"""Report on committed snapshot inputs without network or AI calls.

This is an automated data-quality report, not independent model validation.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODEL_VERSION = 'historical-conditional-v1'


def load_snapshot(path, parts_dir=None):
    snapshot = json.loads(path.read_text())
    symbols = dict(snapshot['symbols'])
    folder = parts_dir or path.parent
    for name in snapshot.get('parts', []):
        if not re.fullmatch(r'history-[a-f0-9]{16}\.json', name):
            raise ValueError('Invalid snapshot part name')
        content = (folder/name).read_bytes()
        if name != f"history-{hashlib.sha256(content).hexdigest()[:16]}.json":
            raise ValueError('Snapshot part hash mismatch')
        part = json.loads(content)
        if symbols.keys() & part.keys():
            raise ValueError('Duplicate snapshot symbols across parts')
        symbols.update(part)
    if len(symbols) != snapshot.get('coverage', {}).get('covered', len(symbols)):
        raise ValueError('Incomplete snapshot coverage')
    dates = snapshot['dates']
    if len(set(dates)) != len(dates) or dates != sorted(dates):
        raise ValueError('Invalid snapshot dates')
    for symbol in symbols.values():
        if len(symbol['values']) != len(dates) or any(value is not None and (not math.isfinite(value) or value <= 0) for value in symbol['values']):
            raise ValueError('Invalid snapshot price values')
    return {**snapshot, 'symbols':symbols}


def intervals(snapshot, ticker):
    values = snapshot['symbols'][ticker]['values']
    # Match exact observation intervals; a gap must not masquerade as one day.
    points = [(date,value) for date,value in zip(snapshot['dates'], values) if value is not None]
    return {(a,b):y/x-1 for (a,x),(b,y) in zip(points, points[1:])}


def build_report(after, before=None, code_revision=None):
    quality = after.get('dataQuality', {})
    treasury = after.get('treasuryYields', {})
    missing = {ticker:sum(value is None for value in symbol['values']) for ticker,symbol in after['symbols'].items()}
    missing = {ticker:count for ticker,count in missing.items() if count}
    comparison = None
    if before is not None:
        old, new = set(before['symbols']), set(after['symbols'])
        old_q = set(before.get('dataQuality', {}).get('quarantined', {}))
        new_q = set(quality.get('quarantined', {}))
        revised = {}
        for ticker in sorted(old & new):
            a, b = intervals(before,ticker), intervals(after,ticker)
            changes = [(start,end,b[start,end]-a[start,end]) for start,end in a.keys() & b.keys() if abs(b[start,end]-a[start,end]) > 1e-6]
            if changes:
                start,end,change = max(changes,key=lambda item:abs(item[2]))
                revised[ticker] = {'changedIntervals':len(changes),'largestRevision':{'startDate':start,'endDate':end,'returnDifference':change}}
        comparison = {'previousAsOf':before['asOf'],'coverageAdded':sorted(new-old),'coverageRemoved':sorted(old-new),
            'quarantineAdded':sorted(new_q-old_q),'quarantineRemoved':sorted(old_q-new_q),
            'revisedReturns':revised,'reviewedOverridesChanged':before.get('dataQuality',{}).get('reviewedSplitOverrides',[])!=quality.get('reviewedSplitOverrides',[])}
    return {'reportSchemaVersion':1,'modelVersion':MODEL_VERSION,'codeRevision':code_revision,
        'verification':'Automated input screens only; not independent source verification or evidence of forecast accuracy.',
        'snapshot':{key:after.get(key) for key in ['asOf','capturedAt','sourceRevision','coverage']},
        'quality':{'exclusionCounts':dict(sorted(Counter(after.get('exclusions',{}).values()).items())),
            'quarantinedCount':len(quality.get('quarantined',{})),'actionFeeds':quality.get('actionFeeds',{}),
            'cutoffReason':quality.get('cutoffReason'),'reviewedSplitOverrides':quality.get('reviewedSplitOverrides',[]),
            'missingPriceObservations':missing,'quarantined':quality.get('quarantined',{})},
        'treasury':{key:treasury.get(key) for key in ['series','startDate','endDate','observations','source']},
        'comparison':comparison,
        'limitations':quality.get('limitations',[])+['Latest event dates are not completeness guarantees.', 'Return revisions describe changes in observed adjusted returns, not a diagnosis of their cause.']}


def markdown(report):
    s, q, t, c = report['snapshot'],report['quality'],report['treasury'],report['comparison']
    coverage = s.get('coverage') or {}
    lines = ['## Historical model data report','',report['verification'],'',
        f"- Model: `{report['modelVersion']}` · code `{report['codeRevision'] or 'not recorded'}`",
        f"- Price data through **{s['asOf']}** · source revision `{s['sourceRevision'] or 'not recorded'}`",
        f"- Covered holdings: **{coverage.get('covered','unknown')}** / {coverage.get('requested','unknown')}",
        f"- Quarantined extreme-return histories: **{q['quarantinedCount']}**",
        f"- Treasury series: {t['series']} · {t['observations']} observations through {t['endDate']}",
        f"- Holdings with missing price observations: {len(q['missingPriceObservations'])}",
        f"- Cutoff reason: {q['cutoffReason'] or 'none recorded'}",'',
        '| Exclusion reason | Holdings |','| --- | ---: |']
    lines.extend(f'| {reason} | {count} |' for reason,count in q['exclusionCounts'].items())
    if c is None:
        lines += ['', 'No comparison baseline supplied; no claim about changes from the previous snapshot.']
    else:
        lines += ['',f"Compared with data through {c['previousAsOf']}:",'']
        for field,label in [('coverageAdded','Coverage added'),('coverageRemoved','Coverage removed'),('quarantineAdded','New quarantine'),('quarantineRemoved','Left quarantine')]:
            values=c[field]
            examples=', '.join(values[:20]) or 'none'
            lines.append(f"- {label}: {len(values)} ({examples}{'; full list in JSON report' if len(values)>20 else ''})")
        lines += [f"- Holdings with revised overlapping returns: {len(c['revisedReturns'])}",f"- Reviewed override metadata changed: {'yes' if c['reviewedOverridesChanged'] else 'no'}"]
    lines += ['', 'Full details are in the JSON report. These checks do not establish provider completeness or model predictive skill.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--after',type=pathlib.Path,default=ROOT/'public/models/historical-snapshot.json')
    parser.add_argument('--before',type=pathlib.Path)
    parser.add_argument('--before-parts-dir',type=pathlib.Path)
    parser.add_argument('--output',type=pathlib.Path,default=ROOT/'artifacts/risk-model-report.md')
    parser.add_argument('--json-output',type=pathlib.Path,default=ROOT/'artifacts/risk-model-report.json')
    args=parser.parse_args()
    after=load_snapshot(args.after)
    before=load_snapshot(args.before,args.before_parts_dir) if args.before else None
    revision=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,text=True,capture_output=True).stdout.strip() or None
    report=build_report(after,before,revision)
    for path in [args.output,args.json_output]: path.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(markdown(report))
    args.json_output.write_text(json.dumps(report,indent=2)+'\n')
    print(f'Report written: {args.output}')


if __name__=='__main__':main()
