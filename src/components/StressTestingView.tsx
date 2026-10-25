import {Explanation} from './Explanation';
import React, { useMemo, useReducer, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { PortfolioPosition, AiResponseSource, StressScenario } from '../types/risk';
import { executeStressTest } from '../utils/quantEngine';
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

const EXAMPLE_PROMPTS = [
  'What if the stock market falls 20%?',
  'Technology stocks fall 30% and the Fed cuts interest rates',
  'What if interest rates rise by 2 percentage points?',
  'A semiconductor supply crisis sends chip stocks down 40%',
];

const EMPTY_SCENARIO: StressScenario = {
  id: 'unsubmitted', name: '', description: '', category: 'custom', tickerShocks: {},
  factorShocks: {equityShockPct: 0, rateChangeBps: 0, techShockPct: 0, semiShockPct: 0, vixSpikePct: 0},
};

export const StressTestingView: React.FC<StressTestingViewProps> = ({ positions }) => {
  const [controls, dispatch] = useReducer(
    scenarioControlsReducer,
    EMPTY_SCENARIO,
    createScenarioControls,
  );
  const [aiPrompt, setAiPrompt] = useState('');
  const [hasResult, setHasResult] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResultExplanation, setAiResultExplanation] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<AiResponseSource | null>(null);
  const scenarioForCalculation = useMemo(() => scenarioFromControls(controls), [controls]);

  const stressResult = useMemo(
    () => executeStressTest(positions, scenarioForCalculation),
    [positions, scenarioForCalculation],
  );

  const handleAiScenario = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!aiPrompt.trim() || isAiLoading) return;
    setIsAiLoading(true);
    setScenarioError(null);
    try {
      const response = await fetch('/api/gemini/parse-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, portfolio: positions }),
      });
      if (!response.ok) throw new Error('Scenario service unavailable');
      const data = await response.json();
      if (!data.factorShocks) throw new Error('Scenario assumptions unavailable');
      const factorShocks = data.factorShocks;
      setAiSource(data.ai ?? {provider: 'fallback', label: 'Legacy scenario service'});
      setAiResultExplanation(data.macroTransmissionExplanation ?? null);
      dispatch({ type: 'load', scenario: {
        id: `ai_${Date.now()}`,
        name: data.scenarioName || aiPrompt,
        description: data.macroTransmissionExplanation || 'Custom market scenario translated from your description.',
        category: data.ai?.provider === 'cloudflare' ? 'ai_generated' : 'custom',
        tickerShocks: {},
        factorShocks,
      } });
      setHasResult(true);
    } catch (error) {
      console.error('Error parsing scenario', error);
      setScenarioError(hasResult ? 'We couldn’t build that scenario. Your current results are unchanged. Please try again.' : 'We couldn’t build that scenario. Please try again.');
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

  const scenarioLabel = controls.edited ? 'Your adjusted scenario' : scenarioForCalculation.name;
  const explanation = !controls.edited && aiResultExplanation ? aiResultExplanation : scenarioForCalculation.description;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">What if?</p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black text-white tracking-tight">What happens if markets change?</h2>
        <p className="mt-2 text-sm text-slate-400">Describe a market change to see what it could mean for your portfolio.</p>
      </header>
      <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 sm:p-6 shadow-sm">
        <form onSubmit={handleAiScenario} className="space-y-4">
          <div className="flex-1">
            <label htmlFor="scenario-prompt" className="text-sm text-slate-200 font-semibold">Describe your scenario</label>
            <textarea
              ref={promptRef}
              id="scenario-prompt"
              rows={3}
              disabled={isAiLoading}
              maxLength={2000}
              value={aiPrompt}
              onChange={event => setAiPrompt(event.target.value)}
              placeholder="e.g. AI stocks fall sharply and the Fed cuts interest rates"
              className="mt-1.5 w-full resize-y bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" aria-expanded={showExamples} aria-controls="scenario-examples"
              onClick={() => setShowExamples(value => !value)}
              className="self-start flex items-center gap-1.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
              {showExamples ? 'Hide examples' : 'Show examples'}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExamples ? 'rotate-180' : ''}`} />
            </button>
            <button
              type="submit"
              disabled={isAiLoading || !aiPrompt.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isAiLoading ? 'Building scenario...' : 'See portfolio impact'}
            </button>
          </div>
        </form>

        {showExamples && <div id="scenario-examples" className="mt-4 border-t border-slate-800 pt-4">
          <p className="mb-3 text-xs text-slate-400">Choose an example to put it in the field, then edit it or see its impact.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLE_PROMPTS.map(prompt => <button key={prompt} type="button" disabled={isAiLoading}
              onClick={() => {setAiPrompt(prompt); setShowExamples(false); promptRef.current?.focus();}}
              className="rounded-lg border border-slate-700/70 bg-slate-950/40 px-3 py-3 text-left text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">
              {prompt}
            </button>)}
          </div>
        </div>}
        {isAiLoading && <p role="status" className="mt-3 text-xs text-slate-400">{hasResult ? 'Building your scenario. Previous results remain below until it’s ready.' : 'Building your scenario…'}</p>}
        {scenarioError && <p role="alert" className="mt-3 text-xs text-amber-300">{scenarioError}</p>}
        <p className="mt-4 text-xs text-slate-500">These are modeled estimates, not predictions.</p>
      </section>

      {hasResult && <>
        <div className="min-w-0 space-y-6" aria-label="Scenario results" aria-busy={isAiLoading}>
          <section className="bg-slate-900/70 rounded-xl border border-slate-800 p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-5 border-b border-slate-800">
              <div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">Estimated portfolio impact</span>
                <h3 className="mt-2 text-xl font-bold text-white">{scenarioLabel}</h3>
                <p className="mt-2 text-xs text-slate-400">Applied to your current portfolio.</p>
              </div>
            </div>

            <div className="py-6">
              <p className="text-xs font-semibold text-slate-400">{hasLoss ? 'Your portfolio could lose' : hasGain ? 'Your portfolio could gain' : 'Estimated portfolio change'}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className={`text-4xl sm:text-5xl font-black tracking-tight font-mono-nums ${impactColor}`}>{impactSign}${Math.round(Math.abs(stressResult.dollarLoss)).toLocaleString()}</p>
                <p className={`text-xl font-bold font-mono-nums ${impactColor}`}>{impactSign}{Math.abs(stressResult.percentLoss).toFixed(1)}%</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-slate-950/50 p-4">
                <div>
                  <p className="text-xs text-slate-400">Starting value</p>
                  <p className="mt-1 text-xl font-bold text-slate-200 font-mono-nums">${Math.round(stressResult.initialValue).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">After this scenario</p>
                  <p className={`mt-1 text-xl font-bold font-mono-nums ${impactColor}`}>${Math.round(stressResult.stressedValue).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-5" aria-label="Why this impact?">
              <h4 className="text-base font-bold text-white">Why this impact?</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{explanation}</p>
              {aiSource && !controls.edited && <p className="mt-3 text-xs text-slate-500">{aiSource.label}{aiSource.provider === 'fallback' && aiSource.reason === 'unavailable' ? ' · AI unavailable right now' : ''}</p>}
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-300">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p>
                  {grossLoss > 0 ? (
                    <><strong className="text-white">Biggest loss driver:</strong> {stressResult.topCulprit.ticker} accounts for about {(Math.max(0, stressResult.topCulprit.dollarLoss) / grossLoss * 100).toFixed(1)}% of the losses across declining holdings, before gains elsewhere offset them.</>
                  ) : hasGain ? 'The model estimates a net gain in this scenario. None of the holdings has a modeled loss.' : 'These assumptions leave the portfolio value unchanged.'}
                </p>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-5">
            <h3 className="text-base font-bold text-white">How would each holding change?</h3>
            <Explanation label="How to read these impacts">Each amount is the estimated change for that holding. Bars show its share of losses before any offsetting gains.</Explanation>
            {sortedLosses.length > 6 && <p className="mt-2 text-xs text-slate-500">Showing 6 of {sortedLosses.length} holdings, ordered by modeled loss.</p>}
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

        </div>

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
              {controls.edited ? 'Custom scenario - results update as you move the sliders.' : 'Your scenario is loaded. Move a slider to adjust its assumptions.'}
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
                Editing a market slider updates the scenario for every holding without a manual override.
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
            that model for the selected ticker. Reset scenario restores the assumptions from your submitted scenario.
          </p>
        </details>
      </>}
    </div>
  );
};
