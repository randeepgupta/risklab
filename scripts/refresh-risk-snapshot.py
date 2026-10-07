"""Build a dated, openly licensed historical snapshot; never run on user clicks."""
import concurrent.futures, datetime as dt, json, math, pathlib, urllib.parse, urllib.request, time, hashlib, tempfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = 'https://www.dolthub.com/api/v1alpha1/post-no-preference/stocks/master'
TICKERS = '''SPY QQQ QQQM VOO VTI VXUS SCHD VT IVV SPLG DIA IWM IJR VB VO VXF VEA VWO EFA EEM
BND AGG TLT IEF SHY TIP LQD HYG BNDX EMB BIL SGOV GLD IAU SLV DBC USO VNQ SCHH XLK XLE XLF XLV XLP XLU XLI XLY XLB XLC XLRE
VGT VHT VDE VDC VCR VFH VPU VIS VAW VOX SMH SOXX XBI IBB ARKK ARKG ARKQ ARKW ARKF ICLN TAN QCLN CIBR HACK IGV ITA KRE XOP GDX GDXJ
SQQQ TQQQ SPXL SPXS SOXL SOXS UPRO SH PSQ VUG VTV VYM DGRO DVY HDV USMV QUAL MTUM SPHD JEPI JEPQ DIVO NOBL RSP SCHG SCHX SCHB VIG VIGI VYMI VEU IXUS ACWI ACWX EWJ EWZ EWG EWU INDA FXI EWY EWT EWC EWA EWH EWQ EWP VGK VPL EZA EWW
AAPL MSFT NVDA AMZN GOOGL GOOG META TSLA AVGO AMD TSM INTC QCOM MU AMAT LRCX KLAC ASML ADI ARM MRVL MCHP NXPI ON TXN
BRK.B JPM BAC WFC C GS MS V MA PYPL COIN HOOD SOFI BLK SCHW AXP SPGI MCO ICE CME
UNH JNJ LLY ABBV MRK PFE BMY AMGN GILD REGN VRTX ISRG TMO DHR ABT MDT CVS CI HUM HCA ELV
XOM CVX COP OXY EOG SLB HAL MPC VLO PSX KMI WMB OKE
WMT COST TGT HD LOW MCD SBUX CMG NKE LULU KO PEP PG CL KMB PM MO MDLZ KHC GIS KR DG DLTR ROST TJX
CRM ORCL ADBE NOW SNOW PLTR CRWD PANW ZS DDOG NET FTNT MDB TEAM WDAY INTU SHOP UBER ABNB NFLX DIS RBLX DASH RDDT DUOL APP SQ XYZ
CAT DE GE HON RTX LMT BA NOC GD UPS FDX UNP CSX NSC WM RSG ETN PH EMR MMM DOW NEM FCX NUE STLD CARR TT
VZ T TMUS CMCSA CHTR AMT PLD EQIX DLR O REAL VICI SPG PSA WELL CCI SRE NEE DUK SO AEP EXC PPL
AAP AME AMN ARI ARR AZZ BBWI BABA JD PDD BIDU NIO LI XPEV RIVN LCID RKLB ASTS IONQ RGTI QBTS F GM FSLR ENPH SEDG TSCO CELH DECK EL FICO BKNG MAR HLT RCL CCL NCLH DAL UAL AAL LUV'''.split()
TICKERS = sorted(set(TICKERS))
def query(sql):
    cache = pathlib.Path(tempfile.gettempdir())/'risklab-public-data-cache'
    cache.mkdir(exist_ok=True)
    cached = cache/(hashlib.sha256(sql.encode()).hexdigest()+'.json')
    if cached.exists() and time.time()-cached.stat().st_mtime < 3600: return json.loads(cached.read_text())
    url = SOURCE + '?' + urllib.parse.urlencode({'q': sql})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as response: data = json.load(response)
            if data.get('query_execution_status') != 'Success': raise ValueError(data.get('query_execution_message') or 'Incomplete public data query')
            cached.write_text(json.dumps(data['rows']))
            return data['rows']
        except Exception:
            if attempt == 2: raise
            time.sleep(attempt + 1)
def quoted(tickers): return ','.join("'" + ticker + "'" for ticker in tickers)
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

def main():
    latest = query('SELECT date FROM ohlcv ORDER BY date DESC LIMIT 1')[0]['date']
    end = dt.date.fromisoformat(latest)
    start = end.replace(year=end.year - 1, day=min(end.day, 28))
    chunks = [TICKERS[i:i+30] for i in range(0, len(TICKERS), 30)]
    days = [start + dt.timedelta(days=i) for i in range((end-start).days+1)]
    jobs = [('prices', TICKERS, f"SELECT date,act_symbol,close FROM ohlcv WHERE date='{day}' AND act_symbol IN ({quoted(TICKERS)})") for day in days if day.weekday() < 5]
    jobs += [(kind, chunk, f"SELECT * FROM {kind} WHERE ex_date >= '{start}' AND ex_date <= '{end}' AND act_symbol IN ({quoted(chunk)})") for chunk in chunks for kind in ['dividend','split']]
    rows = {'prices': [], 'dividend': [], 'split': []}
    def run(job): return job[0], query(job[2])
    print(f'Downloading public snapshot through {latest}: {len(TICKERS)} candidates, {len(jobs)} bounded queries.', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for i, (kind, result) in enumerate(pool.map(run, jobs)):
            rows[kind].extend(result)
            if (i+1)%30 == 0: print(f'Completed {i+1}/{len(jobs)} queries.', flush=True)
    dividends = {(r['act_symbol'], r['ex_date']):float(r['amount'] or 0) for r in rows['dividend']}
    splits = {(r['act_symbol'], r['ex_date']):float(r['to_factor'])/float(r['for_factor']) for r in rows['split']}
    by_ticker = {ticker: [] for ticker in TICKERS}
    for row in rows['prices']:
        close = float(row['close'] or 0)
        if not math.isfinite(close) or close <= 0: raise ValueError('Invalid close in source')
        by_ticker[row['act_symbol']].append((row['date'], close))
    dates = sorted({r['date'] for r in rows['prices']})
    symbols = {}
    skipped = []
    for ticker, prices in by_ticker.items():
        prices.sort()
        if len(prices) < 127 or prices[-1][0] != latest:
            skipped.append(ticker); continue
        price_dates = {date for date,_ in prices}
        event_dates = {date for symbol,date in [*dividends,*splits] if symbol == ticker and prices[0][0] < date <= latest}
        if not event_dates.issubset(price_dates):
            skipped.append(ticker); continue
        adjusted = adjusted_index(ticker, prices, dividends, splits)
        symbols[ticker] = {'values':[adjusted.get(date) for date in dates], 'price':prices[-1][1], 'priceAsOf':prices[-1][0]}
    if 'SPY' not in symbols or len(symbols) < 150: raise ValueError('Insufficient snapshot coverage; existing snapshot preserved')
    snapshot = {'capturedAt':dt.datetime.now(dt.timezone.utc).isoformat(), 'asOf':latest, 'source':SOURCE,
        'license':'CC BY-SA 4.0', 'attribution':'post-no-preference/stocks; adapted by RiskLab into split/dividend-adjusted total-return indices', 'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/', 'dates':dates, 'symbols':symbols, 'skipped':skipped}
    target = ROOT/'public/models/historical-snapshot.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(snapshot,separators=(',',':'))+'\n')
    print(f'Saved {len(symbols)} holdings, {len(dates)} dates; skipped {len(skipped)} unavailable/short/stale symbols.',flush=True)
if __name__ == '__main__': main()
