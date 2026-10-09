import React, { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { MonteCarloResult } from '../types/risk';
import {annualizedOutcomeReturn, annualReturnToDrift, benchmarkDifferenceLabel, DEFAULT_FUTURE_ANNUAL_RETURN, modeledReturnRange, SPY_RETURN_BENCHMARK} from '../utils/simulationOutcomes';
import { runMonteCarloSimulation } from '../utils/quantEngine';

interface MonteCarloViewProps {
  initialValue: number;
  volatility: number;
  volatilitySource?: string;
}

export const MonteCarloView: React.FC<MonteCarloViewProps> = ({
  initialValue,
  volatility,
  volatilitySource = 'Portfolio risk model',
}) => {
  const [expectedReturn, setExpectedReturn] = useState<number>(DEFAULT_FUTURE_ANNUAL_RETURN);
  const [horizonYears, setHorizonYears] = useState<number>(10);
  const [simCount, setSimCount] = useState<number>(2500);
  const [runId, setRunId] = useState<number>(1);
  const [returnPeriod, setReturnPeriod] = useState<'year' | 'month'>('year');
  const returnRange = modeledReturnRange(expectedReturn, volatility, returnPeriod === 'year' ? 1 : 1 / 12);
  const signedReturn = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;

  const mcResult: MonteCarloResult = useMemo(
    () => runMonteCarloSimulation(initialValue, annualReturnToDrift(expectedReturn, volatility), volatility, horizonYears, simCount),
    [initialValue, expectedReturn, volatility, horizonYears, simCount, runId],
  );

  const outcomeReturn = (endingValue: number) => {
    const rate = annualizedOutcomeReturn(initialValue, endingValue, horizonYears);
    return rate === null ? 'N/A' : `${(rate * 100).toFixed(1)}%`;
  };

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
              Explore possible outcomes from thousands of simulated market paths.
            </p>
            <div className="mt-3 rounded-lg border border-sky-500/15 bg-sky-500/5 px-3 py-2 text-xs text-sky-200/80">
              Simulation, not a forecast · No additional contributions
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

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Strong outcome</span>
          <div className="text-2xl font-black text-emerald-300 font-mono-nums mt-2">${Math.round(mcResult.terminalStats.p95Best).toLocaleString()}</div>
          <p className="mt-2 text-sm font-semibold text-emerald-300">{outcomeReturn(mcResult.terminalStats.p95Best)} annualized return</p>
          <details className="mt-2 group"><summary className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"><ChevronDown className="h-3 w-3 group-open:rotate-180" />What does this mean?</summary><p className="mt-1 text-[11px] text-slate-400">95th percentile: about 5% of simulated endings are higher. This is not the maximum possible outcome.</p></details>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Typical modeled outcome</span>
          <div className="text-2xl font-black text-white font-mono-nums mt-2">${Math.round(mcResult.terminalStats.median).toLocaleString()}</div>
          <p className="mt-2 text-sm font-semibold text-slate-200">{outcomeReturn(mcResult.terminalStats.median)} annualized return</p>
          <details className="mt-2 group"><summary className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"><ChevronDown className="h-3 w-3 group-open:rotate-180" />What does this mean?</summary><p className="mt-1 text-[11px] text-slate-400">Half the simulations finish above this value and half below it.</p></details>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Weak outcome</span>
          <div className="text-2xl font-black text-rose-300 font-mono-nums mt-2">${Math.round(mcResult.terminalStats.p5Worst).toLocaleString()}</div>
          <p className="mt-2 text-sm font-semibold text-rose-300">{outcomeReturn(mcResult.terminalStats.p5Worst)} annualized return</p>
          <details className="mt-2 group"><summary className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"><ChevronDown className="h-3 w-3 group-open:rotate-180" />What does this mean?</summary><p className="mt-1 text-[11px] text-slate-400">5th percentile: only about 5% of simulated endings are below this value.</p></details>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Chance of ending below today</span>
          <div className="text-2xl font-black text-amber-300 font-mono-nums mt-2">{(mcResult.terminalStats.probOfLoss * 100).toFixed(1)}%</div>
          <details className="mt-2 group"><summary className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"><ChevronDown className="h-3 w-3 group-open:rotate-180" />What does this mean?</summary><p className="mt-1 text-[11px] text-slate-400">Share of simulations that end below your starting portfolio value.</p></details>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Chance of doubling</span>
          <div className="text-2xl font-black text-emerald-300 font-mono-nums mt-2">{(mcResult.terminalStats.probOfDoubling * 100).toFixed(1)}%</div>
          <details className="mt-2 group"><summary className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"><ChevronDown className="h-3 w-3 group-open:rotate-180" />What does this mean?</summary><p className="mt-1 text-[11px] text-slate-400">Share of simulations that finish above twice your starting value.</p></details>
        </div>
      </section>

      <section aria-label="Simulation assumptions" className="bg-slate-900/60 rounded-xl border border-slate-800 p-5">
        <div>
          <div className="flex items-center justify-between gap-3"><label htmlFor="future-annual-return" className="text-sm font-semibold text-white">Choose annual compound growth</label><output htmlFor="future-annual-return" className="text-xl font-bold text-sky-200 font-mono-nums">{(expectedReturn * 100).toFixed(2)}% per year</output></div>
          <input id="future-annual-return" type="range" min="-10" max="25" step="0.01" value={expectedReturn * 100} onChange={event => setExpectedReturn(Number(event.target.value) / 100)} aria-describedby="future-return-note" className="mt-4 w-full accent-sky-400" />
          <div className="flex justify-between text-[11px] text-slate-500"><span>−10% per year</span><span>25% per year</span></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p aria-live="polite" className="text-xs font-semibold text-sky-200">{benchmarkDifferenceLabel(expectedReturn)}</p><button type="button" onClick={() => setExpectedReturn(DEFAULT_FUTURE_ANNUAL_RETURN)} className="rounded-md border border-sky-500/30 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-500/10">Reset to SPY benchmark</button></div>
          <p id="future-return-note" className="mt-3 text-[11px] text-slate-400">Historical SPY reference · {SPY_RETURN_BENCHMARK.asOf} · Not a forecast</p>
          <details className="mt-3 group">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-sky-300 hover:text-sky-100"><ChevronDown className="h-3.5 w-3.5 group-open:rotate-180" />About the SPY benchmark</summary>
          <p id="future-return-help" className="mt-3 text-xs text-slate-300 leading-relaxed">Starts at SPY’s historical 10-year annualized total return: {(SPY_RETURN_BENCHMARK.annualReturn * 100).toFixed(2)}% per year, as of {SPY_RETURN_BENCHMARK.asOf}, with dividends reinvested. This describes one past decade, not every 10-year period, and is not a forecast for your portfolio.</p>
          <p className="mt-2 text-[11px] text-slate-400">Reference period: {SPY_RETURN_BENCHMARK.period}. Before personal taxes, net of fund fees. <a href={SPY_RETURN_BENCHMARK.source} target="_blank" rel="noreferrer" className="text-sky-300 underline">Source: State Street SPY performance</a></p>
          <p className="mt-2 text-xs text-slate-400">This sets the center of simulated long-term compound growth. Monthly gains and losses still vary randomly, using your portfolio’s volatility. Your holdings’ recent returns are not projected forward. The slider limits are growth assumptions, not limits on individual simulated returns.</p>
          </details>
        </div>
        <details className="mt-4 group border-t border-slate-800 pt-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"><ChevronDown className="h-3.5 w-3.5 group-open:rotate-180" />Simulation settings and assumptions</summary>
        <dl className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-xs text-slate-400">Starting portfolio</dt><dd className="mt-1 font-bold text-white font-mono-nums">${Math.round(initialValue).toLocaleString()}</dd></div>
          <div><dt className="text-xs text-slate-400">Annual compound growth assumption</dt><dd className="mt-1 font-bold text-emerald-300 font-mono-nums">{(expectedReturn * 100).toFixed(2)}%</dd><dd className="mt-1 text-[11px] text-slate-500">Editable assumption anchored to a dated SPY benchmark</dd></div>
          <div><dt className="text-xs text-slate-400">Annual volatility</dt><dd className="mt-1 font-bold text-white font-mono-nums">{(volatility * 100).toFixed(1)}%</dd><dd className="mt-1 text-[11px] text-slate-500">{volatilitySource}. Controls the spread of possible returns.</dd></div>
          <div><dt className="text-xs text-slate-400">Simulation settings</dt><dd className="mt-1 font-bold text-white">{horizonYears} years · {simCount.toLocaleString()} paths</dd><dd className="mt-1 text-[11px] text-slate-500">Monthly steps, compounded returns</dd></div>
        </dl>
        <p className="mt-4 text-xs text-slate-400 leading-relaxed">Strong and weak outcomes use these same inputs. Random monthly market gains and losses produce different endings. The model holds return and volatility constant, with no contributions or withdrawals, taxes, fees, or inflation adjustment.</p>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">The annualized return below each outcome is the equivalent compound growth rate from your starting value to that ending value. It is calculated from the simulation result; individual years can have very different returns.</p>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">The typical outcome’s compound annual return should be close to your selected rate; a finite number of random simulations can place it slightly above or below. Strong and weak outcomes reflect the same growth assumption with different market paths.</p>
        </details>
      </section>

      <details aria-label="Understanding returns" className="group bg-slate-900/60 rounded-xl border border-slate-800 p-5">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"><ChevronDown className="h-4 w-4 group-open:rotate-180" />How can annual growth include losing months?</summary>
        <div className="mt-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Annual growth. Monthly ups and downs.</h3>
            <p className="mt-2 text-sm text-slate-300">The {(expectedReturn * 100).toFixed(2)}% return assumption is <strong className="text-white">per year, not per month</strong>. Each simulated month gets a different return; gains and losses compound over time.</p>
          </div>
          <div role="group" aria-label="Return period" className="flex shrink-0 gap-1 rounded-lg bg-slate-950 p-1">
            {(['year', 'month'] as const).map(period => <button key={period} type="button" aria-pressed={returnPeriod === period} onClick={() => setReturnPeriod(period)} className={`rounded-md px-3 py-2 text-xs font-semibold ${returnPeriod === period ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-white'}`}>One {period}</button>)}
          </div>
        </div>
        <p className="mt-5 text-xs text-slate-400">Possible return over <strong className="text-slate-200">one {returnPeriod}</strong>, using your portfolio’s assumptions</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[{label: 'Lower end', value: returnRange.low, color: 'text-rose-300'}, {label: 'Middle result', value: returnRange.median, color: 'text-white'}, {label: 'Upper end', value: returnRange.high, color: 'text-emerald-300'}].map(item => <div key={item.label}><p className="text-[11px] text-slate-400">{item.label}</p><p className={`mt-1 text-xl sm:text-2xl font-bold font-mono-nums ${item.color}`}>{signedReturn(item.value)}</p></div>)}
        </div>
        <div aria-hidden="true" className="mt-3 flex h-3 overflow-hidden rounded-full"><div className="w-[5%] bg-rose-500/50" /><div className="w-[90%] bg-gradient-to-r from-rose-400/40 via-sky-400/60 to-emerald-400/40" /><div className="w-[5%] bg-emerald-500/50" /></div>
        <div className="mt-2 flex justify-between text-[10px] sm:text-xs text-slate-400"><span>5% below</span><span>90% of modeled outcomes</span><span>5% above</span></div>
        <p className="mt-4 text-xs text-slate-400 leading-relaxed">This is a probability band, not a minimum or maximum. Returns near the middle are more common; larger gains and losses are rarer. A positive growth assumption still allows losing months and years.</p>
        <p className="mt-2 text-xs text-sky-200/80">Switch to “One month” to see short-term swings. A gain of 6% in one month does not mean 6% every month.</p>
        </div>
      </details>

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
              Current assumptions: {(expectedReturn * 100).toFixed(2)}% typical annual compound growth assumption, {(volatility * 100).toFixed(1)}% annual volatility, {simCount.toLocaleString()} simulations, no contributions, no taxes, and constant model parameters.
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
