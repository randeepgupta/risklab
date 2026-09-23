import {
  AssetData,
  PortfolioPosition,
  PortfolioRiskMetrics,
  CorrelationMatrixData,
  MonteCarloResult,
  StressScenario,
  StressTestResult,
  PositionAttribution,
  HedgingStrategy,
} from '../types/risk';

// Realistic empirical market data database
export const ASSET_DATABASE: Record<string, AssetData> = {
  SPY: {
    ticker: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    assetClass: 'US Large Cap',
    price: 540.0,
    volatility: 0.16, // 16% annualized
    beta: 1.0,
    duration: 2.0, // effective rate duration: positive => rates up, price down
    techBeta: 0.35,
    semiBeta: 0.2,
    vixSensitivity: 0.8,
    expectedReturn: 0.10,
    description: 'Core US large cap index benchmark ETF',
  },
  QQQM: {
    ticker: 'QQQM',
    name: 'Invesco NASDAQ 100 ETF',
    assetClass: 'Tech Mega',
    price: 195.0,
    volatility: 0.22, // 22% annualized
    beta: 1.28,
    duration: 4.5,
    techBeta: 1.0,
    semiBeta: 0.65,
    vixSensitivity: 1.1,
    expectedReturn: 0.13,
    description: 'Nasdaq-100 index tracking leading tech & growth companies',
  },
  NVDA: {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    assetClass: 'Semiconductors',
    price: 125.0,
    volatility: 0.48, // 48% annualized
    beta: 1.95,
    duration: 3.5,
    techBeta: 1.5,
    semiBeta: 2.1,
    vixSensitivity: 1.6,
    expectedReturn: 0.22,
    description: 'Dominant accelerated computing & AI datacenter GPU pioneer',
  },
  TSLA: {
    ticker: 'TSLA',
    name: 'Tesla, Inc.',
    assetClass: 'EV / Growth',
    price: 215.0,
    volatility: 0.55, // 55% annualized
    beta: 2.15,
    duration: 5.8,
    techBeta: 1.25,
    semiBeta: 0.4,
    vixSensitivity: 1.7,
    expectedReturn: 0.18,
    description: 'Electric vehicles, autonomous tech, energy storage & robotics',
  },
  AAPL: {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'Tech Mega',
    price: 220.0,
    volatility: 0.21,
    beta: 1.1,
    duration: 3.0,
    techBeta: 0.9,
    semiBeta: 0.3,
    vixSensitivity: 0.9,
    expectedReturn: 0.12,
    description: 'Consumer hardware, iOS ecosystem, and subscription services',
  },
  MSFT: {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    assetClass: 'Tech Mega',
    price: 430.0,
    volatility: 0.23,
    beta: 1.15,
    duration: 3.8,
    techBeta: 1.05,
    semiBeta: 0.45,
    vixSensitivity: 0.95,
    expectedReturn: 0.13,
    description: 'Enterprise cloud (Azure), productivity software, and AI',
  },
  AMD: {
    ticker: 'AMD',
    name: 'Advanced Micro Devices',
    assetClass: 'Semiconductors',
    price: 155.0,
    volatility: 0.45,
    beta: 1.85,
    duration: 3.2,
    techBeta: 1.4,
    semiBeta: 1.8,
    vixSensitivity: 1.5,
    expectedReturn: 0.19,
    description: 'Processors, graphics compute, and Instinct AI accelerators',
  },
  TSM: {
    ticker: 'TSM',
    name: 'Taiwan Semiconductor Mfg',
    assetClass: 'Semiconductors',
    price: 170.0,
    volatility: 0.34,
    beta: 1.45,
    duration: 2.8,
    techBeta: 1.1,
    semiBeta: 1.6,
    vixSensitivity: 1.2,
    expectedReturn: 0.15,
    description: 'World leading foundry manufacturer of cutting-edge silicon',
  },
  TLT: {
    ticker: 'TLT',
    name: 'iShares 20+ Year Treasury Bond ETF',
    assetClass: 'Fixed Income',
    price: 93.0,
    volatility: 0.17,
    beta: -0.32,
    duration: 16.8, // positive duration to interest rates
    techBeta: -0.2,
    semiBeta: -0.15,
    vixSensitivity: -0.4,
    expectedReturn: 0.045,
    description: 'Long-term US sovereign treasuries with high duration',
  },
  BND: {
    ticker: 'BND',
    name: 'Vanguard Total Bond Market ETF',
    assetClass: 'Fixed Income',
    price: 72.0,
    volatility: 0.065,
    beta: 0.05,
    duration: 6.2,
    techBeta: 0.0,
    semiBeta: 0.0,
    vixSensitivity: -0.1,
    expectedReturn: 0.042,
    description: 'Broad investment-grade US bond aggregate',
  },
  GLD: {
    ticker: 'GLD',
    name: 'SPDR Gold Trust',
    assetClass: 'Commodities',
    price: 235.0,
    volatility: 0.145,
    beta: 0.08,
    duration: 1.8,
    techBeta: -0.1,
    semiBeta: -0.05,
    vixSensitivity: -0.3,
    expectedReturn: 0.07,
    description: 'Physical gold bullion commodity hedge',
  },
  IWM: {
    ticker: 'IWM',
    name: 'iShares Russell 2000 ETF',
    assetClass: 'US Small Cap',
    price: 215.0,
    volatility: 0.24,
    beta: 1.25,
    duration: 5.5,
    techBeta: 0.5,
    semiBeta: 0.3,
    vixSensitivity: 1.2,
    expectedReturn: 0.10,
    description: 'US small-cap equity benchmark sensitive to domestic rates',
  },
  XLE: {
    ticker: 'XLE',
    name: 'Energy Select Sector SPDR',
    assetClass: 'Energy Equity',
    price: 88.0,
    volatility: 0.26,
    beta: 0.82,
    duration: 0.5,
    techBeta: 0.15,
    semiBeta: 0.1,
    vixSensitivity: 0.7,
    expectedReturn: 0.09,
    description: 'US energy & crude oil exploration and refining equities',
  },
  AMZN: {
    ticker: 'AMZN',
    name: 'Amazon.com, Inc.',
    assetClass: 'Tech Mega',
    price: 185.0,
    volatility: 0.28,
    beta: 1.3,
    duration: 4.0,
    techBeta: 1.1,
    semiBeta: 0.4,
    vixSensitivity: 1.1,
    expectedReturn: 0.14,
    description: 'E-commerce, AWS cloud computing, digital advertising',
  },
  GOOGL: {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    assetClass: 'Tech Mega',
    price: 165.0,
    volatility: 0.25,
    beta: 1.18,
    duration: 3.6,
    techBeta: 1.0,
    semiBeta: 0.35,
    vixSensitivity: 1.0,
    expectedReturn: 0.13,
    description: 'Search, YouTube, Google Cloud, and AI systems',
  },
};

