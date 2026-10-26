import type {AiResponseSource} from './risk';
import type {ScenarioControlsState} from '../utils/scenarioControls';

export interface FutureSettings {
  annualReturn: number;
  horizonYears: number;
  simulations: number;
  returnPeriod: 'year' | 'month';
}
export interface ScenarioSession {
  prompt: string;
  controls: ScenarioControlsState;
  hasResult: boolean;
  explanation: string | null;
  source: AiResponseSource | null;
}
export interface WorkspaceSettings {
  activeTab: 'risk' | 'stress' | 'monte-carlo';
  future: FutureSettings;
  scenario: ScenarioSession;
}
export interface SavedHolding {
  ticker: string;
  name: string;
  investment: number;
}
export interface SavedPortfolio {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  valuationDate: string;
  currency: 'USD';
  holdings: SavedHolding[];
  settings: WorkspaceSettings;
  modelContext: {asOf: string; capturedAt: string; sourceRevision?: string};
}
export interface PortfolioLibrary {
  app: 'RiskLab';
  schemaVersion: 1;
  portfolios: SavedPortfolio[];
}
