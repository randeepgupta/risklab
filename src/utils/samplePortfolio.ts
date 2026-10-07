import { PortfolioPosition } from '../types/risk';
import { ASSET_DATABASE } from './quantEngine';

export const SAMPLE_PORTFOLIO_VALUE = 250000;

// Use modeled assets so a demo can be analyzed immediately without choosing proxies.
export function createRandomSamplePortfolio(random: () => number = Math.random): PortfolioPosition[] {
  const assets = Object.values(ASSET_DATABASE);
  for (let i = assets.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [assets[i], assets[j]] = [assets[j], assets[i]];
  }
  const selected = assets.slice(0, 4 + Math.floor(random() * 4));
  const scores = selected.map(() => 1 + random() * 9);
  const scoreTotal = scores.reduce((sum, score) => sum + score, 0);
  const remaining = 100 - selected.length * 5;
  const shares = scores.map(score => remaining * score / scoreTotal);
  const percentages = shares.map(share => 5 + Math.floor(share));
  const leftover = 100 - percentages.reduce((sum, value) => sum + value, 0);
  const remainders = shares.map((share, index) => ({index, fraction: share - Math.floor(share)}))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < leftover; i++) percentages[remainders[i].index]++;

  return selected.map((asset, index) => ({
    ticker: asset.ticker,
    name: asset.name,
    assetClass: asset.assetClass,
    price: asset.price,
    investment: SAMPLE_PORTFOLIO_VALUE * percentages[index] / 100,
    weight: percentages[index] / 100,
  }));
}