// Empirical correlation matrix lookup
const CORRELATION_PAIRS: Record<string, number> = {
  // S&P vs others
  'SPY:QQQM': 0.92,
  'SPY:NVDA': 0.76,
  'SPY:TSLA': 0.64,
  'SPY:AAPL': 0.84,
  'SPY:MSFT': 0.86,
  'SPY:AMD': 0.72,
  'SPY:TSM': 0.68,
  'SPY:TLT': -0.38,
  'SPY:BND': -0.15,
  'SPY:GLD': 0.12,
  'SPY:IWM': 0.85,
  'SPY:XLE': 0.54,
  'SPY:AMZN': 0.78,
  'SPY:GOOGL': 0.81,

  // QQQM vs others
  'QQQM:NVDA': 0.84,
  'QQQM:TSLA': 0.71,
  'QQQM:AAPL': 0.88,
  'QQQM:MSFT': 0.90,
  'QQQM:AMD': 0.81,
  'QQQM:TSM': 0.75,
  'QQQM:TLT': -0.42,
  'QQQM:BND': -0.18,
  'QQQM:GLD': 0.08,
  'QQQM:IWM': 0.78,
  'QQQM:XLE': 0.38,
  'QQQM:AMZN': 0.85,
  'QQQM:GOOGL': 0.87,

  // NVDA vs others
  'NVDA:TSLA': 0.62,
  'NVDA:AAPL': 0.68,
  'NVDA:MSFT': 0.75,
  'NVDA:AMD': 0.88,
  'NVDA:TSM': 0.83,
  'NVDA:TLT': -0.32,
  'NVDA:BND': -0.12,
  'NVDA:GLD': 0.05,
  'NVDA:IWM': 0.65,
  'NVDA:XLE': 0.28,
  'NVDA:AMZN': 0.72,
  'NVDA:GOOGL': 0.74,

  // TSLA vs others
  'TSLA:AAPL': 0.55,
  'TSLA:MSFT': 0.58,
  'TSLA:AMD': 0.66,
  'TSLA:TSM': 0.52,
  'TSLA:TLT': -0.25,
  'TSLA:BND': -0.08,
  'TSLA:GLD': 0.02,
  'TSLA:IWM': 0.62,
  'TSLA:XLE': 0.31,
  'TSLA:AMZN': 0.61,
  'TSLA:GOOGL': 0.59,

  // Fixed income & gold
  'TLT:BND': 0.82,
  'TLT:GLD': 0.35,
  'BND:GLD': 0.25,
  'GLD:XLE': 0.18,
  'AAPL:MSFT': 0.82,
  'AMD:TSM': 0.79,
};

export function getPairwiseCorrelation(t1: string, t2: string): number {
  if (t1 === t2) return 1.0;
  const key1 = `${t1}:${t2}`;
  const key2 = `${t2}:${t1}`;
  if (CORRELATION_PAIRS[key1] !== undefined) return CORRELATION_PAIRS[key1];
  if (CORRELATION_PAIRS[key2] !== undefined) return CORRELATION_PAIRS[key2];

  // Derive sensible fallback correlation based on asset classes
  const a1 = ASSET_DATABASE[t1];
  const a2 = ASSET_DATABASE[t2];
  if (!a1 || !a2) return 0.5;
  if (a1.assetClass === a2.assetClass) return 0.75;
  if (a1.assetClass === 'Fixed Income' || a2.assetClass === 'Fixed Income') return -0.25;
  if (a1.assetClass === 'Commodities' || a2.assetClass === 'Commodities') return 0.15;
  return 0.55;
}

