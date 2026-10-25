import type { ScenarioDriver, ScenarioDrivers, StressScenario } from '../types/risk';
import { SCENARIO_DRIVER_LIMITS } from './measuredScenario';

export type EditableFactor = ScenarioDriver;
export const FACTOR_LIMITS = SCENARIO_DRIVER_LIMITS;

export interface ScenarioControlsState {
  source: StressScenario;
  factors: ScenarioDrivers;
  tickerOverrides: Record<string, number>;
  edited: boolean;
}
export type ScenarioControlsAction =
  | { type: 'load'; scenario: StressScenario }
  | { type: 'factor'; key: ScenarioDriver; value: number }
  | { type: 'toggle-factor'; key: ScenarioDriver; enabled: boolean }
  | { type: 'ticker'; ticker: string; value: number }
  | { type: 'reset-ticker'; ticker: string }
  | { type: 'use-factors' }
  | { type: 'reset' };

export function createScenarioControls(source: StressScenario): ScenarioControlsState {
  const copy = { ...source, drivers: { ...source.drivers }, tickerShocks: { ...source.tickerShocks } };
  return { source: copy, factors: { ...copy.drivers }, tickerOverrides: { ...copy.tickerShocks }, edited: false };
}

export function scenarioControlsReducer(state: ScenarioControlsState, action: ScenarioControlsAction): ScenarioControlsState {
  switch (action.type) {
    case 'load': return createScenarioControls(action.scenario);
    case 'reset': return createScenarioControls(state.source);
    case 'factor': {
      const { min, max } = FACTOR_LIMITS[action.key];
      if (!Number.isFinite(action.value) || action.value < min || action.value > max) return state;
      return { ...state, factors: { ...state.factors, [action.key]: action.value }, edited: true };
    }
    case 'toggle-factor': {
      const factors = { ...state.factors };
      if (action.enabled) factors[action.key] = 0;
      else delete factors[action.key];
      return { ...state, factors, edited: true };
    }
    case 'ticker': {
      const ticker = action.ticker.trim().toUpperCase();
      if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker) || !Number.isFinite(action.value) || action.value < -1 || action.value > 3) return state;
      return { ...state, tickerOverrides: { ...state.tickerOverrides, [ticker]: action.value }, edited: true };
    }
    case 'reset-ticker': {
      const tickerOverrides = { ...state.tickerOverrides };
      delete tickerOverrides[action.ticker.toUpperCase()];
      return { ...state, tickerOverrides, edited: true };
    }
    case 'use-factors': return { ...state, tickerOverrides: {}, edited: true };
    default: return state;
  }
}

export function scenarioFromControls(state: ScenarioControlsState): StressScenario {
  if (!state.edited) return state.source;
  return {
    ...state.source, id: `${state.source.id}-edited`, name: `Custom: ${state.source.name}`,
    description: 'Using your edited market changes and explicit holding overrides.', category: 'custom',
    drivers: { ...state.factors }, tickerShocks: { ...state.tickerOverrides },
  };
}
