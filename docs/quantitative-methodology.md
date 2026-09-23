# Quantitative Methodology

This document describes the models currently implemented in RiskLab and, equally importantly, the assumptions they rely on.

## Portfolio weights

Positions are normalized by market value so that weights sum to 1.

## Covariance and portfolio volatility

For asset weights `w` and covariance matrix `Σ`, portfolio variance is:

```text
σ²_p = wᵀ Σ w
```

Portfolio volatility is:

```text
σ_p = sqrt(wᵀ Σ w)
```

The current application builds covariance from modeled annualized volatilities and pairwise correlations.

### Correlation validity

Manually specified pairwise correlations can be individually plausible while still being mutually inconsistent. RiskLab therefore projects the modeled correlation matrix to a positive-semidefinite representation before covariance calculations.

This avoids using an invalid covariance structure for portfolio variance and risk contribution.

## Risk contribution

Risk contribution is based on marginal contribution to portfolio volatility. The implementation decomposes modeled portfolio volatility across positions so the individual contributions reconcile to the total within numerical tolerance.

## Sharpe ratio

RiskLab models Sharpe as excess expected return over portfolio volatility using the configured risk-free assumption.

Because expected returns and the risk-free rate are currently modeled inputs rather than live market estimates, Sharpe should be interpreted as a scenario metric rather than a historical fact.

## Sortino ratio

Sortino uses downside deviation relative to a minimum acceptable return. The current implementation derives downside deviation from the stated normal-return model rather than using a fixed multiplier of total volatility.

A future historical-data version should calculate the lower partial moment directly from observed returns.

## VaR and Expected Shortfall

RiskLab currently implements **parametric normal-model** Value at Risk and Expected Shortfall at 95% and 99% confidence levels across multiple horizons.

The calculation incorporates modeled expected-return drift and scales the volatility to the requested horizon.

### Limitation

Normal-model VaR can materially understate risk when returns are skewed, fat-tailed, or regime-dependent. Planned extensions include historical and simulation-based estimates.

## Stress testing

A stress scenario can contain:

- broad equity shock
- rate shock in basis points
- technology shock
- semiconductor shock
- VIX context
- optional ticker-specific price shocks

### Factor hierarchy

Broad equity, technology, and semiconductor shocks are related rather than independent. RiskLab applies sector effects hierarchically so a semiconductor position does not simply receive the full market shock plus the full technology shock plus the full semiconductor shock.

Ticker-specific shocks take precedence when supplied.

VIX is retained as volatility/option context and is not mechanically deducted from an asset's spot return.

## Fixed-income duration

The first-order relationship used for a positive-duration instrument is:

```text
ΔP / P ≈ -Duration × ΔYield
```

Therefore:

- rates up -> price down
- rates down -> price up

Convexity is not yet modeled.

## Monte Carlo simulation

RiskLab currently uses geometric Brownian motion:

```text
dS / S = μ dt + σ dW
```

The implementation assumes constant drift and volatility across the simulation horizon.

### Limitations

The current model does not yet include:

- stochastic volatility
- changing correlations
- fat-tailed innovations
- regime shifts
- recurring contributions
- inflation-adjusted spending goals
- taxes
- transaction costs

Terminal percentiles are terminal-wealth statistics and are not labeled as maximum drawdowns.

## Black-Scholes hedge illustrations

Option illustrations use Black-Scholes-style pricing inputs to compare conceptual protective puts, put spreads, and collars.

These outputs are intentionally labeled as **illustrations**, not executable orders, because a real hedge needs:

- a tradable proxy
- live option-chain pricing and implied volatility
- portfolio beta
- option delta
- contract multiplier
- basis-risk analysis
- liquidity / spread assumptions

A fixed-strike collar is not described as zero-cost unless modeled put and call premiums approximately offset.

## Current input assumptions

The largest remaining limitation is data provenance. Asset prices, expected returns, volatilities, betas, and several factor exposures are currently hardcoded model assumptions.

The next major phase will separate:

**Observed data**
- historical prices
- realized volatility
- covariance / correlation
- beta / factor estimates

from

**Forward assumptions**
- expected return
- risk-free rate
- scenario shocks
- inflation

That separation is important for reproducibility and honest model interpretation.