function identityMatrix(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

/**
 * Jacobi eigenvalue decomposition for a real symmetric matrix.
 * The matrices in RiskLab are small (typically <= 15x15), so the
 * O(n^3) iterative method is more than adequate and avoids a numeric dependency.
 */
function jacobiEigenDecomposition(input: number[][]): {
  eigenvalues: number[];
  eigenvectors: number[][];
} {
  const n = input.length;
  if (n === 0) return { eigenvalues: [], eigenvectors: [] };

  const a = input.map(row => row.slice());
  const v = identityMatrix(n);
  const tolerance = 1e-12;
  const maxIterations = Math.max(50, n * n * 25);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let p = 0;
    let q = 1;
    let maxOffDiagonal = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const magnitude = Math.abs(a[i][j]);
        if (magnitude > maxOffDiagonal) {
          maxOffDiagonal = magnitude;
          p = i;
          q = j;
        }
      }
    }

    if (maxOffDiagonal < tolerance) break;

    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    for (let k = 0; k < n; k++) {
      if (k === p || k === q) continue;
      const aik = a[k][p];
      const akq = a[k][q];
      const newKp = c * aik - s * akq;
      const newKq = s * aik + c * akq;
      a[k][p] = newKp;
      a[p][k] = newKp;
      a[k][q] = newKq;
      a[q][k] = newKq;
    }

    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = 0;
    a[q][p] = 0;

    for (let k = 0; k < n; k++) {
      const vkp = v[k][p];
      const vkq = v[k][q];
      v[k][p] = c * vkp - s * vkq;
      v[k][q] = s * vkp + c * vkq;
    }
  }

  return {
    eigenvalues: Array.from({ length: n }, (_, i) => a[i][i]),
    eigenvectors: v,
  };
}

/**
 * Projects a symmetric matrix to a valid correlation matrix by clipping
 * negative eigenvalues and then re-normalizing the diagonal to 1.
 * The diagonal scaling is a congruence transform, so PSD is preserved.
 */
export function projectToValidCorrelationMatrix(raw: number[][]): number[][] {
  const n = raw.length;
  if (n === 0) return [];
  if (n === 1) return [[1]];

  // Symmetrize and clamp the raw pairwise estimates to the correlation range.
  const symmetric = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      const a = Number.isFinite(raw[i]?.[j]) ? raw[i][j] : 0;
      const b = Number.isFinite(raw[j]?.[i]) ? raw[j][i] : a;
      return Math.max(-0.999, Math.min(0.999, (a + b) / 2));
    })
  );

  const { eigenvalues, eigenvectors } = jacobiEigenDecomposition(symmetric);
  const floor = 1e-8;
  const clipped = eigenvalues.map(value => Math.max(floor, value));

  const psd = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let value = 0;
      for (let k = 0; k < n; k++) {
        value += eigenvectors[i][k] * clipped[k] * eigenvectors[j][k];
      }
      psd[i][j] = value;
    }
  }

  const scales = psd.map((row, i) => Math.sqrt(Math.max(floor, row[i])));
  const correlation = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        correlation[i][j] = 1;
      } else {
        const normalized = psd[i][j] / (scales[i] * scales[j]);
        correlation[i][j] = Math.max(-0.999, Math.min(0.999, normalized));
      }
    }
  }

  return correlation;
}

export function buildCorrelationMatrix(tickers: string[]): CorrelationMatrixData {
  const n = tickers.length;
  const rawMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    rawMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      rawMatrix[i][j] = getPairwiseCorrelation(tickers[i], tickers[j]);
    }
  }
  const matrix = projectToValidCorrelationMatrix(rawMatrix);
  return { tickers, matrix };
}

function standardNormalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Abramowitz & Stegun approximation for the standard normal CDF.
function standardNormalCdf(x: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }

  const t = 1.0 / (1.0 - p * x);
  return c * Math.exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
}

/**
 * Downside deviation under the same annual normal-return model used by the
 * parametric risk metrics. The target is the minimum acceptable return.
 */
function normalDownsideDeviation(
  expectedReturn: number,
  volatility: number,
  targetReturn: number
): number {
  if (volatility <= 0) return 0;
  const a = (targetReturn - expectedReturn) / volatility;
  const lowerPartialMoment2 =
    volatility * volatility *
    (((a * a) + 1) * standardNormalCdf(a) + a * standardNormalPdf(a));
  return Math.sqrt(Math.max(0, lowerPartialMoment2));
}

