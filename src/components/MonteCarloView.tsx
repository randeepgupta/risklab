import React, { useState, useMemo } from 'react';
import { Play, RotateCcw, TrendingUp, AlertTriangle, ShieldCheck, DollarSign } from 'lucide-react';
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
  const [horizonYears, setHorizonYears] = useState<number>(5);
  const [simCount, setSimCount] = useState<number>(2500);
  // Rerun token: changing it intentionally triggers a fresh unseeded simulation.
  const [runId, setRunId] = useState<number>(1);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  // Compute Monte Carlo on parameter change or rerun request.
  const mcResult: MonteCarloResult = useMemo(() => {
    return runMonteCarloSimulation(initialValue, expectedReturn, volatility, horizonYears, simCount);
  }, [initialValue, expectedReturn, volatility, horizonYears, simCount, runId]);

  const handleRerun = () => {
    setRunId(prev => prev + 1);
  };

  // SVG dimensions for fan chart
  const width = 800;
  const height = 360;
  const padding = { top: 30, right: 70, bottom: 40, left: 75 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Max scale calculation
  const maxVal = Math.max(
    ...mcResult.percentiles.map(p => p.p95),
    initialValue * 1.5
  );
  const minVal = Math.max(
    0,
    Math.min(...mcResult.percentiles.map(p => p.p5)) * 0.8
  );

  const scaleX = (year: number) => padding.left + (year / horizonYears) * chartW;
  const scaleY = (val: number) =>
    padding.top + chartH - ((val - minVal) / Math.max(1, maxVal - minVal)) * chartH;

  // Generate SVG area paths for percentile bands
  const p95_p5_path = useMemo(() => {
    const top = mcResult.percentiles.map(p => `${scaleX(p.year)},${scaleY(p.p95)}`).join(' L ');
    const bottom = mcResult.percentiles
      .slice()
      .reverse()
      .map(p => `${scaleX(p.year)},${scaleY(p.p5)}`)
      .join(' L ');
    return `M ${top} L ${bottom} Z`;
  }, [mcResult, horizonYears, maxVal, minVal]);

  const p75_p25_path = useMemo(() => {
    const top = mcResult.percentiles.map(p => `${scaleX(p.year)},${scaleY(p.p75)}`).join(' L ');
    const bottom = mcResult.percentiles
      .slice()
      .reverse()
      .map(p => `${scaleX(p.year)},${scaleY(p.p25)}`)
      .join(' L ');
    return `M ${top} L ${bottom} Z`;
  }, [mcResult, horizonYears, maxVal, minVal]);

  const medianLine = useMemo(() => {
    return mcResult.percentiles.map(p => `${scaleX(p.year)},${scaleY(p.p50)}`).join(' L ');
  }, [mcResult, horizonYears, maxVal, minVal]);

  const initialBaselineY = scaleY(initialValue);

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Monte Carlo Simulation Engine
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono-nums border border-emerald-500/20">
                Geometric Brownian Motion
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simulates {simCount.toLocaleString()} stochastic portfolio trajectories using drift μ ={' '}
              {(expectedReturn * 100).toFixed(1)}% and annual volatility σ = {(volatility * 100).toFixed(1)}%.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Horizon Buttons (1, 3, 5, 10 Years) */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono-nums">
              <span className="text-slate-500 px-2">Horizon:</span>
              {[1, 3, 5, 10].map(yr => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setHorizonYears(yr)}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                    horizonYears === yr
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {yr}Y
                </button>
              ))}
            </div>

            {/* Sim count */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono-nums">
              <span className="text-slate-500 px-2">Paths:</span>
              {[2500, 5000].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSimCount(c)}
                  className={`px-2 py-1 rounded font-semibold transition-colors ${
                    simCount === c
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {c / 1000}K
                </button>
              ))}
            </div>

            {/* Rerun */}
            <button
              type="button"
              onClick={handleRerun}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Simulate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Probability KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Median Terminal Wealth (50%)
          </span>
          <div className="text-2xl font-bold text-white font-mono-nums mt-1.5">
            ${Math.round(mcResult.terminalStats.median).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono-nums mt-1">
            +
            {(
              ((mcResult.terminalStats.median - initialValue) / initialValue) *
              100
            ).toFixed(1)}
            % gain over {horizonYears}y
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            5th Percentile Terminal Wealth
          </span>
          <div className="text-2xl font-bold text-rose-400 font-mono-nums mt-1.5">
            ${Math.round(mcResult.terminalStats.p5Worst).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 font-mono-nums mt-1">
            {(
              ((mcResult.terminalStats.p5Worst - initialValue) / initialValue) *
              100
            ).toFixed(1)}
            % vs starting value at the end of year {horizonYears}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Probability of Capital Loss
          </span>
          <div className="text-2xl font-bold text-amber-400 font-mono-nums mt-1.5">
            {(mcResult.terminalStats.probOfLoss * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono-nums mt-1">
            Likelihood ending below ${initialValue.toLocaleString()}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Probability of Doubling (2x)
          </span>
          <div className="text-2xl font-bold text-emerald-400 font-mono-nums mt-1.5">
            {(mcResult.terminalStats.probOfDoubling * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono-nums mt-1">
            Likelihood ending &gt; ${(initialValue * 2).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Interactive Fan Chart */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Simulated Wealth Distribution Fan Chart
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulated outcome ranges over time. Bands show the 5th–95th and 25th–75th percentiles across paths.
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono-nums">
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
              <span className="text-slate-400">90% Simulated Range (5th-95th)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/40 border border-emerald-500" />
              <span className="text-slate-400">50% Simulated Range (25th-75th)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-4 h-0.5 bg-emerald-400" />
              <span className="text-emerald-400 font-bold">Median (50th)</span>
            </div>
          </div>
        </div>

        {/* SVG Container */}
        <div className="pt-4 overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto max-h-[420px] font-mono-nums select-none"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map(ratio => {
              const yVal = minVal + ratio * (maxVal - minVal);
              const yPos = scaleY(yVal);
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={width - padding.right}
                    y2={yPos}
                    stroke="#1e293b"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 10}
                    y={yPos + 4}
                    fill="#64748b"
                    fontSize="11"
                    textAnchor="end"
                  >
                    ${Math.round(yVal / 1000)}k
                  </text>
                </g>
              );
            })}

            {/* Year X axis labels */}
            {mcResult.percentiles.map(p => {
              const xPos = scaleX(p.year);
              return (
                <g key={p.year}>
                  <line
                    x1={xPos}
                    y1={padding.top}
                    x2={xPos}
                    y2={height - padding.bottom}
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                  <text
                    x={xPos}
                    y={height - padding.bottom + 18}
                    fill="#94a3b8"
                    fontSize="11"
                    textAnchor="middle"
                  >
                    {p.year === 0 ? 'Start' : `Yr ${p.year}`}
                  </text>
                </g>
              );
            })}

            {/* Outer 90% confidence corridor (p95 - p5) */}
            <path
              d={p95_p5_path}
              fill="rgba(16, 185, 129, 0.12)"
              stroke="rgba(16, 185, 129, 0.3)"
              strokeWidth="1"
            />

            {/* Interquartile 50% corridor (p75 - p25) */}
            <path
              d={p75_p25_path}
              fill="rgba(16, 185, 129, 0.25)"
              stroke="rgba(16, 185, 129, 0.6)"
              strokeWidth="1"
            />

            {/* Representative stochastic paths (faint lines) */}
            {mcResult.samplePaths.slice(0, 8).map(path => {
              const d = path.points.map((pt, i) => `${scaleX(pt.year)},${scaleY(pt.value)}`).join(' L ');
              return (
                <path
                  key={path.pathId}
                  d={`M ${d}`}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.22)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Baseline initial investment line */}
            <line
              x1={padding.left}
              y1={initialBaselineY}
              x2={width - padding.right}
              y2={initialBaselineY}
              stroke="#f43f5e"
              strokeDasharray="5 5"
              strokeWidth="1.5"
            />
            <text
              x={width - padding.right + 8}
              y={initialBaselineY + 4}
              fill="#f43f5e"
              fontSize="10"
              fontWeight="bold"
            >
              $Baseline
            </text>

            {/* Median expected trajectory */}
            <path
              d={`M ${medianLine}`}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
            />

            {/* Dots on median at each year */}
            {mcResult.percentiles.map(p => (
              <circle
                key={p.year}
                cx={scaleX(p.year)}
                cy={scaleY(p.p50)}
                r="4"
                fill="#10b981"
                stroke="#0f172a"
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>

        {/* Year breakdown table */}
        <div className="mt-4 pt-4 border-t border-slate-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-nums">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                <th className="py-2 px-3">Milestone</th>
                <th className="py-2 px-3 text-right">5th Percentile (Tail)</th>
                <th className="py-2 px-3 text-right">25th Percentile</th>
                <th className="py-2 px-3 text-right text-emerald-400">50th (Median)</th>
                <th className="py-2 px-3 text-right">75th Percentile</th>
                <th className="py-2 px-3 text-right">95th Percentile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {mcResult.percentiles.map(p => (
                <tr key={p.year} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-semibold text-white">
                    {p.year === 0 ? 'Initial Value' : `Year ${p.year}`}
                  </td>
                  <td className="py-2 px-3 text-right text-rose-400">
                    ${Math.round(p.p5).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right">${Math.round(p.p25).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-400">
                    ${Math.round(p.p50).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right">${Math.round(p.p75).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-emerald-300">
                    ${Math.round(p.p95).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
