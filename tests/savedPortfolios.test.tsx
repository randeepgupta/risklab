import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyHistoricalSnapshot,type RiskSnapshot} from '../src/utils/riskSnapshot';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PortfolioLibraryDialog} from '../src/components/PortfolioLibraryDialog';
import {MonteCarloView} from '../src/components/MonteCarloView';
import {StressTestingView} from '../src/components/StressTestingView';
import {createWorkspaceSettings} from '../src/utils/workspaceSettings';
import {scenarioControlsReducer,scenarioFromControls} from '../src/utils/scenarioControls';
import {emptyLibrary,mergePortfolioLibraries,parsePortfolioLibrary,PORTFOLIO_STORAGE_KEY,readPortfolioLibrary,validateSavedPortfolio,workspaceFingerprint,writePortfolioLibrary,type PortfolioStorage} from '../src/utils/savedPortfolios';
import type {SavedPortfolio} from '../src/types/workspace';

const settings=createWorkspaceSettings();
settings.activeTab='stress';
settings.future={annualReturn:.08,horizonYears:20,simulations:5000,returnPeriod:'month'};
settings.scenario.prompt='Only SPY falls 10%, all other holdings unchanged';
settings.scenario.hasResult=true;
settings.scenario.controls.source={id:'test',name:'SPY falls 10%',description:'Explicit assumption.',category:'custom',drivers:{},tickerShocks:{SPY:-.1}};
settings.scenario.controls.tickerOverrides={SPY:-.1};
settings.scenario.controls=scenarioControlsReducer(settings.scenario.controls,{type:'ticker',ticker:'NVDA',value:0});
const saved:SavedPortfolio={id:'one',name:'Retirement',createdAt:'2026-10-25T12:00:00Z',updatedAt:'2026-10-26T12:00:00Z',valuationDate:'2026-10-26',currency:'USD',
  holdings:[{ticker:'SPY',name:'S&P fund',investment:60000},{ticker:'NVDA',name:'NVIDIA',investment:40000}],settings,
  modelContext:{asOf:'2026-10-23',capturedAt:'2026-10-25T12:00:00Z',sourceRevision:'source-one'}};
