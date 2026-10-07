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
