## Deploy to Cloudflare

RiskLab can run as one Cloudflare Worker serving the React app and `/api/*` endpoints. The quantitative engine continues to run in the browser; no database is required for the current app.

See [Cloudflare deployment guide](docs/cloudflare-deployment.md) for GitHub auto-deploy settings and local deployment instructions. The Cloudflare deployment uses Workers AI (Llama 3.3) for scenario interpretation and the copilot, with visibly labeled deterministic fallbacks. The existing Express development and Node deployment commands remain available.

# RiskLab

**AI-assisted quantitative portfolio risk analysis, stress testing, and Monte Carlo simulation.**

RiskLab is a full-stack TypeScript application for exploring portfolio risk through deterministic quantitative models and an AI-assisted scenario interface. The core design principle is simple:

> **AI interprets the question. Deterministic code calculates the risk.**

The application combines portfolio analytics, parametric VaR / Expected Shortfall, factor stress testing, Monte Carlo simulation, correlation analysis, risk attribution, and illustrative hedge modeling in a desktop-style React interface.

## Why I built it

Risk tools often fall into one of two categories: opaque institutional systems or simple dashboards that hide the assumptions behind the numbers. RiskLab is an experiment in making portfolio risk modeling both **interactive** and **inspectable**.

The project also explores a practical pattern for AI-enabled software: use an LLM for natural-language interpretation and explanation, while keeping financial calculations inside a bounded, testable quantitative engine.

## Current status

**v0.2.0 — Investor-friendly MVP**

The current release keeps the validated quantitative engine but changes the product experience for informed individual investors. The default interface answers plain-English questions first — how risky is my portfolio, what drives that risk, what if markets change, and what could the portfolio become — while technical methodology remains available on demand.

See [`docs/product-requirements.md`](docs/product-requirements.md) for the MVP product principles and [`docs/phase-1-correctness.md`](docs/phase-1-correctness.md) for the quantitative validation baseline.

## Features

| Area | Capabilities |
| --- | --- |
| Portfolio onboarding | Clean ticker/allocation builder with sample portfolio and allocation validation |
| Overview | Plain-English risk level, diversification, biggest risk driver, holdings, and optional advanced metrics |
| Diversification | Plain-English view of which holdings move together, powered by the correlation model |
| Risk metrics | 95%/99% parametric VaR and Expected Shortfall across multiple horizons |
| What If? | Preset and natural-language market scenarios with estimated portfolio impact |
| Future | Long-term simulated outcome ranges with technical Monte Carlo details available on demand |
| Advanced lab | Optional illustrative protective puts, put spreads, collars, beta overlays, and AI copilot |
| AI copilot | Natural-language scenario parsing and risk explanations using Cloudflare Workers AI (hosted) or legacy Gemini (local) |
| Desktop/PWA UX | Installable PWA, keyboard shortcuts, exportable JSON/CSV snapshots |

## Architecture

```mermaid
flowchart LR
    UI[React / TypeScript UI] --> API[Worker / Express API]
    UI --> QE[Quant Engine]
    API --> AI[Workers AI / Gemini Parser]
    AI --> B[Bounded Scenario Inputs]
    B --> QE
    QE --> R[Risk Metrics]
    QE --> S[Stress Results]
    QE --> M[Monte Carlo]
    QE --> H[Hedge Illustrations]
    R --> UI
    S --> UI
    M --> UI
    H --> UI
```

The AI layer does **not** calculate portfolio risk. It converts narrative scenarios into structured, bounded assumptions. The deterministic engine remains the authority for portfolio mathematics.

More detail: [`docs/architecture.md`](docs/architecture.md)

## Quantitative methodology

RiskLab currently implements:

- portfolio variance using a covariance matrix derived from modeled volatilities and correlations
- positive-semidefinite projection for internally consistent correlation matrices
- marginal and percentage risk contribution
- annualized volatility
- Sharpe ratio
- downside-deviation-based Sortino ratio under the stated normal model
- parametric VaR and Expected Shortfall at 95% and 99% confidence levels
- first-order duration sensitivity for fixed-income stress scenarios
- hierarchical market / technology / semiconductor stress factors
- Black-Scholes option pricing for illustrative hedge economics
- geometric Brownian motion for long-horizon simulation

