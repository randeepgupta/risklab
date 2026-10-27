# Roadmap

RiskLab is being developed in deliberate phases so that additional features do not outrun the reliability of the underlying models.

## Current delivery plan — October 2026

The original phases below are historical planning notes. Historical calibration,
batch refresh, measured conditional stress responses, a Welcome/Lab flow and the
Copilot companion panel have shipped. They are no longer pending market-data work.

The next phase is delivered in reviewable releases:

- **A, shipped:** named local saved portfolios, versioned backup/restore,
  persisted What If and Future settings, validation CI and refresh reports.
- **B, in review:** CSV portfolio import with mapping, value reconciliation and
  coverage review. The five-user pilot is still pending.
- **C, planned:** side-by-side current/proposed allocation comparisons on a common
  model revision, historical window and scenario assumptions.

Independent-source reconciliation and chronological model evaluation remain
required research; an automated input report is not a substitute. Historical
replays and ETF look-through depend on suitable verified, licensed data. See
[saved-portfolio release details](saved-portfolios.md).
See [CSV import and pilot tasks](csv-import.md) for release B's supported inputs
and remaining user validation.

## Phase 1 — Quantitative correctness ✅

Completed:

- PSD-safe correlation handling
- corrected fixed-income duration sign
- improved stress-factor hierarchy
- direct 95%/99% VaR and Expected Shortfall calculations
- more defensible Sortino calculation
- corrected Monte Carlo labels
- removal of unsupported hedge-floor claims
- bounded AI scenario inputs
- focused quantitative invariant tests

Detailed notes: [`phase-1-correctness.md`](phase-1-correctness.md)

## Phase 2 — Market data + model architecture

Planned:

- market-data provider abstraction
- historical price ingestion
- return-series construction
- historical covariance / correlation estimation
- beta and factor-exposure estimation
- explicit separation of observed statistics and forward assumptions
- support for arbitrary stock / ETF tickers
- modularize the quantitative engine by responsibility

## Phase 3 — Test depth + CI

Planned:

- expand unit tests around edge cases
- historical fixture datasets
- regression tests for stress scenarios
- property/invariant tests for covariance and risk decomposition
- API schema tests
- GitHub Actions validation pipeline

## Phase 4 — Portfolio ingestion

Planned:

- Fidelity CSV import
- generic brokerage CSV mapping
- ticker normalization
- unsupported/security-type warnings
- portfolio overlap and concentration analysis

## Phase 5 — Planning analytics

Planned:

- recurring contributions
- 1–30 year horizons
- inflation-adjusted outcomes
- maximum-drawdown distributions
- rebalancing policies
- historical bootstrapping / fat-tail simulation

## Phase 6 — Deployment hardening

Planned:

- authentication if public accounts are introduced
- AI endpoint rate limiting
- API quotas
- production observability
- separate client/server build artifacts
- live demo deployment
