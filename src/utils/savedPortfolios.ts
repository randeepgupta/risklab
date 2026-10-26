import type {PortfolioLibrary, SavedPortfolio, WorkspaceSettings} from '../types/workspace';
import type {StressScenario} from '../types/risk';
import {validateScenarioDrivers} from './measuredScenario';

export const PORTFOLIO_STORAGE_KEY = 'risklab.saved-portfolios.v1';
export const MAX_SAVED_PORTFOLIOS = 50;
export const MAX_BACKUP_BYTES = 1024 * 1024;
export const emptyLibrary = (): PortfolioLibrary => ({app:'RiskLab',schemaVersion:1,portfolios:[]});
export interface PortfolioStorage {getItem(key:string):string|null; setItem(key:string,value:string):void; removeItem(key:string):void}
const fail = (message='This backup contains invalid portfolio inputs.'): never => {throw new Error(message);};
const record = (x:unknown):Record<string,any> => x && typeof x==='object' && !Array.isArray(x) ? x as Record<string,any> : fail();
const string = (x:unknown,max:number,empty=false):string => typeof x==='string' && x.length<=max && (empty||!!x.trim()) ? x : fail();
const number = (x:unknown,min:number,max:number):number => typeof x==='number' && Number.isFinite(x) && x>=min && x<=max ? x : fail();
const bool = (x:unknown):boolean => typeof x==='boolean' ? x : fail();
function dateOnly(x:unknown) {
  const value=string(x,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) fail('Invalid allocation or model date in backup.');
  return value;
}
function timestamp(x:unknown) {
  const value=string(x,40);
  if(!Number.isFinite(Date.parse(value))) fail('Invalid saved date in backup.');
  return value;
}
function ticker(x:unknown) {
  const value=string(x,10).toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9.\-]{0,9}$/.test(value)) fail('Invalid ticker in backup.');
  return value;
}
function shocks(x:unknown) {
  return Object.fromEntries(Object.entries(record(x)).map(([key,value])=>[ticker(key),number(value,-1,3)]));
}
function drivers(x:unknown) {
  const value=record(x);
  validateScenarioDrivers(value);
  return {...value};
}
function scenario(x:unknown):StressScenario {
  const value=record(x);
  if(!['custom','ai_generated','macro_factor','preset'].includes(value.category)) fail();
  return {id:string(value.id,120),name:string(value.name,160,true),description:string(value.description,2500,true),category:value.category,
    drivers:drivers(value.drivers??{}),tickerShocks:shocks(value.tickerShocks)};
}
export function validateSettings(input:unknown):WorkspaceSettings {
  const value=record(input), f=record(value.future), s=record(value.scenario), c=record(s.controls);
  if(!['risk','stress','monte-carlo'].includes(value.activeTab) || !['year','month'].includes(f.returnPeriod)
      || ![1,5,10,20,30].includes(f.horizonYears) || ![1000,2500,5000,10000].includes(f.simulations)) fail('Unsupported analysis settings in backup.');
  let source=null;
  if(s.source!==null) {
    const metadata=record(s.source);
    if(!['deterministic','fallback','cloudflare','gemini'].includes(metadata.provider)) fail();
    source={provider:metadata.provider,label:string(metadata.label,120)};
  }
  return {activeTab:value.activeTab,future:{annualReturn:number(f.annualReturn,-.1,.25),horizonYears:f.horizonYears,simulations:f.simulations,returnPeriod:f.returnPeriod},
    scenario:{prompt:string(s.prompt,2000,true),hasResult:bool(s.hasResult),explanation:s.explanation===null?null:string(s.explanation,2500,true),source,
      controls:{source:scenario(c.source),factors:drivers(c.factors),tickerOverrides:shocks(c.tickerOverrides),edited:bool(c.edited)}}};
}
export function validateSavedPortfolio(input:unknown):SavedPortfolio {
  const value=record(input), context=record(value.modelContext);
  if(value.currency!=='USD' || !Array.isArray(value.holdings) || value.holdings.length<1 || value.holdings.length>30) fail('A backup must contain 1–30 USD holdings per portfolio.');
  const holdings=value.holdings.map((raw:unknown)=>{
    const holding=record(raw);
    return {ticker:ticker(holding.ticker),name:string(holding.name,200),investment:number(holding.investment,.01,1e12)};
  });
  if(new Set(holdings.map(holding=>holding.ticker)).size!==holdings.length) fail('Duplicate tickers must be resolved before restoring a portfolio.');
  return {id:string(value.id,100),name:string(value.name,80).trim(),createdAt:timestamp(value.createdAt),updatedAt:timestamp(value.updatedAt),
    valuationDate:dateOnly(value.valuationDate),currency:'USD',holdings,settings:validateSettings(value.settings),
    modelContext:{asOf:dateOnly(context.asOf),capturedAt:timestamp(context.capturedAt),...(context.sourceRevision?{sourceRevision:string(context.sourceRevision,100)}:{})}};
}
export function parsePortfolioLibrary(raw:string):PortfolioLibrary {
  if(new TextEncoder().encode(raw).length>MAX_BACKUP_BYTES) fail('RiskLab backups must be smaller than 1 MB.');
  let value:Record<string,any>;
  try {value=record(JSON.parse(raw));} catch {return fail('This is not a valid RiskLab saved-portfolio backup. The original stored data has been preserved.');}
  if(value.app!=='RiskLab'||value.schemaVersion!==1) fail('Unsupported backup version. Use a RiskLab saved-portfolio backup (version 1); analysis exports are a different format.');
  if(!Array.isArray(value.portfolios)||value.portfolios.length>MAX_SAVED_PORTFOLIOS) fail(`A library supports up to ${MAX_SAVED_PORTFOLIOS} portfolios.`);
  const portfolios=value.portfolios.map(validateSavedPortfolio);
  if(new Set(portfolios.map(portfolio=>portfolio.id)).size!==portfolios.length) fail('Duplicate saved portfolio IDs in backup.');
  return {app:'RiskLab',schemaVersion:1,portfolios};
}
export function readPortfolioLibrary(storage:PortfolioStorage):PortfolioLibrary {
  const raw=storage.getItem(PORTFOLIO_STORAGE_KEY);
  return raw===null?emptyLibrary():parsePortfolioLibrary(raw);
}
export function writePortfolioLibrary(storage:PortfolioStorage,library:PortfolioLibrary):PortfolioLibrary {
  // Validate and serialize before touching storage; failed writes keep the previous library.
  const clean=parsePortfolioLibrary(JSON.stringify(library));
  storage.setItem(PORTFOLIO_STORAGE_KEY,JSON.stringify(clean));
  return clean;
}
export function mergePortfolioLibraries(current:PortfolioLibrary,incoming:PortfolioLibrary,newId:()=>string):PortfolioLibrary {
  const ids=new Set(current.portfolios.map(p=>p.id));
  const additions=incoming.portfolios.map(p=>{
    if(!ids.has(p.id)) {ids.add(p.id);return p;}
    const id=newId();
    if(ids.has(id)) return fail('Could not create a unique restored portfolio ID.');
    ids.add(id);
    return {...p,id,name:`${p.name.slice(0,73)} (copy)`};
  });
  return parsePortfolioLibrary(JSON.stringify({...current,portfolios:[...current.portfolios,...additions]}));
}
export function workspaceFingerprint(portfolio:Pick<SavedPortfolio,'name'|'valuationDate'|'holdings'|'settings'>):string {
  const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  return JSON.stringify(canonical({name:portfolio.name,valuationDate:portfolio.valuationDate,holdings:portfolio.holdings,settings:validateSettings(portfolio.settings)}));
}
