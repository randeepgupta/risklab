import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PortfolioSnapshot} from '../src/components/PortfolioSnapshot';
import {PortfolioSetup} from '../src/components/PortfolioSetup';
import {createRandomSamplePortfolio, SAMPLE_PORTFOLIO_VALUE} from '../src/utils/samplePortfolio';
import {readFileSync} from 'node:fs';
import {applyHistoricalSnapshot, type RiskSnapshot} from '../src/utils/riskSnapshot';
import {ASSET_DATABASE, calculatePortfolioRisk} from '../src/utils/quantEngine';

// Seed only the tests, so repeated button clicks use fresh Math.random draws.
function seededRandom(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const compositions = new Set<string>();
const allocations = new Set<string>();
const seen = new Set<string>();
const counts = new Set<number>();
for (let seed = 1; seed <= 200; seed++) {
  const sample = createRandomSamplePortfolio(seededRandom(seed));
  assert.ok(sample.length >= 4 && sample.length <= 7);
  counts.add(sample.length);
  assert.equal(new Set(sample.map(p => p.ticker)).size, sample.length);
  assert.equal(sample.reduce((sum, p) => sum + p.investment, 0), SAMPLE_PORTFOLIO_VALUE);
  assert.ok(Math.abs(sample.reduce((sum, p) => sum + p.weight, 0) - 1) < 1e-12);
  for (const position of sample) {
    seen.add(position.ticker);
    assert.equal(position.name, ASSET_DATABASE[position.ticker].name);
    assert.equal(position.riskProxyTicker, undefined);
    assert.ok(position.weight >= 0.05);
    assert.ok(Math.abs(position.weight * 100 - Math.round(position.weight * 100)) < 1e-12);
    assert.ok(Math.abs(position.investment / SAMPLE_PORTFOLIO_VALUE - position.weight) < 1e-12);
  }
  assert.ok(Number.isFinite(calculatePortfolioRisk(sample).annualizedVolatility));
  compositions.add(sample.map(p => p.ticker).sort().join(','));
  allocations.add(sample.map(p => p.weight).join(','));
}
assert.equal(counts.size, 4);
assert.equal(seen.size, Object.keys(ASSET_DATABASE).length);
assert.ok(compositions.size > 100);
assert.ok(allocations.size > 100);
console.log('Random sample portfolio checks passed (200 samples).');

const snapshot = JSON.parse(readFileSync(new URL('../public/models/historical-snapshot.json', import.meta.url), 'utf8')) as RiskSnapshot;
for (const part of snapshot.parts || []) Object.assign(snapshot.symbols, JSON.parse(readFileSync(new URL(`../public/models/${part}`, import.meta.url), 'utf8')));
for (let seed = 1; seed <= 20; seed++) {
  const sample = applyHistoricalSnapshot(createRandomSamplePortfolio(seededRandom(seed)), snapshot);
  assert.ok(sample.every(position => position.historicalModel && !position.riskProxyTicker));
  assert.ok(Number.isFinite(calculatePortfolioRisk(sample).annualizedVolatility));
}
console.log('Random samples also support the cached historical models.');

// The introduction must show every holding and derive allocation from the
// invested amounts, even if an imported position's stored weight is stale.
const previewPositions = Array.from({length:7}, (_,i) => ({
  ...createRandomSamplePortfolio(seededRandom(1))[0], ticker:`EX${i}`, name:`Example holding ${i}`,
  investment:i===0 ? 40000 : 10000, weight:0.99,
}));
const previewProps = {positions:previewPositions, isSample:true, loading:false, onEdit:()=>{}, onNewSample:()=>{}};
const preview = renderToStaticMarkup(createElement(PortfolioSnapshot, previewProps));
assert.ok(preview.includes('$100,000'));
assert.ok(preview.includes('40.0%'));
assert.equal(preview.match(/<li /g)?.length,7);
for (const position of previewPositions) assert.ok(preview.includes(position.name));
assert.ok(preview.includes('Try another sample'));
const customPreview = renderToStaticMarkup(createElement(PortfolioSnapshot, {...previewProps,isSample:false}));
assert.ok(!customPreview.includes('Try another sample'), 'custom portfolios must not offer accidental sample replacement');
console.log('Portfolio introduction allocation and complete holdings checks passed.');

const setupProps = {initialPositions:[{...previewPositions[0], weight:1}], initialPortfolioValue:100000,
  historicalTickers:new Set(['EX0']), snapshotAsOf:'2026-10-23', onAnalyze:()=>{}, onUseSample:()=>{}, onRetrySnapshot:()=>{}};
const setup = renderToStaticMarkup(createElement(PortfolioSetup, setupProps));
assert.ok(!setup.includes('type="checkbox"'), 'historical calibration must not be an opt-in decision');
assert.ok(setup.indexOf('Historical data through') > setup.indexOf('Analyze portfolio'), 'data metadata follows the main portfolio task');
const unsupportedSetup = renderToStaticMarkup(createElement(PortfolioSetup, {...setupProps,historicalTickers:new Set<string>()}));
assert.match(unsupportedSetup, /<button[^>]*disabled=""[^>]*>Analyze portfolio/, 'unsupported holdings cannot silently use preset models');
console.log('Historical default, unsupported holding guard, and data detail placement checks passed.');