function parametricNormalLoss(
  totalValue: number,
  expectedAnnualReturn: number,
  annualizedVolatility: number,
  horizonYears: number,
  confidence: 0.95 | 0.99
): { varDollar: number; varPct: number; cvarDollar: number; cvarPct: number } {
  const z = confidence === 0.95 ? 1.6448536269514722 : 2.3263478740408408;
  const sigmaH = annualizedVolatility * Math.sqrt(horizonYears);
  const muH = expectedAnnualReturn * horizonYears;

  // Loss L = -R. Under R ~ N(mu_h, sigma_h), VaR_alpha(L) = z*sigma_h - mu_h.
  const varPct = Math.max(0, z * sigmaH - muH);
  const tailMultiplier = standardNormalPdf(z) / (1 - confidence);
  const cvarPct = Math.max(varPct, tailMultiplier * sigmaH - muH);

  return {
    varDollar: totalValue * varPct,
    varPct,
    cvarDollar: totalValue * cvarPct,
    cvarPct,
  };
}

export function calculatePortfolioRisk(
  positions: PortfolioPosition[],
  riskFreeRate: number = 0.042 // 4.2%
): PortfolioRiskMetrics {
  const totalValue = positions.reduce((sum, p) => sum + p.investment, 0);
  if (totalValue <= 0 || positions.length === 0) {
    return {
      totalValue: 0,
      annualizedVolatility: 0,
      annualizedVariance: 0,
      expectedAnnualReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      portfolioBeta: 0,
      durationSensitivity: 0,
      var95_1d: 0,
      var95_1d_pct: 0,
      var99_1d: 0,
      var99_1d_pct: 0,
      var95_10d: 0,
      var95_10d_pct: 0,
      var99_10d: 0,
      var99_10d_pct: 0,
      var95_1y: 0,
      var95_1y_pct: 0,
      var99_1y: 0,
      var99_1y_pct: 0,
      cvar95_1d: 0,
      cvar95_1d_pct: 0,
      cvar99_1d: 0,
      cvar99_1d_pct: 0,
      cvar95_10d: 0,
      cvar95_10d_pct: 0,
      cvar99_10d: 0,
      cvar99_10d_pct: 0,
      cvar95_1y: 0,
      cvar95_1y_pct: 0,
      cvar99_1y: 0,
      cvar99_1y_pct: 0,
      riskContributions: [],
      diversificationBenefitPct: 0,
    };
  }

  const n = positions.length;
  const weights = positions.map(p => p.investment / totalValue);
  const vols = positions.map(p => {
    const meta = ASSET_DATABASE[p.ticker];
    return meta ? meta.volatility : 0.25;
  });

  // Covariance matrix: Cov(i, j) = rho(i, j) * vol_i * vol_j.
  // Pairwise estimates are projected to a PSD correlation matrix first so
  // portfolio variance and risk decomposition remain mathematically coherent.
  const correlationMatrix = buildCorrelationMatrix(positions.map(p => p.ticker)).matrix;
  const covMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    covMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      const rho = correlationMatrix[i][j];
      covMatrix[i][j] = rho * vols[i] * vols[j];
    }
  }

  // Portfolio Variance: w^T * Sigma * w
  let portVariance = 0;
  // Sigma * w vector: (Sigma * w)_i = sum_j (cov_ij * w_j)
  const sigmaTimesW: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sigmaTimesW[i] += covMatrix[i][j] * weights[j];
    }
    portVariance += weights[i] * sigmaTimesW[i];
  }

  // PSD covariance implies non-negative variance; clamp only floating-point noise.
  const sanitizedVariance = Math.max(0, portVariance);
  const portVol = Math.sqrt(sanitizedVariance);

  // Risk contributions (Euler decomposition of volatility)
  // MCR_i = (Sigma * w)_i / portVol
  // % Risk Contribution = w_i * MCR_i / portVol
  const riskContributions = positions.map((p, i) => {
    const marginalRisk = sigmaTimesW[i] / portVol;
    const percentRiskContribution = (weights[i] * marginalRisk) / portVol;
    const dollarRiskContribution = percentRiskContribution * (totalValue * portVol);

    return {
      ticker: p.ticker,
      investment: p.investment,
      weight: weights[i],
      volatility: vols[i],
      marginalRisk,
      percentRiskContribution,
      dollarRiskContribution,
    };
  });

  // Standalone weighted volatility sum
  const weightedStandaloneVol = weights.reduce((sum, w, i) => sum + w * vols[i], 0);
  const diversificationBenefitPct = Math.max(0, ((weightedStandaloneVol - portVol) / weightedStandaloneVol) * 100);

  // Expected return and betas
  let expectedAnnualReturn = 0;
  let portfolioBeta = 0;
  let durationSensitivity = 0;

  positions.forEach((p, i) => {
    const meta = ASSET_DATABASE[p.ticker] || {
      expectedReturn: 0.1,
      beta: 1.0,
      duration: 2.5,
    };
    expectedAnnualReturn += weights[i] * meta.expectedReturn;
    portfolioBeta += weights[i] * meta.beta;
    durationSensitivity += weights[i] * meta.duration;
  });

  // Sharpe & Sortino. Sortino uses the risk-free rate as the minimum acceptable
  // return and computes normal-model downside deviation rather than a fixed
  // fraction of total volatility.
  const excessReturn = expectedAnnualReturn - riskFreeRate;
  const sharpeRatio = portVol > 0 ? excessReturn / portVol : 0;
  const downsideDev = normalDownsideDeviation(expectedAnnualReturn, portVol, riskFreeRate);
  const sortinoRatio = downsideDev > 0 ? excessReturn / downsideDev : 0;

  // Parametric normal VaR / Expected Shortfall. Drift is included, which matters
  // especially at the one-year horizon. 252 trading days are used for daily horizons.
  const risk95_1d = parametricNormalLoss(totalValue, expectedAnnualReturn, portVol, 1 / 252, 0.95);
  const risk99_1d = parametricNormalLoss(totalValue, expectedAnnualReturn, portVol, 1 / 252, 0.99);
  const risk95_10d = parametricNormalLoss(totalValue, expectedAnnualReturn, portVol, 10 / 252, 0.95);
  const risk99_10d = parametricNormalLoss(totalValue, expectedAnnualReturn, portVol, 10 / 252, 0.99);
  const risk95_1y = parametricNormalLoss(totalValue, expectedAnnualReturn, portVol, 1, 0.95);
  const risk99_1y = parametricNormalLoss(totalValue, expectedAnnualReturn, portVol, 1, 0.99);

  return {
    totalValue,
    annualizedVolatility: portVol,
    annualizedVariance: sanitizedVariance,
    expectedAnnualReturn,
    sharpeRatio,
    sortinoRatio,
    portfolioBeta,
    durationSensitivity,
    var95_1d: risk95_1d.varDollar,
    var95_1d_pct: risk95_1d.varPct,
    var99_1d: risk99_1d.varDollar,
    var99_1d_pct: risk99_1d.varPct,
    var95_10d: risk95_10d.varDollar,
    var95_10d_pct: risk95_10d.varPct,
    var99_10d: risk99_10d.varDollar,
    var99_10d_pct: risk99_10d.varPct,
    var95_1y: risk95_1y.varDollar,
    var95_1y_pct: risk95_1y.varPct,
    var99_1y: risk99_1y.varDollar,
    var99_1y_pct: risk99_1y.varPct,
    cvar95_1d: risk95_1d.cvarDollar,
    cvar95_1d_pct: risk95_1d.cvarPct,
    cvar99_1d: risk99_1d.cvarDollar,
    cvar99_1d_pct: risk99_1d.cvarPct,
    cvar95_10d: risk95_10d.cvarDollar,
    cvar95_10d_pct: risk95_10d.cvarPct,
    cvar99_10d: risk99_10d.cvarDollar,
    cvar99_10d_pct: risk99_10d.cvarPct,
    cvar95_1y: risk95_1y.cvarDollar,
    cvar95_1y_pct: risk95_1y.cvarPct,
    cvar99_1y: risk99_1y.cvarDollar,
    cvar99_1y_pct: risk99_1y.cvarPct,
    riskContributions,
    diversificationBenefitPct,
  };
}

