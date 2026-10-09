// Equivalent constant compound return for an ending value, not a simulation input.
export function annualizedOutcomeReturn(initialValue: number, endingValue: number, years: number): number | null {
  if (![initialValue, endingValue, years].every(Number.isFinite) || initialValue <= 0 || endingValue < 0 || years <= 0) return null;
  return Math.pow(endingValue / initialValue, 1 / years) - 1;
}

export const DEFAULT_FUTURE_ANNUAL_RETURN = 0.07;

// A user-facing 7% annual mean must yield 7%, not exp(0.07)-1, in GBM.
export function annualReturnToDrift(annualReturn: number): number {
  if (!Number.isFinite(annualReturn) || annualReturn <= -1) throw new Error('Annual return must be finite and greater than -100%.');
  return Math.log1p(annualReturn);
}

// Exact middle 90% interval for the same GBM model used by the simulation.
export function modeledReturnRange(annualReturn: number, volatility: number, years: number) {
  const center = (annualReturnToDrift(annualReturn) - 0.5 * volatility ** 2) * years;
  const spread = volatility * Math.sqrt(years) * 1.6448536269514722;
  return { low: Math.expm1(center - spread), median: Math.expm1(center), high: Math.expm1(center + spread) };
}
