import React, { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { MonteCarloResult } from '../types/risk';
import { runMonteCarloSimulation } from '../utils/quantEngine';

interface MonteCarloViewProps {
  initialValue: number;
  expectedReturn: number;
  volatility: number;
}

export const MonteCarloView: React.FC<MonteCarloViewProps> = ({
  initialValue,
  expectedReturn,
  volatility,
}) => {
  const [horizonYears, setHorizonYears] = useState<number>(10);
  const [simCount, setSimCount] = useState<number>(2500);
  const [runId, setRunId] = useState<number>(1);

  const mcResult: MonteCarloResult = useMemo(
    () => runMonteCarloSimulation(initialValue, expectedReturn, volatility, horizonYears, simCount),
    [initialValue, expectedReturn, volatility, horizonYears, simCount, runId],
  );

  const width = 800;
  const height = 360;
  const padding = { top: 30, right: 70, bottom: 40, left: 75 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...mcResult.percentiles.map(p => p.p95), initialValue * 1.5);
  const minVal = Math.max(0, Math.min(...mcResult.percentiles.map(p => p.p5)) * 0.8);
  const scaleX = (year: number) => padding.left + (year / horizonYears) * chartW;
  const scaleY = (val: number) => padding.top + chartH - ((val - minVal) / Math.max(1, maxVal - minVal)) * chartH;

  const outerBand = useMemo(() => {
    const top = mcResult.percentiles.map(p => `${scaleX(p.year)},${scaleY(p.p95)}`).join(' L ');
    const bottom = mcResult.percentiles.slice().reverse().map(p => `${scaleX(p.year)},${scaleY(p.p5)}`).join(' L ');
    return `M ${top} L ${bottom} Z`;
  }, [mcResult, horizonYears, maxVal, minVal]);

  const innerBand = useMemo(() => {
    const top = mcResult.percentiles.map(p => `${scaleX(p.year)},${scaleY(p.p75)}`).join(' L ');
    const bottom = mcResult.percentiles.slice().reverse().map(p => `${scaleX(p.year)},${scaleY(p.p25)}`).join(' L ');
    return `M ${top} L ${bottom} Z`;
  }, [mcResult, horizonYears, maxVal, minVal]);

  const medianLine = useMemo(
    () => mcResult.percentiles.map(p => `${scaleX(p.year)},${scaleY(p.p50)}`).join(' L '),
    [mcResult, horizonYears, maxVal, minVal],
  );

  return (
    <div className="space-y-6">
      <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Future</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black text-white tracking-tight">What could my portfolio become?</h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Instead of assuming the same return every year, RiskLab runs thousands of different market paths — good years, bad years, and recoveries — to show a range of possible outcomes.
            </p>
            <div className="mt-3 rounded-lg border border-sky-500/15 bg-sky-500/5 px-3 py-2 text-xs text-sky-200/80">
              This is not a forecast. The current model assumes you make no additional contributions during the period.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">Time horizon</span>
            {[1, 5, 10, 20, 30].map(yr => (
              <button
                key={yr}
                type="button"
                onClick={() => setHorizonYears(yr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  horizonYears === yr ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {yr} yr
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRunId(prev => prev + 1)}
              className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Run again
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Typical modeled outcome</span>
          <div className="text-2xl font-black text-white font-mono-nums mt-2">${Math.round(mcResult.terminalStats.median).toLocaleString()}</div>
          <p className="mt-1 text-[11px] text-slate-400">Half the simulations finish above this value and half below it.</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Weak outcome</span>
          <div className="text-2xl font-black text-rose-300 font-mono-nums mt-2">${Math.round(mcResult.terminalStats.p5Worst).toLocaleString()}</div>
          <p className="mt-1 text-[11px] text-slate-400">Only about 5% of simulated endings are below this value.</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Chance of ending below today</span>
          <div className="text-2xl font-black text-amber-300 font-mono-nums mt-2">{(mcResult.terminalStats.probOfLoss * 100).toFixed(1)}%</div>
          <p className="mt-1 text-[11px] text-slate-400">Share of simulations that end below your starting portfolio value.</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Chance of doubling</span>
          <div className="text-2xl font-black text-emerald-300 font-mono-nums mt-2">{(mcResult.terminalStats.probOfDoubling * 100).toFixed(1)}%</div>
          <p className="mt-1 text-[11px] text-slate-400">Share of simulations that finish above twice your starting value.</p>
        </div>
      </section>

      <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="pb-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">Range of simulated outcomes</h3>
          <p className="mt-1 text-xs text-slate-400">The darker band contains the middle 50% of simulations. The lighter band contains 90% of simulations.</p>
        </div>

        <div className="pt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[420px] font-mono-nums select-none">
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
              const yVal = minVal + ratio * (maxVal - minVal);
              const yPos = scaleY(yVal);
              return (
                <g key={ratio}>
                  <line x1={padding.left} y1={yPos} x2={width - padding.right} y2={yPos} stroke="#1e293b" strokeDasharray="4 4" strokeWidth="1" />
                  <text x={padding.left - 10} y={yPos + 4} fill="#64748b" fontSize="11" textAnchor="end">${Math.round(yVal / 1000)}k</text>
                </g>
              );
            })}
            {mcResult.percentiles.map(p => {
              const xPos = scaleX(p.year);
              return (
                <g key={p.year}>
                  <line x1={xPos} y1={padding.top} x2={xPos} y2={height - padding.bottom} stroke="#1e293b" strokeWidth="1" />
                  <text x={xPos} y={height - padding.bottom + 18} fill="#94a3b8" fontSize="11" textAnchor="middle">{p.year === 0 ? 'Start' : `Yr ${p.year}`}</text>
                </g>
              );
            })}
            <path d={outerBand} fill="rgba(16, 185, 129, 0.12)" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1" />
            <path d={innerBand} fill="rgba(16, 185, 129, 0.25)" stroke="rgba(16, 185, 129, 0.6)" strokeWidth="1" />
            {mcResult.samplePaths.slice(0, 8).map(path => {
              const d = path.points.map(pt => `${scaleX(pt.year)},${scaleY(pt.value)}`).join(' L ');
              return <path key={path.pathId} d={`M ${d}`} fill="none" stroke="rgba(148, 163, 184, 0.18)" strokeWidth="1" />;
            })}
            <line x1={padding.left} y1={scaleY(initialValue)} x2={width - padding.right} y2={scaleY(initialValue)} stroke="#f43f5e" strokeDasharray="5 5" strokeWidth="1.5" />
            <path d={`M ${medianLine}`} fill="none" stroke="#10b981" strokeWidth="3" />
          </svg>
        </div>

        <details className="mt-4 group border-t border-slate-800 pt-4">
          <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            See detailed outcome table
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-nums">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                  <th className="py-2 px-3">Year</th>
                  <th className="py-2 px-3 text-right">Weak (5%)</th>
                  <th className="py-2 px-3 text-right">Lower middle (25%)</th>
                  <th className="py-2 px-3 text-right text-emerald-400">Typical (50%)</th>
                  <th className="py-2 px-3 text-right">Upper middle (75%)</th>
                  <th className="py-2 px-3 text-right">Strong (95%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {mcResult.percentiles.map(p => (
                  <tr key={p.year}>
                    <td className="py-2 px-3 text-white">{p.year === 0 ? 'Start' : p.year}</td>
                    <td className="py-2 px-3 text-right text-rose-300">${Math.round(p.p5).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">${Math.round(p.p25).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-emerald-300 font-bold">${Math.round(p.p50).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">${Math.round(p.p75).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-emerald-200">${Math.round(p.p95).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="mt-4 group border-t border-slate-800 pt-4">
          <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            How does this work?
          </summary>
          <div className="mt-3 text-xs text-slate-400 leading-relaxed space-y-2">
            <p>
              Technical method: <strong className="text-slate-300">Monte Carlo simulation using geometric Brownian motion</strong>. RiskLab repeatedly generates different return paths using the portfolio&apos;s model return assumption and volatility.
            </p>
            <p>
              Current assumptions: {(expectedReturn * 100).toFixed(1)}% modeled annual return, {(volatility * 100).toFixed(1)}% annual volatility, {simCount.toLocaleString()} simulations, no contributions, no taxes, and constant model parameters.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span>Simulation detail:</span>
              {[2500, 5000].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSimCount(c)}
                  className={`px-2 py-1 rounded ${simCount === c ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}
                >
                  {c.toLocaleString()} paths
                </button>
              ))}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
};