// Standard Box-Muller transform for pseudo-random Gaussian
function generateStandardNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Monte Carlo Simulation Engine
export function runMonteCarloSimulation(
  initialValue: number,
  expectedReturn: number,
  volatility: number,
  horizonYears: number = 5,
  simulationsCount: number = 2500
): MonteCarloResult {
  const stepsPerYear = 12; // monthly steps
  const totalSteps = horizonYears * stepsPerYear;
  const dt = 1 / stepsPerYear;
  const drift = (expectedReturn - 0.5 * volatility * volatility) * dt;
  const diffusion = volatility * Math.sqrt(dt);

  // Store terminal values and year snapshots
  const terminalValues: number[] = new Array(simulationsCount);
  const yearsArray = Array.from({ length: horizonYears + 1 }, (_, i) => i);
  const pathsValuesByYear: number[][] = Array.from({ length: horizonYears + 1 }, () => []);

  // Sample paths to visualize (keep 15 representative paths)
  const samplePaths: { pathId: number; points: { year: number; value: number }[] }[] = [];
  const sampleIndices = new Set([0, 10, 50, 100, 250, 500, 750, 1000, 1500, 2000, 2400]);

  for (let s = 0; s < simulationsCount; s++) {
    let currentVal = initialValue;
    const isSampled = sampleIndices.has(s);
    const pathPoints = isSampled ? [{ year: 0, value: currentVal }] : [];

    pathsValuesByYear[0].push(currentVal);

    for (let step = 1; step <= totalSteps; step++) {
      const z = generateStandardNormal();
      currentVal = currentVal * Math.exp(drift + diffusion * z);

      if (step % stepsPerYear === 0) {
        const yearIndex = step / stepsPerYear;
        pathsValuesByYear[yearIndex].push(currentVal);
        if (isSampled) {
          pathPoints.push({ year: yearIndex, value: currentVal });
        }
      }
    }

    terminalValues[s] = currentVal;
    if (isSampled) {
      samplePaths.push({ pathId: s, points: pathPoints });
    }
  }

  // Calculate percentiles for each year
  const percentiles = yearsArray.map(year => {
    const vals = pathsValuesByYear[year].slice().sort((a, b) => a - b);
    const count = vals.length;
    return {
      year,
      p1: vals[Math.floor(count * 0.01)],
      p5: vals[Math.floor(count * 0.05)],
      p25: vals[Math.floor(count * 0.25)],
      p50: vals[Math.floor(count * 0.50)],
      p75: vals[Math.floor(count * 0.75)],
      p95: vals[Math.floor(count * 0.95)],
      p99: vals[Math.floor(count * 0.99)],
    };
  });

  terminalValues.sort((a, b) => a - b);
  const sum = terminalValues.reduce((acc, v) => acc + v, 0);
  const mean = sum / simulationsCount;
  const median = terminalValues[Math.floor(simulationsCount * 0.5)];
  const p5Worst = terminalValues[Math.floor(simulationsCount * 0.05)];
  const p95Best = terminalValues[Math.floor(simulationsCount * 0.95)];
  const probOfLoss = terminalValues.filter(v => v < initialValue).length / simulationsCount;
  const probOfDoubling = terminalValues.filter(v => v >= initialValue * 2).length / simulationsCount;

  // Standard deviation
  const variance = terminalValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / simulationsCount;
  const stdDev = Math.sqrt(variance);

  return {
    horizonYears,
    simulationsCount,
    initialValue,
    percentiles,
    terminalStats: {
      mean,
      median,
      stdDev,
      p5Worst,
      p95Best,
      probOfLoss,
      probOfDoubling,
      maxTerminal: terminalValues[simulationsCount - 1],
      minTerminal: terminalValues[0],
    },
    samplePaths,
  };
}

