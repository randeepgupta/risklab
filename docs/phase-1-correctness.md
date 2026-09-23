# Phase 1 — Quantitative Correctness Pass

This pass intentionally focuses on correctness and truthful labeling rather than adding product features.

## Fixed

- **Correlation matrix validity**
  - Raw pairwise correlation assumptions are now projected to a positive-semidefinite (PSD) correlation matrix before covariance and portfolio-risk calculations.
  - This prevents internally inconsistent pairwise correlations from producing invalid portfolio variances.

- **Interest-rate duration sign convention**
  - Rate stress now follows the standard first-order relationship `dP/P ≈ -Duration × dYield`.
  - A rate cut raises positive-duration bond prices; a rate hike lowers them.

- **Stress-factor double counting**
  - Broad equity, technology, and semiconductor shocks are treated hierarchically.
  - Sector shocks contribute only the incremental residual beyond the broader factor.
  - VIX is retained as scenario/option context and is no longer independently subtracted from spot prices.
  - The unused `correlationIncrease` field was removed from deterministic stress P&L because correlation is not itself a one-period spot-return shock.
  - Assets with no explicit ticker shock and no factor model now remain unchanged instead of receiving an invented -20% fallback loss.

- **VaR / Expected Shortfall**
  - Removed UI multipliers that approximated missing 99% and multi-horizon values.
  - The engine now calculates 95% and 99% VaR and Expected Shortfall directly for 1-day, 10-day, and 1-year horizons under the stated normal-return model.
  - Expected-return drift is included in horizon risk.

- **Sortino ratio**
  - Replaced the fixed `0.72 × volatility` downside-deviation shortcut with a normal-model lower-partial-moment calculation using the risk-free rate as the minimum acceptable return.

- **Hedging claims**
  - Removed invented contract counts based on a hardcoded SPY price.
  - Put spreads and beta overlays no longer claim a guaranteed portfolio floor.
  - Collar premium is now signed: it may be a debit or a credit.
  - A 90/110 collar is no longer labeled “zero-cost” unless actual option pricing supports that conclusion.
  - Hedge cards are explicitly labeled as synthetic portfolio-level illustrations rather than executable trade tickets.

- **AI scenario safety/correctness**
  - Gemini scenario output is bounded and sanitized server-side before entering the deterministic engine.
  - Removed hardcoded fallback claims about NVDA/TSLA concentration that could be false for the active portfolio.

- **Monte Carlo labeling**
  - The 5th-percentile terminal value is no longer described as a maximum drawdown.
  - Fan-chart bands are labeled as simulated percentile ranges rather than statistical confidence intervals.

- **Asset classification**
  - IWM is classified as US Small Cap.
  - XLE is classified as Energy Equity rather than a commodity.

## Tests

A focused quantitative test suite lives at `tests/quantEngine.test.ts`.

Run after dependencies are installed:

```bash
npm run test:quant
```

The suite checks:

- PSD/symmetric/unit-diagonal correlation matrix
- risk-contribution decomposition
- VaR/CVaR monotonicity
- bond duration sign behavior
- ticker-shock precedence
- factor hierarchy / VIX non-double-counting
- removal of false hedge floors
- Black-Scholes put-call parity and delta bounds

## Known limitations intentionally left for later phases

- Asset prices, volatilities, betas, expected returns, and base pairwise correlations are still hardcoded assumptions.
- Stress-test beta / technology / semiconductor factor loadings are still hand-calibrated assumptions rather than regression-estimated exposures.
- The 4.2% risk-free rate is still a model assumption rather than a live market input.
- There is no historical market-data ingestion yet.
- Monte Carlo still uses constant-parameter geometric Brownian motion.
- Hedge economics still model a synthetic portfolio underlying rather than a live tradable proxy with real option-chain implied volatility.
- VaR/Expected Shortfall remain parametric normal-model estimates and therefore understate fat-tail / regime-shift risk.

Those are architecture/data enhancements rather than Phase 1 correctness patches.
