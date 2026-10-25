"""Build a dated, openly licensed historical snapshot; never run on user clicks."""
import argparse, os, csv, io, re
from collections import Counter, defaultdict
import concurrent.futures, datetime as dt, json, math, pathlib, urllib.parse, urllib.request, time, hashlib, tempfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = 'https://www.dolthub.com/api/v1alpha1/post-no-preference/stocks/master'
SOURCE_REVISION = None
REQUIRED_REFERENCES = {'SPY', 'QQQM', 'SMH'}
MAX_ABSOLUTE_RETURN = 0.5
MAX_ACTION_LAG_BUSINESS_DAYS = 3
OVERRIDES_PATH = ROOT/'scripts/data/corporate-action-overrides.json'
PAGE_SIZE = 900  # Public API truncates responses at 1,000 rows.

def load_tickers(path):
    directory = json.loads(path.read_text())
    return sorted({row['ticker'] for row in directory['symbols']} | REQUIRED_REFERENCES)

def query(sql, cache_seconds=7 * 86400):
    # SQL AS OF pins all three source tables to the same immutable Dolt commit.
    # The commit is part of the SQL/cache key, so upstream corrections cannot be
    # hidden by an unrelated cached response from mutable master.
    if SOURCE_REVISION:
        sql = re.sub(r'\bFROM (ohlcv|dividend|split)\b',
                     lambda match: f"FROM {match.group(1)} AS OF '{SOURCE_REVISION}'", sql, flags=re.IGNORECASE)
    else:
        cache_seconds = 0
    cache = pathlib.Path(tempfile.gettempdir())/'risklab-public-data-cache'
    cache.mkdir(exist_ok=True)
    cached = cache/(hashlib.sha256((SOURCE + '\n' + sql).encode()).hexdigest()+'.json')
    if cached.exists() and time.time()-cached.stat().st_mtime < cache_seconds: return json.loads(cached.read_text())
    url = SOURCE + '?' + urllib.parse.urlencode({'q': sql})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as response: data = json.load(response)
            if data.get('query_execution_status') != 'Success': raise ValueError(data.get('query_execution_message') or 'Incomplete public data query')
            temporary = cached.with_suffix('.tmp')
            temporary.write_text(json.dumps(data['rows']))
            os.replace(temporary, cached)
            return data['rows']
        except Exception:
            if attempt == 2: raise
            time.sleep(attempt + 1)
