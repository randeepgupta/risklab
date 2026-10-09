import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {annualizedOutcomeReturn, modeledReturnRange} from '../src/utils/simulationOutcomes';
import {MonteCarloView} from '../src/components/MonteCarloView';

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

// Zero volatility makes all outcomes deterministic. The input is GBM drift;
// the displayed equivalent CAGR is exp(drift) - 1, not the drift input itself.
const markup = renderToStaticMarkup(<MonteCarloView initialValue={250000} expectedReturn={0.08} volatility={0}
  returnAssumptionSource="Portfolio-weighted historical average" />);
const visibleAssumptions = markup.slice(markup.indexOf('aria-label="Simulation assumptions"'), markup.indexOf('Strong outcome'));
for (const text of ['Average annual return assumption', '8.0%', 'Annual volatility', '0.0%', '10 years', '2,500 paths', 'Portfolio-weighted historical average', 'Monthly steps']) {
  assert.ok(visibleAssumptions.includes(text), `Visible assumptions should include ${text}`);
}
assert.equal(markup.match(/8\.3% annualized return/g)?.length, 3);
for (const text of ['Strong outcome', '95th percentile', '5th percentile', 'no contributions or withdrawals', 'inflation adjustment']) {
  assert.ok(markup.includes(text));
}
const presetMarkup = renderToStaticMarkup(<MonteCarloView initialValue={100000} expectedReturn={-0.04} volatility={0} />);
assert.ok(presetMarkup.includes('-3.9% annualized return'));
assert.ok(presetMarkup.includes('Portfolio-weighted model assumptions'));
// Match the simulation's lognormal distribution, including volatility drag.
const annual = modeledReturnRange(0.08, 0.2, 1);
assert.ok(Math.abs(annual.median - Math.expm1(0.06)) < 1e-12);
assert.ok(annual.low < 0 && annual.high > 0);
const monthly = modeledReturnRange(0.08, 0.2, 1 / 12);
assert.ok(monthly.low > annual.low && monthly.high < annual.high);
assert.ok(Math.abs(Math.pow(1 + monthly.median, 12) - (1 + annual.median)) < 1e-12);
const fixed = modeledReturnRange(-0.04, 0, 1);
assert.equal(fixed.low, fixed.high);
assert.equal(fixed.median, fixed.low);
for (const text of ['Annual growth. Monthly ups and downs.', 'per year, not per month', '90% of modeled outcomes', '5% below', '5% above', 'not a minimum or maximum']) assert.ok(markup.includes(text));
console.log('Future screen assumptions and compound outcome return checks passed.');
