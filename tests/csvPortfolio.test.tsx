import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {buildCsvPositions,csvMappingErrors,MAX_CSV_BYTES,MAX_CSV_ROWS,parsePortfolioCsv,parseUsdCents,readPortfolioCsvFile,reviewPortfolioCsv,suggestCsvMapping} from '../src/utils/csvPortfolio';
import {applyHistoricalSnapshot,type RiskSnapshot} from '../src/utils/riskSnapshot';
import {calculatePortfolioRisk} from '../src/utils/quantEngine';
import {validateSavedPortfolio,parsePortfolioLibrary,emptyLibrary} from '../src/utils/savedPortfolios';
import {createWorkspaceSettings} from '../src/utils/workspaceSettings';
import {CsvImportDialog} from '../src/components/CsvImportDialog';
import {PortfolioSetup} from '../src/components/PortfolioSetup';
import {PortfolioSnapshot} from '../src/components/PortfolioSnapshot';
import type {ListedSymbol} from '../src/utils/symbolDirectory';
import {buildAllocationPositions,createAllocationInputs} from '../src/utils/portfolioSetupInputs';

const symbols:ListedSymbol[]=[{ticker:'SPY',name:'S&P fund',kind:'ETF',exchange:''},{ticker:'BND',name:'Bond fund',kind:'ETF',exchange:''},{ticker:'GLD',name:'Gold fund',kind:'ETF',exchange:''}];
const covered=new Set(symbols.map(symbol=>symbol.ticker));
const parse=(raw:string)=>{const table=parsePortfolioCsv(raw),mapping=suggestCsvMapping(table.headers);return {table,mapping,review:reviewPortfolioCsv(table,mapping,covered,symbols)};};

const original='\uFEFFAccount Number,Ticker,Description,Market Value,Currency\r\nprivate-account, spy ,"S&P, \"\"500\"\"\r\nFund","$12,000.01",USD\r\nprivate-account,BND,Fund,7999.99,usd\r\nprivate-account,SPY,Fund,0.03,USD\r\n\r\n';
const {table,mapping,review}=parse(original);
assert.equal(table.rows.length,3);assert.equal(table.blankRows,1);
assert.deepEqual(table.rows.map(row=>row.line),[2,4,5]);
assert.equal(table.rows[0].cells[2],'S&P, "500"\r\nFund');
assert.equal(review.canImport,true);assert.equal(review.totalCents,2000003);
assert.deepEqual(review.duplicateTickers,['SPY']);
assert.throws(()=>buildCsvPositions(table,mapping,covered,symbols,false),/Confirm combining/);
const imported=buildCsvPositions(table,mapping,covered,symbols,true);
assert.equal(imported.total,20000.03);
assert.deepEqual(imported.positions.map(p=>[p.ticker,p.investment]),[['SPY',12000.04],['BND',7999.99]]);
assert.ok(Math.abs(imported.positions.reduce((sum,p)=>sum+p.weight,0)-1)<1e-12);
assert.ok(!JSON.stringify(imported.positions).includes('private-account'));
assert.ok(!JSON.stringify(imported.positions).includes('Description'));
assert.equal(imported.positions[0].name,'S&P fund','use public directory names, never raw account descriptions');
assert.throws(()=>buildCsvPositions(table,mapping,new Set(['SPY']),symbols,true),/Resolve every row/,'coverage must be rechecked when applying the import');

for(const [raw,cents] of [['$1,234.56',123456],['USD 100.5',10050],['0.01',1],['($1.00)',-100],['-$1.00',-100],['$-1.00',-100],['+10',1000],['1000000000000',1e14]] as const) assert.equal(parseUsdCents(raw),cents,raw);
for(const raw of ['1,23','1.000,00','1,2345','1.234','1e3','10%','12 dollars','€100','CAD 100','=$100','--1','+-1','(+1)','$','Infinity','NaN','1000000000000.01','']) assert.equal(parseUsdCents(raw),null,raw);