The full methodology, assumptions, and limitations are documented in [`docs/quantitative-methodology.md`](docs/quantitative-methodology.md).

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Backend:** Cloudflare Worker for hosting; Node.js / Express for local development; TypeScript
- **AI:** Cloudflare Workers AI (Llama 3.3) for hosting; Google Gemini via `@google/genai` for the legacy local server
- **Quant layer:** custom TypeScript risk engine
- **PWA:** `vite-plugin-pwa`
- **Testing:** focused quantitative test suite executed with `tsx`

## Welcome page and the Lab

The welcome page at `/` introduces the project, its three analysis views, and the
motivation from “Why I built it.” **Enter the Lab** opens portfolio setup at `/lab`;
**Try a sample portfolio** loads a historically calibrated sample before opening
Overview. The historical snapshot is requested when entering the Lab or opening a
sample, rather than while reading the welcome page. Existing query-based app links
continue to enter the Lab. Overview leads with the actual portfolio: every holding,
company name, invested amount, and allocation. Samples are marked as examples and
can be edited or regenerated before exploring the risk analysis.

Historical calibration is the standard path for custom portfolios, samples, and
portfolio templates; there is no model-selection checkbox or silent proxy fallback.
Uncovered holdings remain unavailable until usable history is added to the batch
snapshot. Data dates, coverage, and model disclosures follow the main content at
the bottom of setup and analysis pages.

The Lab has three views: **Overview**, **What If?**, and **Future**. **Ask Copilot**
opens a companion panel alongside the current view, also available through quick
actions or Command/Ctrl+4. It stays open across view changes and preserves the
conversation when closed and reopened. Changing portfolio holdings resets its
conversation. Escape closes the panel and restores focus. Opening it makes no AI
request; questions are sent only after an explicit user action. Existing source
labels and opt-in rule-based summaries remain in place.

The RiskLab brand link returns to the welcome page. The current portfolio remains
available when returning to the Lab within the same session; reloading the app
still starts with portfolio setup.

## Run locally

### Prerequisites

- Node.js 20+
- npm or Bun
- Optional: a Gemini API key for AI scenario parsing and the copilot

### Install

Using npm:

```bash
npm install
```

Or with Bun:

```bash
bun install
```

### Configure AI (optional)

Copy the example environment file:

```bash
cp .env.example .env
```

Then add your key:

```env
GEMINI_API_KEY=your_key_here
```

RiskLab still runs without a Gemini key. AI endpoints fall back to deterministic, portfolio-aware behavior where available.

### Start development server

```bash
npm run dev
```

Open `http://localhost:3000`.

### Validate the quantitative engine

```bash
npm run test:quant
```

### Type-check

```bash
npm run lint
```

### Production build

```bash
npm run build
npm start
```

## Quantitative validation

The focused test suite checks invariants that should hold regardless of portfolio composition, including:

- correlation matrix symmetry, unit diagonal, and PSD behavior
- risk-contribution decomposition
- VaR / Expected Shortfall ordering
- fixed-income duration direction under rate shocks
- ticker-specific shock precedence
- market / technology / semiconductor factor hierarchy
- removal of unsupported hedge-floor claims
- Black-Scholes put-call parity and option delta bounds

Run:

```bash
npm run test:quant
```

## AI-assisted development

RiskLab began as an AI-assisted prototype. Generative AI was used to accelerate UI scaffolding and implementation, but the quantitative engine is being manually reviewed, tested, and refactored before the project is treated as technically trustworthy.

One example: an early version used manually specified pairwise correlations that looked plausible individually but produced a correlation matrix with a negative eigenvalue. The engine was corrected to project modeled correlations to a positive-semidefinite matrix before portfolio variance calculations. The correction process is documented rather than hidden because validating AI-generated code is part of the engineering work.

## Project structure

```text
risklab/
├── docs/
│   ├── architecture.md
│   ├── phase-1-correctness.md
│   ├── product-requirements.md
│   ├── quantitative-methodology.md
│   └── roadmap.md
├── public/
├── scripts/
├── src/
│   ├── components/
│   ├── types/
│   └── utils/
│       └── quantEngine.ts
├── tests/
│   └── quantEngine.test.ts
├── server.ts
├── package.json
└── vite.config.ts
```

## Roadmap

The next major milestone is to replace hardcoded market assumptions with a market-data layer and support arbitrary real-world portfolio tickers. See [`docs/roadmap.md`](docs/roadmap.md).

## Important limitations

RiskLab is currently a research and engineering project, not a production trading or portfolio-management system. In particular:

