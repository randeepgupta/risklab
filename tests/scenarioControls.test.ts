import assert from 'node:assert/strict';
import {
  createScenarioControls,
  FACTOR_LIMITS,
  scenarioControlsReducer as reduce,
  scenarioFromControls,
} from '../src/utils/scenarioControls';
import type { EditableFactor } from '../src/utils/scenarioControls';
import { ASSET_DATABASE, executeStressTest, PRESET_SCENARIOS } from '../src/utils/quantEngine';
import type { PortfolioPosition, StressScenario } from '../src/types/risk';

let passed = 0;
function test(name: string, run: () => void) {
  try { run(); passed += 1; }
  catch (error) { console.error(`Scenario controls failed: ${name}`); throw error; }
}
function approx(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `Expected ${expected}, got ${actual}`);
}
function position(ticker: string, investment = 25_000): PortfolioPosition {
  const meta = ASSET_DATABASE[ticker];
  return { ticker, name: meta.name, assetClass: meta.assetClass, price: meta.price, investment, weight: 0.25 };
}
const positions = ['SPY', 'QQQM', 'NVDA', 'TSLA'].map(ticker => position(ticker));
const crash = PRESET_SCENARIOS[3];
const snapshot = JSON.stringify(PRESET_SCENARIOS);
const result = (state: ReturnType<typeof createScenarioControls>) => executeStressTest(positions, scenarioFromControls(state));

