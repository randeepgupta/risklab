import importlib.util, pathlib, sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('refresh', pathlib.Path(__file__).resolve().parents[1]/'scripts/refresh-risk-snapshot.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
# A 2-for-1 split plus a dividend is not a 50% drawdown.
prices = [('2026-01-01',100),('2026-01-02',50),('2026-01-03',49)]
values = module.adjusted_index('TEST',prices,{('TEST','2026-01-03'):1},{('TEST','2026-01-02'):2})
assert list(values.values()) == [100,100,100]
# Dividend reinvestment and price gain contribute to total return.
values = module.adjusted_index('TEST',[('2026-01-01',100),('2026-01-02',105)],{('TEST','2026-01-02'):2},{})
assert values['2026-01-02'] == 107
# Reverse splits also preserve the value of an unchanged investment.
values = module.adjusted_index('TEST',[('2026-01-01',10),('2026-01-02',100)],{},{('TEST','2026-01-02'):.1})
assert values['2026-01-02'] == 100
print('Split and dividend adjustment checks passed.')

import json, tempfile
from unittest.mock import patch
# Full directory replaces the former fixed allowlist; benchmark always included.
with tempfile.TemporaryDirectory() as temp:
    directory = pathlib.Path(temp)/'symbols.json'
    directory.write_text(json.dumps({'symbols':[{'ticker':'ZZZZ'},{'ticker':'A'},{'ticker':'ZZZZ'}]}))
    assert module.load_tickers(directory) == ['A','QQQM','SMH','SPY','ZZZZ']
# API row caps cannot silently cut off large daily downloads.
with patch.object(module, 'PAGE_SIZE', 2), patch.object(module, 'query', side_effect=[[{'x':1},{'x':2}],[{'x':3}]]) as request:
    assert module.paged_query('SELECT x FROM prices', 'x') == [{'x':1},{'x':2},{'x':3}]
    assert request.call_args_list[1].args[0].endswith('LIMIT 2 OFFSET 2')
with patch.object(module, 'PAGE_SIZE', 2), patch.object(module, 'query', side_effect=[[1,2], ValueError('source incomplete')]):
    try:
        module.paged_query('SELECT x FROM prices', 'x')
        raise AssertionError('Partial pages must fail the refresh')
    except ValueError:
        pass
# Shards remain bounded and the manifest references reproducible content hashes.
with tempfile.TemporaryDirectory() as temp:
    target = pathlib.Path(temp)/'historical-snapshot.json'
    symbols = {ticker:{'values':[100,101], 'price':101, 'priceAsOf':'2026-01-02'} for ticker in ['SPY']+[f'T{i}' for i in range(1001)]}
    snapshot = {'symbols':symbols, 'dates':['2026-01-01','2026-01-02']}
    module.publish_snapshot(snapshot, target)
    manifest = json.loads(target.read_text())
    assert len(manifest['parts']) == 3
    merged = dict(manifest['symbols'])
    for name in manifest['parts']:
        content = (target.parent/name).read_text()
        assert module.hashlib.sha256(content.encode()).hexdigest()[:16] in name
        part = json.loads(content)
        assert len(part) <= 500
        merged.update(part)
    assert merged == symbols
    previous = target.read_bytes()
    with patch.object(module.os, 'replace', side_effect=OSError('disk full')):
        try:
            module.publish_snapshot(snapshot, target)
            raise AssertionError('Publication must fail')
        except OSError:
            pass
    assert target.read_bytes() == previous
print('Full-directory batching, pagination, and atomic sharded publication checks passed.')
# Daily aggregates must prove completeness, including empty market holidays.
with patch.object(module, 'query', return_value=[{'prices':'{"A":100,"SPY":200}', 'count':2}]):
    assert module.download_day('2026-01-02') == [{'date':'2026-01-02','act_symbol':'A','close':100},{'date':'2026-01-02','act_symbol':'SPY','close':200}]
with patch.object(module, 'query', return_value=[{'prices':None, 'count':0}]):
    assert module.download_day('2026-01-01') == []
with patch.object(module, 'query', return_value=[{'prices':'{"A":100}', 'count':2}]):
    try:
        module.download_day('2026-01-02')
        raise AssertionError('Incomplete aggregates must be rejected')
    except ValueError:
        pass
assert module.matched_intervals([100,None,101,102], ['a','b','c','d']) == {('a','c'),('c','d')}
print('Aggregate completeness and benchmark interval checks passed.')
# Exercise the actual command: eligible tickers expand, exclusions are explicit,
# and failed requests or coverage regressions cannot replace a published batch.
with tempfile.TemporaryDirectory() as temp:
    directory = pathlib.Path(temp)/'directory.json'
    target = pathlib.Path(temp)/'historical-snapshot.json'
    covered = sorted(module.REQUIRED_REFERENCES)+[f'T{i}' for i in range(160)]
    directory.write_text(json.dumps({'capturedAt':'test', 'symbols':[{'ticker':t} for t in covered+['NEW','MISSING','STALE','INVALID','SPIKE']]}))
    def fake_query(sql, **kwargs):
        if 'DOLT_HASHOF' in sql: return [{'revision':'0'*32}]
        if 'SELECT date FROM' in sql: return [{'date':'2026-10-23'}]
        if 'MAX(ex_date)' in sql: return [{'latest':'2026-10-23'}]
        return [{'count':0}] if 'COUNT(*)' in sql else []
    def fake_treasury(dates):
        return {'series':'DGS10','source':'fixture','units':'percent','values':[4+i*.0001 for i in range(len(dates))]}
    def fake_day(day):
        rows = [{'date':str(day), 'act_symbol':t, 'close':100+(day.toordinal()%9)} for t in covered]
        rows += [{'date':str(day), 'act_symbol':'INVALID', 'close':0}, {'date':str(day),'act_symbol':'SPIKE','close':1000 if str(day)=='2026-02-02' else 100}]
        if str(day) > '2026-09-01': rows += [{'date':str(day),'act_symbol':'NEW','close':100}]
        if str(day) < '2026-10-01': rows += [{'date':str(day),'act_symbol':'STALE','close':100}]
        return rows
    argv = ['refresh','--directory',str(directory),'--output',str(target),'--workers','1']
    with patch.object(sys, 'argv', argv), patch.object(module, 'query', side_effect=fake_query), patch.object(module, 'download_day', side_effect=fake_day), patch.object(module, 'load_treasury_yields', side_effect=fake_treasury):
        with patch('builtins.print'):
            module.main()
    manifest = json.loads(target.read_text())
    assert manifest['coverage']['covered'] == 163
    assert manifest['coverage']['requested'] == 168
    assert manifest['exclusions'] == {'NEW':'insufficient_history','MISSING':'no_source_history','STALE':'stale_history','INVALID':'invalid_price','SPIKE':'unverified_extreme_return'}
    assert manifest['dataQuality']['quarantined']['SPIKE']['return'] == 9
    assert manifest['sourceRevision'] == '0'*32
    assert manifest['treasuryYields']['units'] == 'percent'
    previous = target.read_bytes()
    with patch.object(sys, 'argv', argv), patch.object(module, 'query', side_effect=OSError('source down')):
        try:
            with patch('builtins.print'):
                module.main()
            raise AssertionError('Network failure must fail')
        except OSError:
            pass
    assert target.read_bytes() == previous
    inflated = {**manifest, 'coverage':{**manifest['coverage'], 'covered':1000}}
    target.write_text(json.dumps(inflated))
    previous = target.read_bytes()
    with patch.object(sys, 'argv', argv), patch.object(module, 'query', side_effect=fake_query), patch.object(module, 'download_day', side_effect=fake_day), patch.object(module, 'load_treasury_yields', side_effect=fake_treasury):
        try:
            with patch('builtins.print'):
                module.main()
            raise AssertionError('Coverage regression must fail')
        except ValueError as error:
            assert 'Coverage fell' in str(error)
    assert target.read_bytes() == previous
print('Batch command coverage, exclusions, and last-good-snapshot checks passed.')

with patch.object(module, 'PAGE_SIZE', 2), patch.object(module, 'query', side_effect=[[1,2],[3]]):
    assert module.paged_query('SELECT * FROM dividend', 'date', expected_count=3, workers=1) == [1,2,3]
with patch.object(module, 'query', return_value=[]):
    try:
        module.paged_query('SELECT * FROM dividend', 'date', expected_count=3, workers=1)
        raise AssertionError('Corporate-action truncation must fail')
    except ValueError:
        pass
print('Parallel corporate-action pagination checks passed.')
# Malformed source actions exclude only the affected security. Never silently
# treat an unknown adjustment as an unadjusted price, or divide by zero.
rows = {'dividend':[{'act_symbol':'GOOD','ex_date':'2026-01-02','amount':'1.25'}, {'act_symbol':'BAD_DIV','ex_date':'2026-01-02','amount':'NaN'}],
        'split':[{'act_symbol':'GOOD','ex_date':'2026-01-02','to_factor':'2','for_factor':'1'}, {'act_symbol':'BAD_SPLIT','ex_date':'2026-01-02','to_factor':'1','for_factor':'0'}, {'act_symbol':'UNREQUESTED','ex_date':'2026-01-02','to_factor':'1','for_factor':'0'}]}
dividends, splits, invalid = module.corporate_actions(rows, {'GOOD','BAD_DIV','BAD_SPLIT'})
assert dividends == {('GOOD','2026-01-02'):1.25}
assert splits == {('GOOD','2026-01-02'):2}
assert invalid == {'BAD_DIV','BAD_SPLIT'}
print('Invalid corporate-action isolation checks passed.')

# A new master revision must never reuse a response cached for an older commit.
import io, urllib.parse
with tempfile.TemporaryDirectory() as temp:
    calls = []
    def public_response(url, **kwargs):
        calls.append(url)
        return io.StringIO(json.dumps({'query_execution_status':'Success','rows':[{'value':len(calls)}]}))
    with patch.object(module.tempfile,'gettempdir',return_value=temp), patch.object(module.urllib.request,'urlopen',side_effect=public_response), patch.object(module,'SOURCE_REVISION','a'*32):
        assert module.query('SELECT close FROM ohlcv') == [{'value':1}]
        assert module.query('SELECT close FROM ohlcv') == [{'value':1}]
        module.SOURCE_REVISION = 'b'*32
        assert module.query('SELECT close FROM ohlcv') == [{'value':2}]
        assert len(calls) == 2
        assert "AS OF '"+'b'*32+"'" in urllib.parse.parse_qs(urllib.parse.urlparse(calls[-1]).query)['q'][0]
print('Immutable-revision cache isolation checks passed.')

# Observed action dates are conservative screening inputs, never a claimed
# completeness watermark. A lagged feed caps the analysis date; a missing feed fails.
cutoff, lag = module.analysis_cutoff('2026-10-23', {'dividend':'2026-10-16','split':'2026-10-16'})
assert cutoff == '2026-10-16' and lag == {'dividend':5,'split':5}
assert module.analysis_cutoff('2026-10-23', {'dividend':'2026-10-23','split':'2026-10-23'})[0] == '2026-10-23'
try:
    module.analysis_cutoff('2026-10-23', {'dividend':None,'split':'2026-10-23'})
    raise AssertionError('Missing corporate-action feeds must fail')
except ValueError:
    pass

# These two issuer-confirmed reverse splits must not become +5,000% daily gains.
splits = {}
reviewed = module.apply_split_overrides(splits, '2026-10-01', '2026-10-23')
assert all(row['source'].startswith('https://') for row in reviewed)
assert splits[('AMTD','2026-10-19')] == 1/60
assert splits[('DKI','2026-10-22')] == 1/50
for ticker,date,before,after in [('AMTD','2026-10-19',.4979,28.5),('DKI','2026-10-22',.0399,2.25)]:
    values = module.adjusted_index(ticker, [('2026-10-16',before),(date,after)], {}, splits)
    assert not module.extreme_returns(values)
try:
    module.apply_split_overrides({('AMTD','2026-10-19'):2}, '2026-10-01','2026-10-23')
    raise AssertionError('Contradictory source adjustments must fail')
except ValueError:
    pass
raw = {'2026-01-01':100,'2026-01-02':200}
assert module.extreme_returns(raw)[0]['return'] == 1
assert raw['2026-01-02'] == 200, 'genuine extreme moves must be reviewed, never silently capped'
print('Corporate-action lag, reviewed overrides, and quarantine checks passed.')

# Treasury yields retain percent units and nulls; no interpolation across holidays.
dates = [(module.dt.date(2026,1,1)+module.dt.timedelta(days=i)).isoformat() for i in range(130)]
text = 'observation_date,DGS10\n'+'\n'.join(f"{date},{'' if i==20 else 4+i*.001}" for i,date in enumerate(dates))
yields = module.parse_treasury_csv(text, dates, 'fixture')
assert yields['values'][20] is None and yields['values'][0] == 4
assert yields['units'] == 'percent' and yields['observations'] == 129
assert len(yields['values']) == len(dates)
for invalid in [text.replace('4.0','nan',1), 'DATE,UNKNOWN\n2026-01-01,4']:
    try:
        module.parse_treasury_csv(invalid, dates, 'fixture')
        raise AssertionError('Malformed Treasury source must fail')
    except ValueError:
        pass
try:
    module.parse_treasury_csv('observation_date,DGS10\n2026-01-01,4\n', dates, 'fixture')
    raise AssertionError('Insufficient Treasury source must fail')
except ValueError:
    pass
print('Official Treasury CSV validation and alignment checks passed.')
