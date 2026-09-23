import React from 'react';
import { Activity, ShieldAlert, TrendingUp, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { PortfolioRiskMetrics } from '../types/risk';

interface HeaderProps {
  metrics: PortfolioRiskMetrics;
  activeTab: 'risk' | 'monte-carlo' | 'stress' | 'hedging';
  setActiveTab: (tab: 'risk' | 'monte-carlo' | 'stress' | 'hedging') => void;
  onSelectPreset: (presetKey: string) => void;
  activePreset: string;
  onResetToMvp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  metrics,
  activeTab,
  setActiveTab,
  onSelectPreset,
  activePreset,
  onResetToMvp,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar: Branding, Quick Presets & Portfolio Ticker */}
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-3">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-500/10">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-tight text-white">RiskLab</span>
                <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono-nums font-semibold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  v0.1 Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">Quantitative Portfolio Risk & Scenario Engine</p>
            </div>
          </div>

          {/* Quick Metrics Badge Strip */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 flex items-center space-x-2">
              <span className="text-slate-400">Total Value:</span>
              <span className="font-mono-nums font-semibold text-white">
                ${metrics.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="px-3 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 flex items-center space-x-2">
              <span className="text-slate-400">Portfolio Vol (σ):</span>
              <span className="font-mono-nums font-semibold text-amber-400">
                {(metrics.annualizedVolatility * 100).toFixed(1)}%
              </span>
            </div>

            <div className="px-3 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 flex items-center space-x-2">
              <span className="text-slate-400">1-Day VaR (95%):</span>
              <span className="font-mono-nums font-semibold text-rose-400">
                -${Math.round(metrics.var95_1d).toLocaleString()}
                <span className="text-slate-500 font-normal ml-1">({(metrics.var95_1d_pct * 100).toFixed(2)}%)</span>
              </span>
            </div>

            {/* Presets dropdown */}
            <div className="flex items-center space-x-1.5">
              <div className="relative">
                <select
                  aria-label="Select portfolio preset"
                  value={activePreset}
                  onChange={(e) => onSelectPreset(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-2.5 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none"
                >
                  <option value="mvp">Preset: MVP Tech Growth ($250K)</option>
                  <option value="balanced">Preset: Balanced 60/40 Core</option>
                  <option value="semi_heavy">Preset: Semiconductor & AI</option>
                  <option value="all_weather">Preset: All-Weather Macro</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>

              <button
                type="button"
                onClick={onResetToMvp}
                title="Reset to MVP Portfolio"
                className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation with Desktop Shortcuts */}
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 pb-2">
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              id="tab-risk"
              onClick={() => setActiveTab('risk')}
              className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'risk'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Portfolio Risk & VaR</span>
              <kbd className="hidden md:inline px-1 py-0.2 text-[9px] font-mono rounded bg-slate-900 border border-slate-800 text-slate-400">
                ⌘1
              </kbd>
            </button>

            <button
              type="button"
              id="tab-monte-carlo"
              onClick={() => setActiveTab('monte-carlo')}
              className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'monte-carlo'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Monte Carlo Simulation</span>
              <kbd className="hidden md:inline px-1 py-0.2 text-[9px] font-mono rounded bg-slate-900 border border-slate-800 text-slate-400">
                ⌘2
              </kbd>
            </button>

            <button
              type="button"
              id="tab-stress"
              onClick={() => setActiveTab('stress')}
              className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'stress'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Stress Testing & Scenarios</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-mono-nums">
                $250K → $178K
              </span>
              <kbd className="hidden md:inline px-1 py-0.2 text-[9px] font-mono rounded bg-slate-900 border border-slate-800 text-slate-400">
                ⌘3
              </kbd>
            </button>

            <button
              type="button"
              id="tab-hedging"
              onClick={() => setActiveTab('hedging')}
              className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'hedging'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Hedging Lab & AI Copilot</span>
              <kbd className="hidden md:inline px-1 py-0.2 text-[9px] font-mono rounded bg-slate-900 border border-slate-800 text-slate-400">
                ⌘4
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
