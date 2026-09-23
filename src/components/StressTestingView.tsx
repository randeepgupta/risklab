import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Sparkles,
  ArrowRight,
  TrendingDown,
  AlertCircle,
  Sliders,
  CheckCircle,
  RefreshCw,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { PortfolioPosition, StressScenario, StressTestResult } from '../types/risk';
import { PRESET_SCENARIOS, executeStressTest } from '../utils/quantEngine';

interface StressTestingViewProps {
  positions: PortfolioPosition[];
}

export const StressTestingView: React.FC<StressTestingViewProps> = ({ positions }) => {
  const [activeScenario, setActiveScenario] = useState<StressScenario>(PRESET_SCENARIOS[0]);
  const [customTickerShocks, setCustomTickerShocks] = useState<Record<string, number>>({
    SPY: -0.18,
    QQQM: -0.32,
    NVDA: -0.45,
    TSLA: -0.40,
  });

  // Factor sliders state
  const [equityShock, setEquityShock] = useState<number>(-18);
  const [rateBps, setRateBps] = useState<number>(-150);
  const [vixSpike, setVixSpike] = useState<number>(80);
  const [semiShock, setSemiShock] = useState<number>(-45);
  const [techShock, setTechShock] = useState<number>(-30);

  // Natural Language Prompt State
  const [aiPrompt, setAiPrompt] = useState<string>(
    'AI bubble bursts and the Fed cuts rates by 150 bps'
  );
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiResultExplanation, setAiResultExplanation] = useState<string | null>(null);

  // Keep customTickerShocks synced when positions change or activeScenario changes
  useEffect(() => {
    if (activeScenario.category === 'preset') {
      const shocks: Record<string, number> = {};
      positions.forEach(p => {
        shocks[p.ticker] = activeScenario.tickerShocks[p.ticker] !== undefined
          ? activeScenario.tickerShocks[p.ticker]
          : 0;
      });
      setCustomTickerShocks(shocks);
    }
  }, [activeScenario, positions]);

  // Execute stress test
  const stressResult: StressTestResult = React.useMemo(() => {
    // If active scenario is macro_factor, construct factorShocks
    if (activeScenario.category === 'macro_factor') {
      const scenarioWithFactors: StressScenario = {
        ...activeScenario,
        factorShocks: {
          equityShockPct: equityShock,
          rateChangeBps: rateBps,
          vixSpikePct: vixSpike,
          semiShockPct: semiShock,
          techShockPct: techShock,
        },
      };
      return executeStressTest(positions, scenarioWithFactors);
    }

    // Otherwise use direct ticker shocks
    const scenarioWithShocks: StressScenario = {
      ...activeScenario,
      tickerShocks: customTickerShocks,
    };
    return executeStressTest(positions, scenarioWithShocks);
  }, [positions, activeScenario, customTickerShocks, equityShock, rateBps, vixSpike, semiShock, techShock]);

  // Handle direct ticker shock slider
  const handleTickerShockChange = (ticker: string, val: number) => {
    setCustomTickerShocks(prev => ({
      ...prev,
      [ticker]: val,
    }));
  };

  // Call Gemini API to parse natural language scenario
  const handleAiTranslateScenario = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsAiLoading(true);
    try {
      const res = await fetch('/api/gemini/parse-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, portfolio: positions }),
      });

      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();

      if (data.factorShocks) {
        setEquityShock(data.factorShocks.equityShockPct ?? -18);
        setRateBps(data.factorShocks.rateChangeBps ?? -150);
        setVixSpike(data.factorShocks.vixSpikePct ?? 60);
        setSemiShock(data.factorShocks.semiShockPct ?? -40);
        setTechShock(data.factorShocks.techShockPct ?? -25);
      }

      if (data.assetSpecificImpacts) {
        const shocks: Record<string, number> = { ...customTickerShocks };
        Object.entries(data.assetSpecificImpacts).forEach(([t, impact]: [string, any]) => {
          shocks[t] = impact.shockPct;
        });
        setCustomTickerShocks(shocks);
      }

      setAiResultExplanation(data.macroTransmissionExplanation);

      // Create new active AI scenario
      setActiveScenario({
        id: 'ai_custom_' + Date.now(),
        name: data.scenarioName || aiPrompt,
        description: data.macroTransmissionExplanation,
        category: 'macro_factor',
        tickerShocks: customTickerShocks,
        factorShocks: data.factorShocks,
      });
    } catch (err) {
      console.error('Error parsing scenario:', err);
      // Fallback
      setActiveScenario(PRESET_SCENARIOS[1]);
      setAiResultExplanation(
        'Simulated transmission: Tech multiples compress under semiconductor margin contraction (-45%). Fixed income rallies as Fed eases rates by 150 bps.'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Natural Language Scenario Input Engine */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              AI Scenario Translation Engine
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono-nums">
            Translate Narrative → Factor Shocks → Asset Drawdowns
          </span>
        </div>

        <form onSubmit={handleAiTranslateScenario} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              aria-label="Describe a 'what-if' market scenario"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g., 'AI bubble bursts and the Fed cuts rates by 150 bps'"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={isAiLoading}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            {isAiLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Translating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Simulate Scenario</span>
              </>
            )}
          </button>
        </form>

        {/* Quick prompt pills */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
          <span className="text-slate-500 text-[11px]">Quick Scenarios:</span>
          <button
            type="button"
            onClick={() => {
              setAiPrompt('AI bubble bursts and the Fed cuts rates by 150 bps');
              setActiveScenario(PRESET_SCENARIOS[1]);
            }}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
          >
            AI Bubble + 150 bps Fed Cut
          </button>
          <button
            type="button"
            onClick={() => {
              setAiPrompt('Tech & Semiconductor Rout (SPY -18%, QQQM -32%, NVDA -45%, TSLA -40%)');
              setActiveScenario(PRESET_SCENARIOS[0]);
            }}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
          >
            MVP Tech Rout (-45% NVDA)
          </button>
          <button
            type="button"
            onClick={() => {
              setAiPrompt('2022-style Stagflation & aggressive +300 bps Fed tightening');
              setActiveScenario(PRESET_SCENARIOS[2]);
            }}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
          >
            2022 Rate Spike (+300 bps)
          </button>
          <button
            type="button"
            onClick={() => {
              setAiPrompt('Taiwan strait geopolitical escalation and semiconductor supply freeze');
              setActiveScenario(PRESET_SCENARIOS[4]);
            }}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
          >
            Taiwan Strait Semi Freeze
          </button>
        </div>

        {aiResultExplanation && (
          <div className="mt-3.5 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono-nums">
            <span className="text-emerald-400 font-bold mr-1.5">Transmission Mechanism:</span>
            {aiResultExplanation}
          </div>
        )}
      </div>

      {/* 2. HERO P&L RESULT CARD ($250K -> $178K) */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-mono-nums font-semibold border border-rose-500/20">
                Stress Test Outcome
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight">{activeScenario.name}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">{activeScenario.description}</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setActiveScenario(PRESET_SCENARIOS[0]);
                setCustomTickerShocks({
                  SPY: -0.18,
                  QQQM: -0.32,
                  NVDA: -0.45,
                  TSLA: -0.40,
                });
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold font-mono-nums transition-colors"
            >
              Reset to MVP Benchmark
            </button>
          </div>
        </div>

        {/* Big P&L Numbers */}
        <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4 sm:space-x-8">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Initial Portfolio
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono-nums mt-1">
                ${Math.round(stressResult.initialValue).toLocaleString()}
              </div>
            </div>

            <div className="text-slate-600">
              <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Stressed Value
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-rose-400 font-mono-nums mt-1">
                ${Math.round(stressResult.stressedValue).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Loss Summary Badges */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="text-[11px] text-rose-300 uppercase tracking-wider font-semibold">
                Total Dollar Loss
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono-nums mt-0.5">
                -${Math.round(stressResult.dollarLoss).toLocaleString()}
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="text-[11px] text-rose-300 uppercase tracking-wider font-semibold">
                Portfolio Drawdown
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono-nums mt-0.5">
                -{stressResult.percentLoss.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Primary Culprit Callout */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-300">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Primary Loss Driver:{' '}
              <strong className="text-white font-mono-nums">
                {stressResult.topCulprit.ticker}
              </strong>{' '}
              contributes{' '}
              <strong className="text-rose-400 font-mono-nums">
                -${Math.round(stressResult.topCulprit.dollarLoss).toLocaleString()}
              </strong>{' '}
              ({stressResult.topCulprit.lossContributionPct.toFixed(1)}% of total portfolio loss).
            </span>
          </div>
          <span className="text-slate-400 font-mono-nums text-[11px]">
            {stressResult.attributions.length} positions evaluated
          </span>
        </div>
      </div>

      {/* 3. Interactive Shocks Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Macro Factor Sliders */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Macro Financial Factors
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveScenario({ ...activeScenario, category: 'macro_factor' })}
              className={`text-xs px-2.5 py-1 rounded font-mono-nums transition-colors ${
                activeScenario.category === 'macro_factor'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {activeScenario.category === 'macro_factor' ? 'Active Mode' : 'Switch to Factor Mode'}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Shocks apply through each asset&apos;s equity beta, interest rate duration, and sector loadings.
          </p>

          {/* Factor 1: Equity Market */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono-nums">
              <span className="text-slate-300">Equity Market Shock (S&amp;P 500):</span>
              <span className={equityShock < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {equityShock > 0 ? `+${equityShock}%` : `${equityShock}%`}
              </span>
            </div>
            <input
              type="range"
              aria-label="Equity Market Shock"
              min="-50"
              max="20"
              step="1"
              value={equityShock}
              onChange={e => {
                setEquityShock(parseFloat(e.target.value));
                if (activeScenario.category !== 'macro_factor') {
                  setActiveScenario({ ...activeScenario, category: 'macro_factor' });
                }
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Factor 2: Interest Rates (bps) */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono-nums">
              <span className="text-slate-300">Interest Rates Change:</span>
              <span className={rateBps > 0 ? 'text-rose-400 font-bold' : 'text-sky-400 font-bold'}>
                {rateBps > 0 ? `+${rateBps} bps (Hike)` : `${rateBps} bps (Cut)`}
              </span>
            </div>
            <input
              type="range"
              aria-label="Interest Rates Change"
              min="-300"
              max="300"
              step="25"
              value={rateBps}
              onChange={e => {
                setRateBps(parseFloat(e.target.value));
                if (activeScenario.category !== 'macro_factor') {
                  setActiveScenario({ ...activeScenario, category: 'macro_factor' });
                }
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Factor 3: Semiconductor Sector */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono-nums">
              <span className="text-slate-300">Semiconductor Sector Shock:</span>
              <span className={semiShock < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {semiShock}%
              </span>
            </div>
            <input
              type="range"
              aria-label="Semiconductor Sector Shock"
              min="-60"
              max="20"
              step="1"
              value={semiShock}
              onChange={e => {
                setSemiShock(parseFloat(e.target.value));
                if (activeScenario.category !== 'macro_factor') {
                  setActiveScenario({ ...activeScenario, category: 'macro_factor' });
                }
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Factor 4: Broad Tech Shock */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono-nums">
              <span className="text-slate-300">Nasdaq / Tech Sector Shock:</span>
              <span className={techShock < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {techShock}%
              </span>
            </div>
            <input
              type="range"
              aria-label="Nasdaq / Tech Sector Shock"
              min="-50"
              max="20"
              step="1"
              value={techShock}
              onChange={e => {
                setTechShock(parseFloat(e.target.value));
                if (activeScenario.category !== 'macro_factor') {
                  setActiveScenario({ ...activeScenario, category: 'macro_factor' });
                }
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Factor 5: VIX context (not directly added to spot P&L) */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono-nums">
              <span className="text-slate-300">VIX Spike (scenario context):</span>
              <span className="text-amber-400 font-bold">+{vixSpike}%</span>
            </div>
            <input
              type="range"
              aria-label="VIX Volatility Spike"
              min="0"
              max="250"
              step="5"
              value={vixSpike}
              onChange={e => {
                setVixSpike(parseFloat(e.target.value));
                if (activeScenario.category !== 'macro_factor') {
                  setActiveScenario({ ...activeScenario, category: 'macro_factor' });
                }
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 leading-snug">
              Stored for volatility/option context; not separately subtracted from spot returns to avoid double-counting the equity shock.
            </p>
          </div>
        </div>

        {/* Right: Asset-by-Asset Direct Shock Sliders */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Direct Asset Shocks
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveScenario({ ...activeScenario, category: 'preset' })}
              className={`text-xs px-2.5 py-1 rounded font-mono-nums transition-colors ${
                activeScenario.category === 'preset'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {activeScenario.category === 'preset' ? 'Active Mode' : 'Switch to Asset Mode'}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Directly adjust individual asset returns to test custom tail scenarios.
          </p>

          <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
            {positions.map(p => {
              const currentShock = customTickerShocks[p.ticker] ?? -0.20;
              const shockPct = currentShock * 100;

              return (
                <div key={p.ticker} className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80">
                  <div className="flex justify-between items-center text-xs font-mono-nums mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">{p.ticker}</span>
                      <span className="text-slate-400">(${p.investment.toLocaleString()})</span>
                    </div>
                    <span className={shockPct < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {shockPct > 0 ? `+${shockPct.toFixed(1)}%` : `${shockPct.toFixed(1)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={`Shock for ${p.ticker}`}
                    min="-80"
                    max="40"
                    step="1"
                    value={shockPct}
                    onChange={e => {
                      handleTickerShockChange(p.ticker, parseFloat(e.target.value) / 100);
                      if (activeScenario.category !== 'preset') {
                        setActiveScenario({ ...activeScenario, category: 'preset' });
                      }
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Detailed Loss Attribution Waterfall & Table */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Position Loss Attribution & Risk Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifies which holdings contribute the highest share to the total -${Math.round(stressResult.dollarLoss).toLocaleString()} drawdown.
            </p>
          </div>
          <span className="text-xs font-mono-nums text-slate-400">
            Sorted by Dollar Loss ↓
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-nums">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase text-[11px]">
                <th className="py-2.5 px-4">Asset</th>
                <th className="py-2.5 px-4 text-right">Initial Value</th>
                <th className="py-2.5 px-4 text-right">Shock %</th>
                <th className="py-2.5 px-4 text-right">Stressed Value</th>
                <th className="py-2.5 px-4 text-right text-rose-400 font-semibold">Dollar Loss</th>
                <th className="py-2.5 px-4 text-right">% of Portfolio Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {stressResult.attributions.map((attr, idx) => {
                const isTop = idx === 0;
                return (
                  <tr key={attr.ticker} className={`hover:bg-slate-800/30 ${isTop ? 'bg-rose-950/20' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">{attr.ticker}</span>
                        {isTop && (
                          <span className="px-1.5 py-0.2 text-[9px] bg-rose-500/20 text-rose-300 rounded uppercase font-bold">
                            Top Culprit
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      ${Math.round(attr.initialValue).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={attr.shockPct < 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                        {(attr.shockPct * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-white font-semibold">
                      ${Math.round(attr.stressedValue).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400 font-bold">
                      -${Math.round(attr.dollarLoss).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, attr.lossContributionPct)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-bold text-slate-200">
                          {attr.lossContributionPct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-800 bg-slate-950/70 font-bold text-white">
                <td className="py-3 px-4">Total Portfolio</td>
                <td className="py-3 px-4 text-right">
                  ${Math.round(stressResult.initialValue).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right text-rose-400">
                  -{stressResult.percentLoss.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-right text-rose-300">
                  ${Math.round(stressResult.stressedValue).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right text-rose-400">
                  -${Math.round(stressResult.dollarLoss).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right text-slate-300">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
