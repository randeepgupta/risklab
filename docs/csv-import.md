# CSV portfolio import

Release B adds a browser-only **Import CSV** flow to portfolio setup and the Lab's
**More actions** menu. Choose a file (or paste CSV), check the column mapping,
name/date the allocation, then review every row and the reconciled total before
applying. Import replaces the open allocation and resets its What If/Future
settings. Saved portfolios are kept. Choose Save portfolio afterward to persist
the new inputs; importing alone does not write to localStorage.

## Supported inputs

The initial release accepts current **USD market values**, not share quantities,
cost basis, individual prices, or percentage weights. Each CSV must start with
unique column headers and contain holdings only. Suggested mappings recognize
Ticker/Symbol, Market Value/Current Value/Investment and Currency. Ambiguous
columns require a manual choice. Obvious cost, price, quantity, weight and
account-identifier columns cannot be used as dollar values.

Example: [downloadable sample](../public/examples/portfolio.csv).

```csv
Ticker,Market Value,Currency
SPY,65000.25,USD
BND,29999.75,USD
GLD,5000.00,USD
```

The parser handles [RFC 4180 quoting](https://www.rfc-editor.org/rfc/rfc4180),
including quoted commas, escaped quotes and embedded newlines. UTF-8 BOM,
CRLF/LF/CR records and entirely blank rows are accepted. Limits: 1 MB, 1,000 holding
rows, 100 columns and 30 distinct final holdings. Nonempty footer/total rows,
ragged rows and repeated headers are not silently discarded. Remove report
titles, totals, footnotes and unsupported rows in the source file, with awareness
that a stock/ETF subset is not a model of an entire account that also holds cash.
This is a generic mapper, not a claim of full broker-format compatibility.

Market values may include a dollar sign, USD prefix, correctly grouped thousands
and up to two decimal places. Decimal amounts are converted to integer cents;
totals and duplicates reconcile before dollar values enter the quantitative
engine. Scientific notation, formulas, partial numbers, foreign currency symbols
and decimal-comma formats are rejected. The maximum total is $1 trillion.
Negative/zero balances and short positions block the import.

## Review and coverage

- Tickers are trimmed and uppercased. Share-class punctuation is not rewritten
  into another ticker; choose the exact identifier in the symbol directory.
- Repeated tickers remain visible with their source lines. The user must confirm
  combining their dollar values. No ticker is silently deduplicated or dropped.
- An optional expected total compares the file with a holdings statement. A
  mismatch blocks import. A second confirmation acknowledges USD market values
  and the complete intended portfolio. Displayed allocation percentages are
  rounded for readability; calculation uses the exact reviewed dollar amounts.
- If the file has a recognized currency column, it must be mapped. Every mapped
  and recognized currency field must say USD; no conversion is performed. When
  there is no currency column, USD requires the user's explicit confirmation.
- Cash, money-market balances and ambiguous cash/currency labels such as CASH
  and USD block import. Those labels are not automatically resolved to similarly
  named listed securities. The release has no cash risk model. Individual bonds,
  options, crypto and other instruments without an eligible stock/ETF historical
  model are unavailable. Money-market funds are not treated as cash or bond ETFs.
- Explicit Security Type/Instrument Type/Asset Type columns are checked on every
  row, even though they are not retained. Only stock/equity and ETF values are
  accepted; an option's underlying ticker is not a stock position. Public directory
  names identifying stock-kind warrants, rights, units and notes also block import.
  Without a security-type column, the user's review must confirm stock/ETF holdings
  with their actual security tickers. The importer cannot infer a security's type
  from an underlying ticker or a missing description.
- Missing or quarantined models block the complete import. There is no proxy,
  partial portfolio analysis, or silent renormalization. Coverage is checked
  again at application time; every holding is recalibrated against the current
  snapshot before any open inputs are replaced. If calibration fails, the open
  portfolio remains unchanged.

The allocation valuation date is entered as MM/DD/YYYY and stays separate from
the historical model date. Opening Edit and reanalyzing unchanged allocations
preserves their exact dollar amounts and fractional-dollar total. Save/restore
uses the existing versioned portfolio schema, including that valuation date.

## Privacy and validation

Raw CSV data is held only in dialog memory and cleared on close/import. It is not
uploaded, logged, persisted, or sent to Copilot. Only tickers, reviewed dollar
values, the user-entered portfolio name/date and public directory names enter
the workspace. Account identifiers and raw description columns are not carried
forward. Optional Copilot use later follows the existing active-portfolio behavior.

`npm run test:csv` covers parser boundaries, malformed/partial inputs, currency,
mapping, blocked rows, stale coverage, duplicate consent, cent reconciliation,
privacy, calibration, precision through Edit, and save/restore. CI and the weekly
local refresh pipeline include the suite. After merge, reinstall the existing
Saturday runner with `python3 scripts/local-refresh/install.py` to update its
copied check list. The schedule stays unchanged.

## Five-user pilot — pending

The software checks do not establish product usability. Run the same tasks with
five consenting users before calling release B's pilot complete. Use sanitized
files and observations, without collecting raw brokerage exports or balances.

1. Import a supported stock/ETF file, review the mapping, explain its total and
   valuation date, and reach the Lab. Proposed target: four of five finish in
   under three minutes without assistance.
2. Present a file with a duplicate, cash balance, non-USD value or uncovered
   ticker. Verify that users understand why it cannot be partially analyzed.
3. Save the imported allocation, close/reopen the app, resume it and identify the
   allocation date versus the model date.
4. Record completion time, errors and confusing labels; do not record account
   identifiers, file contents or actual portfolio amounts. Revise the mapper
   from findings before claiming compatibility with any specific brokerage.