def paged_query(sql, order, expected_count=None, workers=8):
    if expected_count is not None:
        jobs = [f'{sql} ORDER BY {order} LIMIT {PAGE_SIZE} OFFSET {offset}' for offset in range(0, expected_count, PAGE_SIZE)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            rows = [row for page in pool.map(query, jobs) for row in page]
        if len(rows) != expected_count:
            raise ValueError('Corporate-action row count changed or download was incomplete')
        return rows
    rows = []
    while True:
        page = query(f'{sql} ORDER BY {order} LIMIT {PAGE_SIZE} OFFSET {len(rows)}')
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows

def download_day(day):
    # One aggregate row avoids the API's 1,000-row response cap. Validate its
    # cardinality against COUNT(*) so duplicate symbols or truncation fail closed.
    row = query(f"SELECT JSON_OBJECTAGG(act_symbol,close) AS prices, COUNT(*) AS count FROM ohlcv WHERE date='{day}'")[0]
    prices = json.loads(row['prices']) if isinstance(row['prices'], str) else row['prices']
    prices = prices or {}
    if len(prices) != int(row['count']):
        raise ValueError(f'Incomplete or duplicate daily prices for {day}')
    return [{'date':str(day), 'act_symbol':ticker, 'close':close} for ticker,close in prices.items()]

def publish_snapshot(snapshot, target):
    # Content-addressed parts keep each static asset below hosting/cache limits.
    # Publish the manifest last; interruptions cannot corrupt the previous batch.
    target.parent.mkdir(parents=True, exist_ok=True)
    tickers = sorted(set(snapshot['symbols']) - {'SPY'})
    parts = []
    for i in range(0, len(tickers), 500):
        content = json.dumps({t:snapshot['symbols'][t] for t in tickers[i:i+500]}, separators=(',', ':')) + '\n'
        name = 'history-' + hashlib.sha256(content.encode()).hexdigest()[:16] + '.json'
        part = target.parent / name
        temporary = part.with_suffix('.tmp')
        temporary.write_text(content)
        os.replace(temporary, part)
        parts.append(name)
    manifest = {**snapshot, 'symbols': {'SPY': snapshot['symbols']['SPY']}, 'parts': parts}
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    os.replace(temporary, target)
    # Old content-addressed files are deliberately retained; remove unreferenced
    # parts before committing, once no local client needs the previous manifest.

def adjusted_index(ticker, prices, dividends, splits):
    value = 100.0
    adjusted = {}
    for i, (date, close) in enumerate(prices):
        if i:
            factor = splits.get((ticker,date),1)
            dividend = dividends.get((ticker,date),0)
            value *= (close + dividend) * factor / prices[i-1][1]
        if not math.isfinite(value) or value <= 0: raise ValueError('Invalid adjusted total-return index')
        adjusted[date] = round(value,8)
    return adjusted

def matched_intervals(values, dates):
    present = [date for date, value in zip(dates, values) if value is not None]
    return set(zip(present, present[1:]))

def corporate_actions(rows, tickers):
    dividends, splits, invalid = {}, {}, set()
    for kind in ['dividend', 'split']:
        for row in rows[kind]:
            ticker = row['act_symbol']
            if ticker not in tickers:
                continue
            try:
                if kind == 'dividend':
                    value = float(row['amount'])
                    if not math.isfinite(value) or value < 0: raise ValueError('Invalid dividend')
                else:
                    to_factor, for_factor = float(row['to_factor']), float(row['for_factor'])
                    if not all(math.isfinite(v) and v > 0 for v in [to_factor, for_factor]): raise ValueError('Invalid split')
                    value = to_factor / for_factor
                    if not math.isfinite(value) or value <= 0: raise ValueError('Invalid split ratio')
            except (ValueError, TypeError, ZeroDivisionError):
                invalid.add(ticker)
                continue
            (dividends if kind == 'dividend' else splits)[(ticker, row['ex_date'])] = value
    return dividends, splits, invalid

def business_days_between(first, last):
    start, end = dt.date.fromisoformat(first), dt.date.fromisoformat(last)
    return sum((start + dt.timedelta(days=i)).weekday() < 5 for i in range(1, (end-start).days+1))


def analysis_cutoff(latest, action_dates):
    if not all(action_dates.values()):
        raise ValueError('Corporate-action feed dates unavailable; existing snapshot preserved')
    lag = {kind:business_days_between(date, latest) for kind,date in action_dates.items()}
    cutoff = min(action_dates.values()) if max(lag.values()) > MAX_ACTION_LAG_BUSINESS_DAYS else latest
    return min(cutoff, latest), lag


def apply_split_overrides(splits, start, end):
    applied = []
    for override in json.loads(OVERRIDES_PATH.read_text()):
        ticker, date = override['ticker'], override['date']
        factor = float(override['toFactor']) / float(override['forFactor'])
        if not math.isfinite(factor) or factor <= 0 or not override['source'].startswith('https://'):
            raise ValueError('Invalid reviewed corporate-action override')
        dt.date.fromisoformat(date)
        status = 'outside_window'
        if str(start) <= date <= str(end):
            previous = splits.get((ticker, date))
            if previous is not None and not math.isclose(previous, factor, rel_tol=1e-8):
                raise ValueError(f'Conflicting split sources for {ticker} on {date}')
            status = 'already_present' if previous is not None else 'applied'
            splits[(ticker, date)] = factor
        applied.append({**override, 'status':status})
    return applied


def extreme_returns(adjusted):
    observations = sorted(adjusted.items())
    flags = []
    for (start,a),(end,b) in zip(observations, observations[1:]):
        change = b/a-1
        if abs(change) >= MAX_ABSOLUTE_RETURN:
            flags.append({'startDate':start, 'endDate':end, 'return':change})
    return flags


def parse_treasury_csv(content, dates, download_url):
    reader = csv.DictReader(io.StringIO(content))
    if reader.fieldnames != ['observation_date', 'DGS10']:
        raise ValueError('Unexpected FRED Treasury CSV schema')
    observations = {}
    for row in reader:
        date, raw = row['observation_date'], row['DGS10']
        dt.date.fromisoformat(date)
        if date in observations:
            raise ValueError('Duplicate FRED Treasury observation')
        if raw in ('', '.'):
            observations[date] = None
            continue
        value = float(raw)
        if not math.isfinite(value) or not -5 <= value <= 30:
            raise ValueError('Invalid Treasury yield observation')
        observations[date] = value
    values = [observations.get(date) for date in dates]
    finite_dates = [date for date,value in zip(dates, values) if value is not None]
    if len(finite_dates) < 127:
        raise ValueError('Insufficient FRED Treasury history; existing snapshot preserved')
    if business_days_between(finite_dates[-1], dates[-1]) > 3:
        raise ValueError('Stale FRED Treasury history; existing snapshot preserved')
    return {'series':'DGS10', 'source':'https://fred.stlouisfed.org/series/DGS10',
            'downloadUrl':download_url, 'units':'percent',
            'attribution':'Board of Governors of the Federal Reserve System (US), retrieved from FRED, Federal Reserve Bank of St. Louis',
            'license':'Public Domain: Citation Requested',
            'values':values, 'observations':len(finite_dates), 'startDate':finite_dates[0], 'endDate':finite_dates[-1]}


def load_treasury_yields(dates):
    url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?' + urllib.parse.urlencode({'id':'DGS10', 'cosd':dates[0], 'coed':dates[-1]})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                return parse_treasury_csv(response.read().decode('utf-8-sig'), dates, url)
        except Exception:
            if attempt == 2: raise
            time.sleep(attempt + 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=pathlib.Path, default=ROOT/'public/symbols/us-listed.json')
    parser.add_argument('--output', type=pathlib.Path, default=ROOT/'public/models/historical-snapshot.json')
    parser.add_argument('--workers', type=int, default=8, choices=range(1, 17), metavar='1..16')
    args = parser.parse_args()
    tickers = load_tickers(args.directory)
    ticker_set = set(tickers)
    global SOURCE_REVISION
    revision = query("SELECT DOLT_HASHOF('HEAD') AS revision", cache_seconds=0)[0]['revision']
    if not re.fullmatch('[a-z0-9]{32}', revision):
        raise ValueError('Could not pin a valid immutable source revision')
    SOURCE_REVISION = revision
    price_latest = query('SELECT date FROM ohlcv ORDER BY date DESC LIMIT 1', cache_seconds=0)[0]['date']
    action_dates = {kind:query(f"SELECT MAX(ex_date) AS latest FROM {kind} WHERE ex_date <= '{price_latest}'")[0]['latest'] for kind in ['dividend', 'split']}
    latest, action_lags = analysis_cutoff(price_latest, action_dates)
    if latest != price_latest:
        latest = query(f"SELECT date FROM ohlcv WHERE date <= '{latest}' ORDER BY date DESC LIMIT 1")[0]['date']
        print(f'Price source reaches {price_latest}; action feeds lag. Conservatively limiting analysis to {latest}.', flush=True)
    end = dt.date.fromisoformat(latest)
    start = end.replace(year=end.year - 1, day=min(end.day, 28))
    days = [start + dt.timedelta(days=i) for i in range((end-start).days+1)]
    days = [day for day in days if day.weekday() < 5]
    rows = {'dividend': [], 'split': []}
    by_ticker = {ticker: [] for ticker in tickers}
    invalid, price_dates = set(), set()
    print(f'Downloading public snapshot through {latest}: {len(tickers)} directory tickers, {len(days)} trading-day candidates.', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download_day, day) for day in days}
        try:
            for i, future in enumerate(concurrent.futures.as_completed(futures)):
                result = future.result()
                futures.remove(future)
                for row in result:
                    ticker = row['act_symbol']
                    if ticker not in ticker_set:
                        continue
                    price_dates.add(row['date'])
                    close = float(row['close'] or 0)
                    if not math.isfinite(close) or close <= 0:
                        invalid.add(ticker)
                    else:
                        by_ticker[ticker].append((row['date'], close))
                if (i+1)%10 == 0: print(f'Completed {i+1}/{len(days)} days (cached pages reused on retry).', flush=True)
        except BaseException:
            for future in futures:
                future.cancel()
            raise
    for kind in ['dividend', 'split']:
        print(f'Downloading paginated {kind} history.', flush=True)
        where = f"FROM {kind} WHERE ex_date >= '{start}' AND ex_date <= '{end}'"
        count = int(query(f'SELECT COUNT(*) AS count {where}')[0]['count'])
        rows[kind] = paged_query(f'SELECT * {where}', 'ex_date,act_symbol', expected_count=count, workers=args.workers)
    dividends, splits, invalid_actions = corporate_actions(rows, ticker_set)
    overrides = apply_split_overrides(splits, start, end)
    events = defaultdict(set)
    for ticker, date in [*dividends, *splits]:
        events[ticker].add(date)
    dates = sorted(price_dates)
    symbols, excluded, quarantined = {}, {}, {}
    for ticker, prices in by_ticker.items():
        prices.sort()
        reason = None
        if ticker in invalid: reason = 'invalid_price'
        elif ticker in invalid_actions: reason = 'invalid_corporate_action'
        elif not prices: reason = 'no_source_history'
        elif prices[-1][0] != latest: reason = 'stale_history'
        elif len(prices) < 127: reason = 'insufficient_history'
        elif len({date for date,_ in prices}) != len(prices): reason = 'duplicate_prices'
        else:
            price_dates = {date for date,_ in prices}
            event_dates = {date for date in events[ticker] if prices[0][0] < date <= latest}
            if not event_dates.issubset(price_dates): reason = 'missing_corporate_action_price'
        if reason:
            excluded[ticker] = reason
            continue
        try:
            adjusted = adjusted_index(ticker, prices, dividends, splits)
        except ValueError:
            excluded[ticker] = 'invalid_adjusted_history'
            continue
        flags = extreme_returns(adjusted)
        if flags:
            excluded[ticker] = 'unverified_extreme_return'
            quarantined[ticker] = max(flags, key=lambda flag:abs(flag['return']))
            continue
        symbols[ticker] = {'values':[adjusted.get(date) for date in dates], 'price':prices[-1][1], 'priceAsOf':prices[-1][0]}
    if 'SPY' in symbols:
        benchmark = matched_intervals(symbols['SPY']['values'], dates)
        for ticker in list(symbols):
            if len(matched_intervals(symbols[ticker]['values'], dates) & benchmark) < 126:
                excluded[ticker] = 'insufficient_benchmark_overlap'
                del symbols[ticker]
    if not REQUIRED_REFERENCES.issubset(symbols) or len(symbols) < 150:
        raise ValueError('Insufficient snapshot coverage; existing snapshot preserved')
    # Refuse a suspicious source-wide regression without replacing good data.
    if args.output.exists():
        previous = json.loads(args.output.read_text())
        previous_count = previous.get('coverage', {}).get('covered', len(previous['symbols']))
        if len(symbols) + len(quarantined) < previous_count * .9:
            raise ValueError('Coverage fell more than 10%; existing snapshot preserved')
    treasury_yields = load_treasury_yields(dates)
    reference_intervals = set.intersection(*(matched_intervals(symbols[ticker]['values'], dates) for ticker in REQUIRED_REFERENCES))
    yield_intervals = matched_intervals(treasury_yields['values'], dates)
    if len(reference_intervals & yield_intervals) < 126:
        raise ValueError('Insufficient matched reference/Treasury intervals; existing snapshot preserved')
    snapshot = {'capturedAt':dt.datetime.now(dt.timezone.utc).isoformat(), 'asOf':latest, 'source':SOURCE, 'sourceRevision':revision,
        'treasuryYields':treasury_yields,
        'dataQuality':{'priceDataAsOf':price_latest, 'analysisCutoff':latest,
            'cutoffReason':'observed_action_feed_lag' if latest != price_latest else None,
            'actionFeeds':{kind:{'latestEventDate':date, 'lagBusinessDays':action_lags[kind], 'completeThrough':None} for kind,date in action_dates.items()},
            'maxActionLagBusinessDays':MAX_ACTION_LAG_BUSINESS_DAYS,
            'extremeReturnThreshold':MAX_ABSOLUTE_RETURN, 'quarantined':quarantined, 'reviewedSplitOverrides':overrides,
            'limitations':['Latest observed event dates are not provider completeness guarantees.', 'Unverified moves of at least 50% between observations are quarantined, not capped; some genuine moves may require review.']},
        'license':'CC BY-SA 4.0', 'attribution':'post-no-preference/stocks; adapted by RiskLab into split/dividend-adjusted total-return indices',
        'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/', 'dates':dates, 'symbols':symbols,
        'skipped':sorted(excluded), 'exclusions':excluded,
        'coverage':{'requested':len(tickers), 'covered':len(symbols), 'excluded':len(excluded), 'directoryCapturedAt':json.loads(args.directory.read_text()).get('capturedAt')}}
    publish_snapshot(snapshot, args.output)
    print(f'Saved {len(symbols)}/{len(tickers)} holdings, {len(dates)} dates; exclusions recorded in {args.output}.', flush=True)
    print('Exclusions: ' + ', '.join(f'{reason}={count}' for reason,count in sorted(Counter(excluded.values()).items())), flush=True)

if __name__ == '__main__':
    main()
