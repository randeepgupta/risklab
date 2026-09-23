import React, { useMemo, useReducer, useState } from 'react';
import { AlertCircle, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { PortfolioPosition, StressScenario } from '../types/risk';
import { PRESET_SCENARIOS, executeStressTest } from '../utils/quantEngine';
import {
  createScenarioControls,
  FACTOR_LIMITS,
  scenarioControlsReducer,
  scenarioFromControls,
} from '../utils/scenarioControls';
import type { EditableFactor } from '../utils/scenarioControls';

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
  const [controls, dispatch] = useReducer(
    scenarioControlsReducer,
    PRESET_SCENARIOS[0],
    createScenarioControls,
  );
  const [aiPrompt, setAiPrompt] = useState('AI stocks fall sharply and the Fed cuts rates');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResultExplanation, setAiResultExplanation] = useState<string | null>(null);
  const scenarioForCalculation = useMemo(() => scenarioFromControls(controls), [controls]);

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
      dispatch({ type: 'load', scenario: {
        id: `ai_${Date.now()}`,
        name: data.scenarioName || aiPrompt,
        description: data.macroTransmissionExplanation || 'Custom market scenario translated from your description.',
        category: 'ai_generated',
        tickerShocks: {},
        factorShocks,
      } });
    } catch (error) {
      console.error('Error parsing scenario', error);
      setAiResultExplanation('AI translation was unavailable, so RiskLab loaded its built-in AI selloff scenario instead.');
      dispatch({ type: 'load', scenario: PRESET_SCENARIOS[1] });
    } finally {
      setIsAiLoading(false);
    }
  };

  const hasLoss = stressResult.dollarLoss > 0;
  const hasGain = stressResult.dollarLoss < 0;
  const impactColor = hasLoss ? 'text-rose-300' : hasGain ? 'text-emerald-300' : 'text-slate-200';
  const impactSign = hasLoss ? '-' : hasGain ? '+' : '';
  const grossLoss = stressResult.attributions.reduce((sum, attr) => sum + Math.max(0, attr.dollarLoss), 0);
  const manualCount = positions.filter(position =>
    Object.prototype.hasOwnProperty.call(controls.tickerOverrides, position.ticker),
  ).length;
  const allManual = positions.length > 0 && manualCount === positions.length;
  const factorControls: { key: EditableFactor; label: string; suffix: string }[] = [
    { key: 'equityShockPct', label: 'Stock market', suffix: '%' },
    { key: 'rateChangeBps', label: 'Interest rates', suffix: ' bps' },
    { key: 'techShockPct', label: 'Technology', suffix: '%' },
    { key: 'semiShockPct', label: 'Semiconductors', suffix: '%' },
  ];
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
              disabled={isAiLoading}
              onClick={() => {
                dispatch({ type: 'load', scenario: PRESET_SCENARIOS[item.index] });
                setAiResultExplanation(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700/50 disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>

        {aiResultExplanation && !controls.edited && (
          <div className="mt-4 rounded-lg bg-slate-950/70 border border-slate-800 p-3 text-xs text-slate-300 leading-relaxed">
            <strong className="text-emerald-300">Why the model expects this impact: </strong>{aiResultExplanation}
          </div>
        )}
      </section>

      <section className="bg-slate-900/70 rounded-xl border border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">Estimated portfolio impact</span>
            <h3 className="mt-2 text-xl font-bold text-white">{scenarioForCalculation.name}</h3>
            <p className="mt-1 max-w-3xl text-xs text-slate-400 leading-relaxed">{scenarioForCalculation.description}</p>
          </div>
        </div>

        <div className="py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Starting value</div>
            <div className="mt-1 text-2xl sm:text-3xl font-black text-white font-mono-nums">${Math.round(stressResult.initialValue).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">After scenario</div>
            <div className={`mt-1 text-2xl sm:text-3xl font-black font-mono-nums ${impactColor}`}>${Math.round(stressResult.stressedValue).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{hasLoss ? 'Estimated loss' : hasGain ? 'Estimated gain' : 'Estimated change'}</div>
            <div className={`mt-1 text-2xl sm:text-3xl font-black font-mono-nums ${impactColor}`}>{impactSign}${Math.round(Math.abs(stressResult.dollarLoss)).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{hasLoss ? 'Estimated decline' : hasGain ? 'Estimated increase' : 'Estimated change'}</div>
            <div className={`mt-1 text-2xl sm:text-3xl font-black font-mono-nums ${impactColor}`}>{impactSign}{Math.abs(stressResult.percentLoss).toFixed(1)}%</div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-start gap-2 text-xs text-slate-300">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p>
            {grossLoss > 0 ? (
              <><strong className="text-white">Biggest loss driver:</strong> {stressResult.topCulprit.ticker} accounts for about {(Math.max(0, stressResult.topCulprit.dollarLoss) / grossLoss * 100).toFixed(1)}% of the losses across declining holdings, before gains elsewhere offset them.</>
            ) : hasGain ? 'The model estimates a net gain in this scenario. None of the holdings has a modeled loss.' : 'These assumptions leave the portfolio value unchanged.'}
          </p>
        </div>
      </section>

      <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-5">
        <h3 className="text-base font-bold text-white">How would each holding change?</h3>
        <p className="mt-1 text-xs text-slate-400">Each amount is the estimated change for that holding. Bars show its share of losses before any offsetting gains.</p>
        <div className="mt-4 space-y-3">
          {sortedLosses.slice(0, 6).map(attr => {
            const pct = grossLoss > 0 ? Math.max(0, attr.dollarLoss) / grossLoss * 100 : 0;
            return (
              <div key={attr.ticker}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-white">{attr.ticker}</span>
                  <span className="text-slate-400">{attr.dollarLoss > 0 ? `-$${Math.round(attr.dollarLoss).toLocaleString()}` : attr.dollarLoss < 0 ? `+$${Math.round(-attr.dollarLoss).toLocaleString()}` : '$0'}</span>
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400" role="status">
            {controls.edited ? 'Custom scenario - results update as you move the sliders.' : 'Preset loaded. Move a slider to explore your own assumptions.'}
          </p>
          <button
            type="button"
            disabled={!controls.edited || isAiLoading}
            onClick={() => dispatch({ type: 'reset' })}
            className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset scenario
          </button>
        </div>

        <fieldset disabled={isAiLoading} className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-slate-800 pt-5 min-w-0 disabled:opacity-60">
          <legend className="sr-only">Edit scenario assumptions</legend>
          <div className="space-y-4 min-w-0">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">Broad market assumptions</h4>
            <p className="text-xs text-slate-400 leading-relaxed" id="market-controls-help">
              Editing a market slider uses the model instead of the preset&apos;s fixed holding changes.
              Holdings marked Manual keep your value until you reset them. 100 bps means a 1 percentage-point interest-rate change.
            </p>
            {factorControls.map(({ key, label, suffix }) => {
              const value = controls.factors[key];
              const { min, max } = FACTOR_LIMITS[key];
              const id = `scenario-${key}`;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor={id}>{label}</label>
                    <output htmlFor={id} className="font-mono-nums text-slate-200">{value > 0 ? '+' : ''}{value}{suffix}</output>
                  </div>
                  <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    step="any"
                    value={value}
                    aria-valuetext={`${value}${suffix}`}
                    aria-describedby="market-controls-help"
                    onChange={event => {
                      const raw = Number(event.currentTarget.value);
                      const value = key === 'rateChangeBps' ? Math.round(raw) : Math.round(raw * 10) / 10;
                      dispatch({ type: 'factor', key, value });
                    }}
                    className="risklab-scenario-slider text-emerald-400"
                    style={{ '--slider-fill': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties}
                  />
                </div>
              );
            })}
            <p className="text-xs text-slate-500 leading-relaxed">
              Volatility context: +{controls.factors.vixSpikePct}%. This is background information only;
              it does not change this price-impact estimate, so it is not an adjustable slider.
            </p>
            {allManual && (
              <p role="status" className="text-xs text-amber-300 leading-relaxed">
                All holdings are manually set. Choose &ldquo;Use market assumptions for all&rdquo; to let market sliders change the result.
              </p>
            )}
          </div>

          <div className="space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">Individual holdings</h4>
              <button
                type="button"
                onClick={() => dispatch({ type: 'use-factors' })}
                className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
              >Use market assumptions for all</button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              These values show what the calculation actually uses. Change one to override just that holding.
            </p>
            {positions.map(position => {
              const attribution = stressResult.attributions.find(item => item.ticker === position.ticker);
              const shock = attribution?.shockPct ?? 0;
              const manual = Object.prototype.hasOwnProperty.call(controls.tickerOverrides, position.ticker);
              const fixedByPreset = !controls.usingFactors && controls.source.tickerShocks[position.ticker] !== undefined;
              const id = `scenario-holding-${position.ticker}`;
              const value = shock * 100;
              // The existing engine bounds factor returns at [-98%, +300%].
              // Include the displayed estimate rather than clipping the thumb.
              const min = Math.min(-100, value);
              const max = Math.max(300, value);
              return (
                <div key={position.ticker}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 mb-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor={id}>{position.ticker}</label>
                      <span className={`text-[10px] rounded px-1.5 py-0.5 ${manual ? 'bg-amber-400/10 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                        {manual ? 'Manual' : fixedByPreset ? 'Preset' : 'Model estimate'}
                      </span>
                      {manual && (
                        <button
                          type="button"
                          aria-label={`Reset ${position.ticker} to scenario estimate`}
                          onClick={() => dispatch({ type: 'reset-ticker', ticker: position.ticker })}
                          className="text-emerald-300 hover:text-emerald-200"
                        >Reset</button>
                      )}
                    </div>
                    <output htmlFor={id} className="font-mono-nums">{value > 0 ? '+' : ''}{value.toFixed(1)}%</output>
                  </div>
                  <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    step="any"
                    value={value}
                    aria-valuetext={`${value.toFixed(1)} percent, ${manual ? 'manual override' : fixedByPreset ? 'preset' : 'model estimate'}`}
                    onChange={event => dispatch({
                      type: 'ticker',
                      ticker: position.ticker,
                      value: Math.round(Number(event.currentTarget.value) * 10) / 1000,
                    })}
                    className="risklab-scenario-slider text-rose-400"
                    style={{ '--slider-fill': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <p className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
          Market sliders use modeled sensitivities, not live market data. Manual holding values override
          that model for the selected ticker. Reset scenario restores the originally selected preset or generated scenario.
        </p>
      </details>
    </div>
  );
};
