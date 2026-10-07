import type { HistoricalRiskModel } from '../types/risk';
export interface DailyPrice {date: string; adjClose: number; close: number}
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
function covariance(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b);
  return a.reduce((sum, value, i) => sum + (value - ma) * (b[i] - mb), 0) / (a.length - 1);
}
export function calibrateHistoricalModels(series: Record<string, DailyPrice[]>, tickers: string[], capturedAt: string): Record<string, HistoricalRiskModel> {
  const allTickers = [...new Set([...tickers, 'SPY'])];
  const returns: Record<string, Map<string, number>> = {};
  for (const ticker of allTickers) {
    const prices = [...(series[ticker] || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (prices.length < 127) throw new Error(`${ticker}: at least 127 daily prices are required.`);
    const dates = new Set<string>();
    for (const price of prices) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(price.date) || !Number.isFinite(Date.parse(price.date)) || dates.has(price.date)
          || !Number.isFinite(price.adjClose) || price.adjClose <= 0 || !Number.isFinite(price.close) || price.close <= 0) {
        throw new Error(`${ticker}: invalid or duplicate daily price data.`);
      }
      dates.add(price.date);
    }
    returns[ticker] = new Map(prices.slice(1).map((price, i) => [
      `${prices[i].date}/${price.date}`, price.adjClose / prices[i].adjClose - 1,
    ]));
  }
  // Align identical return intervals, not merely end dates. A missing price must
  // never compare a two-day return with another holding's one-day return.
  const intervals = [...returns.SPY.keys()].filter(date => allTickers.every(ticker => returns[ticker].has(date))).sort();
  if (intervals.length < 126) throw new Error('Not enough overlapping history: at least 126 matched daily returns are required across holdings and SPY.');
  const values = Object.fromEntries(allTickers.map(ticker => [ticker, intervals.map(date => returns[ticker].get(date)!)]));
  const variances = Object.fromEntries(allTickers.map(ticker => [ticker, covariance(values[ticker], values[ticker])]));
  if (variances.SPY <= 1e-15) throw new Error('Benchmark history has no usable variation.');
  return Object.fromEntries(tickers.map(ticker => {
    const variance = variances[ticker];
    return [ticker, {provider: 'DoltHub', source: 'https://www.dolthub.com/repositories/post-no-preference/stocks', license: 'CC BY-SA 4.0', startDate: intervals[0].slice(0, 10), endDate: intervals.at(-1)!.slice(11),
      capturedAt, observations: intervals.length, volatility: Math.sqrt(variance * 252),
      beta: covariance(values[ticker], values.SPY) / variances.SPY,
      annualizedMeanReturn: mean(values[ticker]) * 252,
      correlations: Object.fromEntries(tickers.map(other => [other, ticker === other ? 1 : variance <= 1e-15 || variances[other] <= 1e-15 ? 0
        : Math.max(-1, Math.min(1, covariance(values[ticker], values[other]) / Math.sqrt(variance * variances[other])))])),
    } satisfies HistoricalRiskModel];
  }));
}
