import type {RiskContribution} from '../types/risk';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export interface RiskContributionExplanation {
  summary: string;
  correlation: number | null;
  calculation: string | null;
  note: string;
}

/** Euler volatility share = weight × asset volatility × corr(asset, portfolio)
 * / portfolio volatility. Correlation is with the full portfolio, including the
 * holding itself, and uses the same covariance inputs as the displayed share. */
export function explainRiskContribution(item: RiskContribution, portfolioVol: number): RiskContributionExplanation {
  const unavailable = {
    summary: 'The inputs needed to explain this risk share are unavailable.',
    correlation: null, calculation: null, note: 'No explanation is inferred from the ticker name or asset class.',
  };
  if (![item.weight, item.volatility, item.marginalRisk, item.percentRiskContribution, portfolioVol].every(Number.isFinite)
      || item.weight < 0 || item.volatility < 0 || portfolioVol < 0) return unavailable;
  if (portfolioVol === 0) return {
    summary: 'The model estimates zero portfolio volatility, so a percentage share of that volatility is undefined.',
    correlation: null, calculation: null,
    note: 'The engine uses zero contributions as a display convention; there is no meaningful percentage to divide across holdings.',
  };
  if (item.volatility === 0) return {
    summary: `${item.ticker} has no observed variation in the model window, so its ${percent(item.weight)} allocation contributes 0.0% of modeled portfolio volatility.`,
    correlation: null, calculation: null,
    note: 'Correlation is undefined for a flat return series. This does not guarantee the holding will remain stable.',
  };
  const rawCorrelation = item.marginalRisk / item.volatility;
  if (Math.abs(rawCorrelation) > 1 + 1e-8) return unavailable;
  const correlation = Math.max(-1, Math.min(1, rawCorrelation)); // Floating-point tolerance only.
  const inputs = `Its ${percent(item.weight)} allocation combines with ${percent(item.volatility)} annualized historical volatility and a ${correlation.toFixed(2)} correlation with the whole portfolio.`;
  let interpretation: string;
  if (item.percentRiskContribution < 0) {
    interpretation = 'Its historical movements partly offset other holdings, giving it a negative risk contribution.';
  } else if (item.weight === 0) {
    interpretation = 'With no money allocated, it contributes no modeled volatility risk.';
  } else if (Math.abs(item.percentRiskContribution - item.weight) < 0.0005) {
    interpretation = 'Together, these inputs make its risk share about the same as its allocation.';
  } else if (item.percentRiskContribution > item.weight) {
    interpretation = 'Together, these inputs make its risk share larger than its allocation.';
  } else {
    interpretation = 'Together, these inputs make its risk share smaller than its allocation.';
  }
  return {
    summary: `${inputs} ${interpretation}`,
    correlation,
    calculation: `${percent(item.weight)} × ${percent(item.volatility)} × ${correlation.toFixed(2)} ÷ ${percent(portfolioVol)} ≈ ${percent(item.percentRiskContribution)}`,
    note: 'Risk share = allocation × holding volatility × correlation with the portfolio ÷ portfolio volatility. Correlation runs from −1 (opposite movements) to +1 (moving together) and includes this holding in the portfolio. Calculations use unrounded values. This is a share of volatility, not a probability of loss or a forecast.',
  };
}
