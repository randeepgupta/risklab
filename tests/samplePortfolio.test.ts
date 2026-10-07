import assert from 'node:assert/strict';
import {createRandomSamplePortfolio, SAMPLE_PORTFOLIO_VALUE} from '../src/utils/samplePortfolio';
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