- volatility, correlation, and beta are historical estimates; forward growth and macroeconomic stress sensitivities retain modeled assumptions
- the application uses dated historical snapshots, not a live quote feed
- Monte Carlo uses constant-parameter geometric Brownian motion
- hedge outputs are illustrative and do not use a live option chain
- parametric VaR / Expected Shortfall use a normal-return model and can understate fat-tail risk

## Disclaimer

RiskLab is an educational and software-engineering project. It does **not** provide investment advice, trading recommendations, or guarantees of future performance. Model outputs are sensitive to assumptions and should not be relied upon for real financial decisions without independent validation.

### US-listed holdings directory

Both holding pickers search tickers and security names from a committed Nasdaq Trader snapshot:
`public/symbols/us-listed.json`. Sources are Nasdaq-listed and other-listed directories at
https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt and
https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt. The snapshot records download time
and source file creation times. It includes US exchange-listed stocks (including ADRs) and
ETFs; test issues, warrants, rights, preferred issues, notes and closed-end funds are excluded.
It is a listing directory, not a live quote feed; some corporate actions or unusual issue names
may require a refresh or filter adjustment. Refresh deliberately with `npm run refresh:symbols`
and commit the resulting snapshot. Failed downloads preserve the existing file.

Portfolios support up to 30 covered holdings. Each uses its own historical model;
the broader listing directory includes some securities without usable history.
Those holdings remain unavailable until a later batch adds sufficient, valid data.
Security names, tickers, model provenance, and data dates remain visible and are
preserved in exports. Run `npm run test:symbols` for directory and model checks.

### Historical risk models from a public snapshot

RiskLab calculates each covered holding's risk from a committed, dated public dataset,
loaded once and reused in the browser. Changing allocations, adding covered holdings and running
analysis do not call a market-data API. No account, token or backend market-data secret is needed.
The PWA also caches the snapshot and its content-addressed parts. The listing directory
remains broader than historical coverage. All portfolio holdings are calibrated against
the same historical snapshot, with no hidden mixture of historical and preset covariance estimates.

`npm run refresh:risk-models` deliberately rebuilds `public/models/historical-snapshot.json`
from the publicly readable `post-no-preference/stocks` DoltHub database. The generator uses its
indexed daily closing-price records and dividend/split tables to form total-return indices over
the latest available year. It checks query completeness, valid closes, source dates, minimum
history and availability of corporate-action dates. Missing, short or stale symbols are omitted;
failed refreshes preserve the previous snapshot. Refresh and commit the file when desired;
there is no runtime upstream price fetch. Optional weekly local scheduling is described below. Repeated generator queries have a
seven-day temporary cache to permit resuming downloads; remove `risklab-public-data-cache` from
your system's temporary directory if you need to bypass it for source corrections.

For the selected holdings and SPY benchmark, RiskLab aligns identical daily return intervals,
requires at least 126 common returns, and calculates sample variance/covariance, annualized
volatility (252 days), correlations, beta versus SPY, and annualized arithmetic historical mean
return. The mean supplies the existing simulation/parametric risk drift and is explicitly labeled
as historical, not a forecast. VaR/CVaR still use the normal-distribution model; this does not
turn them into empirical historical VaR. Rate duration and sector stress sensitivities remain
preset assumptions where available; unknown holdings use only their measured market beta in
factor stress tests, with zero unspecified sector/rate loadings. Closing prices alone do not
estimate all macroeconomic transmission paths. No live quote or future return is implied.

The UI and JSON export preserve provider, observation count, historical window, capture time,
correlations and last closing-price date. CSV identifies the risk mode and data-through date.
All holdings in an updated historical portfolio are recalibrated together against the same
snapshot and window. Flat series produce zero volatility with finite risk contributions.

Data attribution: https://www.dolthub.com/repositories/post-no-preference/stocks,
creator `post-no-preference`, licensed CC BY-SA 4.0. RiskLab's stored adjusted indices and derived
historical-model data are adaptations distributed under the same license:
https://creativecommons.org/licenses/by-sa/4.0/. Adjustments and methodology are described above.
This data license does not change the license of unrelated application code. Snapshot and
model data retain source and license metadata. The public dataset is community-maintained;
corporate actions, source corrections and ticker reuse can affect estimates. Inspect the visible
as-of date and coverage before relying on a model.

### Ad hoc full-directory historical refresh

