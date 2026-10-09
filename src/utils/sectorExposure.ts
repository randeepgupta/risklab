import type {PortfolioPosition} from '../types/risk';

// Curated position-level labels, checked 2026-10-08. A mixed ETF is never
// treated as a single sector; a risk proxy never supplies a sector label.
const sectors: Record<string, string> = {
  NVDA: 'Technology', AMD: 'Technology', TSM: 'Technology', AAPL: 'Technology', MSFT: 'Technology', AVGO: 'Technology',
  AMZN: 'Consumer discretionary', TSLA: 'Consumer discretionary',
  GOOG: 'Communication services', GOOGL: 'Communication services', META: 'Communication services',
  XLK: 'Technology', XLY: 'Consumer discretionary', XLC: 'Communication services',
  XLE: 'Energy', XLV: 'Health care', XLF: 'Financials', XLI: 'Industrials',
  XLU: 'Utilities', XLP: 'Consumer staples', XLB: 'Materials', XLRE: 'Real estate',
};
const funds: Record<string, string> = {
  SPY: 'Broad US equity funds', VOO: 'Broad US equity funds', VTI: 'Broad US equity funds',
  IWM: 'US small-cap funds', QQQ: 'Nasdaq-100 funds', QQQM: 'Nasdaq-100 funds',
  VXUS: 'International equity funds', VEA: 'International equity funds', VWO: 'International equity funds',
  SCHD: 'Dividend equity funds',
};
const assets: Record<string, string> = {
  TLT: 'Treasury bond funds', IEF: 'Treasury bond funds', SHY: 'Treasury bond funds',
  BND: 'Broad bond funds', AGG: 'Broad bond funds',
  SGOV: 'Treasury bill funds', BIL: 'Treasury bill funds',
  GLD: 'Gold funds', IAU: 'Gold funds', SLV: 'Silver funds',
};
export interface ExposureGroup {
  label: string;
  kind: 'sector' | 'fund' | 'asset' | 'unknown';
  tickers: string[];
  investment: number;
  percent: number;
}
export function buildSectorExposure(positions: PortfolioPosition[]): ExposureGroup[] {
  const valid = positions.filter(p => Number.isFinite(p.investment) && p.investment > 0);
  const total = valid.reduce((sum, p) => sum + p.investment, 0);
  const groups = new Map<string, ExposureGroup>();
  for (const position of valid) {
    const ticker = position.ticker.toUpperCase();
    const kind = sectors[ticker] ? 'sector' : funds[ticker] ? 'fund' : assets[ticker] ? 'asset' : 'unknown';
    const label = sectors[ticker] ?? funds[ticker] ?? assets[ticker] ?? 'Unclassified positions';
    const group = groups.get(label) ?? {label, kind, tickers: [], investment: 0, percent: 0};
    group.tickers.push(ticker);
    group.investment += position.investment;
    group.percent = total ? group.investment / total * 100 : 0;
    groups.set(label, group);
  }
  return [...groups.values()].sort((a, b) => b.percent - a.percent);
}
