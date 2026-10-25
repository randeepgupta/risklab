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

The Lab builds covariance from aligned historical daily returns, annualized using 252 trading days. Legacy illustrative engine inputs also support modeled volatilities and correlations.

### Correlation validity

Manually specified pairwise correlations can be individually plausible while still being mutually inconsistent. RiskLab therefore projects the modeled correlation matrix to a positive-semidefinite representation before covariance calculations.

This avoids using an invalid covariance structure for portfolio variance and risk contribution.

## Risk contribution

Risk contribution is based on marginal contribution to portfolio volatility. The implementation decomposes portfolio volatility across positions so the signed contributions reconcile to the total within numerical tolerance. Negative contributions offset other holdings; positive shares can exceed 100%. The diversification benefit compares portfolio volatility with the weighted sum of standalone volatilities (perfect co-movement), not with independent holdings.

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

What If fits joint historical sensitivities to the market moves explicitly supplied
by the user: SPY, QQQM, SMH returns and 10-year Treasury yield changes. It uses
covariances of aligned daily observations, with no hand-assigned sector loadings,
rate durations, preset crisis losses or guessed shocks from narrative events.
Ticker-specific user assumptions take precedence. Missing sensitivities and
ill-conditioned fits prevent a total rather than implying an unchanged holding.

See [scenario inputs, estimation and limitations](scenario-model.md) for units,
omitted-versus-zero constraints, the conditional linear projection, provenance,
and extrapolation limits. A policy-rate move is not automatically a Treasury move.

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

Terminal percentiles are terminal-wealth statistics and are not labeled as maximum drawdowns. Chart bands are pointwise percentiles at each year, not the proportion of entire paths remaining inside a band.

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

Portfolio volatility, beta, correlations and the arithmetic mean use the committed
historical snapshot. The batch records source dates, exclusions and quality policy;
it cannot guarantee the accuracy of every upstream observation. Scenario
sensitivities are estimated from that history, rather than ticker presets.

Forward assumptions remain separate: Future uses user-selected compound growth
and calibrated constant volatility. Parametric risk metrics still use a normal
model, the historical arithmetic mean and a fixed risk-free assumption. Hedge
illustrations do not use a live options chain. None of these is a validated forecast.
