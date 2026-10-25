# Historical snapshot quality and provenance

The batch snapshot is input to the statistical models. Finite numbers and a current
closing date are necessary checks, but do not establish that a return series is
correct. A missing reverse split can otherwise look like a gain of thousands of
percent and contaminate volatility, covariance, beta, risk estimates, and scenario
sensitivities.

## Consistent source revisions and corrections

Every refresh first reads the Dolt repository's current `DOLT_HASHOF('HEAD')` and
records it as `sourceRevision`. All subsequent price, dividend, and split SQL
queries use `AS OF` that immutable revision. This prevents a long-running batch
from mixing different revisions of those tables. The query cache includes the
pinned SQL and source endpoint in its key; a new source revision cannot reuse an
older revision's cached rows. The unpinned revision lookup is always fresh. Cached
rows from an interrupted run can still be reused for the same immutable revision.

The generator verifies aggregate price cardinality and counts every bounded
corporate-action page against a source row count. These checks establish transport
completeness for the selected repository revision, not completeness of the
provider's underlying economic data.

## Action-feed lag and analysis cutoff

The generator records the latest observed dividend and split event dates on or
before the latest available price date. If either observation date lags prices by
more than three weekdays, the analysis cutoff is conservatively moved to the
latest available price date on or before the earlier action observation date.
The manifest records `priceDataAsOf`, `analysisCutoff`, `cutoffReason`, and each
feed's `latestEventDate` and `lagBusinessDays`.

An event date is **not** a provider guarantee that every action through that date
has been captured. `completeThrough` therefore remains `null`. This lag policy is
a conservative screen, not certification of complete corporate-action coverage.
A missing action feed prevents publication. Existing good output is retained when
a download or validation fails.

## Reviewed corrections and extreme-return quarantine

`scripts/data/corporate-action-overrides.json` contains narrowly reviewed split
corrections with effective date, explicit share ratio, verification date, and a
primary issuer or SEC source. An override is applied only inside the analysis
window. An equivalent source action is recorded as `already_present`; conflicting
source ratios fail the refresh instead of being silently overwritten.

The initial reviewed cases are:

- AMTD: its ADS ratio changed from six to 360 ordinary shares per ADS, economically
  a one-for-60 reverse split effective October 19, 2026.
  [Issuer SEC exhibit](https://www.sec.gov/Archives/edgar/data/1769731/000121390026107254/ea030787901ex99-1.htm).
- DKI: a one-for-50 share consolidation effective October 22, 2026.
  [Issuer announcement](https://www.globenewswire.com/news-release/2026/10/19/3383397/0/en/darkiris-inc-announces-share-consolidation.html).

After available actions are applied, a holding with an absolute return of at
least 50% between any consecutive observations is quarantined as
`unverified_extreme_return`. No return is clipped or winsorized to disguise the
problem. The threshold is a documented operational review policy, not a claim
that such a move is impossible. It may quarantine genuine market moves, especially
in speculative or leveraged securities; those require data review before
publication. `dataQuality.quarantined` records each holding's largest flagged
interval and observed return. A reduction in coverage due to this explicit review
policy is distinct from an unexplained source-wide coverage regression.

The same snapshot still requires positive valid closes, at least 127 observations,
current prices at its stated analysis cutoff, no duplicate dates, prices on known
corporate-action dates, and at least 126 identical daily return intervals with
SPY. SPY, QQQM, and SMH must survive all checks. These are the observed reference
series for market, technology, and semiconductor exposures; a curated proxy's
volatility is not presented as an uncovered security's own history.

## Treasury yields

The refresh separately downloads the official daily FRED `DGS10` series from:

`https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=START&coed=END`

This CSV download needs no API key. The source is the Board of Governors of the
Federal Reserve System (US), H.15 Selected Interest Rates, distributed by FRED,
Federal Reserve Bank of St. Louis. [Official series and notes](https://fred.stlouisfed.org/series/DGS10).
The series is labeled Public Domain: Citation Requested. This attribution applies
to the Treasury observations separately from the CC BY-SA license of the Dolt
price-index adaptation.

`treasuryYields.values` is aligned to the manifest's `dates`, in **percent yield**:
`4.25` means 4.25%, not 425% or a 4.25% price return. Yield changes of 0.01 percentage
points correspond to one basis point. The manifest preserves the series identifier,
source, download URL, units, attribution, observation count, and actual start/end
dates. Missing observations and holidays remain `null`; they are not interpolated
or treated as zero rates. Invalid, insufficient, or stale observations prevent
publication. At least 126 identical intervals must exist across DGS10 and the
three reference price series.

## Remaining limits

The source is community-maintained. Source revisions, ticker reuse, missing or
incorrect actions, price corrections, and unverified moves below the quarantine
threshold can still affect estimates. Passing the screens is not a guarantee of
financial accuracy. Models describe the selected historical window and depend on
statistical assumptions; they are not validated return forecasts. Inspect the
stated cutoff and provenance, and review source corrections before treating a
new security as trustworthy. The batch keeps the previous manifest when required
references, Treasury history, or minimum source coverage are unavailable.
