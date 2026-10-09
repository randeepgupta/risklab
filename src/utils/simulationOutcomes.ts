// Equivalent constant compound return for an ending value, not a simulation input.
export function annualizedOutcomeReturn(initialValue: number, endingValue: number, years: number): number | null {
  if (![initialValue, endingValue, years].every(Number.isFinite) || initialValue <= 0 || endingValue < 0 || years <= 0) return null;
  return Math.pow(endingValue / initialValue, 1 / years) - 1;
}

// Exact middle 90% interval for the same GBM model used by the simulation.
export function modeledReturnRange(expectedReturn: number, volatility: number, years: number) {
  const center = (expectedReturn - 0.5 * volatility ** 2) * years;
  const spread = volatility * Math.sqrt(years) * 1.6448536269514722;
  return { low: Math.expm1(center - spread), median: Math.expm1(center), high: Math.expm1(center + spread) };
}
