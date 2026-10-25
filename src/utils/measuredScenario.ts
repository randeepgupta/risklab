import type {HistoricalScenarioModel, ScenarioDriver, ScenarioDrivers} from '../types/risk';
import type {DailyPrice} from './historicalModels';

export const SCENARIO_DRIVER_ORDER: readonly ScenarioDriver[] = ['market', 'technology', 'semiconductors', 'treasury10y'];
export const SCENARIO_DRIVER_LIMITS: Record<ScenarioDriver, {min:number; max:number}> = {
  market: {min:-80,max:50}, technology:{min:-80,max:100},
  semiconductors:{min:-80,max:100}, treasury10y:{min:-300,max:300},
};
export const SCENARIO_BENCHMARKS = {market:'SPY', technology:'QQQM', semiconductors:'SMH'} as const;
export interface DailyYield {date: string; value: number}
const mean = (a:number[]) => a.reduce((sum,x)=>sum+x,0)/a.length;
function covariance(a:number[],b:number[]) {
  const ma=mean(a), mb=mean(b);
  return a.reduce((sum,x,i)=>sum+(x-ma)*(b[i]-mb),0)/(a.length-1);
}
function priceReturns(prices:DailyPrice[]):Map<string,number> {
  const sorted=[...prices].sort((a,b)=>a.date.localeCompare(b.date));
  const seen=new Set<string>();
  for(const p of sorted) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date))||seen.has(p.date)||!Number.isFinite(p.adjClose)||p.adjClose<=0) throw new Error('Invalid benchmark or holding price history.');
    seen.add(p.date);
  }
  return new Map(sorted.slice(1).map((p,i)=>[`${sorted[i].date}/${p.date}`,100*(p.adjClose/sorted[i].adjClose-1)]));
}
export function calibrateScenarioModel(series:Record<string,DailyPrice[]>,ticker:string,yields?:DailyYield[]):HistoricalScenarioModel {
  const asset=priceReturns(series[ticker]??[]);
  const features=new Map<ScenarioDriver,Map<string,number>>();
  for(const [driver,benchmark] of Object.entries(SCENARIO_BENCHMARKS)) {
    if(series[benchmark]) features.set(driver as ScenarioDriver,priceReturns(series[benchmark]));
  }
  if(yields?.length) {
    const sorted=[...yields].sort((a,b)=>a.date.localeCompare(b.date));
    const seen=new Set<string>();
    for(const y of sorted) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(y.date)||!Number.isFinite(Date.parse(y.date))||!Number.isFinite(y.value)||seen.has(y.date)) throw new Error('Invalid Treasury yield history.');
      seen.add(y.date);
    }
    features.set('treasury10y',new Map(sorted.slice(1).map((y,i)=>[`${sorted[i].date}/${y.date}`,100*(y.value-sorted[i].value)])));
  }
  // A missing daily observation cannot become a spurious one-day return.
  let driverOrder=SCENARIO_DRIVER_ORDER.filter(driver=>(features.get(driver)?.size??0)>=126);
  let intervals:string[]=[];
  while(driverOrder.length) {
    intervals=[...asset.keys()].filter(interval=>driverOrder.every(driver=>features.get(driver)!.has(interval))).sort();
    if(intervals.length>=126) break;
    // Preserve supported lower-dimensional models, but never synthesize data for
    // a missing driver. Requests for removed drivers fail in estimateScenario.
    driverOrder=driverOrder.slice(0,-1);
  }
  if(!driverOrder.length||intervals.length<126) throw new Error('At least 126 matched daily observations are required for a measured scenario response.');
  const a=intervals.map(interval=>asset.get(interval)!);
  const xs=driverOrder.map(driver=>intervals.map(interval=>features.get(driver)!.get(interval)!));
  return {driverOrder:[...driverOrder], covariance:xs.map(x=>xs.map(y=>covariance(x,y))),
    assetCovariances:xs.map(x=>covariance(a,x)), assetVariance:covariance(a,a),
    observations:intervals.length,startDate:intervals[0].slice(0,10),endDate:intervals.at(-1)!.slice(11),
    returnUnits:'percentage_points',treasuryUnits:'basis_points'};
}

