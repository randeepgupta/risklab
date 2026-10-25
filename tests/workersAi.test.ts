import assert from 'node:assert/strict';
import worker from '../worker';
import {AI_MODEL, validateScenario, type Env} from '../api/workers-ai';
import {parseExplicitScenario, ScenarioInputError, EXPLICIT_DRIVER_LIMITS} from '../api/scenario-parser';

const assets = {fetch: async () => new Response('RiskLab assets')};
const portfolio = [{ticker:'SPY',investment:10000,weight:1}];
async function post(path: string, body: unknown, env: Env) {
  const response = await worker.fetch(new Request('https://risklab.test'+path, {method:'POST',body:JSON.stringify(body)}), env);
  return {status:response.status, data:await response.json() as any};
}
const parse = (prompt:string, holdings=portfolio, env:Env={ASSETS:assets}) => post('/api/gemini/parse-scenario', {prompt,portfolio:holdings},env);
let calls = 0;
const ai: NonNullable<Env['AI']> = {async run(model,input) {
  calls++;
  assert.equal(model,AI_MODEL);
  assert.equal(input.stream,undefined);
  assert.equal(input.response_format,undefined,'scenario assumptions never require AI inference');
  assert.equal(input.max_tokens,800);
  const messages = input.messages as {role:string;content:string}[];
  assert.equal(messages[0].role,'system');
  assert.equal(messages[1].role,'user');
  assert.ok(messages[1].content.includes('10,000'));
  assert.ok(messages[1].content.includes('percentRiskContribution'));
  assert.ok(!messages[1].content.includes('discard-this-field'));
  return {response:'Your modeled portfolio risk is driven by equity exposure.'};
}};
const env = {ASSETS:assets, AI:ai};
const quotaEnv = {...env, AI:{run:async()=>{throw new Error('quota exceeded: private provider details');}}};

// The same explicit assumptions are honored with AI configured, absent, or
// unavailable. Neither a quota failure nor ambiguous prose creates a downturn.
for (const scenarioEnv of [env, quotaEnv, {ASSETS:assets}]) {
  const fall = await parse('What if the stock market falls 20%?',portfolio,scenarioEnv);
  const rise = await parse('What if the stock market rises 20%?',portfolio,scenarioEnv);
  assert.equal(fall.status,200); assert.equal(rise.status,200);
  assert.deepEqual(fall.data.drivers,{market:-20});
  assert.deepEqual(rise.data.drivers,{market:20});
  assert.deepEqual(fall.data.tickerShocks,{});
  assert.equal(fall.data.factorShocks,undefined,'no unconstrained driver is silently zero-filled');
  assert.equal(fall.data.ai.provider,'deterministic');
  assert.ok(fall.data.macroTransmissionExplanation.includes('falls 20%'));
  assert.ok(rise.data.macroTransmissionExplanation.includes('rises 20%'));
}
assert.equal(calls,0);
const yieldShock = await parse('10-year Treasury yield rises by 2 percentage points');
assert.equal(yieldShock.status,200);
assert.deepEqual(yieldShock.data.drivers,{treasury10y:200});
assert.ok(yieldShock.data.macroTransmissionExplanation.includes('rises 200 bps'));
const direct = await parse('Only NVDA falls 10%, all other holdings unchanged',[{ticker:'NVDA',investment:10000,weight:1}]);
assert.equal(direct.status,200);
assert.deepEqual(direct.data.drivers,{});
assert.deepEqual(direct.data.tickerShocks,{NVDA:-0.1});
assert.equal(direct.data.assetSpecificImpacts.NVDA.shockPct,-0.1);
const onlySpy = await parse('Only SPY falls 10%, all other holdings unchanged');
assert.deepEqual(onlySpy.data.drivers,{});
assert.deepEqual(onlySpy.data.tickerShocks,{SPY:-0.1});
assert.deepEqual((await parse('exactly SPY falls 20%')).data.drivers,{market:-20});
const mixed = parseExplicitScenario('stock market -20% and NVDA falls 10%',[{ticker:'NVDA'}]);
assert.deepEqual(mixed.drivers,{market:-20}); assert.deepEqual(mixed.tickerShocks,{NVDA:-0.1});
assert.deepEqual(parseExplicitScenario('SPY unchanged').drivers,{market:0});
assert.deepEqual(parseExplicitScenario('US10Y +100 bps').drivers,{treasury10y:100});
assert.deepEqual(parseExplicitScenario('10-year US Treasury yield falls .5 percentage points').drivers,{treasury10y:-50});
assert.deepEqual(parseExplicitScenario('BRK.B -10%',[{ticker:'BRK.B'}]).tickerShocks,{'BRK.B':-0.1});
assert.deepEqual(parseExplicitScenario('Only NVDA falls 100%',[{ticker:'NVDA'}]).tickerShocks,{NVDA:-1});

