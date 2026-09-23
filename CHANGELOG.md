# Changelog

All notable project-level changes are documented here.

## 0.1.0 — Quantitative correctness baseline

### Corrected

- correlation matrices are projected to a PSD representation before covariance calculations
- fixed-income duration now follows the correct price/yield sign convention
- stress factors use a hierarchy to reduce market/sector double counting
- 95%/99% VaR and Expected Shortfall are calculated directly instead of UI multipliers
- Sortino downside deviation no longer uses a fixed volatility shortcut
- Monte Carlo terminal percentiles are no longer mislabeled as maximum drawdown
- unsupported guaranteed-floor language was removed from hedge illustrations
- collar economics may correctly represent either a debit or credit
- AI scenario inputs are sanitized and bounded server-side
- hardcoded portfolio-specific AI fallback claims were removed

### Added

- focused quantitative invariant tests
- methodology and correctness documentation
