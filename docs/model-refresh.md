# Model snapshots and local refreshes

RiskLab serves a committed historical snapshot; the browser does not fetch upstream
market prices when an allocation changes. Refreshing is a deliberate batch operation.
The batch pins an immutable Dolt source revision, builds split/dividend-adjusted
indices, and aligns official FRED DGS10 Treasury observations. Data-quality screens,
cutoffs, attribution and remaining limits are described in
[historical data quality](historical-data-quality.md).

## Ad hoc full-directory historical refresh

Run `npm run refresh:risk-models` to rebuild historical models for the entire committed
`public/symbols/us-listed.json` directory, including SPY as the benchmark. There is no
hardcoded ticker allowlist. Optionally run `npm run refresh:symbols` first to update listings.
The browser calculates each covered ticker's model from its own adjusted return series;
portfolio covariance still uses matching daily intervals across the selected holdings.

The batch scans one year of daily prices with one aggregate per day, validating its
size against the source row count to avoid the public API's 1,000-row cap. Dividend
and split downloads use explicit pagination below that cap. A full refresh can take several minutes
or longer depending on source latency. Interrupted runs reuse successfully downloaded
pages for seven days within the same immutable source revision. A new revision downloads fresh data. Retry the same command to resume. No API key is required.

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
`invalid_adjusted_history`, `unverified_extreme_return`, or `insufficient_benchmark_overlap`. Some new listings or securities absent from the public dataset
cannot have a valid own-history model yet. These remain visibly unavailable in the Lab; the batch never substitutes another security's model.

Output is `public/models/historical-snapshot.json` plus content-addressed `history-*.json`
parts with at most 500 holdings each. All parts are written before atomically replacing the
manifest. Failed downloads, missing benchmark data, fewer than 150 covered tickers, or an
unexplained coverage drop greater than 10% preserve the current manifest. Documented extreme-return quarantines are reported separately from an unexplained source regression. Old parts remain safe for
clients that already loaded the previous manifest; remove unreferenced parts deliberately
before committing a refreshed snapshot. Commit the manifest and every referenced part
together, then run `npm run test:history` and `npm run build`.

The refresh also records corporate-action feed dates, a conservative cutoff policy when those feeds lag prices, reviewed split corrections, and a quarantine for unverified absolute returns of at least 50% between observations. Genuine extreme moves can be excluded pending review. Inspect the manifest for the current price cutoff and Treasury observation dates. See [quality and provenance](historical-data-quality.md).

## Snapshot reports

Generate the current snapshot report without fetching market data:

```sh
npm run report:risk-models
```

Markdown and JSON outputs are written to ignored `artifacts/`. To compare a
candidate with an earlier manifest:

```sh
npm run report:risk-models -- --before /path/to/previous/historical-snapshot.json
```

Supply `--before-parts-dir` if the earlier manifest was copied away from its parts.
Reports record hashes, coverage, exclusions, quarantines, missing observations,
Treasury coverage and source/code revisions. Comparisons also report changed
coverage and overlapping return intervals. These are automated input screens,
not independent source reconciliation or evidence of forecast accuracy.

The weekly runner preserves reports under its state folder's `reports/` directory,
commits `public/models/validation-report.json`, and adds the comparison summary to
its PR. See [report details](saved-portfolios.md#ci-and-refresh-reports).

## Weekly refresh on a local Mac

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
