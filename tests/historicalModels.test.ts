import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calibrateHistoricalModels, type DailyPrice} from '../src/utils/historicalModels';
import {calculatePortfolioRisk, buildPositionCorrelationMatrix, executeStressTest} from '../src/utils/quantEngine';
import {applyHistoricalSnapshot, loadRiskSnapshot, type RiskSnapshot} from '../src/utils/riskSnapshot';
import type {PortfolioPosition} from '../src/types/risk';
const spy: DailyPrice[] = [], twice: DailyPrice[] = [], flat: DailyPrice[] = [];
let a=100,b=100;
for (let i=0;i<200;i++) {
  if (i) {const ret=(i%7-3)*0.001; a*=1+ret; b*=1+2*ret;}
  const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
  spy.push({date,adjClose:a,close:a}); twice.push({date,adjClose:b,close:b}); flat.push({date,adjClose:100,close:100});
}
const models=calibrateHistoricalModels({SPY:spy,TEST:twice,FLAT:flat},['SPY','TEST','FLAT'],'2026-10-05');
assert.ok(Math.abs(models.TEST.beta-2)<1e-10);
assert.ok(Math.abs(models.TEST.volatility/models.SPY.volatility-2)<1e-10);
assert.ok(Math.abs(models.TEST.correlations.SPY-1)<1e-10);
assert.equal(models.FLAT.volatility,0); assert.equal(models.FLAT.beta,0);
assert.equal(models.SPY.observations,199);
const missing=twice.filter((_,i)=>i!==100);
assert.equal(calibrateHistoricalModels({SPY:spy,TEST:missing},['TEST'],'now').TEST.observations,197,'exclude both intervals adjacent to missing price');
assert.throws(()=>calibrateHistoricalModels({SPY:spy,TEST:twice.slice(0,126)},['TEST'],'now'),/127/);
assert.throws(()=>calibrateHistoricalModels({SPY:spy,TEST:[...twice,twice[0]]},['TEST'],'now'),/duplicate/);
assert.throws(()=>calibrateHistoricalModels({SPY:spy,TEST:twice.map((p,i)=>i===2?{...p,adjClose:0}:p)},['TEST'],'now'),/invalid/);
const position=(ticker:string):PortfolioPosition=>({ticker,name:ticker,assetClass:'Other',investment:50000,weight:.5,price:0,historicalModel:models[ticker]});
const positions=[position('SPY'),position('TEST')];
const metrics=calculatePortfolioRisk(positions);
assert.ok(Math.abs(metrics.portfolioBeta-1.5)<1e-10);
assert.ok(Math.abs(metrics.annualizedVolatility-models.SPY.volatility*1.5)<1e-10);
assert.deepEqual(buildPositionCorrelationMatrix(positions).tickers,['SPY','TEST']);
assert.ok(Math.abs(metrics.riskContributions.reduce((sum,r)=>sum+r.percentRiskContribution,0)-1)<1e-10);
const flatMetrics=calculatePortfolioRisk([position('FLAT')]);
assert.equal(flatMetrics.annualizedVolatility,0);
assert.ok(flatMetrics.riskContributions.every(r=>Number.isFinite(r.percentRiskContribution)));
const stress=executeStressTest([position('TEST')],{id:'x',name:'x',description:'',category:'custom',tickerShocks:{},factorShocks:{equityShockPct:-10,rateChangeBps:0,vixSpikePct:0,techShockPct:-10,semiShockPct:-10}});
assert.ok(Math.abs(stress.attributions[0].shockPct+.2)<1e-10);
const snapshot:RiskSnapshot={capturedAt:'now',asOf:spy.at(-1)!.date,dates:spy.map(p=>p.date),symbols:{SPY:{values:spy.map(p=>p.adjClose),price:123,priceAsOf:spy.at(-1)!.date},TEST:{values:twice.map(p=>p.adjClose),price:234,priceAsOf:twice.at(-1)!.date}}};
const updated=applyHistoricalSnapshot([{...position('TEST'),riskProxyTicker:'SPY'}],snapshot);
assert.equal(updated[0].riskProxyTicker,undefined); assert.equal(updated[0].price,234);
assert.equal(updated[0].historicalModel!.beta,models.TEST.beta);
assert.throws(()=>applyHistoricalSnapshot([position('MISSING')],snapshot),/not covered/);
assert.throws(()=>buildPositionCorrelationMatrix([position('SPY'),{...position('TEST'),historicalModel:undefined}]),/mix/);
console.log('Historical model calibration and engine checks passed.');

const committed:RiskSnapshot=JSON.parse(readFileSync(new URL('../public/models/historical-snapshot.json',import.meta.url),'utf8'));
assert.ok(Object.keys(committed.symbols).length>=150);
for (const ticker of ['SPY','VOO','VTI','VXUS','SCHD','META','QQQM']) assert.ok(committed.symbols[ticker],ticker);
for (const [ticker,symbol] of Object.entries(committed.symbols)) {
  assert.equal(symbol.values.length,committed.dates.length,ticker);
  assert.equal(symbol.priceAsOf,committed.asOf,ticker);
  const calibrated=applyHistoricalSnapshot([{ticker,name:ticker,assetClass:'Other',investment:100000,weight:1,price:0}],committed);
  const metrics=calculatePortfolioRisk(calibrated);
  assert.ok(Number.isFinite(metrics.annualizedVolatility)&&metrics.annualizedVolatility>=0,ticker);
  assert.ok(Number.isFinite(metrics.portfolioBeta),ticker);
}
console.log(`Committed public snapshot checks passed (${Object.keys(committed.symbols).length} holdings).`);

const originalFetch=globalThis.fetch;
let fetchCount=0;
try {
  globalThis.fetch=async()=> {fetchCount++; return fetchCount===1 ? new Response('',{status:503}) : Response.json(committed);};
  await assert.rejects(loadRiskSnapshot(),/unavailable/);
  const [one,two]=await Promise.all([loadRiskSnapshot(),loadRiskSnapshot()]);
  assert.equal(one,two);
  for (const investment of [10000,20000,30000]) applyHistoricalSnapshot([{ticker:'VOO',name:'VOO',assetClass:'Other',investment,weight:1,price:0}],one);
  assert.equal(fetchCount,2,'one failed fetch, then one shared successful fetch; allocation changes do not fetch');
} finally {globalThis.fetch=originalFetch;}
console.log('Snapshot retry, shared loading and allocation reuse checks passed.');