// Preset Stress Scenarios
export const PRESET_SCENARIOS: StressScenario[] = [
  {
    id: 'user_mvp_tech_shock',
    name: 'Tech & Semi Rout (RiskLab MVP Scenario)',
    description: 'Nasdaq correction with severe semiconductor & EV drawdowns: SPY -18%, QQQM -32%, NVDA -45%, TSLA -40%.',
    category: 'preset',
    tickerShocks: {
      SPY: -0.18,
      QQQM: -0.32,
      NVDA: -0.45,
      TSLA: -0.40,
    },
  },
  {
    id: 'ai_bubble_burst_rates_cut',
    name: 'AI Bubble Bursts & Fed Cuts 150 bps',
    description: 'Datacenter capex freeze causes semiconductor multiple compression, while Fed aggressively slashes rates by 150 bps to avert recession.',
    category: 'macro_factor',
    factorShocks: {
      equityShockPct: -18,
      rateChangeBps: -150,
      vixSpikePct: 80,
      semiShockPct: -45,
      techShockPct: -32,
    },
    tickerShocks: {
      SPY: -0.16,
      QQQM: -0.30,
      NVDA: -0.46,
      TSLA: -0.35,
      AAPL: -0.22,
      MSFT: -0.25,
      AMD: -0.44,
      TSM: -0.38,
      TLT: 0.18, // bonds rally when rates drop!
      BND: 0.08,
      GLD: 0.12,
    },
  },
  {
    id: '2022_stagflation_rate_hike',
    name: '2022 Inflation & Rate Spike (+300 bps)',
    description: 'Aggressive monetary tightening and 40-year high inflation crush growth multiples and bond durations simultaneously.',
    category: 'preset',
    factorShocks: {
      equityShockPct: -22,
      rateChangeBps: 300,
      vixSpikePct: 50,
      semiShockPct: -38,
      techShockPct: -34,
    },
    tickerShocks: {
      SPY: -0.19,
      QQQM: -0.33,
      NVDA: -0.50,
      TSLA: -0.65,
      AAPL: -0.27,
      MSFT: -0.29,
      AMD: -0.55,
      TLT: -0.31,
      BND: -0.13,
      GLD: -0.01,
      XLE: 0.45, // energy rallied in 2022
    },
  },
  {
    id: '2020_covid_flash_crash',
    name: 'March 2020 Liquidity Shock',
    description: 'Sudden global shutdown triggers a VIX explosion above 80 and broad panic liquidations across all risk assets.',
    category: 'preset',
    factorShocks: {
      equityShockPct: -34,
      rateChangeBps: -125,
      vixSpikePct: 300,
      semiShockPct: -32,
      techShockPct: -28,
    },
    tickerShocks: {
      SPY: -0.34,
      QQQM: -0.28,
      NVDA: -0.32,
      TSLA: -0.42,
      AAPL: -0.24,
      MSFT: -0.26,
      TLT: 0.16,
      GLD: -0.04,
      XLE: -0.52,
    },
  },
  {
    id: 'geopolitical_taiwan_semi_chokepoint',
    name: 'Taiwan Strait Semiconductor Crisis',
    description: 'Severe supply disruption in advanced packaging and wafer fabrication sends semiconductor stocks into a multi-quarter tailspin.',
    category: 'preset',
    factorShocks: {
      equityShockPct: -15,
      rateChangeBps: -50,
      vixSpikePct: 120,
      semiShockPct: -55,
      techShockPct: -35,
    },
    tickerShocks: {
      SPY: -0.15,
      QQQM: -0.28,
      NVDA: -0.55,
      TSM: -0.65,
      AMD: -0.50,
      AAPL: -0.32,
      TSLA: -0.38,
      GLD: 0.15,
      TLT: 0.08,
    },
  },
];

