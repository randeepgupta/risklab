export const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export interface Env {
  ASSETS: {fetch(request: Request): Promise<Response>};
  AI?: {run(model: string, input: Record<string, unknown>): Promise<{response?: unknown}>};
  fallbackReason?: 'unavailable';
}

export function aiMetadata(env: Env) {
  return env.AI
    ? {provider: 'cloudflare', model: AI_MODEL, label: 'Llama 3.3 · Cloudflare AI'}
    : {provider: 'fallback', reason: env.fallbackReason ?? 'not_configured', label: 'Rule-based fallback'};
}

const factorNames = ['equityShockPct', 'rateChangeBps', 'vixSpikePct', 'semiShockPct', 'techShockPct'];
const scenarioSchema = {
  type: 'object',
  properties: {
    scenarioName: {type: 'string'},
    factorShocks: {
      type: 'object',
      properties: Object.fromEntries(factorNames.map(name => [name, {type: 'number'}])),
      required: factorNames,
    },
    macroTransmissionExplanation: {type: 'string'},
    vulnerabilities: {type: 'array', items: {type: 'string'}},
    suggestedHedgeAction: {type: 'string'},
  },
  required: ['scenarioName', 'factorShocks', 'macroTransmissionExplanation'],
};

export function validateScenario(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.scenarioName !== 'string' || !value.scenarioName.trim()
      || typeof value.macroTransmissionExplanation !== 'string' || !value.macroTransmissionExplanation.trim()
      || !factorNames.every(name => typeof value.factorShocks?.[name] === 'number'
        && Number.isFinite(value.factorShocks[name]))) {
    throw new Error('AI response is missing valid scenario factors');
  }
}

export async function generateAi(env: Env, system: string, user: string, json: boolean): Promise<unknown> {
  if (!env.AI) throw new Error('Workers AI is not configured');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      env.AI.run(AI_MODEL, {
        messages: [{role: 'system', content: system}, {role: 'user', content: user}],
        max_tokens: json ? 1200 : 800,
        temperature: json ? 0.1 : 0.3,
        ...(json ? {response_format: {type: 'json_schema', json_schema: scenarioSchema}} : {}),
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI response timed out')), 25000);
      }),
    ]);
    if (result?.response == null) throw new Error('AI returned no response');
    return result.response;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Return a bounded reason without exposing provider response details.
export function copilotUnavailable(error?: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const reason = !error ? 'not_configured'
    : /quota|rate.limit|429|limit exceeded/.test(message) ? 'quota_exceeded'
    : /timed out|timeout/.test(message) ? 'timeout' : 'service_error';
  return {code: 'AI_UNAVAILABLE', error: 'AI is not available right now.', reason};
}
