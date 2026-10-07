import { ASSET_DATABASE } from './quantEngine';
import { PortfolioPosition } from '../types/risk';

export interface ListedSymbol { ticker: string; name: string; kind: 'Stock' | 'ETF'; exchange: string }
export interface SymbolDirectory { capturedAt: string; symbols: ListedSymbol[] }
export const modeledSymbols: ListedSymbol[] = Object.values(ASSET_DATABASE).map(asset => ({
  ticker: asset.ticker, name: asset.name, kind: ['SPY', 'QQQM', 'TLT', 'BND', 'GLD', 'IWM', 'XLE'].includes(asset.ticker) ? 'ETF' : 'Stock', exchange: '',
}));
let directoryPromise: Promise<SymbolDirectory> | undefined;
export function loadSymbolDirectory(): Promise<SymbolDirectory> {
  if (!directoryPromise) directoryPromise = fetch('/symbols/us-listed.json').then(async response => {
    if (!response.ok) throw new Error('Unable to load symbol directory');
    const data = await response.json() as SymbolDirectory;
    if (!Array.isArray(data.symbols) || data.symbols.length < 5000) throw new Error('Invalid symbol directory');
    return data;
  }).catch(error => { directoryPromise = undefined; throw error; });
  return directoryPromise;
}
export function searchSymbols(symbols: ListedSymbol[], query: string, excluded: Set<string>, limit = 40): ListedSymbol[] {
  const text = query.trim().toUpperCase();
  const rank = (symbol: ListedSymbol) => symbol.ticker === text ? 0 : symbol.ticker.startsWith(text) ? 1 : 2;
  return symbols.filter(symbol => !excluded.has(symbol.ticker) && (!text || symbol.ticker.includes(text) || symbol.name.toUpperCase().includes(text)))
    .sort((a, b) => rank(a) - rank(b) || a.ticker.localeCompare(b.ticker)).slice(0, limit);
}
export function createListedPosition(symbol: ListedSymbol, investment: number, weight: number, riskProxyTicker = '', historicalAvailable = false): PortfolioPosition {
  const ownModel = ASSET_DATABASE[symbol.ticker];
  const model = ownModel || ASSET_DATABASE[riskProxyTicker];
  if (!model && !historicalAvailable) throw new Error('Choose a modeled risk proxy for this holding');
  return { ticker: symbol.ticker, name: symbol.name, assetClass: ownModel?.assetClass ?? 'Other', investment, weight,
    price: ownModel?.price ?? 0, ...(ownModel || historicalAvailable ? {} : {riskProxyTicker}) };
}
