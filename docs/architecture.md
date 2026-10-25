# Architecture

RiskLab is designed around a strict separation between **language interpretation** and **financial computation**.

## Design principle

> Explicit user scenarios are parsed into measurable assumptions; AI explanations do not control portfolio mathematics.

This boundary makes the system easier to test, reason about, and evolve.

## High-level flow

```mermaid
flowchart TD
    U[User] --> FE[React UI]
    FE -->|positions| QE[Quantitative Engine]
    FE -->|natural-language scenario| API[Express API]
    API --> PARSER[Shared explicit-shock parser]
    PARSER --> QE
    SNAP[Historical snapshot + Treasury yields] --> QE

    QE --> RM[Risk metrics]
    QE --> RC[Risk contribution]
    QE --> ST[Stress testing]
    QE --> MC[Monte Carlo]
    QE --> HG[Hedge illustrations]

    RM --> FE
    RC --> FE
    ST --> FE
    MC --> FE
    HG --> FE
```

## Frontend

The frontend is a React + TypeScript application organized around several analytical views:

- portfolio risk and VaR
- correlation matrix
- risk contribution
- Monte Carlo simulation
- factor stress testing
- hedging lab

Portfolio edits trigger deterministic recalculation through `src/utils/quantEngine.ts`.

## Quantitative engine

The quantitative engine contains the financial models and has no dependency on Gemini. Its responsibilities include:

- modeled asset metadata
- portfolio normalization
- correlation construction and PSD projection
- covariance and portfolio variance
- risk contribution
- VaR / Expected Shortfall
- downside-risk metrics
- stress testing
- Monte Carlo simulation
- Black-Scholes option pricing
- illustrative hedge economics

Portfolio mathematics remain in `quantEngine.ts`; `historicalModels.ts` calibrates risk statistics and `measuredScenario.ts` handles historical stress sensitivities. The batch snapshot supplies reproducible inputs.

## API layer

`server.ts` provides:

- `/api/health`
- `/api/gemini/parse-scenario`
- `/api/gemini/ask-copilot`

The server owns the Gemini credential. The browser never receives the API key.

### Scenario safety boundary

Both deployments use `api/scenario-parser.ts` for explicit numeric shocks. It
validates supported drivers, magnitudes, directions, units and held ticker symbols.
Ambiguous requests return clarification errors; values are rejected rather than
silently clamped. It makes no AI call and does not invent missing magnitudes.

The browser estimates joint measured responses from the historical snapshot, and
refuses a portfolio total for missing coverage or invalid fits. See
[the scenario model](scenario-model.md). The copilot remains an optional AI
explanation service; its prose does not supply scenario price changes.

## Development / production

In development, Express hosts Vite in middleware mode so API and frontend requests share one server.

In production, Vite builds the browser application and the Express server serves the generated assets plus API endpoints.

## Future architecture direction

The next major boundary is a market-data service:

```mermaid
flowchart LR
    CSV[Portfolio CSV] --> N[Portfolio Normalizer]
    N --> MDS[Market Data Service]
    MDS --> HR[Historical Returns]
    HR --> COV[Covariance / Factor Estimation]
    COV --> QE[Risk Engine]
    QE --> UI[Analytics UI]
```

That will allow RiskLab to replace hand-entered market assumptions with reproducible historical inputs while retaining explicit forward-looking assumptions separately.
