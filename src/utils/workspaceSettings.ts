import type {FutureSettings, ScenarioSession, WorkspaceSettings} from '../types/workspace';
import {createScenarioControls} from './scenarioControls';
import {DEFAULT_FUTURE_ANNUAL_RETURN} from './simulationOutcomes';

export const DEFAULT_FUTURE_SETTINGS: FutureSettings = {
  annualReturn: DEFAULT_FUTURE_ANNUAL_RETURN, horizonYears: 10, simulations: 2500, returnPeriod: 'year',
};
export function createScenarioSession(): ScenarioSession {
  return {prompt:'',hasResult:false,explanation:null,source:null,
    controls:createScenarioControls({id:'unsubmitted',name:'',description:'',category:'custom',tickerShocks:{},drivers:{}})};
}
export function createWorkspaceSettings(): WorkspaceSettings {
  return {activeTab:'risk',future:{...DEFAULT_FUTURE_SETTINGS},scenario:createScenarioSession()};
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
