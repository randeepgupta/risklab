import type { StressScenario } from '../types/risk';

export type ScenarioFactors = NonNullable<StressScenario['factorShocks']>;
export type EditableFactor = Exclude<keyof ScenarioFactors, 'vixSpikePct'>;

// Match the bounds used by the scenario API. Volatility is context, not spot P&L.
export const FACTOR_LIMITS: Record<EditableFactor, { min: number; max: number }> = {
  equityShockPct: { min: -80, max: 50 },
  rateChangeBps: { min: -1000, max: 1000 },
  techShockPct: { min: -90, max: 100 },
  semiShockPct: { min: -95, max: 100 },
};

const NEUTRAL_FACTORS: ScenarioFactors = {
  equityShockPct: 0,
  rateChangeBps: 0,
  techShockPct: 0,
  semiShockPct: 0,
  vixSpikePct: 0,
};

export interface ScenarioControlsState {
  // The selected template is immutable and only used for reset / baseline values.
  source: StressScenario;
  factors: ScenarioFactors;
  usingFactors: boolean;
  // Only explicit user edits belong here, never automatically inferred zeroes.
  tickerOverrides: Record<string, number>;
  edited: boolean;
}

export type ScenarioControlsAction =
  | { type: 'load'; scenario: StressScenario }
  | { type: 'factor'; key: EditableFactor; value: number }
  | { type: 'ticker'; ticker: string; value: number }
  | { type: 'reset-ticker'; ticker: string }
  | { type: 'use-factors' }
  | { type: 'reset' };

export function createScenarioControls(source: StressScenario): ScenarioControlsState {
  const copy: StressScenario = {
    ...source,
    tickerShocks: { ...source.tickerShocks },
    ...(source.factorShocks ? { factorShocks: { ...source.factorShocks } } : {}),
  };
  return {
    source: copy,
    factors: { ...NEUTRAL_FACTORS, ...copy.factorShocks },
    usingFactors: false,
    tickerOverrides: {},
    edited: false,
  };
}

export function scenarioControlsReducer(
  state: ScenarioControlsState,
  action: ScenarioControlsAction,
): ScenarioControlsState {
  switch (action.type) {
    case 'load':
      return createScenarioControls(action.scenario);
    case 'reset':
      return createScenarioControls(state.source);
    case 'factor': {
      if (!Number.isFinite(action.value)) return state;
      const limits = FACTOR_LIMITS[action.key];
      const value = Math.max(limits.min, Math.min(limits.max, action.value));
      return {
        ...state,
        factors: { ...state.factors, [action.key]: value },
        // Replace fixed preset shocks on the first market edit. Explicit user
        // overrides are preserved and visibly marked in the holdings controls.
        usingFactors: true,
        edited: true,
      };
    }
    case 'ticker': {
      const ticker = action.ticker.trim().toUpperCase();
      if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker) || !Number.isFinite(action.value)) return state;
      return {
        ...state,
        tickerOverrides: {
          ...state.tickerOverrides,
          [ticker]: Math.max(-1, Math.min(3, action.value)),
        },
        edited: true,
      };
    }
    case 'reset-ticker': {
      const ticker = action.ticker.trim().toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(state.tickerOverrides, ticker)) return state;
      const tickerOverrides = { ...state.tickerOverrides };
      delete tickerOverrides[ticker];
      return {
        ...state,
        tickerOverrides,
        edited: state.usingFactors || Object.keys(tickerOverrides).length > 0,
      };
    }
    case 'use-factors':
      return { ...state, usingFactors: true, tickerOverrides: {}, edited: true };
    default:
      return state;
  }
}

// This is the one scenario both the inputs and calculation render from.
// No effect copies the selected template back over a user's slider movement.
export function scenarioFromControls(state: ScenarioControlsState): StressScenario {
  if (!state.edited) return state.source;
  return {
    ...state.source,
    id: `${state.source.id}-edited`,
    name: `Custom: ${state.source.name}`,
    description: 'Using your edited assumptions, not the original preset. Estimates update as you adjust the controls.',
    category: 'custom',
    factorShocks: state.usingFactors ? state.factors : state.source.factorShocks,
    tickerShocks: {
      ...(state.usingFactors ? {} : state.source.tickerShocks),
      ...state.tickerOverrides,
    },
  };
}
