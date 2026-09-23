import React, { useState } from 'react';
import { Shield, AlertTriangle, TrendingUp, Info, HelpCircle } from 'lucide-react';
import { PortfolioRiskMetrics } from '../types/risk';

interface RiskMetricsCardProps {
  metrics: PortfolioRiskMetrics;
}

export const RiskMetricsCard: React.FC<RiskMetricsCardProps> = ({ metrics }) => {
  const [varHorizon, setVarHorizon] = useState<'1d' | '10d' | '1y'>('1d');
  const [confidenceLevel, setConfidenceLevel] = useState<'95' | '99'>('95');

  // Compute selected VaR and CVaR
  let selectedVaR = metrics.var95_1d;
  let selectedVaRPct = metrics.var95_1d_pct;
  let selectedCVaR = metrics.cvar95_1d;
  let selectedCVaRPct = metrics.cvar95_1d_pct;

  if (varHorizon === '1d') {
    if (confidenceLevel === '95') {
      selectedVaR = metrics.var95_1d;
      selectedVaRPct = metrics.var95_1d_pct;
      selectedCVaR = metrics.cvar95_1d;
      selectedCVaRPct = metrics.cvar95_1d_pct;
    } else {
      selectedVaR = metrics.var99_1d;
      selectedVaRPct = metrics.var99_1d_pct;
      selectedCVaR = metrics.cvar99_1d;
      selectedCVaRPct = metrics.cvar99_1d_pct;
    }
  } else if (varHorizon === '10d') {
    if (confidenceLevel === '95') {
      selectedVaR = metrics.var95_10d;
      selectedVaRPct = metrics.var95_10d_pct;
      selectedCVaR = metrics.cvar95_10d;
      selectedCVaRPct = metrics.cvar95_10d_pct;
    } else {
      selectedVaR = metrics.var99_10d;
      selectedVaRPct = metrics.var99_10d_pct;
      selectedCVaR = metrics.cvar99_10d;
      selectedCVaRPct = metrics.cvar99_10d_pct;
    }
  } else {
    // 1y
    if (confidenceLevel === '95') {
      selectedVaR = metrics.var95_1y;
      selectedVaRPct = metrics.var95_1y_pct;
      selectedCVaR = metrics.cvar95_1y;
      selectedCVaRPct = metrics.cvar95_1y_pct;
    } else {
      selectedVaR = metrics.var99_1y;
      selectedVaRPct = metrics.var99_1y_pct;
      selectedCVaR = metrics.cvar99_1y;
      selectedCVaRPct = metrics.cvar99_1y_pct;
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Volatility Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Annualized Volatility (σ)
          </span>
          <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
            <ActivityIcon className="w-4 h-4" />
          </span>
        </div>
        <div className="my-2">
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono-nums">
            {(metrics.annualizedVolatility * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span>Variance: {metrics.annualizedVariance.toFixed(4)}</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400">
              +{metrics.diversificationBenefitPct.toFixed(1)}% div benefit
            </span>
          </div>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              metrics.annualizedVolatility > 0.3
                ? 'bg-rose-500'
                : metrics.annualizedVolatility > 0.2
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, metrics.annualizedVolatility * 200)}%` }}
          />
        </div>
      </div>

      {/* 2. Value at Risk (VaR) Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Value at Risk (VaR)
            </span>
            <span
              title="Parametric normal VaR: the loss threshold exceeded with the selected tail probability under the model assumptions."
              className="text-slate-500 cursor-help"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-center space-x-1 text-[10px] font-mono-nums">
            <button
              type="button"
              onClick={() => setConfidenceLevel(confidenceLevel === '95' ? '99' : '95')}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              {confidenceLevel}%
            </button>
            <button
              type="button"
              onClick={() => {
                const next = varHorizon === '1d' ? '10d' : varHorizon === '10d' ? '1y' : '1d';
                setVarHorizon(next);
              }}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold transition-colors"
            >
              {varHorizon}
            </button>
          </div>
        </div>
        <div className="my-2">
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono-nums">
            -${Math.round(selectedVaR).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span className="text-rose-300/90 font-mono-nums">
              -{(selectedVaRPct * 100).toFixed(2)}%
            </span>{' '}
            loss threshold ({varHorizon} horizon, {confidenceLevel}% conf)
          </div>
        </div>
        <div className="text-[10px] text-slate-500 flex justify-between items-center pt-1 border-t border-slate-800/60 font-mono-nums">
          <span>Daily 95%: -${Math.round(metrics.var95_1d).toLocaleString()}</span>
          <span>1-Yr 95%: -${Math.round(metrics.var95_1y).toLocaleString()}</span>
        </div>
      </div>

      {/* 3. Conditional VaR (Expected Shortfall) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Conditional VaR (CVaR)
            </span>
            <span
              title="CVaR (Expected Shortfall) measures average loss when losses breach the VaR cutoff threshold."
              className="text-slate-500 cursor-help"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono-nums">
            Tail Risk
          </span>
        </div>
        <div className="my-2">
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-300 font-mono-nums">
            -${Math.round(selectedCVaR).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span className="text-rose-400 font-mono-nums">
              -{(selectedCVaRPct * 100).toFixed(2)}%
            </span>{' '}
            average tail loss if VaR is breached
          </div>
        </div>
        <div className="text-[10px] text-slate-500 flex justify-between items-center pt-1 border-t border-slate-800/60 font-mono-nums">
          <span>Daily ES: -${Math.round(metrics.cvar95_1d).toLocaleString()}</span>
          <span>1-Yr ES: -${Math.round(metrics.cvar95_1y).toLocaleString()}</span>
        </div>
      </div>

      {/* 4. Portfolio Beta & Sharpe */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Risk-Adjusted Efficiency
          </span>
          <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </span>
        </div>
        <div className="my-2 grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-slate-400">Sharpe Ratio</div>
            <div className="text-xl font-bold text-white font-mono-nums">
              {metrics.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono-nums">
              Sortino: {metrics.sortinoRatio.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Market Beta (β)</div>
            <div className="text-xl font-bold text-amber-400 font-mono-nums">
              {metrics.portfolioBeta.toFixed(2)}x
            </div>
            <div className="text-[10px] text-slate-500 font-mono-nums">
              Rate sensitivity: {metrics.durationSensitivity.toFixed(1)}y
            </div>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 flex items-center justify-between">
          <span>Model Return Assumption:</span>
          <span className="font-mono-nums text-emerald-400 font-semibold">
            +{(metrics.expectedAnnualReturn * 100).toFixed(1)}% / yr
          </span>
        </div>
      </div>
    </div>
  );
};

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