for(const raw of ['Ticker,Value\nSPY,"100','Ticker,Value\nSPY,10"0','Ticker,Value\nSPY,"10"suffix','Ticker,TICKER\nSPY,100','Ticker,\nSPY,100','SPY,100','\u0000Ticker,Value\nSPY,100']) assert.throws(()=>parsePortfolioCsv(raw));
assert.throws(()=>parsePortfolioCsv(`Ticker,Value\n${'SPY,100\n'.repeat(MAX_CSV_ROWS+1)}`),/1000/);
assert.throws(()=>parsePortfolioCsv('a'.repeat(MAX_CSV_BYTES+1)),/1 MB/);
assert.throws(()=>parsePortfolioCsv('é'.repeat(MAX_CSV_BYTES/2+1)),/1 MB/,'the size limit counts UTF-8 bytes');
assert.equal(parse('Ticker,Value\rSPY,100\rBND,100').review.canImport,true);

const blockedRows=[
  ['SPY,',/USD market value/],['SPY,0',/positive/],['SPY,-100',/short positions/],
  ['CASH,100',/Cash/],['SPAXX**,100',/money-market/],['AMTD,100',/unavailable/],
  ['SPY 261023C00100000,100',/stock or ETF/],['=SPY,100',/stock or ETF/],
  [',100',/Missing ticker/],['SPY,100,extra',/columns/],
] as const;
for(const [row,reason] of blockedRows){
  const parsed=parse(`Ticker,Market Value\nBND,100\n${row}`);
  assert.equal(parsed.review.rows.length,2,'unresolved rows cannot disappear');
  assert.equal(parsed.review.canImport,false,row);
  assert.match(parsed.review.rows[1].issues.join(' '),reason);
  assert.throws(()=>buildCsvPositions(parsed.table,parsed.mapping,covered,symbols,true),/Resolve every row/);
}
const footer=parse('Ticker,Market Value\nSPY,100\nAccount Total,100');
assert.equal(footer.review.canImport,false,'a total/footer must not be treated as a position or silently skipped');
assert.equal(parse('Ticker,Market Value,Currency\nSPY,100,EUR').review.canImport,false);
assert.equal(parse('Ticker,Market Value,Currency\nSPY,100,EUR\nBND,100,USD').review.completeTotal,false,'mixed currencies cannot be presented as a USD portfolio total');
assert.equal(parse('Ticker,Market Value,Currency\nSPY,100,').review.canImport,false);
assert.equal(parse('Ticker,Market Value,Currency,Local Currency\nSPY,100,USD,CAD').review.canImport,false);
for(const kind of ['Option','Bond','Mutual Fund','Cash','Crypto','']) assert.equal(parse(`Ticker,Market Value,Security Type\nSPY,100,${kind}`).review.canImport,false,'an option underlying must never be imported as the stock/ETF itself');
for(const kind of ['Stock','Equity','Common Stock','ETF','Exchange Traded Fund']) assert.equal(parse(`Ticker,Market Value,Security Type\nSPY,100,${kind}`).review.canImport,true);
assert.equal(reviewPortfolioCsv(parsePortfolioCsv('Ticker,Value\nSPY,100'),{ticker:0,value:1,currency:-1},covered,[{...symbols[0],kind:'Stock',name:'Example Corporation Warrants'}]).canImport,false);
assert.ok(csvMappingErrors(['Ticker','Market Value','Currency'],{ticker:0,value:1,currency:-1}).length);
for(const valueHeader of ['Cost Basis','Quantity','Shares','Last Price','Weight (%)','Gain/Loss','Yield','Account Number','CUSIP']) {
  assert.ok(csvMappingErrors(['Ticker',valueHeader],{ticker:0,value:1,currency:-1}).length,valueHeader);
}
assert.ok(csvMappingErrors(['Ticker','Market Value'],{ticker:0,value:0,currency:-1}).length);
assert.equal(suggestCsvMapping(['Ticker','Current Value','Market Value']).value,-1,'ambiguous values require a manual mapping');
assert.equal(reviewPortfolioCsv(table,mapping,covered,symbols,false).canImport,false);
const many=parsePortfolioCsv('Ticker,Value\n'+Array.from({length:31},(_,i)=>`EX${i},100`).join('\n'));
assert.equal(reviewPortfolioCsv(many,suggestCsvMapping(many.headers),new Set(Array.from({length:31},(_,i)=>`EX${i}`)),symbols).canImport,false);

