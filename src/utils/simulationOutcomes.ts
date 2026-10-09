// Equivalent constant compound return for an ending value, not a simulation input.
export function annualizedOutcomeReturn(initialValue: number, endingValue: number, years: number): number | null {
  if (![initialValue, endingValue, years].every(Number.isFinite) || initialValue <= 0 || endingValue < 0 || years <= 0) return null;
  return Math.pow(endingValue / initialValue, 1 / years) - 1;
}

// Dated NAV total-return CAGR, not an average across all rolling decades.
export const SPY_RETURN_BENCHMARK = {
  annualReturn: 0.1518,
  asOf: 'September 30, 2026',
  period: 'September 2016–September 2026',
  source: 'https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy',
} as const;
export const DEFAULT_FUTURE_ANNUAL_RETURN = SPY_RETURN_BENCHMARK.annualReturn;

export function benchmarkDifferenceLabel(annualReturn: number): string {
  const difference = (annualReturn - SPY_RETURN_BENCHMARK.annualReturn) * 100;
  return Math.abs(difference) < 0.005 ? 'Matches SPY’s historical 10-year return'
    : `${Math.abs(difference).toFixed(2)} percentage points ${difference > 0 ? 'above' : 'below'} SPY’s historical 10-year return`;
}

// The slider is compound growth (CAGR), so it sets the median log-growth.
// Add half the variance to GBM drift; the engine subtracts it in each step.
export function annualReturnToDrift(annualReturn: number, volatility: number = 0): number {
  if (!Number.isFinite(annualReturn) || annualReturn <= -1) throw new Error('Annual return must be finite and greater than -100%.');
  if (!Number.isFinite(volatility) || volatility < 0) throw new Error('Volatility must be finite and nonnegative.');
  return Math.log1p(annualReturn) + 0.5 * volatility ** 2;
}

// Exact middle 90% interval for the same GBM model used by the simulation.
export function modeledReturnRange(annualReturn: number, volatility: number, years: number) {
  const center = (annualReturnToDrift(annualReturn, volatility) - 0.5 * volatility ** 2) * years;
  const spread = volatility * Math.sqrt(years) * 1.6448536269514722;
  return { low: Math.expm1(center - spread), median: Math.expm1(center), high: Math.expm1(center + spread) };
}