const library={...emptyLibrary(),portfolios:[saved]};
class MemoryStorage implements PortfolioStorage {
  data=new Map<string,string>(); blocked=false;
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){if(this.blocked)throw new Error('Quota exceeded');this.data.set(key,value);}
  removeItem(key:string){this.data.delete(key);}
}
const storage=new MemoryStorage();
assert.deepEqual(readPortfolioLibrary(storage),emptyLibrary());
const written=writePortfolioLibrary(storage,library);
const resumed=readPortfolioLibrary(storage).portfolios[0];
assert.deepEqual(resumed.settings.future,settings.future);
assert.deepEqual(scenarioFromControls(resumed.settings.scenario.controls).tickerShocks,{SPY:-.1,NVDA:0});
assert.deepEqual(scenarioFromControls(scenarioControlsReducer(resumed.settings.scenario.controls,{type:'reset'})).tickerShocks,{SPY:-.1},'reset must restore the original submitted scenario after reload');
assert.equal(workspaceFingerprint(saved),workspaceFingerprint(resumed),'saving must not immediately appear dirty due to JSON key order');
assert.notEqual(workspaceFingerprint({...saved,holdings:[{...saved.holdings[0],investment:60001},saved.holdings[1]]}),workspaceFingerprint(resumed));
const backup=JSON.stringify(written);
storage.blocked=true;
assert.throws(()=>writePortfolioLibrary(storage,{...library,portfolios:[]}),/Quota/);
assert.equal(storage.getItem(PORTFOLIO_STORAGE_KEY),backup,'failed writes must preserve the previous library');
storage.blocked=false;
storage.setItem(PORTFOLIO_STORAGE_KEY,'{"app":"RiskLab","schemaVersion":2,"portfolios":[]}');
assert.throws(()=>readPortfolioLibrary(storage),/Unsupported backup version/);
assert.equal(JSON.parse(storage.getItem(PORTFOLIO_STORAGE_KEY)!).schemaVersion,2,'unknown versions must not be overwritten during read');
storage.setItem(PORTFOLIO_STORAGE_KEY,'broken JSON');
assert.throws(()=>readPortfolioLibrary(storage),/preserved/);
assert.equal(storage.getItem(PORTFOLIO_STORAGE_KEY),'broken JSON');
assert.throws(()=>parsePortfolioLibrary('x'.repeat(1024*1024+1)),/1 MB/);
for(const bad of [
  {...saved,currency:'EUR'}, {...saved,holdings:[{...saved.holdings[0],investment:NaN}]},
  {...saved,holdings:[{...saved.holdings[0],investment:-1}]}, {...saved,holdings:[saved.holdings[0],{...saved.holdings[0],ticker:'spy'}]},
  {...saved,valuationDate:'2026-02-30'}, {...saved,settings:{...settings,future:{...settings.future,annualReturn:1}}},
  {...saved,settings:{...settings,scenario:{...settings.scenario,controls:{...settings.scenario.controls,factors:{market:-1000}}}}},
]) assert.throws(()=>validateSavedPortfolio(bad));
const sanitized=validateSavedPortfolio({...saved,accountNumber:'private-field',holdings:saved.holdings.map(p=>({...p,price:99,historicalModel:{secret:'do not store'}}))});
assert.ok(!JSON.stringify(sanitized).includes('private-field'));
assert.ok(!JSON.stringify(sanitized).includes('historicalModel'));
const merged=mergePortfolioLibraries(library,parsePortfolioLibrary(backup),()=> 'copy-id');
assert.equal(merged.portfolios.length,2);
assert.equal(merged.portfolios[0].id,'one');assert.equal(merged.portfolios[1].id,'copy-id');
assert.equal(merged.portfolios[1].name,'Retirement (copy)');
const unsupported=validateSavedPortfolio({...saved,holdings:[{ticker:'AMTD',name:'Saved but currently unavailable',investment:100000}]});
assert.equal(unsupported.holdings[0].ticker,'AMTD','stored input must survive current coverage changes; recalibration is a separate resume step');
const snapshot:RiskSnapshot=JSON.parse(readFileSync(new URL('../public/models/historical-snapshot.json',import.meta.url),'utf8'));
const unavailableInputs=unsupported.holdings.map(p=>({...p,price:0,weight:1,assetClass:'Other' as const}));
assert.throws(()=>applyHistoricalSnapshot(unavailableInputs,snapshot),/AMTD is not covered/);
assert.equal(unavailableInputs.length,1);assert.equal(unavailableInputs[0].investment,100000,'failed recalibration must keep the allocation rather than dropping a holding');
const future=renderToStaticMarkup(<MonteCarloView initialValue={100000} volatility={0} settings={resumed.settings.future}/>);
assert.ok(future.includes('8.00%'));assert.ok(future.includes('20 years'));assert.ok(future.includes('5,000 paths'));
const positions=saved.holdings.map(p=>({...p,price:0,weight:p.investment/100000,assetClass:'Other' as const}));
const stress=renderToStaticMarkup(<StressTestingView positions={positions} session={resumed.settings.scenario}/>);
assert.ok(stress.includes('Only SPY falls 10%'));
assert.ok(stress.includes('$6,000'));
assert.ok(stress.includes('NVDA override: 0.0%'));
const dialog=renderToStaticMarkup(<PortfolioLibraryDialog open onClose={()=>{}} library={library} error="" blocked={false} message="" loading={false} onSave={()=>{}} onResume={()=>{}} onDelete={()=>{}} onRestore={()=>true} onClear={()=>{}} onRetry={()=>{}} onConfirmResume={()=>{}}/>);
assert.ok(dialog.includes('Values as of 2026-10-26'));
assert.ok(dialog.includes('Model data through 2026-10-23'));
console.log('Saved portfolio schema, restore, settings, privacy, conflicts and failed storage checks passed.');
