import assert from 'node:assert/strict';
import {buildSectorExposure} from '../src/utils/sectorExposure';
import type {PortfolioPosition} from '../src/types/risk';

const position = (ticker: string, investment: number, riskProxyTicker?: string): PortfolioPosition => ({
  ticker, investment, riskProxyTicker, name: ticker, assetClass: 'Tech Mega', weight: 0.99, price: 0,
});
const groups = buildSectorExposure([
  position('NVDA', 300), position('MSFT', 100), position('QQQM', 200),
  position('SPY', 200), position('AMZN', 100), position('UNKNOWN', 100, 'NVDA'),
]);
assert.equal(groups.find(g => g.label === 'Technology')?.percent, 40);
assert.equal(groups.find(g => g.label === 'Nasdaq-100 funds')?.kind, 'fund');
assert.equal(groups.find(g => g.label === 'Broad US equity funds')?.percent, 20);
assert.equal(groups.find(g => g.label === 'Consumer discretionary')?.percent, 10);
assert.equal(groups.find(g => g.kind === 'unknown')?.percent, 10);
assert.equal(groups.reduce((sum, g) => sum + g.percent, 0), 100);
assert.deepEqual(buildSectorExposure([]), []);
assert.deepEqual(buildSectorExposure([position('NVDA', NaN), position('SPY', -1)]), []);
assert.equal(buildSectorExposure([position('xlv', 10)])[0].label, 'Health care');
assert.equal(buildSectorExposure([position('TSLA', 10)])[0].label, 'Consumer discretionary');
assert.equal(buildSectorExposure([position('GOOGL', 10)])[0].label, 'Communication services');
console.log('Position-level sector grouping and incomplete-coverage checks pass.');
