# Historical conditional stress scenarios

What If uses explicit user assumptions and measured relationships from the committed
historical snapshot. It no longer translates a narrative such as “a crisis” into a
fixed demo selloff, or assigns sector and rate sensitivities from a ticker allowlist.
The same parser serves local Express and Cloudflare deployments, without an AI call.

## Inputs

Supported market drivers are SPY total return (broad US equities), QQQM total return
(technology-heavy equities), SMH total return (semiconductors), and the change in the
10-year US Treasury yield from Federal Reserve H.15 / FRED series DGS10. QQQM is a
technology-heavy Nasdaq-100 proxy, not a pure technology sector index. Equity moves
are percentage points of return; yield changes are basis points (100 bps = 1
percentage point of yield). A Fed policy-rate change is not automatically a change
in the 10-year yield.

The user must supply a direction and size. Unsupported or ambiguous scenarios ask
for clarification rather than receiving guessed magnitudes. Supported bounds are
validated without silently changing the stated assumptions. The submitted driver
set remains visible and editable. A driver omitted from that set is unconstrained;
explicitly specifying zero means holding that driver unchanged. These are different
scenarios.

Explicit per-holding shocks are direct user assumptions, not model predictions.
They override estimated responses. A scenario containing only ticker shocks assumes
other holdings unchanged, and labels that assumption. A shock to a ticker outside
the portfolio is rejected unless it names a supported market benchmark.

## Estimation

For each holding, the browser aligns its total-return index, benchmark indices,
and available Treasury observations on identical daily intervals. It requires at
least 126 common observations. Treasury holidays or missing yields are not filled
with invented zero changes. Equity returns and yield changes are measured over the
same start and end dates.

For an asset return `r` and the subset of user-specified drivers `F`, the estimated
stress change is:

```text
b = inverse(Cov(F, F)) * Cov(F, r)
asset shock = transpose(b) * specified driver moves
```

This is a joint linear sensitivity fit. Correlation among the selected drivers is
accounted for in the covariance matrix; separate market and sector losses are not
simply added together with hand-assigned coefficients. The response has no drift
term: it estimates the change attributable to the specified stress moves, not the
asset's unconditional expected return. It is a conditional linear projection,
not a probability estimate or a causal model.

Missing models, insufficient common history, singular driver combinations, invalid
values, or a predicted holding loss beyond 100% prevent a portfolio total from being
shown. An unavailable sensitivity is never silently replaced with zero. The user
can change the assumptions or explicitly override an unmodeled holding.

## Interpretation and limits

The visible explanation includes the effective assumptions and model notes. Large
stress moves extrapolate from daily history; this is useful for sensitivity analysis
but does not establish that the historical relationship will survive a crisis.
Returns can be nonlinear, correlations can change, and yield curves can shift in
ways a single Treasury maturity does not capture. Option convexity, leverage,
liquidity effects and company-specific news are not modeled by these drivers.

The snapshot is a public, community-maintained source, not a certified market-data
feed. The refresh applies documented corporate-action handling, data-quality
exclusions and a conservative cutoff when action feeds lag closing prices. These
checks reduce known distortions; they do not prove every price and dividend is
correct. See the manifest's quality metadata and source attribution. The displayed
as-of date can be older than the newest upstream price.

These outputs are scenario estimates, not forecasts, backtested trading signals,
or guarantees. Future simulations remain a separate model with an explicit growth
assumption; What If does not supply their expected return.

Data: [DoltHub stocks](https://www.dolthub.com/repositories/post-no-preference/stocks)
(CC BY-SA 4.0) and [Federal Reserve H.15 / FRED DGS10](https://fred.stlouisfed.org/series/DGS10).
