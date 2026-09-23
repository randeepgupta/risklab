import React, { useState } from 'react';
import { RiskContribution } from '../types/risk';
import { AlertCircle, ChevronDown } from 'lucide-react';

interface RiskContributionChartProps {
  contributions: RiskContribution[];
  portfolioVol: number;
}

export const RiskContributionChart: React.FC<RiskContributionChartProps> = ({ contributions }) => {
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  const sorted = [...contributions].sort(
    (a, b) => b.percentRiskContribution - a.percentRiskContribution,
  );

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
      <div className="pb-4 border-b border-slate-800">
        <h3 className="text-base font-bold text-white">What is driving your risk?</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          A holding can be a small part of your money but a large part of your portfolio&apos;s ups and downs. Compare how much you own with how much risk it contributes.
        </p>
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white font-mono-nums">{item.ticker}</span>
                  {isRiskHeavy && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      More risk than its size suggests
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {weightPct.toFixed(1)}% of money <span className="text-slate-600 mx-1">→</span>{' '}
                  <span className="text-amber-300 font-semibold">{riskContribPct.toFixed(1)}% of risk</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="w-16">Money</span>
                  <div className="flex-1 bg-slate-800/80 rounded-full h-2 overflow-hidden">
                    <div className="bg-slate-500 h-full rounded-full" style={{ width: `${Math.min(100, weightPct)}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="w-16">Risk</span>
                  <div className="flex-1 bg-slate-800/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isRiskHeavy ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(100, riskContribPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <details className="mt-4 group border-t border-slate-800 pt-3 text-xs text-slate-400">
        <summary className="cursor-pointer list-none flex items-center gap-1.5 text-slate-400 hover:text-slate-200">
          <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
          How is this calculated?
        </summary>
        <p className="mt-2 leading-relaxed">
          Technical method: <strong className="text-slate-300">Euler risk decomposition</strong>. The model combines each position&apos;s weight, volatility, and correlation with the rest of the portfolio to estimate its share of total portfolio volatility.
        </p>
      </details>
    </div>
  );
};
