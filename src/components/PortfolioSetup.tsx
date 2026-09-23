import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { PortfolioPosition } from '../types/risk';
import { ASSET_DATABASE } from '../utils/quantEngine';

type AllocationRow = {
  id: number;
  ticker: string;
  allocation: string;
};

interface PortfolioSetupProps {
  initialPositions?: PortfolioPosition[];
  initialPortfolioValue?: number;
  onAnalyze: (positions: PortfolioPosition[], portfolioValue: number) => void;
  onUseSample: () => void;
}

const supportedTickers = Object.keys(ASSET_DATABASE).sort();

export const PortfolioSetup: React.FC<PortfolioSetupProps> = ({
  initialPositions = [],
  initialPortfolioValue = 100000,
  onAnalyze,
  onUseSample,
}) => {
  const nextId = useRef(1);
  const [portfolioValue, setPortfolioValue] = useState(String(Math.round(initialPortfolioValue || 100000)));
  const [rows, setRows] = useState<AllocationRow[]>(() => {
    if (initialPositions.length > 0) {
      return initialPositions.map((position) => ({
        id: nextId.current++,
        ticker: position.ticker,
        allocation: (position.weight * 100).toFixed(1).replace(/\.0$/, ''),
      }));
    }

    return [{ id: nextId.current++, ticker: 'SPY', allocation: '' }];
  });

  useEffect(() => {
    if (initialPositions.length === 0) return;
    setPortfolioValue(String(Math.round(initialPortfolioValue || 100000)));
    setRows(initialPositions.map((position) => ({
      id: nextId.current++,
      ticker: position.ticker,
      allocation: (position.weight * 100).toFixed(1).replace(/\.0$/, ''),
    })));
  }, [initialPositions, initialPortfolioValue]);

  const allocationTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (Number.parseFloat(row.allocation) || 0), 0),
    [rows],
  );

  const parsedPortfolioValue = Number.parseFloat(portfolioValue);
  const uniqueTickers = new Set(rows.map((row) => row.ticker));
  const allocationsValid = rows.every((row) => {
    const value = Number.parseFloat(row.allocation);
    return row.ticker && Number.isFinite(value) && value > 0 && value <= 100;
  });
  const isValid =
    rows.length > 0 &&
    Number.isFinite(parsedPortfolioValue) &&
    parsedPortfolioValue > 0 &&
    Math.abs(allocationTotal - 100) < 0.05 &&
    uniqueTickers.size === rows.length &&
    allocationsValid;

  const updateRow = (id: number, field: 'ticker' | 'allocation', value: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addRow = () => {
    const used = new Set(rows.map((row) => row.ticker));
    const nextTicker = supportedTickers.find((ticker) => !used.has(ticker));
    if (!nextTicker) return;
    setRows((current) => [...current, { id: nextId.current++, ticker: nextTicker, allocation: '' }]);
  };

  const removeRow = (id: number) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const analyzePortfolio = () => {
    if (!isValid) return;

    const positions: PortfolioPosition[] = rows.map((row) => {
      const meta = ASSET_DATABASE[row.ticker];
      const weight = Number.parseFloat(row.allocation) / 100;
      return {
        ticker: row.ticker,
        name: meta.name,
        assetClass: meta.assetClass,
        investment: parsedPortfolioValue * weight,
        weight,
        price: meta.price,
      };
    });

    onAnalyze(positions, parsedPortfolioValue);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      <header className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-white">RiskLab</div>
            <div className="text-[11px] text-slate-500">Portfolio risk analytics</div>
          </div>
        </div>
        <span className="hidden sm:inline text-xs text-slate-500">Educational analytics · Not investment advice</span>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-16">
        <section className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300 mb-5">
            Portfolio risk, explained
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Understand how your portfolio behaves before the market tests it.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Add your holdings and allocation. RiskLab will analyze concentration, volatility, correlation,
            downside risk, stress scenarios, and long-term outcomes.
          </p>
        </section>

        <section className="mt-10 sm:mt-12 max-w-3xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/55 shadow-2xl shadow-black/20 overflow-hidden">
          <div className="px-5 sm:px-7 py-5 border-b border-slate-800">
            <h2 className="font-bold text-white">Build your portfolio</h2>
            <p className="text-xs text-slate-400 mt-1">Enter a total value and make sure your allocations add up to 100%.</p>
          </div>

          <div className="p-5 sm:p-7 space-y-6">
            <div>
              <label htmlFor="portfolio-value" className="block text-xs font-semibold text-slate-300 mb-2">
                Portfolio value
              </label>
              <div className="relative max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                <input
                  id="portfolio-value"
                  type="number"
                  min="1"
                  value={portfolioValue}
                  onChange={(event) => setPortfolioValue(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 pl-7 pr-3 py-2.5 text-sm text-white font-mono-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">Used for dollar-denominated VaR, stress loss, and simulations.</p>
            </div>

            <div>
              <div className="grid grid-cols-[1fr_120px_32px] gap-3 px-1 mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                <span>Holding</span>
                <span className="text-right">Allocation</span>
                <span />
              </div>

              <div className="space-y-2.5">
                {rows.map((row) => {
                  const usedByOthers = new Set(rows.filter((candidate) => candidate.id !== row.id).map((candidate) => candidate.ticker));
                  return (
                    <div key={row.id} className="grid grid-cols-[1fr_120px_32px] gap-3 items-center">
                      <select
                        aria-label="Portfolio holding"
                        value={row.ticker}
                        onChange={(event) => updateRow(row.id, 'ticker', event.target.value)}
                        className="min-w-0 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        {supportedTickers.map((ticker) => (
                          <option key={ticker} value={ticker} disabled={usedByOthers.has(ticker)}>
                            {ticker} — {ASSET_DATABASE[ticker].name}
                          </option>
                        ))}
                      </select>

                      <div className="relative">
                        <input
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          aria-label={`Allocation for ${row.ticker}`}
                          value={row.allocation}
                          onChange={(event) => updateRow(row.id, 'allocation', event.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950/70 pl-3 pr-8 py-2.5 text-right text-sm text-white font-mono-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 text-sm">%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        className="h-8 w-8 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors flex items-center justify-center"
                        title="Remove holding"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addRow}
                disabled={rows.length >= supportedTickers.length}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add holding
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400">Total allocation</span>
                <span className={`font-mono-nums font-semibold ${Math.abs(allocationTotal - 100) < 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {allocationTotal.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allocationTotal > 100.05 ? 'bg-rose-400' : Math.abs(allocationTotal - 100) < 0.05 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, allocationTotal)}%` }}
                />
              </div>
              {allocationTotal > 100.05 && (
                <p className="mt-2 text-[11px] text-rose-300">Allocations exceed 100%. Reduce one or more positions.</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={analyzePortfolio}
                disabled={!isValid}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 px-4 py-3 text-sm font-bold transition-colors"
              >
                Analyze portfolio
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onUseSample}
                className="px-4 py-3 text-sm font-semibold text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800/70 transition-colors"
              >
                Try sample portfolio
              </button>
            </div>
          </div>
        </section>

        <p className="mt-5 text-center text-[11px] text-slate-600">
          v0.1 currently supports {supportedTickers.length} modeled assets. Broader ticker support and CSV import are planned for the market-data phase.
        </p>
      </main>
    </div>
  );
};
