// Also exercise the UI scenario-state logic against the actual stress engine.
import './scenarioControls.test';
import assert from 'node:assert/strict';
import {
  ASSET_DATABASE,
  blackScholes,
  buildCorrelationMatrix,
  calculateHedgingStrategies,
  calculatePortfolioRisk,
  executeStressTest,
} from '../src/utils/quantEngine';
import type { PortfolioPosition, StressScenario } from '../src/types/risk';

function approx(actual: number, expected: number, tolerance: number, message: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function choleskyPsd(matrix: number[][], tolerance = 1e-7): boolean {
  const n = matrix.length;
  const l = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k++) sum -= l[i][k] * l[j][k];
      if (i === j) {
        if (sum < -tolerance) return false;
        l[i][j] = Math.sqrt(Math.max(0, sum));
      } else if (Math.abs(l[j][j]) > tolerance) {
        l[i][j] = sum / l[j][j];
      } else if (Math.abs(sum) > tolerance) {
        return false;
      }
    }
  }
  return true;
}

function position(ticker: string, investment: number): PortfolioPosition {
  const meta = ASSET_DATABASE[ticker];
  if (!meta) throw new Error(`Missing test asset ${ticker}`);
  return {
    ticker,
    name: meta.name,
    assetClass: meta.assetClass,
    investment,
    weight: 0,
    price: meta.price,
  };
}

// 1) Correlation matrix is valid after PSD projection.
{
  const tickers = Object.keys(ASSET_DATABASE);
  const { matrix } = buildCorrelationMatrix(tickers);
  assert.equal(matrix.length, tickers.length);
  for (let i = 0; i < matrix.length; i++) {
    approx(matrix[i][i], 1, 1e-10, 'Correlation diagonal must equal 1');
    for (let j = 0; j < matrix.length; j++) {
      approx(matrix[i][j], matrix[j][i], 1e-10, 'Correlation matrix must be symmetric');
      assert.ok(matrix[i][j] >= -1 && matrix[i][j] <= 1, 'Correlation must be in [-1, 1]');
    }
  }
  assert.ok(choleskyPsd(matrix), 'Projected correlation matrix must be positive semidefinite');
}

// 2) Risk contribution decomposition sums to portfolio volatility contribution (100%).
{
  const positions = [position('SPY', 60_000), position('QQQM', 25_000), position('TLT', 15_000)];
  const metrics = calculatePortfolioRisk(positions);
  const contributionSum = metrics.riskContributions.reduce((sum, item) => sum + item.percentRiskContribution, 0);
  approx(contributionSum, 1, 1e-8, 'Risk contributions should sum to 100%');
  assert.ok(metrics.annualizedVariance >= 0, 'Portfolio variance must be non-negative');
  assert.ok(Number.isFinite(metrics.sortinoRatio), 'Sortino ratio must be finite');
}

// 3) Parametric tail-risk metrics are monotonic and CVaR >= VaR.
{
  const metrics = calculatePortfolioRisk([position('SPY', 70_000), position('QQQM', 30_000)]);
  assert.ok(metrics.var99_1d > metrics.var95_1d, '99% daily VaR should exceed 95% daily VaR');
  assert.ok(metrics.var99_10d > metrics.var95_10d, '99% 10-day VaR should exceed 95% 10-day VaR');
  assert.ok(metrics.var99_1y > metrics.var95_1y, '99% annual VaR should exceed 95% annual VaR');
  assert.ok(metrics.cvar95_1d >= metrics.var95_1d, '95% daily CVaR should be >= VaR');
  assert.ok(metrics.cvar99_10d >= metrics.var99_10d, '99% 10-day CVaR should be >= VaR');
  assert.ok(metrics.cvar99_1y >= metrics.var99_1y, '99% annual CVaR should be >= VaR');
  assert.ok(metrics.var95_10d > metrics.var95_1d, '10-day VaR should exceed 1-day VaR for this portfolio');
}