for (const prompt of [
  'What if interest rates rise by 2 percentage points?', 'Fed cuts rates 150 bps',
  'AI bubble bursts', 'VIX rises 40%', 'Oil rises 20%',
  'stock market falls sharply', 'stock market 20%', 'stocks rise -20%',
  'market falls +20%', 'market -90%', 'technology -81%',
  '10-year Treasury yield rises 2%', '10-year Treasury yield +301 bps',
  'stock market -20% and a geopolitical crisis',
  'stock market -20% and SPY +10%', 'Only MSFT falls 10%',
  'stock market -20%, everything else unchanged', 'NVDA falls 101%',
]) {
  const result = await parse(prompt);
  assert.equal(result.status,422,prompt);
  assert.equal(result.data.code,'SCENARIO_CLARIFICATION_REQUIRED',prompt);
  assert.equal(result.data.drivers,undefined,prompt);
  assert.equal(result.data.factorShocks,undefined,prompt);
  assert.ok(result.data.error.includes('explicit') || result.data.error.includes('Explicit') || result.data.error.includes('signed'),prompt);
}
for (const [driver,bounds] of Object.entries(EXPLICIT_DRIVER_LIMITS)) {
  const valid = {scenarioName:'Test',drivers:{[driver]:bounds.min},tickerShocks:{},macroTransmissionExplanation:'Explicit input.'};
  assert.doesNotThrow(()=>validateScenario(valid));
  assert.throws(()=>validateScenario({...valid,drivers:{[driver]:bounds.min-1}}),ScenarioInputError);
}
for (const bad of [{}, {scenarioName:'x',factorShocks:{equityShockPct:-20},macroTransmissionExplanation:'x'},
  {scenarioName:'x',drivers:{market:'-20'},tickerShocks:{},macroTransmissionExplanation:'x'},
  {scenarioName:'x',drivers:{oil:20},tickerShocks:{},macroTransmissionExplanation:'x'},
  {scenarioName:'x',drivers:{toString:0},tickerShocks:{},macroTransmissionExplanation:'x'}]) {
  assert.throws(()=>validateScenario(bad),ScenarioInputError);
}
assert.equal((await parse(' ')).status,400);
assert.equal((await parse('x'.repeat(2001))).status,400);
assert.equal(calls,0,'unsupported scenarios must not incur AI calls or invent return assumptions');
console.log('Explicit scenario parsing, direction, units, bounds, and clarification checks passed.');

// Copilot still receives bounded portfolio facts, preserves source attribution,
// and requires an explicit request for a rule-based answer.
const copilot = await post('/api/gemini/ask-copilot', {question:'Explain my risk',portfolio,
  riskMetrics:{totalValue:10000,annualizedVolatility:0.2,var95_1d:200,
    ignored:'discard-this-field',riskContributions:[{ticker:'SPY',percentRiskContribution:1}]}},env);
assert.equal(copilot.status,200); assert.equal(copilot.data.ai.provider,'cloudflare');
assert.ok(copilot.data.answer.includes('equity exposure'));
assert.equal(calls,1);
for (const [failureEnv,reason] of [
  [quotaEnv,'quota_exceeded'],
  [{...env,AI:{run:async()=>({response:''})}},'service_error'],
  [{...env,AI:{run:async()=>{throw new Error('AI response timed out');}}},'timeout'],
  [{ASSETS:assets},'not_configured'],
] as const) {
  const unavailable = await post('/api/gemini/ask-copilot',{question:'Explain risk'},failureEnv);
  assert.equal(unavailable.status,503); assert.equal(unavailable.data.code,'AI_UNAVAILABLE');
  assert.equal(unavailable.data.reason,reason); assert.equal(unavailable.data.answer,undefined);
  assert.ok(!JSON.stringify(unavailable.data).includes('private provider details'));
}
for (const fallbackEnv of [env,quotaEnv,{ASSETS:assets}]) {
  const summary = await post('/api/gemini/ask-copilot',{question:'Explain risk',mode:'rule_based',riskMetrics:{totalValue:10000,riskContributions:[null]}},fallbackEnv);
  assert.equal(summary.status,200); assert.equal(summary.data.ai.provider,'fallback');
  assert.equal(summary.data.ai.reason,'requested'); assert.ok(summary.data.answer.includes('10,000'));
}
assert.equal(calls,1,'explicit summary must bypass AI inference');
assert.equal((await post('/api/gemini/ask-copilot',{question:'Risk?',mode:'invalid'},env)).status,400);
assert.equal((await post('/api/gemini/ask-copilot',{question:' ',mode:'rule_based'},env)).status,400);
assert.equal((await post('/api/gemini/ask-copilot',{question:'x'.repeat(2001)},env)).status,400);
assert.equal((await post('/api/gemini/parse-scenario',{prompt:'x',extra:'x'.repeat(50000)},env)).status,413);
const health = await worker.fetch(new Request('https://risklab.test/api/health'),env);
assert.equal((await health.json() as any).aiConfigured,true);

for (const holdings of [
  [{ticker:'VOO',riskProxyTicker:'SPY',investment:10000,weight:1}],
  [{ticker:'VOO',investment:10000,weight:1,historicalModel:{provider:'DoltHub',startDate:'2025-10-06',endDate:'2026-10-05',observations:251,correlations:'discard-history-correlations'}}],
]) {
  const contextAi: NonNullable<Env['AI']> = {async run(_model,input) {
    const messages = input.messages as {content:string}[];
    assert.ok(messages.some(message=>message.content.includes('VOO')));
    if ('riskProxyTicker' in holdings[0]) {
      assert.ok(messages.some(message=>message.content.includes('SPY')));
      assert.ok(messages[0].content.includes('proxy assumptions'));
    } else {
      assert.ok(messages.some(message=>message.content.includes('2026-10-05')));
      assert.ok(!messages.some(message=>message.content.includes('discard-history-correlations')));
    }
    return {response:'Use the supplied dated model and holdings context.'};
  }};
  const result = await post('/api/gemini/ask-copilot',{question:'Explain risk',portfolio:holdings}, {ASSETS:assets,AI:contextAi});
  assert.equal(result.status,200); assert.equal(result.data.ai.provider,'cloudflare');
}
console.log('Workers AI Copilot consent, bounded facts, and historical/proxy context checks passed.');