Run `npm run refresh:risk-models` to rebuild historical models for the entire committed
`public/symbols/us-listed.json` directory, including SPY as the benchmark. There is no
hardcoded ticker allowlist. Optionally run `npm run refresh:symbols` first to update listings.
The browser calculates each covered ticker's model from its own adjusted return series;
portfolio covariance still uses matching daily intervals across the selected holdings.

The batch scans one year of daily prices with one aggregate per day, validating its
size against the source row count to avoid the public API's 1,000-row cap. Dividend
and split downloads use explicit pagination below that cap. A full refresh can take several minutes
or longer depending on source latency. Interrupted runs reuse successfully downloaded
pages for seven days. Retry the same command to resume. No API key is required.

```bash
npm run refresh:risk-models
# Reduce concurrent day downloads if the public source is busy:
npm run refresh:risk-models -- --workers 4
# Generate an isolated candidate without replacing the app's snapshot:
npm run refresh:risk-models -- --output /tmp/risklab-models/historical-snapshot.json
```

The manifest records `coverage` counts and an `exclusions` reason for every uncovered ticker:
`no_source_history`, `stale_history`, `insufficient_history` (fewer than 127 closes),
`invalid_price`, `invalid_corporate_action`, `duplicate_prices`, `missing_corporate_action_price`,
`invalid_adjusted_history`, or `insufficient_benchmark_overlap`. Some new listings or securities absent from the public dataset
cannot have a valid own-history model yet. These remain visibly unavailable in the Lab; the batch never substitutes another security's model.

Output is `public/models/historical-snapshot.json` plus content-addressed `history-*.json`
parts with at most 500 holdings each. All parts are written before atomically replacing the
manifest. Failed downloads, missing benchmark data, fewer than 150 covered tickers, or a
coverage drop greater than 10% preserve the current manifest. Old parts remain safe for
clients that already loaded the previous manifest; remove unreferenced parts deliberately
before committing a refreshed snapshot. Commit the manifest and every referenced part
together, then run `npm run test:history` and `npm run build`.

### Weekly refresh on a local Mac

The macOS scheduler can run the batch without Codex, an LLM, or AI token usage.
Install once from the repository:

```bash
python3 scripts/local-refresh/install.py
```

This installs the per-user LaunchAgent `com.risklab.weekly-refresh` for **Saturday
at 22:00 in the Mac's system time zone** (10 PM Central when set to Chicago).
It copies the runner into `~/Library/Application Support/RiskLab/weekly-refresh/`;
re-run the installer after changing the runner. Nothing runs immediately at install.
Your Mac must be logged into your account and have internet access. If asleep at
that time, launchd runs the missed calendar job on wake. The runner uses `caffeinate`
to prevent idle sleep while working; it cannot run while the Mac is powered off.

Prerequisites: Git, Python 3, Node.js 20+, npm, and GitHub CLI authenticated using
`gh auth login`, with permission to push branches and open PRs in this repository.
The installer records the required tool directories for noninteractive runs. No credentials
are copied into the LaunchAgent or stored in repository files.

Each run clones current GitHub `main` into a disposable checkout, refreshes the
historical data, runs TypeScript checks, all existing application test suites, and
both builds, then pushes a unique `codex/risk-models-*` branch and opens a PR.
Your development checkout is untouched. Old snapshot parts are pruned only in the
disposable checkout. A failed check prevents publication. A timestamp-only update
creates no PR, and an existing open refresh PR pauses new refreshes until reviewed.
The job never merges PRs or deploys directly; approval and merge trigger the existing
Cloudflare integration.

Validate the full pipeline without publishing anything:

```bash
python3 scripts/local-refresh/run.py --validate-only --state-dir /tmp/risklab-weekly-validation
```

Inspect `~/Library/Application Support/RiskLab/weekly-refresh/status.json` for the
last outcome and its log path. Detailed per-run logs live in the `logs/` subfolder.
Logs are local and retained for troubleshooting; no automated AI review runs.

```bash
# Run once on demand using the installed job:
launchctl kickstart gui/$(id -u)/com.risklab.weekly-refresh
# Inspect the schedule and most recent exit status:
launchctl print gui/$(id -u)/com.risklab.weekly-refresh
# Disable future scheduled runs:
launchctl disable gui/$(id -u)/com.risklab.weekly-refresh
```

Scheduler regression checks: `python3 tests/localRefresh.test.py`.
