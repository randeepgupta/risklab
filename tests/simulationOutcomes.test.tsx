import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {annualizedOutcomeReturn, annualReturnToDrift, benchmarkDifferenceLabel, modeledReturnRange, SPY_RETURN_BENCHMARK} from '../src/utils/simulationOutcomes';
import {MonteCarloView} from '../src/components/MonteCarloView';
import {runMonteCarloSimulation} from '../src/utils/quantEngine';
import {readFileSync} from 'node:fs';

// The user's example values must be explained by equivalent compound growth.
for (const endingValue of [1650000, 800000, 100000, 250000]) {
  const rate = annualizedOutcomeReturn(250000, endingValue, 10)!;
  assert.ok(Math.abs(250000 * Math.pow(1 + rate, 10) - endingValue) < 1e-6);
}
assert.equal(annualizedOutcomeReturn(250000, 0, 10), -1);
assert.equal(annualizedOutcomeReturn(0, 800000, 10), null);
assert.equal(annualizedOutcomeReturn(250000, 800000, 0), null);
assert.equal(annualizedOutcomeReturn(250000, -1, 10), null);
assert.equal(annualizedOutcomeReturn(250000, Infinity, 10), null);
assert.ok(Math.abs(annualizedOutcomeReturn(250000, 1650000, 10)! * 100 - 20.77) < 0.01);
assert.ok(Math.abs(annualizedOutcomeReturn(250000, 800000, 10)! * 100 - 12.33) < 0.01);

// Future growth is an independent scenario assumption, not the historical mean.
// At zero volatility the historical benchmark compounds at exactly its CAGR.
const markup = renderToStaticMarkup(<MonteCarloView initialValue={250000} volatility={0}
  volatilitySource="Estimated from historical prices and correlations" />);
assert.ok(markup.indexOf('Strong outcome') < markup.indexOf('aria-label="Simulation assumptions"'), 'Lead with outcomes before assumptions');
const visibleAssumptions = markup.slice(markup.indexOf('aria-label="Simulation assumptions"'), markup.indexOf('aria-label="Understanding returns"'));
for (const text of ['Annual compound growth assumption', '15.18%', 'Annual volatility', '0.0%', '10 years', '2,500 paths', 'Estimated from historical prices and correlations', 'Monthly steps', 'Choose annual compound growth', 'not a forecast', 'recent returns are not projected forward', 'September 30, 2026', 'dividends reinvested', 'Reset to SPY benchmark', 'Source: State Street SPY performance']) {
  assert.ok(visibleAssumptions.includes(text), `Visible assumptions should include ${text}`);
}
assert.equal(markup.match(/15\.2% annualized return/g)?.length, 3);
for (const text of ['Strong outcome', '95th percentile', '5th percentile', 'no contributions or withdrawals', 'inflation adjustment']) {
  assert.ok(markup.includes(text));
}
for (const rate of [-0.1, 0, 0.07, 0.2]) {
  const simulation = runMonteCarloSimulation(250000, annualReturnToDrift(rate), 0, 10, 20);
  assert.ok(Math.abs(simulation.terminalStats.median / (250000 * (1 + rate) ** 10) - 1) < 1e-12);
  assert.ok(Math.abs(annualizedOutcomeReturn(250000, simulation.terminalStats.median, 10)! - rate) < 1e-12);
}
assert.throws(() => annualReturnToDrift(-1));
assert.throws(() => annualReturnToDrift(NaN));
assert.throws(() => annualReturnToDrift(0.1, -0.2));
assert.equal(benchmarkDifferenceLabel(SPY_RETURN_BENCHMARK.annualReturn), 'Matches SPY’s historical 10-year return');
assert.ok(benchmarkDifferenceLabel(0.1).startsWith('5.18 percentage points below'));
assert.ok(benchmarkDifferenceLabel(0.2).startsWith('4.82 percentage points above'));
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const futureView = appSource.slice(appSource.indexOf('<MonteCarloView'), appSource.indexOf('/>', appSource.indexOf('<MonteCarloView')));
assert.ok(!futureView.includes('expectedAnnualReturn'), 'Future must not receive the recent historical return');
// CAGR sets median log-growth; changing volatility widens the range.
const annual = modeledReturnRange(0.08, 0.2, 1);
assert.ok(Math.abs(annual.median - 0.08) < 1e-12);
assert.ok(annual.low < 0 && annual.high > 0);
const monthly = modeledReturnRange(0.08, 0.2, 1 / 12);
assert.ok(monthly.low > annual.low && monthly.high < annual.high);
assert.ok(Math.abs(Math.pow(1 + monthly.median, 12) - (1 + annual.median)) < 1e-12);
const fixed = modeledReturnRange(-0.04, 0, 1);
assert.equal(fixed.low, fixed.high);
assert.equal(fixed.median, fixed.low);
const riskyBenchmark = modeledReturnRange(SPY_RETURN_BENCHMARK.annualReturn, 0.4, 10);
assert.ok(Math.abs(annualizedOutcomeReturn(1, 1 + riskyBenchmark.median, 10)! - SPY_RETURN_BENCHMARK.annualReturn) < 1e-12);
const saferBenchmark = modeledReturnRange(SPY_RETURN_BENCHMARK.annualReturn, 0.1, 10);
assert.ok(riskyBenchmark.low < saferBenchmark.low && riskyBenchmark.high > saferBenchmark.high);
assert.ok(Math.abs(riskyBenchmark.median - saferBenchmark.median) < 1e-12);
for (const text of ['Annual growth. Monthly ups and downs.', 'per year, not per month', '90% of modeled outcomes', '5% below', '5% above', 'not a minimum or maximum']) assert.ok(markup.includes(text));
console.log('Future screen assumptions and compound outcome return checks passed.');
