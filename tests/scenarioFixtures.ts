import {calibrateHistoricalModels, type DailyPrice} from '../src/utils/historicalModels';
import type {PortfolioPosition} from '../src/types/risk';

export function measuredFixture() {
  const tickers=['SPY','QQQM','SMH','AVGO','IEF'];
  const series:Record<string,DailyPrice[]>=Object.fromEntries(tickers.map(ticker=>[ticker,[]]));
  const values=Object.fromEntries(tickers.map(ticker=>[ticker,100]));
  const yields:{date:string;value:number}[]=[];
  let yieldPercent=4;
  for(let i=0;i<=252;i++) {
    const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
    if(i) {
      const wave=(frequency:number)=>Math.sin(2*Math.PI*frequency*i/252);
      const market=.5*wave(1),technology=.7*market+.5*wave(2),semi=1.2*technology+.4*wave(3),rateBps=5*wave(4);
      const daily={SPY:market,QQQM:technology,SMH:semi,AVGO:1.7*semi+.15*market+.3*wave(5),IEF:-.07*rateBps+.2*market};
      for(const ticker of tickers) values[ticker]*=1+daily[ticker as keyof typeof daily]/100;
      yieldPercent+=rateBps/100;
    }
    yields.push({date,value:yieldPercent});
    for(const ticker of tickers) series[ticker].push({date,adjClose:values[ticker],close:values[ticker]});
  }
  const models=calibrateHistoricalModels(series,tickers,'2026-10-25',yields);
  const position=(ticker:string,investment=100000):PortfolioPosition=>({ticker,name:ticker,assetClass:'Other',investment,weight:1,price:100,historicalModel:models[ticker]});
  return {series,yields,models,position};
}
