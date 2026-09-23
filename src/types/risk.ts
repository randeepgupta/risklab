export interface PortfolioPosition {
  ticker: string;
  name: string;
  assetClass:
    | 'US Large Cap'
    | 'US Small Cap'
    | 'Tech Mega'
    | 'Semiconductors'
    | 'EV / Growth'
    | 'Energy Equity'
    | 'Fixed Income'
    | 'Commodities'
    | 'Crypto'
    | 'Other';
  investment: number; // in USD
  weight: number; // 0 to 1
  price: number;
}

export interface AssetData {
  ticker: string;
  name: string;
  assetClass: PortfolioPosition['assetClass'];
  price: number;
  volatility: number; // Annualized volatility (e.g. 0.22 = 22%)
  beta: number; // Beta vs S&P 500
  duration: number; // Effective rate duration/sensitivity. Positive => price tends to fall when yields rise.
  techBeta: number; // Tech sector factor loading
  semiBeta: number; // Semiconductor factor loading
  vixSensitivity: number; // Sensitivity to VIX shocks
  expectedReturn: number; // Forward/model return assumption used by RiskLab; not a forecast guarantee.
  description: string;
}

export interface RiskContribution {
  ticker: string;
  investment: number;
  weight: number;
  volatility: number;
  marginalRisk: number; // Marginal contribution to risk
  percentRiskContribution: number; // Percentage contribution (sums to 100%)
  dollarRiskContribution: number;
}

export interface PortfolioRiskMetrics {
  totalValue: number;
  annualizedVolatility: number;
  annualizedVariance: number;
  expectedAnnualReturn: number;
  sharpeRatio: number; // assuming risk-free rate
  sortinoRatio: number;
  portfolioBeta: number;
  durationSensitivity: number;
  
  // Value at Risk (Parametric & Historical)
  var95_1d: number;
  var95_1d_pct: number;
  var99_1d: number;
  var99_1d_pct: number;
  var95_10d: number;
  var95_10d_pct: number;
  var99_10d: number;
  var99_10d_pct: number;
  var95_1y: number;
  var95_1y_pct: number;
  var99_1y: number;
  var99_1y_pct: number;
  
  // Conditional VaR (Expected Shortfall)
  cvar95_1d: number;
  cvar95_1d_pct: number;
  cvar99_1d: number;
  cvar99_1d_pct: number;
  cvar95_10d: number;
  cvar95_10d_pct: number;
  cvar99_10d: number;
  cvar99_10d_pct: number;
  cvar95_1y: number;
  cvar95_1y_pct: number;
  cvar99_1y: number;
  cvar99_1y_pct: number;
  
  riskContributions: RiskContribution[];
  diversificationBenefitPct: number; // % reduction from sum of weighted standalone vols
}

export interface CorrelationMatrixData {
  tickers: string[];
  matrix: number[][];
}

export interface MonteCarloYearPercentile {
  year: number;
  p1: number;
  p5: number;
  p25: number;
  p50: number; // Median
  p75: number;
  p95: number;
  p99: number;
}

export interface MonteCarloResult {
  horizonYears: number;
  simulationsCount: number;
  initialValue: number;
  percentiles: MonteCarloYearPercentile[];
  terminalStats: {
    mean: number;
    median: number;
    stdDev: number;
    p5Worst: number;
    p95Best: number;
    probOfLoss: number; // 0 to 1
    probOfDoubling: number; // 0 to 1
    maxTerminal: number;
    minTerminal: number;
  };
  samplePaths: {
    pathId: number;
    points: { year: number; value: number }[];
  }[];
}

export interface StressScenario {
  id: string;
  name: string;
  description: string;
  category: 'preset' | 'macro_factor' | 'custom' | 'ai_generated';
  tickerShocks: Record<string, number>; // e.g. { SPY: -0.18, QQQM: -0.32, NVDA: -0.45, TSLA: -0.40 }
  factorShocks?: {
    equityShockPct: number; // e.g. -20
    rateChangeBps: number; // e.g. -150
    vixSpikePct: number; // e.g. +60
    semiShockPct: number; // e.g. -45
    techShockPct: number; // e.g. -30
  };
}

export interface PositionAttribution {
  ticker: string;
  name: string;
  initialValue: number;
  shockPct: number;
  stressedValue: number;
  dollarLoss: number;
  lossContributionPct: number; // of total portfolio dollar loss
}

export interface StressTestResult {
  scenario: StressScenario;
  initialValue: number;
  stressedValue: number;
  dollarLoss: number;
  percentLoss: number;
  attributions: PositionAttribution[];
  topCulprit: PositionAttribution;
}

export interface HedgingStrategy {
  id: string;
  name: string;
  strategyType: 'protective_put' | 'put_spread' | 'collar' | 'inverse_beta';
  recommendedStrikePutPct: number;
  recommendedStrikeCallPct?: number;
  expiryMonths: number;
  costDollar: number;
  costPct: number;
  maxUpsideCapPct?: number; // for collar
  annualizedCostPct: number;
  protectionFloorDollar?: number;
  contractsNeeded?: number;
  rationale: string;
  tradeOffs: string[];
}

export interface AiScenarioParseResponse {
  scenarioName: string;
  factorShocks: {
    equityShockPct: number;
    rateChangeBps: number;
    vixSpikePct: number;
    semiShockPct: number;
    techShockPct: number;
  };
  macroTransmissionExplanation: string;
  assetSpecificImpacts: Record<string, { shockPct: number; reason: string }>;
  vulnerabilities: string[];
  suggestedHedgeAction: string;
}

export interface AiCopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  scenarioData?: Partial<AiScenarioParseResponse>;
}
