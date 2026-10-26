# Saved portfolios and release validation

This is release A of the next-phase proposal: saved inputs/settings, validation CI,
and an automated snapshot report. CSV import, comparison, independent-source model
validation and longer historical replays remain later work.

## Save and resume

Choose **Save portfolio** in the Lab. Give it a name and confirm the date of the
entered dollar values. Save changes updates the active record; Save a copy creates
a separate record. The library is available from Welcome, portfolio setup and the
Lab. Welcome offers direct resume links to the three most recently saved records.

A save includes holdings and dollar amounts, the active view, Future growth/horizon/
simulation settings, the What If draft and submitted assumptions, manual overrides
and reset baseline. It records the model snapshot's data date, capture time and
source revision. The allocation-value date is separate from the model-data date.

Only an explicit save writes this information to localStorage under
`risklab.saved-portfolios.v1`. Browser storage is device/origin specific, can be
cleared by the browser, and is not a claim of encryption or cloud sync. Preview
workers.dev domains, localhost and risklab.us have separate libraries. Backups
can transfer inputs between them.

Resume recalibrates all holdings against the snapshot loaded by the current app.
It reruns simulations and scenarios instead of displaying cached risk results.
Random simulation outcomes may differ even with identical settings. Changed model
snapshot metadata is disclosed. If a holding lacks coverage, its saved amount is
kept in portfolio setup and analysis stays blocked until the user resolves it.
There is no silent proxy, exclusion or renormalization.

Unsaved open inputs require confirmation before resume replaces them. Concurrent
updates to the same saved record in another tab are detected; reopen the record
or save a copy instead of overwriting a newer version.

## Backup and recovery

Download backup writes a versioned JSON library. Restore reads and validates that
file in the browser, previews the names/count and requires an explicit add action.
Existing records are kept; matching IDs create separate copies. The limit is 50
saved portfolios, 30 holdings per portfolio, and 1 MB per backup. Only USD positive
dollar allocations and supported analysis settings are accepted.

Backups do not contain prices, historical calibration arrays, cached risk results,
account-identifying columns or Copilot conversations. They are different from the
existing analysis JSON exports. Restore only accepts this saved-library format.

Unreadable data or an unknown version is preserved. The library offers download
of the original stored bytes and an explicit confirmed clear action. Failed storage
writes do not replace the saved library. Download this portfolio can back up the open inputs even when browser storage is unavailable. Deleting a record requires confirmation;
a downloaded backup can restore it. These operations affect only RiskLab's key.

What If parsing sends only held ticker identifiers to its deterministic API.
Copilot remains optional and sends active portfolio context when the user asks a
question; it is not sent the saved library or backup file.

## CI and refresh reports

`.github/workflows/validation.yml` runs the existing application test suites,
saved-portfolio tests, refresh/report tests, TypeScript checks and both Node and
Cloudflare builds. It uses pinned official actions, read-only repository permissions,
and no market-data or AI secrets. Required status check: **RiskLab validation**.
Human merge approval remains part of the project workflow.

Run the current snapshot report without network access:

```sh
npm run report:risk-models
```

Reports appear in ignored `artifacts/risk-model-report.md` and `.json`, and CI
uploads them for review. To compare a candidate with an earlier manifest, use:

```sh
npm run report:risk-models -- --before /path/to/previous/historical-snapshot.json
```

If the old manifest was copied elsewhere, supply `--before-parts-dir` pointing to
its original part directory. Both snapshots' referenced parts must be available.
The report validates part hashes and cardinality, records model/code and source
revisions, dates, exclusion/quarantine counts, missing observations and Treasury
coverage. With a baseline it also lists coverage/quarantine additions/removals,
reviewed override metadata changes and revised overlapping return intervals.
Rebasing an adjusted index alone is not reported as a return revision. A gap is not
compared with a one-day return. Numerical changes under 1e-6 decimal return are
ignored to avoid index-rounding noise.

The local weekly runner adds a comparison summary to its data PR, commits the
complete `public/models/validation-report.json`, and preserves both report formats
under its state folder's `reports/` directory. It retains the tests/builds and
approval-before-merge behavior. After this code is merged, reinstall the existing
runner with `python3 scripts/local-refresh/install.py` so its installed copy picks
up report generation. The Saturday 22:00 schedule does not change.

Model report ID: `historical-conditional-v1`; update it when changing the statistical
method, and retain the exact code revision. This report describes automated input
screens. It does not independently verify the source or establish forecast skill.