// Reproduce the screen in the report: broad crash, then change the market slider.
test('all preset outputs are preserved before any user edit', () => {
  for (const preset of PRESET_SCENARIOS) {
    assert.deepEqual(scenarioFromControls(createScenarioControls(preset)), preset);
  }
});
test('market input persists instead of snapping back to preset', () => {
  const state = reduce(createScenarioControls(crash), { type: 'factor', key: 'equityShockPct', value: -10 });
  assert.equal(state.factors.equityShockPct, -10);
  assert.equal(scenarioFromControls(state).factorShocks?.equityShockPct, -10);
  assert.notEqual(result(state).dollarLoss, result(createScenarioControls(crash)).dollarLoss);
});
test('repeated drag events keep the last entered value', () => {
  let state = createScenarioControls(crash);
  for (const value of [-33, -32, -25, -10, 0, 15]) {
    state = reduce(state, { type: 'factor', key: 'equityShockPct', value });
    assert.equal(state.factors.equityShockPct, value);
  }
  assert.equal(scenarioFromControls(state).factorShocks?.equityShockPct, 15);
});
test('editing one market field does not reset the others', () => {
  let state = createScenarioControls(crash);
  state = reduce(state, { type: 'factor', key: 'rateChangeBps', value: 100 });
  state = reduce(state, { type: 'factor', key: 'techShockPct', value: -10 });
  state = reduce(state, { type: 'factor', key: 'semiShockPct', value: -20 });
  assert.equal(state.factors.rateChangeBps, 100);
  assert.equal(state.factors.techShockPct, -10);
  assert.equal(state.factors.semiShockPct, -20);
  assert.equal(state.factors.equityShockPct, -34);
});
test('all four market controls affect the calculation for an exposed portfolio', () => {
  const state = reduce(createScenarioControls(crash), { type: 'use-factors' });
  const before = result(state).dollarLoss;
  for (const key of Object.keys(FACTOR_LIMITS) as EditableFactor[]) {
    const updated = reduce(state, { type: 'factor', key, value: state.factors[key] + (key === 'rateChangeBps' ? 25 : 5) });
    assert.notEqual(result(updated).dollarLoss, before, `${key} must reach the engine`);
  }
});
test('market edits remove implicit preset holding overrides', () => {
  const state = reduce(createScenarioControls(crash), { type: 'factor', key: 'equityShockPct', value: -10 });
  assert.deepEqual(scenarioFromControls(state).tickerShocks, {});
});
test('holding slider keeps its value and changes only that holding', () => {
  const original = createScenarioControls(crash);
  const updated = reduce(original, { type: 'ticker', ticker: 'NVDA', value: -0.50 });
  approx(result(updated).attributions.find(a => a.ticker === 'NVDA')!.shockPct, -0.50);
  for (const ticker of ['SPY', 'QQQM', 'TSLA']) {
    approx(result(updated).attributions.find(a => a.ticker === ticker)!.shockPct, crash.tickerShocks[ticker]);
  }
  approx(result(updated).dollarLoss - result(original).dollarLoss, 25_000 * 0.18);
});
test('multiple holding edits are retained independently', () => {
  let state = createScenarioControls(crash);
  state = reduce(state, { type: 'ticker', ticker: 'SPY', value: -0.1 });
  state = reduce(state, { type: 'ticker', ticker: 'QQQM', value: -0.2 });
  assert.equal(scenarioFromControls(state).tickerShocks.SPY, -0.1);
  assert.equal(scenarioFromControls(state).tickerShocks.QQQM, -0.2);
});
test('intentional manual override survives market changes', () => {
  let state = createScenarioControls(crash);
  state = reduce(state, { type: 'ticker', ticker: 'SPY', value: -0.1 });
  state = reduce(state, { type: 'factor', key: 'equityShockPct', value: -5 });
  assert.deepEqual(scenarioFromControls(state).tickerShocks, { SPY: -0.1 });
  approx(result(state).attributions.find(a => a.ticker === 'SPY')!.shockPct, -0.1);
});
test('reset one holding restores current model result', () => {
  let model = reduce(createScenarioControls(crash), { type: 'factor', key: 'techShockPct', value: -10 });
  let edited = reduce(model, { type: 'ticker', ticker: 'NVDA', value: -0.9 });
  edited = reduce(edited, { type: 'reset-ticker', ticker: 'NVDA' });
  assert.deepEqual(result(edited), result(model));
});
test('reset last holding edit returns exact preset before market edits', () => {
  let state = reduce(createScenarioControls(crash), { type: 'ticker', ticker: 'SPY', value: -0.1 });
  state = reduce(state, { type: 'reset-ticker', ticker: 'SPY' });
  assert.equal(state.edited, false);
  assert.deepEqual(scenarioFromControls(state), crash);
});
test('use market assumptions clears all fixed holding values', () => {
  let state = reduce(createScenarioControls(crash), { type: 'ticker', ticker: 'SPY', value: -0.1 });
  state = reduce(state, { type: 'use-factors' });
  assert.deepEqual(state.tickerOverrides, {});
  assert.deepEqual(scenarioFromControls(state).tickerShocks, {});
  assert.ok(state.usingFactors);
});
test('reset scenario restores original values after both edit types', () => {
  let state = reduce(createScenarioControls(crash), { type: 'factor', key: 'rateChangeBps', value: 150 });
  state = reduce(state, { type: 'ticker', ticker: 'NVDA', value: -0.80 });
  state = reduce(state, { type: 'reset' });
  assert.deepEqual(scenarioFromControls(state), crash);
});
test('selecting even the same preset reloads it and discards edits', () => {
  let state = reduce(createScenarioControls(crash), { type: 'ticker', ticker: 'TSLA', value: -0.80 });
  state = reduce(state, { type: 'load', scenario: crash });
  assert.deepEqual(scenarioFromControls(state), crash);
});
test('direct-only template cannot inherit factors from previous selection', () => {
  let state = reduce(createScenarioControls(crash), { type: 'factor', key: 'rateChangeBps', value: 250 });
  state = reduce(state, { type: 'load', scenario: PRESET_SCENARIOS[0] });
  assert.equal(state.factors.rateChangeBps, 0);
  assert.equal(state.factors.equityShockPct, 0);
  assert.equal(scenarioFromControls(state).factorShocks, undefined);
});
test('missing direct shock is not silently replaced by a zero override', () => {
  const source: StressScenario = { ...crash, tickerShocks: { SPY: -0.34 } };
  let state = createScenarioControls(source);
  const before = executeStressTest([position('BND')], scenarioFromControls(state));
  state = reduce(state, { type: 'ticker', ticker: 'SPY', value: -0.1 });
  const after = executeStressTest([position('BND')], scenarioFromControls(state));
  assert.notEqual(before.attributions[0].shockPct, 0);
  approx(after.attributions[0].shockPct, before.attributions[0].shockPct);
});
test('AI factors are editable without becoming fixed holding shocks', () => {
  const source: StressScenario = { ...crash, category: 'ai_generated', tickerShocks: {} };
  let state = reduce(createScenarioControls(source), { type: 'factor', key: 'semiShockPct', value: -60 });
  assert.equal(scenarioFromControls(state).factorShocks?.semiShockPct, -60);
  assert.deepEqual(scenarioFromControls(state).tickerShocks, {});
});
test('zero is a deliberate holding override, not a missing value', () => {
  const state = reduce(createScenarioControls(crash), { type: 'ticker', ticker: 'NVDA', value: 0 });
  approx(result(state).attributions.find(a => a.ticker === 'NVDA')!.shockPct, 0);
});
test('invalid and non-finite input is rejected', () => {
  const state = createScenarioControls(crash);
  assert.equal(reduce(state, { type: 'factor', key: 'equityShockPct', value: NaN }), state);
  assert.equal(reduce(state, { type: 'ticker', ticker: 'SPY', value: Infinity }), state);
  assert.equal(reduce(state, { type: 'ticker', ticker: '__proto__', value: -0.1 }), state);
});
test('slider bounds are enforced without changing other assumptions', () => {
  let state = createScenarioControls(crash);
  state = reduce(state, { type: 'factor', key: 'rateChangeBps', value: 9000 });
  assert.equal(state.factors.rateChangeBps, 1000);
  state = reduce(state, { type: 'ticker', ticker: 'spy', value: -2 });
  assert.equal(state.tickerOverrides.SPY, -1);
  state = reduce(state, { type: 'ticker', ticker: 'SPY', value: 4 });
  assert.equal(state.tickerOverrides.SPY, 3);
});
test('volatility context is preserved, not injected into spot returns', () => {
  const first = reduce(createScenarioControls(crash), { type: 'use-factors' });
  const alternate = { ...first, factors: { ...first.factors, vixSpikePct: 0 } };
  assert.equal(first.factors.vixSpikePct, 300);
  approx(result(first).dollarLoss, result(alternate).dollarLoss);
});
test('all operations leave the global presets untouched', () => {
  assert.equal(JSON.stringify(PRESET_SCENARIOS), snapshot);
});
console.log(`Scenario control regression checks passed (${passed} cases).`);
