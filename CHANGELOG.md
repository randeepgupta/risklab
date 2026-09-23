# Changelog

All notable project-level changes are documented here.

## 0.2.0 — Investor-friendly MVP

### Changed

- reorganized the product around four investor questions: Overview, What If?, Future, and Advanced
- added a plain-English portfolio summary with risk level, biggest risk driver, diversification quality, and a very-bad-day model estimate
- renamed Euler decomposition to "What is driving your risk?" and moved the technical method behind an explanation control
- renamed the correlation matrix to "Which investments move together?" with a plain-English interpretation
- simplified the holdings table by removing volatility and beta from the default view
- redesigned Monte Carlo as "What could my portfolio become?" with typical, weak, loss, and doubling outcomes
- redesigned stress testing as "What happens if markets change?" with natural-language scenarios and advanced controls hidden by default
- moved hedging into an explicitly optional Advanced lab
- updated command palette and shortcut labels to match the investor-first navigation

### Added

- investor-friendly product requirements in `docs/product-requirements.md`
- progressive disclosure pattern: answer first, explanation second, technical detail third

## 0.1.1 — Clean portfolio onboarding

### Changed

- added a focused landing page that asks users for portfolio value and ticker allocations before showing analytics
- replaced the dense desktop-workstation titlebar with a compact product header
- simplified analysis navigation to Risk Overview, Monte Carlo, Stress Tests, and Hedging & AI
- moved export, install, layout, help, and quick actions into compact utility menus
- added an Edit Portfolio flow that returns users to the allocation builder without losing their current holdings
- simplified footer language and removed workstation-specific visual clutter

### Added

- sample portfolio path for first-time users
- allocation validation with a live 100% progress indicator
- explicit disclosure of the current modeled-asset limitation on the onboarding screen

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
