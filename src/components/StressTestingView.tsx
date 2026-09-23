import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { PortfolioPosition, StressScenario } from '../types/risk';
import { PRESET_SCENARIOS, executeStressTest } from '../utils/quantEngine';

interface StressTestingViewProps {
  positions: PortfolioPosition[];
}

const QUICK_SCENARIOS = [
  { index: 3, label: 'Broad market crash' },
  { index: 0, label: 'Technology selloff' },
  { index: 2, label: 'Rates rise sharply' },
  { index: 4, label: 'Semiconductor supply crisis' },
];

export const StressTestingView: React.FC<StressTestingViewProps> = ({ positions }) => {
  const [activeScenario, setActiveScenario] = useState<StressScenario>(PRESET_SCENARIOS[0]);
  const [customTickerShocks, setCustomTickerShocks] = useState<Record<string, number>>({});
  const [equityShock, setEquityShock] = useState(-18);
  const [rateBps, setRateBps] = useState(-150);
  const [vixSpike, setVixSpike] = useState(80);
  const [semiShock, setSemiShock] = useState(-45);
  const [techShock, setTechShock] = useState(-30);
  const [aiPrompt, setAiPrompt] = useState('AI stocks fall sharply and the Fed cuts rates');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResultExplanation, setAiResultExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (activeScenario.category === 'preset') {
      const shocks: Record<string, number> = {};
      positions.forEach(position => {
        shocks[position.ticker] = activeScenario.tickerShocks[position.ticker] ?? 0;
      });
      setCustomTickerShocks(shocks);
    }
    if (activeScenario.factorShocks) {
      setEquityShock(activeScenario.factorShocks.equityShockPct);
      setRateBps(activeScenario.factorShocks.rateChangeBps);
      setVixSpike(activeScenario.factorShocks.vixSpikePct);
      setSemiShock(activeScenario.factorShocks.semiShockPct);
      setTechShock(activeScenario.factorShocks.techShockPct);
    }
  }, [activeScenario, positions]);

  const scenarioForCalculation = useMemo<StressScenario>(() => {
    if (activeScenario.category === 'macro_factor' || activeScenario.category === 'ai_generated') {
      return {
        ...activeScenario,
        factorShocks: {
          equityShockPct: equityShock,
          rateChangeBps: rateBps,
          vixSpikePct: vixSpike,
          semiShockPct: semiShock,
          techShockPct: techShock,
        },
      };
    }
    return { ...activeScenario, tickerShocks: customTickerShocks };
  }, [activeScenario, customTickerShocks, equityShock, rateBps, vixSpike, semiShock, techShock]);

  const stressResult = useMemo(
    () => executeStressTest(positions, scenarioForCalculation),
    [positions, scenarioForCalculation],
  );

  const handleAiScenario = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/gemini/parse-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, portfolio: positions }),
      });
      if (!response.ok) throw new Error('Scenario service unavailable');
      const data = await response.json();
      const factorShocks = data.factorShocks ?? PRESET_SCENARIOS[1].factorShocks!;
      setAiResultExplanation(data.macroTransmissionExplanation ?? null);
      setActiveScenario({
        id: `ai_${Date.now()}`,
        name: data.scenarioName || aiPrompt,
        description: data.macroTransmissionExplanation || 'Custom market scenario translated from your description.',
        category: 'ai_generated',
        tickerShocks: {},
        factorShocks,
      });
    } catch (error) {
      console.error('Error parsing scenario', error);
      setAiResultExplanation('AI translation was unavailable, so RiskLab loaded its built-in AI selloff scenario instead.');
      setActiveScenario(PRESET_SCENARIOS[1]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const sortedLosses = [...stressResult.attributions].sort((a, b) => b.dollarLoss - a.dollarLoss);

  return (
    <div className="space-y-6">
      <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">What if?</p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black text-white tracking-tight">What happens if markets change?</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400 leading-relaxed">
          Stress testing asks a simple question: <strong className="text-slate-300">“If this bad thing happened, what might it do to my portfolio?”</strong> It is not a prediction — it is a way to understand vulnerability before a real downturn arrives.
        </p>

        <form onSubmit={handleAiScenario} className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1">
            <label className="text-xs text-slate-400 font-semibold">Describe a market scenario in plain English</label>
            <input
              type="text"
              value={aiPrompt}
              onChange={event => setAiPrompt(event.target.value)}
              placeholder="e.g. Technology falls 30% and interest rates decline"
              className="mt-1.5 w-full bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={isAiLoading}
            className="sm:self-end px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAiLoading ? 'Building scenario...' : 'See portfolio impact'}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-slate-500">Or try:</span>
          {QUICK_SCENARIOS.map(item => (
            <button
              key={item.index}
              type="button"
              onClick={() => {
                setActiveScenario(PRESET_SCENARIOS[item.index]);
                setAiResultExplanation(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700/50"
            >
              {item.label}
            </button>
          ))}
        </div>

        {aiResultExplanation && (
          <div className="mt-4 rounded-lg bg-slate-950/70 border border-slate-800 p-3 text-xs text-slate-300 leading-relaxed">
            <strong className="text-emerald-300">Why the model expects this impact: </strong>{aiResultExplanation}
          </div>
        )}
      </section>

      <section className="bg-slate-900/70 rounded-xl border border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">Estimated portfolio impact</span>
            <h3 className="mt-2 text-xl font-bold text-white">{activeScenario.name}</h3>
            <p className="mt-1 max-w-3xl text-xs text-slate-400 leading-relaxed">{activeScenario.description}</p>
          </div>
        </div>

        <div className="py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Starting value</div>
            <div className="mt-1 text-2xl sm:text-3xl font-black text-white font-mono-nums">${Math.round(stressResult.initialValue).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">After scenario</div>
            <div className="mt-1 text-2xl sm:text-3xl font-black text-rose-300 font-mono-nums">${Math.round(stressResult.stressedValue).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Estimated loss</div>
            <div className="mt-1 text-2xl sm:text-3xl font-black text-rose-300 font-mono-nums">-${Math.round(stressResult.dollarLoss).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Estimated decline</div>
            <div className="mt-1 text-2xl sm:text-3xl font-black text-rose-300 font-mono-nums">-{stressResult.percentLoss.toFixed(1)}%</div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-start gap-2 text-xs text-slate-300">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p>
            <strong className="text-white">Biggest loss driver:</strong> {stressResult.topCulprit.ticker} accounts for about {stressResult.topCulprit.lossContributionPct.toFixed(1)}% of the modeled loss in this scenario.
          </p>
        </div>
      </section>

      <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-5">
        <h3 className="text-base font-bold text-white">Where would the loss come from?</h3>
        <p className="mt-1 text-xs text-slate-400">This helps separate a portfolio-wide problem from a problem concentrated in one or two holdings.</p>
        <div className="mt-4 space-y-3">
          {sortedLosses.slice(0, 6).map(attr => {
            const pct = stressResult.dollarLoss > 0 ? Math.max(0, attr.dollarLoss / stressResult.dollarLoss) * 100 : 0;
            return (
              <div key={attr.ticker}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-white">{attr.ticker}</span>
                  <span className="text-slate-400">{attr.dollarLoss > 0 ? `-$${Math.round(attr.dollarLoss).toLocaleString()}` : `+$${Math.round(-attr.dollarLoss).toLocaleString()}`}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <details className="group bg-slate-900/50 rounded-xl border border-slate-800 p-5">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">Advanced scenario controls</div>
            <div className="text-xs text-slate-400 mt-0.5">Adjust market, interest-rate, technology, and individual-asset shocks manually.</div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-slate-800 pt-5">
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">Broad market assumptions</h4>
            {[
              ['Stock market', equityShock, setEquityShock, -50, 20, '%'],
              ['Interest rates', rateBps, setRateBps, -300, 300, ' bps'],
              ['Technology', techShock, setTechShock, -70, 30, '%'],
              ['Semiconductors', semiShock, setSemiShock, -80, 30, '%'],
              ['Volatility spike', vixSpike, setVixSpike, 0, 300, '%'],
            ].map(([label, value, setter, min, max, suffix]) => (
              <div key={String(label)}>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{String(label)}</span><span className="font-mono-nums text-slate-200">{Number(value) > 0 ? '+' : ''}{Number(value)}{String(suffix)}</span>
                </div>
                <input
                  type="range"
                  min={Number(min)}
                  max={Number(max)}
                  step={String(label) === 'Interest rates' ? 25 : 1}
                  value={Number(value)}
                  onChange={event => {
                    (setter as React.Dispatch<React.SetStateAction<number>>)(Number(event.target.value));
                    setActiveScenario({ ...activeScenario, category: 'macro_factor' });
                  }}
                  className="w-full accent-emerald-500"
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">Individual holdings</h4>
            {positions.map(position => {
              const shock = customTickerShocks[position.ticker] ?? 0;
              return (
                <div key={position.ticker}>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>{position.ticker}</span><span className="font-mono-nums">{shock > 0 ? '+' : ''}{(shock * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="-80"
                    max="40"
                    step="1"
                    value={shock * 100}
                    onChange={event => {
                      setCustomTickerShocks(prev => ({ ...prev, [position.ticker]: Number(event.target.value) / 100 }));
                      setActiveScenario({ ...activeScenario, category: 'preset' });
                    }}
                    className="w-full accent-rose-500"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
          Technical note: factor scenarios translate broad market, rate, technology, and semiconductor shocks through each asset&apos;s modeled sensitivities. Direct asset shocks override those factor assumptions for the selected ticker.
        </p>
      </details>
    </div>
  );
};
