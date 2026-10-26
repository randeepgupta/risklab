import {formatDate} from '../utils/dateFormat';
import {Explanation} from './Explanation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { PortfolioPosition, StressScenario } from '../types/risk';
import { executeStressTest } from '../utils/quantEngine';
import {
  createScenarioControls,
  FACTOR_LIMITS,
  scenarioControlsReducer,
  scenarioFromControls,
} from '../utils/scenarioControls';
import type { EditableFactor } from '../utils/scenarioControls';
import type {ScenarioSession} from '../types/workspace';
import {createScenarioSession} from '../utils/workspaceSettings';

interface StressTestingViewProps {
  positions: PortfolioPosition[];
  session?: ScenarioSession;
  onSessionChange?: (session:ScenarioSession) => void;
}

const EXAMPLE_PROMPTS = [
  'What if the stock market falls 20%?',
  'Technology stocks fall 30%',
  'The 10-year Treasury yield rises by 2 percentage points',
];

export const StressTestingView: React.FC<StressTestingViewProps> = ({ positions, session:suppliedSession, onSessionChange }) => {
  const [localSession,setLocalSession] = useState(createScenarioSession);
  const session = suppliedSession ?? localSession;
  const updateSession = (patch:Partial<ScenarioSession>) => {
    const next={...session,...patch};
    if(onSessionChange) onSessionChange(next); else setLocalSession(next);
  };
  const {controls,prompt:aiPrompt,hasResult,explanation:aiResultExplanation,source:aiSource}=session;
  const setAiPrompt = (prompt:string) => updateSession({prompt});
  const dispatch = (action:Parameters<typeof scenarioControlsReducer>[1]) => updateSession({controls:scenarioControlsReducer(controls,action)});
  const [showExamples, setShowExamples] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const pendingRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {mounted.current=true; return () => {mounted.current=false; pendingRequest.current?.abort();};}, []);
  const scenarioForCalculation = useMemo(() => scenarioFromControls(controls), [controls]);

  const calculation = useMemo(() => {
    if (!hasResult) return {result: null, error: null};
    try { return {result: executeStressTest(positions, scenarioForCalculation), error: null}; }
    catch (error) { return {result: null, error: error instanceof Error ? error.message : 'Historical scenario estimates are unavailable.'}; }
  }, [hasResult, positions, scenarioForCalculation]);
  const stressResult = calculation.result;

  const handleAiScenario = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!aiPrompt.trim() || isAiLoading) return;
    setIsAiLoading(true);
    setScenarioError(null);
    const controller=new AbortController();
    pendingRequest.current=controller;
    try {
      const response = await fetch('/api/gemini/parse-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, portfolio: positions.map(({ticker})=>({ticker})) }),
        signal: controller.signal,
      });
      const data = await response.json();
      if(!mounted.current || controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || 'Scenario service unavailable. Please try again.');
      if (!data.drivers || !data.tickerShocks) throw new Error('Scenario assumptions unavailable');
      const scenario:StressScenario={
        id: `scenario_${Date.now()}`, name:data.scenarioName || aiPrompt,
        description:data.macroTransmissionExplanation || 'Your explicit market assumptions.',
        category:'custom', tickerShocks:data.tickerShocks, drivers:data.drivers,
      };
      updateSession({source:data.ai ?? {provider:'deterministic',label:'Explicit scenario assumptions'},
        explanation:data.macroTransmissionExplanation ?? null,controls:createScenarioControls(scenario),hasResult:true});
    } catch (error) {
      if(!mounted.current || controller.signal.aborted) return;
      setScenarioError((error instanceof Error ? error.message : 'We couldn’t interpret that scenario.') + (hasResult ? ' Previous results remain below.' : ''));
    } finally {
      if(mounted.current) setIsAiLoading(false);
    }
  };

  const hasLoss = (stressResult?.dollarLoss ?? 0) > 0;
  const hasGain = (stressResult?.dollarLoss ?? 0) < 0;
  const impactColor = hasLoss ? 'text-rose-300' : hasGain ? 'text-emerald-300' : 'text-slate-200';
  const impactSign = hasLoss ? '-' : hasGain ? '+' : '';
  const grossLoss = stressResult?.attributions.reduce((sum, attr) => sum + Math.max(0, attr.dollarLoss), 0) ?? 0;
  const manualCount = positions.filter(position =>
    Object.prototype.hasOwnProperty.call(controls.tickerOverrides, position.ticker),
  ).length;
  const allManual = positions.length > 0 && manualCount === positions.length;
  const factorControls: { key: EditableFactor; label: string; suffix: string }[] = [
    { key: 'market', label: 'Stock market (SPY)', suffix: '%' },
    { key: 'treasury10y', label: '10-year Treasury yield', suffix: ' bps' },
    { key: 'technology', label: 'Technology (QQQM)', suffix: '%' },
    { key: 'semiconductors', label: 'Semiconductors (SMH)', suffix: '%' },
  ];
  const sortedLosses = [...(stressResult?.attributions ?? [])].sort((a, b) => grossLoss > 0 ? b.dollarLoss - a.dollarLoss : Math.abs(b.dollarLoss) - Math.abs(a.dollarLoss));

  const scenarioLabel = controls.edited ? 'Your adjusted scenario' : scenarioForCalculation.name;
  const explanation = !controls.edited && aiResultExplanation ? aiResultExplanation : scenarioForCalculation.description;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">What if?</p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black text-white tracking-tight">What happens if markets change?</h2>
        <p className="mt-2 text-sm text-slate-400">Enter a specific market change. Historical relationships estimate how your holdings might respond.</p>
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
              placeholder="e.g. The stock market falls 20%"
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
            {[...EXAMPLE_PROMPTS, `Only ${positions[0]?.ticker ?? 'SPY'} falls 10%, all other holdings unchanged`].map(prompt => <button key={prompt} type="button" disabled={isAiLoading}
              onClick={() => {setAiPrompt(prompt); setShowExamples(false); promptRef.current?.focus();}}
              className="rounded-lg border border-slate-700/70 bg-slate-950/40 px-3 py-3 text-left text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">
              {prompt}
            </button>)}
          </div>
        </div>}
        {isAiLoading && <p role="status" className="mt-3 text-xs text-slate-400">{hasResult ? 'Building your scenario. Previous results remain below until it’s ready.' : 'Building your scenario…'}</p>}
        {scenarioError && <p role="alert" className="mt-3 text-xs text-amber-300">{scenarioError}</p>}
        <p className="mt-4 text-xs text-slate-500">Include a size and direction, such as “technology stocks fall 20%.” These are conditional stress estimates, not forecasts.</p>
      </section>

      {hasResult && <>
        {calculation.error && <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-200">
          <h3 className="font-semibold">This scenario cannot be estimated reliably</h3>
          <p className="mt-2">{calculation.error}</p>
          <p className="mt-2 text-xs text-slate-400">Adjust the assumptions below or set an explicit change for any holding without a model.</p>
        </div>}
        {stressResult && <div className="min-w-0 space-y-6" aria-label="Scenario results" aria-busy={isAiLoading}>
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
              {aiSource && !controls.edited && <p className="mt-3 text-xs text-slate-500">{aiSource.label}</p>}
              <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300" aria-label="Effective scenario assumptions">
                {factorControls.filter(({key}) => scenarioForCalculation.drivers?.[key] !== undefined).map(({key,label,suffix}) =>
                  <li key={key} className="rounded border border-slate-700 bg-slate-950/50 px-2 py-1">{label}: {scenarioForCalculation.drivers![key]! > 0 ? '+' : ''}{scenarioForCalculation.drivers![key]}{suffix}</li>)}
                {Object.entries(scenarioForCalculation.tickerShocks).map(([ticker,shock]) =>
                  <li key={ticker} className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1">{ticker} override: {shock > 0 ? '+' : ''}{(shock * 100).toFixed(1)}%</li>)}
              </ul>
              {stressResult.modelNotes?.map(note => <p key={note} className="mt-3 text-xs leading-relaxed text-slate-400">{note}</p>)}
              {!!stressResult.modelDiagnostics?.length && <details className="mt-3 text-xs text-slate-400">
                <summary className="cursor-pointer text-emerald-300">Historical model details</summary>
                <p className="mt-2">Fit measures how much daily variation these drivers explained in the historical window. It does not measure prediction accuracy.</p>
                <ul className="mt-2 space-y-1">
                  {stressResult.modelDiagnostics.map(model => <li key={model.ticker}><strong className="text-slate-300">{model.ticker}</strong>: {model.observations} matched returns, {formatDate(model.startDate)} to {formatDate(model.endDate)}; {(model.rSquared * 100).toFixed(0)}% explained variation.</li>)}
                </ul>
              </details>}
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
            {sortedLosses.length > 6 && <p className="mt-2 text-xs text-slate-500">Showing 6 of {sortedLosses.length} holdings, ordered by {grossLoss > 0 ? 'modeled loss' : 'size of change'}.</p>}
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

        </div>}

        <details className="group bg-slate-900/50 rounded-xl border border-slate-800 p-5">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white">Advanced scenario controls</div>
              <div className="text-xs text-slate-400 mt-0.5">Choose which market moves to specify, or override individual holdings.</div>
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
                Checked drivers are explicit constraints. Unchecked drivers are left to historical relationships; they are not held at zero. Holding overrides take precedence. 100 bps is a 1 percentage-point yield change.
              </p>
              {factorControls.map(({ key, label, suffix }) => {
                const active = controls.factors[key] !== undefined;
                const value = controls.factors[key] ?? 0;
                const { min, max } = FACTOR_LIMITS[key];
                const id = `scenario-${key}`;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <label className="flex items-center gap-2" htmlFor={`${id}-enabled`}>
                        <input id={`${id}-enabled`} type="checkbox" checked={active}
                          onChange={event => dispatch({type: 'toggle-factor', key, enabled: event.currentTarget.checked})} />
                        {label}
                      </label>
                      <output htmlFor={id} className="font-mono-nums text-slate-200">{active ? `${value > 0 ? '+' : ''}${value}${suffix}` : 'Unspecified'}</output>
                    </div>
                    <input
                      id={id}
                      type="range"
                      min={min}
                      max={max}
                      step="any"
                      value={value}
                      disabled={!active}
                      aria-label={label}
                      aria-valuetext={`${value}${suffix}`}
                      aria-describedby="market-controls-help"
                      onChange={event => {
                        const raw = Number(event.currentTarget.value);
                        const value = key === 'treasury10y' ? Math.round(raw) : Math.round(raw * 10) / 10;
                        dispatch({ type: 'factor', key, value });
                      }}
                      className="risklab-scenario-slider text-emerald-400 disabled:opacity-25"
                      style={{ '--slider-fill': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties}
                    />
                  </div>
                );
              })}
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
                  disabled={!Object.keys(controls.factors).length}
                  onClick={() => dispatch({ type: 'use-factors' })}
                  className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
                >Use market assumptions for all</button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Change one to override that holding. “Unavailable” means no estimate exists; moving its slider sets your own assumption.
              </p>
              {positions.map(position => {
                const attribution = stressResult?.attributions.find(item => item.ticker === position.ticker);
                const shock = controls.tickerOverrides[position.ticker] ?? attribution?.shockPct;
                const available = shock !== undefined;
                const manual = Object.prototype.hasOwnProperty.call(controls.tickerOverrides, position.ticker);
                const id = `scenario-holding-${position.ticker}`;
                const value = (shock ?? 0) * 100;
                const min = Math.min(-100, value);
                const max = Math.max(300, value);
                return (
                  <div key={position.ticker}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 mb-1">
                      <div className="flex items-center gap-2">
                        <label htmlFor={id}>{position.ticker}</label>
                        <span className={`text-[10px] rounded px-1.5 py-0.5 ${manual ? 'bg-amber-400/10 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                          {manual ? 'Explicit override' : available ? 'Historical estimate' : 'Unavailable'}
                        </span>
                        {manual && (
                          <button
                            type="button"
                            aria-label={`Remove ${position.ticker} override`}
                            onClick={() => dispatch({ type: 'reset-ticker', ticker: position.ticker })}
                            className="text-emerald-300 hover:text-emerald-200"
                          >Remove override</button>
                        )}
                      </div>
                      {!available && <button type="button" className="text-emerald-300" onClick={() => dispatch({type:'ticker',ticker:position.ticker,value:0})}>Set unchanged</button>}
                      <output htmlFor={id} className="font-mono-nums">{available ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : 'Set a change'}</output>
                    </div>
                    <input
                      id={id}
                      type="range"
                      min={min}
                      max={max}
                      step="any"
                      value={value}
                      aria-valuetext={available ? `${value.toFixed(1)} percent, ${manual ? 'explicit override' : 'historical estimate'}` : 'No model estimate; move to set an explicit change'}
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
            Market estimates use aligned daily total returns and Treasury yield changes from the historical snapshot. Large moves extrapolate beyond the observed data. Reset scenario restores your submitted assumptions.
          </p>
        </details>
      </>}
    </div>
  );
};