// 4) Duration sign convention: falling yields lift a positive-duration bond; rising yields hurt it.
{
  const base: StressScenario = {
    id: 'rates-only',
    name: 'Rates only',
    description: 'Rates-only unit test',
    category: 'macro_factor',
    tickerShocks: {},
    factorShocks: {
      equityShockPct: 0,
      rateChangeBps: -100,
      vixSpikePct: 0,
      semiShockPct: 0,
      techShockPct: 0,
    },
  };

  const cut = executeStressTest([position('TLT', 100_000)], base);
  approx(cut.attributions[0].shockPct, 0.168, 1e-10, '100 bps rate cut should lift TLT by duration approximation');

  const hike: StressScenario = {
    ...base,
    factorShocks: { ...base.factorShocks!, rateChangeBps: 100 },
  };
  const up = executeStressTest([position('TLT', 100_000)], hike);
  approx(up.attributions[0].shockPct, -0.168, 1e-10, '100 bps rate hike should hurt TLT by duration approximation');
}

// 5) Direct ticker shock overrides factor model.
{
  const scenario: StressScenario = {
    id: 'override',
    name: 'Override',
    description: 'Direct shock wins',
    category: 'macro_factor',
    tickerShocks: { SPY: -0.12 },
    factorShocks: {
      equityShockPct: -50,
      rateChangeBps: 0,
      vixSpikePct: 200,
      semiShockPct: -60,
      techShockPct: -50,
    },
  };
  const result = executeStressTest([position('SPY', 100_000)], scenario);
  approx(result.attributions[0].shockPct, -0.12, 1e-12, 'Direct ticker shock should override factor calculation');
}

// 6) Hierarchical factor shocks do not double-count identical market/sector shocks,
// and a VIX-only change does not mechanically subtract from spot P&L.
{
  const sameShock: StressScenario = {
    id: 'same-shock',
    name: 'Same shock',
    description: 'Market and sector shocks are identical',
    category: 'macro_factor',
    tickerShocks: {},
    factorShocks: {
      equityShockPct: -20,
      rateChangeBps: 0,
      vixSpikePct: 200,
      semiShockPct: -20,
      techShockPct: -20,
    },
  };
  const qqqm = executeStressTest([position('QQQM', 100_000)], sameShock);
  approx(qqqm.attributions[0].shockPct, -0.256, 1e-12, 'Equal sector shocks should reduce to beta-adjusted market shock');

  const vixOnly: StressScenario = {
    ...sameShock,
    factorShocks: {
      equityShockPct: 0,
      rateChangeBps: 0,
      vixSpikePct: 250,
      semiShockPct: 0,
      techShockPct: 0,
    },
  };
  const spot = executeStressTest([position('SPY', 100_000)], vixOnly);
  approx(spot.attributions[0].shockPct, 0, 1e-12, 'VIX context should not be double-counted into spot returns');
}

// 7) Hedging output no longer invents a fixed floor for put spreads / beta overlays.
{
  const strategies = calculateHedgingStrategies(100_000, 0.25);
  const spread = strategies.find(s => s.strategyType === 'put_spread');
  const inverse = strategies.find(s => s.strategyType === 'inverse_beta');
  const collar = strategies.find(s => s.strategyType === 'collar');
  assert.equal(spread?.protectionFloorDollar, undefined, 'Put spread should not claim a guaranteed floor');
  assert.equal(inverse?.protectionFloorDollar, undefined, 'Beta overlay should not claim a guaranteed floor');
  assert.ok(collar && Number.isFinite(collar.costDollar), 'Collar premium should remain a signed debit/credit');
}

// 8) Unspecified assets in a direct-shock scenario are unchanged rather than
// receiving an arbitrary fallback loss.
{
  const scenario: StressScenario = {
    id: 'partial-direct',
    name: 'Partial direct shocks',
    description: 'Only SPY is explicitly shocked',
    category: 'preset',
    tickerShocks: { SPY: -0.2 },
  };
  const result = executeStressTest([position('BND', 100_000)], scenario);
  approx(result.attributions[0].shockPct, 0, 1e-12, 'Unspecified direct-shock asset should remain unchanged');
}

// 9) Black-Scholes implementation satisfies European put-call parity.
{
  const s = 100;
  const k = 95;
  const t = 0.5;
  const r = 0.04;
  const sigma = 0.25;
  const option = blackScholes(s, k, t, r, sigma);
  const lhs = option.callPrice - option.putPrice;
  const rhs = s - k * Math.exp(-r * t);
  approx(lhs, rhs, 1e-4, 'Black-Scholes put-call parity');
  assert.ok(option.callDelta >= 0 && option.callDelta <= 1, 'Call delta should be in [0, 1]');
  assert.ok(option.putDelta >= -1 && option.putDelta <= 0, 'Put delta should be in [-1, 0]');
}

console.log('RiskLab quantitative correctness tests passed.');
