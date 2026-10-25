import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RiskContributionChart} from '../src/components/RiskContributionChart';
import {explainRiskContribution} from '../src/utils/riskContributionExplanation';
import {calculatePortfolioRisk} from '../src/utils/quantEngine';
import type {PortfolioPosition} from '../src/types/risk';

const position = (ticker:string, investment:number, volatility=.2):PortfolioPosition => ({
  ticker,name:ticker,assetClass:'Other',investment,weight:investment/100000,price:100,
  historicalModel:{provider:'DoltHub',source:'test',license:'CC BY-SA 4.0',capturedAt:'test',
    startDate:'2025-10-23',endDate:'2026-10-23',observations:251,volatility,beta:1,
    annualizedMeanReturn:.05,correlations:{ALPHA:ticker==='ALPHA'?1:-.8,HEDGE:ticker==='HEDGE'?1:-.8,[ticker]:1}},
});
// Independent two-asset example: 80% and 20% weights, equal 20% volatilities,
// and -0.8 correlation. Signed Euler shares are 120.7547% and -20.7547%.
const metrics=calculatePortfolioRisk([position('ALPHA',80000),position('HEDGE',20000)]);
assert.ok(Math.abs(metrics.annualizedVariance-.01696)<1e-10);
assert.ok(Math.abs(metrics.riskContributions[0].percentRiskContribution-1.2075471698113207)<1e-9);
assert.ok(Math.abs(metrics.riskContributions[1].percentRiskContribution+.2075471698113207)<1e-9);
for(const item of metrics.riskContributions) {
  const explanation=explainRiskContribution(item,metrics.annualizedVolatility);
  assert.notEqual(explanation.correlation,null);
  const reconstructed=item.weight*item.volatility*explanation.correlation!/metrics.annualizedVolatility;
  assert.ok(Math.abs(reconstructed-item.percentRiskContribution)<1e-10,'explanation must reconcile to the displayed engine contribution');
  assert.ok(explanation.summary.includes('20.0% annualized historical volatility'));
  assert.ok(explanation.note.includes('whole portfolio')||explanation.note.includes('includes this holding'));
}
const positive=explainRiskContribution(metrics.riskContributions[0],metrics.annualizedVolatility);
assert.ok(positive.summary.includes('larger than its allocation'));
assert.ok(positive.calculation?.includes('120.8%'));
const offset=explainRiskContribution(metrics.riskContributions[1],metrics.annualizedVolatility);
assert.ok(offset.correlation!<0);
assert.ok(offset.summary.includes('partly offset other holdings'));
assert.ok(offset.calculation?.includes('-20.8%'));
const markup=renderToStaticMarkup(<RiskContributionChart contributions={metrics.riskContributions} portfolioVol={metrics.annualizedVolatility}/>);
for(const ticker of ['ALPHA','HEDGE']) assert.ok(markup.includes(`Why ${ticker} contributes this risk share`),'each holding must have a visible explanation');
assert.ok(markup.includes('-20.8% of risk (offset)'));
assert.ok(markup.includes('not a probability of loss or a forecast'));

const single=calculatePortfolioRisk([position('ALPHA',100000)]);
const one=explainRiskContribution(single.riskContributions[0],single.annualizedVolatility);
assert.ok(Math.abs(one.correlation!-1)<1e-10,'correlation is with the full portfolio, including the holding itself');
assert.ok(one.calculation?.endsWith('100.0%'));
const flat=calculatePortfolioRisk([position('FLAT',100000,0)]);
const noVol=explainRiskContribution(flat.riskContributions[0],flat.annualizedVolatility);
assert.equal(noVol.correlation,null);
assert.equal(noVol.calculation,null);
assert.ok(noVol.summary.includes('undefined'));
const flatMarkup=renderToStaticMarkup(<RiskContributionChart contributions={flat.riskContributions} portfolioVol={0}/>);
assert.ok(flatMarkup.includes('Risk share undefined'));
assert.ok(!/NaN|Infinity/.test(flatMarkup));
const flatHolding=explainRiskContribution({...metrics.riskContributions[0],volatility:0,marginalRisk:0,percentRiskContribution:0},.2);
assert.equal(flatHolding.correlation,null);
assert.ok(flatHolding.summary.includes('no observed variation'));
console.log('Per-holding risk explanations reconcile with signed Euler shares and handle undefined correlations.');