// Stress Test Calculation Engine
export function executeStressTest(
  positions: PortfolioPosition[],
  scenario: StressScenario
): StressTestResult {
  const initialValue = positions.reduce((sum, p) => sum + p.investment, 0);

  const attributions: PositionAttribution[] = positions.map(p => {
    let shockPct = 0;
    if (scenario.tickerShocks[p.ticker] !== undefined) {
      shockPct = scenario.tickerShocks[p.ticker];
    } else if (scenario.factorShocks) {
      // Translate hierarchical factor shocks into an estimated asset return.
      // Sector shocks are treated as absolute scenario levels, so only their
      // incremental residual versus the broader factor is added. This avoids
      // counting the same market drawdown multiple times.
      //
      // Rate convention follows duration: dP/P ~= -Duration * dYield.
      // VIX is retained as scenario metadata for future option repricing, but is
      // not separately subtracted from spot returns because it is strongly
      // endogenous to the equity shock and would otherwise double-count panic.
      const meta = ASSET_DATABASE[p.ticker] || {
        beta: 1.0,
        duration: 2.5,
        semiBeta: 0.2,
        techBeta: 0.5,
        vixSensitivity: 0.8,
      };

      const eqImpact = (meta.beta * scenario.factorShocks.equityShockPct) / 100;
      const rateImpact = -meta.duration * (scenario.factorShocks.rateChangeBps / 10000);

      const techResidualPct =
        scenario.factorShocks.techShockPct - scenario.factorShocks.equityShockPct;
      const semiResidualPct =
        scenario.factorShocks.semiShockPct - scenario.factorShocks.techShockPct;
      const techImpact = (meta.techBeta * techResidualPct) / 100;
      const semiImpact = (meta.semiBeta * semiResidualPct) / 100;

      shockPct = eqImpact + rateImpact + techImpact + semiImpact;
      // Cap maximum loss at -98%
      shockPct = Math.max(-0.98, Math.min(3, shockPct));
    } else {
      // No explicit ticker or factor shock was supplied for this asset.
      // Do not invent a loss; leave it unchanged until the scenario defines one.
      shockPct = 0;
    }

    const stressedValue = Math.max(0, p.investment * (1 + shockPct));
    const dollarLoss = p.investment - stressedValue;

    return {
      ticker: p.ticker,
      name: p.name,
      initialValue: p.investment,
      shockPct,
      stressedValue,
      dollarLoss,
      lossContributionPct: 0, // calculated below
    };
  });

  const stressedTotal = attributions.reduce((sum, a) => sum + a.stressedValue, 0);
  const totalDollarLoss = initialValue - stressedTotal;
  const totalPercentLoss = initialValue > 0 ? (totalDollarLoss / initialValue) * 100 : 0;

  // Calculate loss contribution %
  attributions.forEach(a => {
    a.lossContributionPct = totalDollarLoss > 0 ? (a.dollarLoss / totalDollarLoss) * 100 : 0;
  });

  // Sort by dollar loss descending
  attributions.sort((a, b) => b.dollarLoss - a.dollarLoss);
  const topCulprit = attributions[0] || {
    ticker: 'N/A',
    name: '',
    initialValue: 0,
    shockPct: 0,
    stressedValue: 0,
    dollarLoss: 0,
    lossContributionPct: 0,
  };

  return {
    scenario,
    initialValue,
    stressedValue: stressedTotal,
    dollarLoss: totalDollarLoss,
    percentLoss: totalPercentLoss,
    attributions,
    topCulprit,
  };
}

// Black-Scholes European Option Pricing
export function blackScholes(
  s: number, // current price / portfolio value
  k: number, // strike price
  t: number, // time to expiration in years
  r: number, // risk-free rate
  sigma: number // volatility
): { callPrice: number; putPrice: number; putDelta: number; callDelta: number } {
  if (t <= 0 || sigma <= 0) {
    return {
      callPrice: Math.max(0, s - k),
      putPrice: Math.max(0, k - s),
      putDelta: s < k ? -1 : 0,
      callDelta: s > k ? 1 : 0,
    };
  }

  const d1 = (Math.log(s / k) + (r + 0.5 * sigma * sigma) * t) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);

  const callPrice = s * standardNormalCdf(d1) - k * Math.exp(-r * t) * standardNormalCdf(d2);
  const putPrice = k * Math.exp(-r * t) * standardNormalCdf(-d2) - s * standardNormalCdf(-d1);

  const callDelta = standardNormalCdf(d1);
  const putDelta = standardNormalCdf(d1) - 1;

  return { callPrice, putPrice, putDelta, callDelta };
}

