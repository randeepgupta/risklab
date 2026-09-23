import React, { useState } from 'react';
import { RiskContribution } from '../types/risk';
import { PieChart, AlertCircle, Info } from 'lucide-react';

interface RiskContributionChartProps {
  contributions: RiskContribution[];
  portfolioVol: number;
}

export const RiskContributionChart: React.FC<RiskContributionChartProps> = ({
  contributions,
  portfolioVol,
}) => {
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);

  // Sort by risk contribution descending
  const sorted = [...contributions].sort(
    (a, b) => b.percentRiskContribution - a.percentRiskContribution
  );

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Risk Contribution by Asset
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono-nums border border-amber-500/20">
              Euler Decomposition
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compares <span className="text-slate-300 font-medium">Capital Weight (%)</span> against{' '}
            <span className="text-amber-400 font-medium">Risk Contribution (%)</span>. High-beta assets dominate total risk.
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono-nums">
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-600" />
            <span className="text-slate-400">Capital Weight %</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-slate-400">Risk Contrib %</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        {sorted.map(item => {
          const weightPct = item.weight * 100;
          const riskContribPct = Math.max(0, item.percentRiskContribution * 100);
          const isRiskHeavy = riskContribPct > weightPct * 1.25;

          return (
            <div
              key={item.ticker}
              onMouseEnter={() => setHoveredTicker(item.ticker)}
              onMouseLeave={() => setHoveredTicker(null)}
              className={`p-3 rounded-lg border transition-all ${
                hoveredTicker === item.ticker
                  ? 'bg-slate-800/60 border-slate-700'
                  : 'bg-slate-950/30 border-slate-800/60 hover:border-slate-700/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white font-mono-nums">{item.ticker}</span>
                  <span className="text-xs text-slate-400">
                    Standalone Vol: {(item.volatility * 100).toFixed(1)}%
                  </span>
                  {isRiskHeavy && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 font-mono-nums flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      Disproportionate Risk
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono-nums">
                  <span className="text-slate-400">
                    Weight: <span className="text-slate-200 font-semibold">{weightPct.toFixed(1)}%</span>
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-amber-400 font-bold">
                    Risk: {riskContribPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Visual dual bar: Weight vs Risk Contribution */}
              <div className="space-y-1.5">
                {/* Capital Weight bar */}
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden flex">
                  <div
                    className="bg-slate-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, weightPct)}%` }}
                  />
                </div>
                {/* Risk Contribution bar */}
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isRiskHeavy ? 'bg-amber-400 shadow-sm shadow-amber-500/20' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, riskContribPct)}%` }}
                  />
                </div>
              </div>

              {hoveredTicker === item.ticker && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono-nums animate-fadeIn">
                  <span>Investment: ${item.investment.toLocaleString()}</span>
                  <span>Marginal Risk (MCR): {(item.marginalRisk * 100).toFixed(2)}%</span>
                  <span>
                    Risk Factor Multiplier: {(riskContribPct / Math.max(0.1, weightPct)).toFixed(2)}x
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