// Keep exact amounts through the real calibration/save/restore path. The
// current risk model is recalculated rather than imported from any CSV column.
const snapshot:RiskSnapshot=JSON.parse(readFileSync(new URL('../public/models/historical-snapshot.json',import.meta.url),'utf8'));
for(const part of snapshot.parts??[])Object.assign(snapshot.symbols,JSON.parse(readFileSync(new URL(`../public/models/${part}`,import.meta.url),'utf8')));
const calibrated=applyHistoricalSnapshot(imported.positions,snapshot);
assert.deepEqual(calibrated.map(p=>p.investment),[12000.04,7999.99]);
const allocationInputs=createAllocationInputs(calibrated,imported.total);
assert.deepEqual(buildAllocationPositions(allocationInputs,imported.total,imported.total).map(p=>p.investment),[12000.04,7999.99],'opening Edit and reanalyzing cannot round imported amounts or total');
assert.equal(buildAllocationPositions(allocationInputs.map(row=>({...row,allocation:'50'})),20000,imported.total)[0].investment,10000,'edited allocations use their new values');
assert.equal(buildAllocationPositions(allocationInputs,imported.total*2,imported.total)[0].investment,imported.total*2*Number(allocationInputs[0].allocation)/100,'a changed total scales the entered weights');
assert.ok(calibrated.every(p=>p.historicalModel&&!p.riskProxyTicker));
assert.ok(Number.isFinite(calculatePortfolioRisk(calibrated).annualizedVolatility));
const saved=validateSavedPortfolio({id:'imported',name:'Imported portfolio',createdAt:'2026-10-26T12:00:00Z',updatedAt:'2026-10-26T12:00:00Z',valuationDate:'2026-10-23',currency:'USD',holdings:calibrated,settings:createWorkspaceSettings(),modelContext:{asOf:snapshot.asOf,capturedAt:snapshot.capturedAt}});
assert.deepEqual(parsePortfolioLibrary(JSON.stringify({...emptyLibrary(),portfolios:[saved]})).portfolios[0].holdings.map(p=>p.investment),[12000.04,7999.99]);
const preview=renderToStaticMarkup(<PortfolioSnapshot positions={calibrated} isSample={false} onEdit={()=>{}} onNewSample={()=>{}} loading={false}/>);
assert.ok(preview.includes('60.0%'));assert.ok(preview.includes('40.0%'));

// RiskLab's own holdings export is accepted; price and weight are not mistaken
// for the invested dollars, and its old model metadata is not loaded as input.
const exported=parse('Ticker,Name,Asset Class,Price,Investment ($),Weight (%),Risk Proxy,Risk Model,Data Through\nSPY,"S&P fund",US Large Cap,100,10000.01,60,,Historical snapshot,2026-10-23\nBND,Fund,Fixed Income,50,3333.33,40,,Historical snapshot,2026-10-23');
assert.equal(exported.review.totalCents,1333334);assert.equal(exported.review.canImport,true);
const unsupported=parse('Ticker,Value\nBRK.B,100');
assert.equal(unsupported.review.canImport,false,'class/share tickers are never guessed or silently rewritten');

const file=new File(['Ticker,Market Value\nSPY,100'],'holdings.csv',{type:'text/csv'});
assert.equal(await readPortfolioCsvFile(file),'Ticker,Market Value\nSPY,100');
await assert.rejects(readPortfolioCsvFile(new File(['data'],'holdings.xlsx')),/\.csv/);
await assert.rejects(readPortfolioCsvFile(new File([new Uint8Array([0xff,0xfe,0x00])],'holdings.csv')),/UTF-8/);
await assert.rejects(readPortfolioCsvFile(new File(['a'.repeat(MAX_CSV_BYTES+1)],'holdings.csv')),/1 MB/);
const dialog=renderToStaticMarkup(<CsvImportDialog open onClose={()=>{}} covered={covered} snapshotAsOf="2026-10-23" modelError="" onRetrySnapshot={()=>{}} replacesOpen={false} onImport={()=>null}/>);
assert.ok(dialog.includes('Portfolio CSV file'));assert.ok(dialog.includes('Paste CSV instead'));assert.ok(dialog.includes('not uploaded'));
const setup=renderToStaticMarkup(<PortfolioSetup onImportCsv={()=>{}} onAnalyze={()=>{}} onUseSample={()=>{}} historicalTickers={covered} onRetrySnapshot={()=>{}}/>);
assert.ok(setup.includes('Import CSV'));
console.log('CSV quoting, exact-cent reconciliation, mapping, coverage, duplicates, privacy and save/restore checks passed.');
