import assert from 'node:assert/strict';
import worker from '../worker';
import {AI_MODEL, type Env} from '../api/workers-ai';

const assets = {fetch: async () => new Response('RiskLab assets')};
const scenario = {
  scenarioName: 'Higher rates, weaker technology',
  factorShocks: {equityShockPct: -10, rateChangeBps: 200, vixSpikePct: 40, semiShockPct: -20, techShockPct: -15},
  macroTransmissionExplanation: 'Higher rates reduce modeled growth valuations.',
};
const portfolio = [{ticker: 'SPY', investment: 10000, weight: 1}];
async function post(path: string, body: unknown, env: Env) {
  const response = await worker.fetch(new Request('https://risklab.test' + path,
    {method: 'POST', body: JSON.stringify(body)}), env);
  return {status: response.status, data: await response.json() as any};
}

let calls = 0;
const ai: NonNullable<Env['AI']> = {async run(model, input) {
  calls++;
  assert.equal(model, AI_MODEL);
  assert.equal(input.stream, undefined);
  const messages = input.messages as {role: string; content: string}[];
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].role, 'user');
  if (input.response_format) {
    assert.equal(input.max_tokens, 1200);
    assert.equal((input.response_format as any).type, 'json_schema');
    return {response: scenario};
  }
  assert.equal(input.max_tokens, 800);
  assert.ok(messages[1].content.includes('10,000'));
  assert.ok(messages[1].content.includes('percentRiskContribution'));
  assert.ok(!messages[1].content.includes('discard-this-field'));
  return {response: 'Your modeled portfolio risk is driven by equity exposure.'};
}};
const env = {ASSETS: assets, AI: ai};

const result = await post('/api/gemini/parse-scenario', {prompt: 'Rates rise 200 bps', portfolio}, env);
assert.equal(result.status, 200);
assert.equal(result.data.factorShocks.rateChangeBps, 200);
assert.equal(result.data.ai.provider, 'cloudflare');
assert.equal(result.data.ai.model, AI_MODEL);
assert.equal(calls, 1);

const copilot = await post('/api/gemini/ask-copilot', {question: 'Explain my risk', portfolio,
  riskMetrics: {totalValue: 10000, annualizedVolatility: 0.2, var95_1d: 200,
    ignored: 'discard-this-field', riskContributions: [{ticker: 'SPY', percentRiskContribution: 1}]}}, env);
assert.equal(copilot.status, 200);
assert.equal(copilot.data.ai.provider, 'cloudflare');
assert.ok(copilot.data.answer.includes('equity exposure'));
assert.equal(calls, 2);

// Cloudflare JSON mode may return an object or serialized JSON; both must work.
const stringEnv = {...env, AI: {run: async () => ({response: JSON.stringify(scenario)})}};
assert.equal((await post('/api/gemini/parse-scenario', {prompt: 'Rates rise', portfolio}, stringEnv)).data.ai.provider, 'cloudflare');

// Unsafe or incomplete model responses must never be marked as successful AI output.
for (const response of ['not JSON', {}, {...scenario, factorShocks: {equityShockPct: 'bad'}}]) {
  const invalidEnv = {...env, AI: {run: async () => ({response})}};
  const fallback = await post('/api/gemini/parse-scenario', {prompt: '2008 crash', portfolio}, invalidEnv);
  assert.equal(fallback.status, 200);
  assert.equal(fallback.data.ai.provider, 'fallback');
  assert.equal(fallback.data.ai.reason, 'unavailable');
  assert.equal(fallback.data.factorShocks.equityShockPct, -35);
}

const quotaEnv = {...env, AI: {run: async () => {throw new Error('quota exceeded: private provider details');}}};
for (const path of ['/api/gemini/parse-scenario', '/api/gemini/ask-copilot']) {
  const fallback = await post(path, {prompt: '2008 crash', question: 'Explain risk', portfolio,
    riskMetrics: {totalValue: 10000, riskContributions: [null]}}, quotaEnv);
  assert.equal(fallback.status, 200);
  assert.equal(fallback.data.ai.provider, 'fallback');
  assert.equal(fallback.data.ai.reason, 'unavailable');
  assert.ok(!JSON.stringify(fallback.data).includes('private provider details'));
}
assert.equal((await post('/api/gemini/ask-copilot', {question: 'Risk?'}, {...env,
  AI: {run: async () => ({response: ''})}})).data.ai.provider, 'fallback');

const boundedEnv = {...env, AI: {run: async () => ({response: {...scenario,
  factorShocks: {...scenario.factorShocks, equityShockPct: -999, rateChangeBps: 9999}}})}};
const bounded = await post('/api/gemini/parse-scenario', {prompt: 'A severe shock'}, boundedEnv);
assert.equal(bounded.data.factorShocks.equityShockPct, -80);
assert.equal(bounded.data.factorShocks.rateChangeBps, 1000);

const missing = await post('/api/gemini/parse-scenario', {prompt: '2008 crash'}, {ASSETS: assets});
assert.equal(missing.data.ai.reason, 'not_configured');
assert.equal((await post('/api/gemini/parse-scenario', {prompt: ' '}, env)).status, 400);
assert.equal((await post('/api/gemini/ask-copilot', {question: 'x'.repeat(2001)}, env)).status, 400);
assert.equal((await post('/api/gemini/parse-scenario', {prompt: 'x', extra: 'x'.repeat(50000)}, env)).status, 413);
assert.equal(calls, 2, 'Invalid requests must not incur inference calls');
const health = await worker.fetch(new Request('https://risklab.test/api/health'), env);
assert.equal((await health.json() as any).aiConfigured, true);


// Proxy assumptions must survive request normalization and reach both AI prompts.
const proxyAi: NonNullable<Env['AI']> = {async run(_model, input) {
  const messages = input.messages as {role: string; content: string}[];
  assert.ok(messages.some(message => message.content.includes('SPY')));
  assert.ok(messages.some(message => message.content.includes('VOO')));
  assert.ok(messages[0].content.includes('proxy assumptions'));
  assert.ok(messages.some(message => message.content.includes('riskProxyTicker') || message.content.includes('modeled using SPY')));
  return input.response_format ? {response: scenario} : {response: 'VOO uses SPY proxy assumptions.'};
}};
const proxyPortfolio = [{ticker: 'VOO', riskProxyTicker: 'SPY', investment: 10000, weight: 1}];
for (const path of ['/api/gemini/parse-scenario', '/api/gemini/ask-copilot']) {
  const result = await post(path, {prompt: 'Explain risk', question: 'Explain risk', portfolio: proxyPortfolio}, {ASSETS: assets, AI: proxyAi});
  assert.equal(result.status, 200);
  assert.equal(result.data.ai.provider, 'cloudflare');
}

console.log('Workers AI integration and proxy context checks passed.');
