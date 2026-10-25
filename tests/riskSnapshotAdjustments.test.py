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
    assert module.load_tickers(directory) == ['A','SPY','ZZZZ']
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
    covered = ['SPY']+[f'T{i}' for i in range(160)]
    directory.write_text(json.dumps({'capturedAt':'test', 'symbols':[{'ticker':t} for t in covered+['NEW','MISSING','STALE','INVALID']]}))
    def fake_query(sql, **kwargs):
        return [{'date':'2026-10-23'}] if 'SELECT date FROM' in sql else [{'count':0}] if 'COUNT(*)' in sql else []
    def fake_day(day):
        rows = [{'date':str(day), 'act_symbol':t, 'close':100+(day.toordinal()%9)} for t in covered]
        rows += [{'date':str(day), 'act_symbol':'INVALID', 'close':0}]
        if str(day) > '2026-09-01': rows += [{'date':str(day),'act_symbol':'NEW','close':100}]
        if str(day) < '2026-10-01': rows += [{'date':str(day),'act_symbol':'STALE','close':100}]
        return rows
    argv = ['refresh','--directory',str(directory),'--output',str(target),'--workers','1']
    with patch.object(sys, 'argv', argv), patch.object(module, 'query', side_effect=fake_query), patch.object(module, 'download_day', side_effect=fake_day):
        with patch('builtins.print'):
            module.main()
    manifest = json.loads(target.read_text())
    assert manifest['coverage']['covered'] == 161
    assert manifest['coverage']['requested'] == 165
    assert manifest['exclusions'] == {'NEW':'insufficient_history','MISSING':'no_source_history','STALE':'stale_history','INVALID':'invalid_price'}
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
    with patch.object(sys, 'argv', argv), patch.object(module, 'query', side_effect=fake_query), patch.object(module, 'download_day', side_effect=fake_day):
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
