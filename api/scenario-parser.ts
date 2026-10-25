import type {AiScenarioParseResponse, ScenarioDriver} from '../src/types/risk';

// API limits match the scenario controls. Reject extremes rather than changing
// the user's assumptions while leaving their explanation unchanged.
export const EXPLICIT_DRIVER_LIMITS: Record<ScenarioDriver, {min: number; max: number}> = {
  market: {min: -80, max: 50},
  technology: {min: -80, max: 100},
  semiconductors: {min: -80, max: 100},
  treasury10y: {min: -300, max: 300},
};
const DRIVER_LABELS: Record<ScenarioDriver, string> = {
  market: 'Broad U.S. equities (SPY)',
  technology: 'Technology / Nasdaq-100 (QQQM)',
  semiconductors: 'Semiconductors (SMH)',
  treasury10y: '10-year U.S. Treasury yield',
};
const GUIDANCE = 'Use explicit moves, for example “stock market falls 20%”, “technology stocks rise 10%”, “10-year Treasury yield rises 200 bps”, or “Only NVDA falls 10%” when NVDA is in your portfolio.';

export class ScenarioInputError extends Error {
  readonly code = 'SCENARIO_CLARIFICATION_REQUIRED';
}
const reject = (reason: string): never => {throw new ScenarioInputError(`${reason} ${GUIDANCE}`);};

const TARGETS = {
  treasury10y: '(?:(?:us\\s+)?(?:10[\\s-]*year|10y|ten[\\s-]*year)\\s+(?:us\\s+)?treasury(?:\\s+bond)?\\s+yields?|us10y(?:\\s+yield)?)',
  technology: '(?:technology(?:\\s+(?:stocks|equities|sector|etf))?|tech(?:\\s+(?:stocks|equities|sector))?|nasdaq(?:[\\s-]*100)?|qqqm)',
  semiconductors: '(?:semiconductors?(?:\\s+(?:stocks|equities|sector|etf))?|chips?(?:\\s+(?:stocks|equities|sector))?|smh)',
  market: '(?:broad\\s+(?:stock\\s+)?market|stock\\s+market|equity\\s+market|stocks|equities|markets?|s\\s*&\\s*p\\s*500|spy)',
};
const targetPattern = Object.values(TARGETS).join('|') + '|[a-z][a-z0-9.\\-]{0,9}';
const prefix = '(?:(?:what\\s+if|suppose|assume|if)\\s+)?(?:(only)\\s+)?(?:exactly\\s+)?(?:the\\s+|my\\s+)?\\$?';
const direction = '(?:go(?:es)?\\s+(?:up|down)|falls?|fell|drops?|declines?|decreases?|down|loses?|crashes?|rises?|increases?|gains?|up|grows?|rall(?:y|ies)|[=:])';
const unit = '(?:%|percent(?:age\\s+points?)?|basis\\s+points?|bps|pp)';
const shockPattern = new RegExp(`^${prefix}(${targetPattern})(?:\\s+(?:price|return))?\\s*(?:(?:is|are|will|would|could)\\s+)?(${direction})?\\s*(?:by\\s+)?(?:exactly\\s+)?([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))\\s*(${unit})$`, 'i');
const unchangedPattern = new RegExp(`^${prefix}(${targetPattern})\\s+(?:(?:is|are|remains?|stays?)\\s+)?(?:unchanged|flat)$`, 'i');
const othersUnchanged = /^(?:all\s+)?(?:other\s+(?:holdings|assets|stocks)|everything\s+else)\s+(?:(?:is|are|remains?|stays?)\s+)?unchanged$/i;

function resolveTarget(target: string, only: boolean, holdOthers: boolean, allowed: Set<string>): {driver?: ScenarioDriver; ticker?: string} {
  const ticker = target.toUpperCase();
  const benchmarkTicker = ['SPY', 'QQQM', 'SMH'].includes(ticker);
  if (allowed.has(ticker) && (!benchmarkTicker || only || holdOthers)) return {ticker};
  if (benchmarkTicker && (only || holdOthers)) return reject(`${ticker} is not a holding in the supplied portfolio.`);
  for (const [driver, expression] of Object.entries(TARGETS)) {
    if (new RegExp(`^${expression}$`, 'i').test(target)) return {driver: driver as ScenarioDriver};
  }
  return reject(`${ticker} is not a supported benchmark or a holding in the supplied portfolio.`);
}

function describe(label: string, value: number, treasury: boolean): string {
  if (value === 0) return `${label} is unchanged (${treasury ? '0 bps' : '0%'})`;
  return `${label} ${value < 0 ? 'falls' : 'rises'} ${Math.abs(value)}${treasury ? ' bps' : '%'}`;
}

/** Parse only explicit measurable assumptions. This function never estimates a
 * market move or asks a model to invent a number from a qualitative narrative. */