// Hedging Strategies Generator
export function calculateHedgingStrategies(
  totalValue: number,
  portfolioVol: number,
  riskFreeRate: number = 0.042
): HedgingStrategy[] {
  if (totalValue <= 0) return [];

  // 1. Protective Put (95% Strike, 6-Month Horizon)
  const strikePut95 = totalValue * 0.95;
  const t6m = 0.5;
  const bs95 = blackScholes(totalValue, strikePut95, t6m, riskFreeRate, portfolioVol);
  const costPut95 = bs95.putPrice;
  const costPct95 = (costPut95 / totalValue) * 100;

  // 2. Bear Put Spread (Buy 95% Put, Sell 85% Put - Capped Protection at lower cost)
  const strikePut85 = totalValue * 0.85;
  const bs85 = blackScholes(totalValue, strikePut85, t6m, riskFreeRate, portfolioVol);
  const costSpread = Math.max(0, costPut95 - bs85.putPrice);
  const costSpreadPct = (costSpread / totalValue) * 100;

  // 3. Collar Strategy (Buy 90% Put, Sell 110% Out-of-the-money Call)
  const strikePut90 = totalValue * 0.90;
  const strikeCall110 = totalValue * 1.10;
  const bsPut90 = blackScholes(totalValue, strikePut90, t6m, riskFreeRate, portfolioVol);
  const bsCall110 = blackScholes(totalValue, strikeCall110, t6m, riskFreeRate, portfolioVol);
  // Collar can be either a debit or a credit; do not force a credit to zero.
  const netCollarCost = bsPut90.putPrice - bsCall110.callPrice;
  const netCollarCostPct = (netCollarCost / totalValue) * 100;

  // 4. Inverse Beta / Short Futures Overlay (Synthetic 50% downside offset)
  const hedgeNotional = totalValue * 0.5;
  const inverseCostAnnual = 0.015 * hedgeNotional; // borrow/financing friction ~1.5%

  return [
    {
      id: 'protective_put_95',
      name: 'Illustrative Protective Put (95% Strike)',
      strategyType: 'protective_put',
      recommendedStrikePutPct: 95,
      expiryMonths: 6,
      costDollar: costPut95,
      costPct: costPct95,
      annualizedCostPct: costPct95 * 2,
      protectionFloorDollar: strikePut95,
      rationale: 'Theoretical portfolio-level put equivalent. A real implementation must use a tradable proxy and account for beta, delta, basis risk, and live option pricing.',
      tradeOffs: [
        `High insurance premium drag (${costPct95.toFixed(1)}% every 6 months)`,
        'Time decay (theta) erodes premium if market stays flat',
        'The displayed floor applies only to the synthetic modeled underlying, not automatically to a real multi-asset portfolio',
      ],
    },
    {
      id: 'put_spread_95_85',
      name: 'Bear Put Spread (95/85 Corridors)',
      strategyType: 'put_spread',
      recommendedStrikePutPct: 95,
      expiryMonths: 6,
      costDollar: costSpread,
      costPct: costSpreadPct,
      annualizedCostPct: costSpreadPct * 2,
      rationale: 'Theoretical 95/85 put spread. It offsets losses only inside the strike corridor; losses resume below the lower strike, so there is no guaranteed portfolio floor.',
      tradeOffs: [
        `Much lower upfront cost (${costSpreadPct.toFixed(1)}% vs ${costPct95.toFixed(1)}%)`,
        'Downside protection is capped below -15% drawdown',
        'Requires active rebalancing if market crashes beyond 85% strike',
      ],
    },
    {
      id: 'collar_90_110',
      name: 'Illustrative Collar (90 Put / 110 Call)',
      strategyType: 'collar',
      recommendedStrikePutPct: 90,
      recommendedStrikeCallPct: 110,
      expiryMonths: 6,
      costDollar: netCollarCost,
      costPct: netCollarCostPct,
      maxUpsideCapPct: 10, // Capped at +10% gain
      annualizedCostPct: netCollarCostPct * 2,
      protectionFloorDollar: strikePut90,
      rationale: 'Theoretical 90/110 collar. Its net premium may be a debit or credit; a true zero-cost collar requires solving for a call strike using live option prices.',
      tradeOffs: [
        netCollarCost >= 0
          ? `Modeled net debit: ${netCollarCostPct.toFixed(1)}% of portfolio value`
          : `Modeled net credit: ${Math.abs(netCollarCostPct).toFixed(1)}% of portfolio value`,
        'Synthetic downside floor applies only if the hedge underlying perfectly tracks the portfolio',
        'Opportunity cost: Upside is strictly capped at +10%',
      ],
    },
    {
      id: 'inverse_beta_overlay',
      name: 'Short Index Beta Overlay (50% Hedge)',
      strategyType: 'inverse_beta',
      recommendedStrikePutPct: 100,
      expiryMonths: 12,
      costDollar: inverseCostAnnual,
      costPct: (inverseCostAnnual / totalValue) * 100,
      annualizedCostPct: 0.75,
      rationale: 'Illustrative 50% beta overlay. It reduces broad-market beta exposure but does not create a fixed loss floor because tracking error and basis risk remain.',
      tradeOffs: [
        'No option volatility smile or implied vol crush',
        'Directly cuts portfolio upside by 50% during bull runs',
        'Easy to scale in and out dynamically without strike constraints',
      ],
    },
  ];
}
