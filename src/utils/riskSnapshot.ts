import {calibrateHistoricalModels, type DailyPrice} from './historicalModels';
import type {PortfolioPosition} from '../types/risk';
export interface RiskSnapshot {
  capturedAt: string; asOf: string; dates: string[];
  symbols: Record<string, {values: (number | null)[]; price: number; priceAsOf: string}>;
}
let snapshotPromise: Promise<RiskSnapshot> | undefined;
export function loadRiskSnapshot(): Promise<RiskSnapshot> {
  if (!snapshotPromise) snapshotPromise = fetch('/models/historical-snapshot.json').then(async response => {
    if (!response.ok) throw new Error('Historical snapshot unavailable. Retry or use preset assumptions.');
    const snapshot = await response.json() as RiskSnapshot;
    if (!snapshot.symbols?.SPY || !Array.isArray(snapshot.dates) || snapshot.dates.length < 127) throw new Error('Historical snapshot is invalid.');
    return snapshot;
  }).catch(error => {snapshotPromise = undefined; throw error;});
  return snapshotPromise;
}
export function applyHistoricalSnapshot(positions: PortfolioPosition[], snapshot: RiskSnapshot): PortfolioPosition[] {
  const tickers = [...new Set([...positions.map(position => position.ticker), 'SPY'])];
  const series: Record<string, DailyPrice[]> = {};
  for (const ticker of tickers) {
    const symbol = snapshot.symbols[ticker];
    if (!symbol) throw new Error(`${ticker} is not covered by this historical snapshot. Use preset assumptions and select a proxy, or choose a covered holding.`);
    series[ticker] = snapshot.dates.flatMap((date, i) => symbol.values[i] == null ? [] : [{date, adjClose: symbol.values[i]!, close: symbol.values[i]!}]);
  }
  const models = calibrateHistoricalModels(series, positions.map(position => position.ticker), snapshot.capturedAt);
  return positions.map(position => {
    const {riskProxyTicker: _proxy, ...rest} = position;
    return {...rest, historicalModel: models[position.ticker], price: snapshot.symbols[position.ticker].price, priceAsOf: snapshot.symbols[position.ticker].priceAsOf};
  });
}