export function parseExplicitScenario(prompt: string, portfolio: unknown = []): AiScenarioParseResponse {
  const normalized = prompt.trim().replace(/[−–]/g, '-').replace(/U\.S\./gi, 'US').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '');
  const clauses = normalized.split(/[,;\n]+|\s+and\s+|\s+while\s+|\.(?=\s+[a-z]|$)/i).map(clause => clause.trim().replace(/[?!]+$/, '').trim()).filter(Boolean);
  const holdOthers = clauses.some(clause => othersUnchanged.test(clause));
  const allowed = new Set<string>(Array.isArray(portfolio) ? portfolio.filter(item => item && typeof item.ticker === 'string').map(item => item.ticker.toUpperCase()) : []);
  const drivers: Partial<Record<ScenarioDriver, number>> = {};
  const tickerShocks: Record<string, number> = {};
  for (const clause of clauses) {
    if (othersUnchanged.test(clause)) continue;
    const unchanged = unchangedPattern.exec(clause);
    const match = shockPattern.exec(clause);
    if (!match && !unchanged) {
      if (/fed|policy\s+rates?|interest\s+rates?|rate\s+(?:cuts?|hikes?)/i.test(clause)) return reject('Policy or generic interest-rate changes do not specify a 10-year Treasury yield move. Please state that yield change explicitly in basis points or percentage points.');
      return reject('I could not read an explicit benchmark or portfolio-holding move from every part of that scenario. Qualitative events and VIX changes are not translated into invented returns.');
    }
    const only = Boolean((match ?? unchanged)![1]);
    const target = (match ?? unchanged)![2];
    const destination = resolveTarget(target, only, holdOthers, allowed);
    let value = 0;
    if (match) {
      const move = (match[3] ?? '').toLowerCase();
      const raw = match[4];
      value = Number(raw);
      const units = match[5].toLowerCase();
      const down = /fall|fell|drop|declin|decreas|down|lose|crash/.test(move);
      const up = /rise|increas|gain|up|grow|rall/.test(move);
      if ((up && value < 0) || (down && raw.startsWith('+'))) return reject('The direction and signed amount disagree.');
      if (!up && !down && !/^[+-]/.test(raw) && value !== 0) return reject('Please say whether the move is up or down, or provide a signed amount.');
      if (down) value = -Math.abs(value);
      if (destination.driver === 'treasury10y') {
        if (['%', 'percent'].includes(units)) return reject('For Treasury yields, use basis points or percentage points, not a relative percent change.');
        if (/percent|^pp$/.test(units)) value *= 100;
      } else if (/bps|basis/.test(units)) return reject('Stock and ETF moves must be expressed as percent returns; basis points are reserved for the 10-year Treasury yield.');
    }
    if (!Number.isFinite(value)) return reject('The shock amount must be finite.');
    if (destination.driver) {
      const key = destination.driver, bounds = EXPLICIT_DRIVER_LIMITS[key];
      if (value < bounds.min || value > bounds.max) return reject(`${DRIVER_LABELS[key]} supports moves from ${bounds.min} to ${bounds.max}${key === 'treasury10y' ? ' bps' : '%'}. The requested amount was not changed.`);
      if (drivers[key] !== undefined && drivers[key] !== value) return reject(`Conflicting moves were supplied for ${DRIVER_LABELS[key]}.`);
      drivers[key] = value;
    } else {
      const ticker = destination.ticker!;
      if (value < -100 || value > 300) return reject(`${ticker} supports explicit returns from -100% to +300%. The requested amount was not changed.`);
      const decimal = value / 100;
      if (tickerShocks[ticker] !== undefined && tickerShocks[ticker] !== decimal) return reject(`Conflicting moves were supplied for ${ticker}.`);
      tickerShocks[ticker] = decimal;
    }
  }
  if (!Object.keys(drivers).length && !Object.keys(tickerShocks).length) return reject('Specify at least one benchmark or holding move.');
  if (holdOthers && Object.keys(drivers).length) return reject('“Other holdings unchanged” requires a direct holding scenario, not a benchmark scenario that estimates other holdings.');
  const descriptions = [...Object.entries(drivers).map(([key, value]) => describe(DRIVER_LABELS[key as ScenarioDriver], value!, key === 'treasury10y')),
    ...Object.entries(tickerShocks).map(([ticker, value]) => describe(ticker, value * 100, false))];
  const explanation = 'Your explicit assumptions: ' + descriptions.join('; ') + '. ' +
    (Object.keys(drivers).length ? 'Other holding changes are estimated from historical relationships with these benchmarks. Direct holding assumptions override those estimates.' : 'All other holdings are left unchanged in this direct-holding scenario.') +
    ' These are hypothetical assumptions, not forecasts.';
  return {
    ai: {provider: 'deterministic', label: 'Explicit scenario assumptions'},
    scenarioName: descriptions.join(' · ').slice(0, 120), drivers, tickerShocks,
    macroTransmissionExplanation: explanation,
    assetSpecificImpacts: Object.fromEntries(Object.entries(tickerShocks).map(([ticker, shockPct]) => [ticker, {shockPct, reason: 'Explicit user assumption'}])),
    vulnerabilities: [], suggestedHedgeAction: '',
  };
}

/** Shared response validation for integrations; no coercion, filling or clipping. */
export function validateExplicitScenario(value: any): void {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.scenarioName !== 'string' || !value.scenarioName.trim()
      || typeof value.macroTransmissionExplanation !== 'string' || !value.macroTransmissionExplanation.trim()
      || !value.drivers || typeof value.drivers !== 'object' || Array.isArray(value.drivers)
      || !value.tickerShocks || typeof value.tickerShocks !== 'object' || Array.isArray(value.tickerShocks)
      || (!Object.keys(value.drivers).length && !Object.keys(value.tickerShocks).length)) throw new ScenarioInputError('Missing explicit scenario assumptions.');
  for (const [key, shock] of Object.entries(value.drivers)) {
    const limit = EXPLICIT_DRIVER_LIMITS[key as ScenarioDriver];
    if (!Object.hasOwn(EXPLICIT_DRIVER_LIMITS, key) || !limit || typeof shock !== 'number' || !Number.isFinite(shock) || shock < limit.min || shock > limit.max) throw new ScenarioInputError('Invalid benchmark move.');
  }
  for (const [ticker, shock] of Object.entries(value.tickerShocks)) {
    if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker) || typeof shock !== 'number' || !Number.isFinite(shock) || shock < -1 || shock > 3) throw new ScenarioInputError('Invalid direct holding move.');
  }
}