// Pivot on a correlation-scaled system so percentage returns and yield bps do
// not create a numerical condition problem solely because their units differ.
function solve(matrix:number[][],vector:number[]):number[] {
  const n=vector.length;
  const a=matrix.map((row,i)=>[...row,vector[i]]);
  for(let col=0;col<n;col++) {
    let pivot=col;
    for(let row=col+1;row<n;row++) if(Math.abs(a[row][col])>Math.abs(a[pivot][col])) pivot=row;
    if(!Number.isFinite(a[pivot][col])||Math.abs(a[pivot][col])<1e-8) throw new Error('The selected drivers cannot be separated reliably in the available history. Use fewer drivers.');
    [a[col],a[pivot]]=[a[pivot],a[col]];
    const divisor=a[col][col];
    for(let j=col;j<=n;j++) a[col][j]/=divisor;
    for(let row=0;row<n;row++) if(row!==col) {
      const factor=a[row][col];
      for(let j=col;j<=n;j++) a[row][j]-=factor*a[col][j];
    }
  }
  return a.map(row=>row[n]);
}
export function validateScenarioDrivers(drivers:ScenarioDrivers):ScenarioDriver[] {
  if(!drivers||typeof drivers!=='object'||Array.isArray(drivers)) throw new Error('Scenario drivers must be an object.');
  for(const [key,value] of Object.entries(drivers)) {
    if(!SCENARIO_DRIVER_ORDER.includes(key as ScenarioDriver)) throw new Error(`Unsupported scenario driver: ${key}.`);
    const limits=SCENARIO_DRIVER_LIMITS[key as ScenarioDriver];
    if(!Number.isFinite(value)||value<limits.min||value>limits.max) throw new Error(`${key} must be between ${limits.min} and ${limits.max} ${key==='treasury10y'?'bps':'percentage points'}.`);
  }
  return SCENARIO_DRIVER_ORDER.filter(driver=>Object.prototype.hasOwnProperty.call(drivers,driver));
}
export function estimateScenario(ticker:string,model:HistoricalScenarioModel|undefined,drivers:ScenarioDrivers) {
  const selected=validateScenarioDrivers(drivers);
  if(!selected.length) throw new Error('At least one measured scenario driver is required.');
  if(!model) throw new Error(`${ticker}: a measured historical scenario response is unavailable.`);
  if(model.observations<126||model.returnUnits!=='percentage_points'||model.treasuryUnits!=='basis_points') throw new Error(`${ticker}: historical scenario calibration is invalid or too short.`);
  const indices=selected.map(driver=>{
    const index=model.driverOrder.indexOf(driver);
    if(index<0) throw new Error(`${ticker}: measured ${driver} history is unavailable. Choose a supported scenario.`);
    return index;
  });
  const covarianceMatrix=indices.map(i=>indices.map(j=>model.covariance[i]?.[j]));
  const variances=indices.map((i,n)=>covarianceMatrix[n][n]);
  if(variances.some(v=>!Number.isFinite(v)||v<=1e-12)) throw new Error(`${ticker}: selected driver history has no usable variation.`);
  const scales=variances.map(Math.sqrt);
  const correlation=covarianceMatrix.map((row,i)=>row.map((v,j)=>v/scales[i]/scales[j]));
  const covariances=indices.map((i,n)=>model.assetCovariances[i]/scales[n]);
  if(covariances.some(v=>!Number.isFinite(v))||correlation.some(row=>row.some(v=>!Number.isFinite(v)))) throw new Error(`${ticker}: invalid historical scenario covariance.`);
  const standardized=selected.map((driver,i)=>drivers[driver]!/scales[i]);
  const coefficients=solve(correlation,covariances);
  const shockPct=coefficients.reduce((sum,c,i)=>sum+c*standardized[i],0)/100;
  if(!Number.isFinite(shockPct)||shockPct < -1-1e-10) throw new Error(`${ticker}: the historical linear response extrapolates below -100%. Reduce the shock or specify a direct holding change.`);
  const inverseShock=solve(correlation,standardized);
  const mahalanobis=Math.sqrt(Math.max(0,standardized.reduce((sum,x,i)=>sum+x*inverseShock[i],0)));
  const explained=covariances.reduce((sum,c,i)=>sum+c*coefficients[i],0);
  const rSquared=model.assetVariance>1e-12?Math.max(0,Math.min(1,explained/model.assetVariance)):0;
  return {shockPct:Math.max(-1,shockPct),rSquared,extrapolated:mahalanobis>3,
    observations:model.observations,startDate:model.startDate,endDate:model.endDate};
}
