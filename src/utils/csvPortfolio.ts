import type {ListedSymbol} from './symbolDirectory';
import {createListedPosition} from './symbolDirectory';

export const MAX_CSV_BYTES=1024*1024;
export const MAX_CSV_ROWS=1000;
const MAX_CENTS=1e14; // $1 trillion, within exact integer arithmetic.
export interface CsvTable {headers:string[];rows:{line:number;cells:string[]}[];blankRows:number}
export interface CsvMapping {ticker:number;value:number;currency:number}
export interface CsvReviewRow {line:number;ticker:string;rawValue:string;cents:number|null;currency:string;usd:boolean;issues:string[]}
export interface CsvHolding {ticker:string;name:string;cents:number;lines:number[]}
export interface CsvReview {rows:CsvReviewRow[];holdings:CsvHolding[];errors:string[];totalCents:number;completeTotal:boolean;duplicateTickers:string[];canImport:boolean}
const headerKey=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const currencyHeaders=new Set(['currency','currencycode','ccy','localcurrency','marketvaluecurrency']);
const securityHeaders=new Set(['securitytype','instrumenttype','assettype']);
const supportedTypes=new Set(['stock','stocks','equity','equities','commonstock','etf','exchangetradedfund']);
const forbiddenValueHeader=/(cost|basis|quantity|shares|price|gain|loss|percent|weight|change|proceeds|yield|account|routing|cusip|isin|identifier)/i;

// Commas, doubled quotes and embedded newlines follow RFC 4180. LF/CR files and
// a UTF-8 BOM are also accepted. Only entirely empty records are skipped.
export function parsePortfolioCsv(raw:string):CsvTable {
  if(new TextEncoder().encode(raw).length>MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 1 MB.');
  const text=raw.replace(/^\uFEFF/,'');
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\uFFFD]/.test(text)) throw new Error('Use a UTF-8 text CSV, not an Excel workbook or binary file.');
  const records:{line:number;cells:string[]}[]=[];
  let cells:string[]=[],field='',quoted=false,closed=false,line=1,start=1,blankRows=0;
  const endField=()=>{cells.push(field);field='';closed=false;if(cells.length>100)throw new Error('CSV files support up to 100 columns.');};
  const endRecord=()=>{
    endField();
    if(cells.every(cell=>!cell.trim())) blankRows++;
    else records.push({line:start,cells});
    if(records.length>MAX_CSV_ROWS+1) throw new Error(`CSV files support up to ${MAX_CSV_ROWS} holding rows.`);
    cells=[];
  };
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(quoted) {
      if(char==='"') {if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else {field+=char;if(char==='\n'||(char==='\r'&&text[i+1]!=='\n'))line++;}
    } else if(char===',') endField();
    else if(char==='\r'||char==='\n') {endRecord();if(char==='\r'&&text[i+1]==='\n')i++;line++;start=line;}
    else if(char==='"'&&!field&&!closed) quoted=true;
    else {
      if(closed||char==='"') throw new Error(`Malformed quotes near CSV line ${line}. Check the CSV export.`);
      field+=char;
    }
    if(field.length>4096) throw new Error(`A field near CSV line ${line} is too long.`);
  }
  if(quoted) throw new Error('An opening quote is missing its closing quote. Check the CSV export.');
  if(field||cells.length||closed) endRecord();
  if(records.length<2) throw new Error('Include a header row and at least one holding row.');
  const headers=records[0].cells.map(cell=>cell.trim());
  if(headers.length<2||headers.some(header=>!header||header.length>120)||new Set(headers.map(headerKey)).size!==headers.length) {
    throw new Error('The first nonempty row must contain unique column names. Remove report titles or repeated headers before importing.');
  }
  return {headers,rows:records.slice(1),blankRows};
}

export async function readPortfolioCsvFile(file:File):Promise<string> {
  if(!/\.csv$/i.test(file.name)) throw new Error('Choose a .csv file. Export Excel workbooks as UTF-8 CSV first.');
  if(file.size>MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 1 MB.');
  try {return new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}
  catch {throw new Error('The file could not be read as UTF-8. Export it as UTF-8 CSV and try again.');}
}

export function suggestCsvMapping(headers:string[]):CsvMapping {
  const find=(keys:string[])=>{
    const candidates=headers.flatMap((header,index)=>keys.includes(headerKey(header))?[index]:[]);
    return candidates.length===1?candidates[0]:-1;
  };
  return {ticker:find(['ticker','symbol','tickersymbol','securitysymbol']),
    value:find(['marketvalue','currentvalue','marketvalueusd','currentvalueusd','investment','investmentusd','value']),
    currency:find([...currencyHeaders])};
}

export function csvMappingErrors(headers:string[],mapping:CsvMapping):string[] {
  const errors:string[]=[];
  const valid=(index:number)=>Number.isInteger(index)&&index>=0&&index<headers.length;
  if(!valid(mapping.ticker)||!valid(mapping.value)) errors.push('Choose the ticker and current USD market-value columns.');
  if(mapping.currency!==-1&&!valid(mapping.currency)) errors.push('Choose a valid currency column.');
  const columns=[mapping.ticker,mapping.value,mapping.currency].filter(index=>index>=0);
  if(new Set(columns).size!==columns.length) errors.push('Use a different column for each field.');
  if(valid(mapping.value)&&forbiddenValueHeader.test(headers[mapping.value])) errors.push('Use current market values, not cost basis, quantity, price, gains, weights or account identifiers.');
  if(mapping.currency===-1&&headers.some(header=>currencyHeaders.has(headerKey(header)))) errors.push('This file has a currency column. Map it so each row can be checked.');
  return errors;
}

// Convert decimal text to integer cents without parseFloat truncation or
// interpreting quantity, percentages, formulas or European separators as USD.
export function parseUsdCents(raw:string):number|null {
  let text=raw.trim(),negative=false;
  if(text.startsWith('(')&&text.endsWith(')')) {negative=true;text=text.slice(1,-1).trim();}
  const match=/^([+-])?\s*(?:USD\s*|\$\s*)?([+-])?((?:\d{1,3}(?:,\d{3})+|\d+))(?:\.(\d{1,2}))?$/i.exec(text);
  if(!match||(match[1]&&match[2])||(negative&&(match[1]||match[2]))) return null;
  const cents=Number(match[3].replace(/,/g,''))*100+Number((match[4]??'').padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents>MAX_CENTS) return null;
  return negative||match[1]==='-'||match[2]==='-'?-cents:cents;
}

const cashTicker=/^(CASH|USD|US DOLLAR|FCASH|SPAXX|FDRXX|SPRXX|SWVXX|VMFXX|FZFXX)(\*\*)?$/;
export function reviewPortfolioCsv(table:CsvTable,mapping:CsvMapping,covered:Set<string>,symbols:ListedSymbol[],coverageReady=true):CsvReview {
  const errors=csvMappingErrors(table.headers,mapping);
  const names=new Map(symbols.map(symbol=>[symbol.ticker,symbol.name]));
  const directory=new Map(symbols.map(symbol=>[symbol.ticker,symbol]));
  const groups=new Map<string,CsvHolding>();
  let totalCents=0;
  const rows:CsvReviewRow[]=table.rows.map(row=>{
    const ticker=(row.cells[mapping.ticker]??'').trim().toUpperCase();
    const rawValue=(row.cells[mapping.value]??'').trim();
    const cents=parseUsdCents(rawValue);
    const currency=mapping.currency===-1?'USD':(row.cells[mapping.currency]??'').trim().toUpperCase();
    const usd=currency==='USD'&&table.headers.every((header,index)=>!currencyHeaders.has(headerKey(header))||(row.cells[index]??'').trim().toUpperCase()==='USD');
    const issues:string[]=[];
    if(row.cells.length!==table.headers.length) issues.push(`Expected ${table.headers.length} columns; found ${row.cells.length}.`);
    if(!ticker) issues.push('Missing ticker.');
    else if(cashTicker.test(ticker)||/CASH|MONEY MARKET|SWEEP/.test(ticker)) issues.push('Cash-like labels are ambiguous. Cash and money-market balances are not supported in this import; verify the intended security.');
    else if(!/^[A-Z0-9][A-Z0-9.\-]{0,9}$/.test(ticker)) issues.push('Not a supported stock or ETF ticker.');
    else if(!coverageReady) issues.push('Waiting for historical coverage.');
    else if(!covered.has(ticker)) issues.push('Historical model unavailable. No substitute will be used.');
    const symbol=directory.get(ticker);
    if(symbol?.kind==='Stock'&&/\b(warrants?|rights?|units?|debentures?|notes)\b/i.test(symbol.name)) issues.push('This listed instrument is not a supported stock or ETF holding.');
    if(table.headers.some((header,index)=>securityHeaders.has(headerKey(header))&&!supportedTypes.has(headerKey(row.cells[index]??'')))) issues.push('The security-type column contains an unsupported or missing type. Only stock/equity and ETF rows are supported.');
    if(cents===null) issues.push('Enter a USD market value with at most two decimal places.');
    else if(cents<=0) issues.push('Values must be positive. Zero balances and short positions are not supported.');
    if(currency!=='USD') issues.push('Only USD is supported; a missing currency or another currency must be resolved.');
    // Check every recognized currency field, even if a different one was mapped.
    if(!usd&&currency==='USD') issues.push('Another currency column is missing USD or contains a different currency. Resolve it before importing.');
    if(cents!==null) totalCents+=cents;
    if(ticker&&cents!==null&&cents>0) {
      const group=groups.get(ticker)??{ticker,name:names.get(ticker)??ticker,cents:0,lines:[]};
      group.cents+=cents;group.lines.push(row.line);groups.set(ticker,group);
    }
    return {line:row.line,ticker,rawValue,cents,currency,usd,issues};
  });
  const holdings=[...groups.values()];
  if(!coverageReady) errors.push('Historical models must finish loading before import.');
  if(!rows.length) errors.push('There are no holding rows.');
  if(holdings.length>30) errors.push('RiskLab supports up to 30 distinct holdings. No rows will be dropped.');
  if(!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>MAX_CENTS||holdings.some(holding=>holding.cents>MAX_CENTS)) errors.push('The total must be positive and no more than $1 trillion.');
  const duplicateTickers=holdings.filter(holding=>holding.lines.length>1).map(holding=>holding.ticker);
  const completeTotal=rows.every(row=>row.cents!==null&&row.usd)&&Number.isSafeInteger(totalCents);
  return {rows,holdings,errors,totalCents,completeTotal,duplicateTickers,canImport:!errors.length&&rows.every(row=>!row.issues.length)};
}

// Rebuild the review at application time; callers cannot bypass unresolved rows
// by submitting only a valid subset or an old coverage review.
export function buildCsvPositions(table:CsvTable,mapping:CsvMapping,covered:Set<string>,symbols:ListedSymbol[],combineDuplicates:boolean) {
  const review=reviewPortfolioCsv(table,mapping,covered,symbols);
  if(!review.canImport) throw new Error('Resolve every row before importing. No holdings have been changed.');
  if(review.duplicateTickers.length&&!combineDuplicates) throw new Error('Confirm combining the repeated tickers before importing.');
  const directory=new Map(symbols.map(symbol=>[symbol.ticker,symbol]));
  return {total:review.totalCents/100,positions:review.holdings.map(holding=>createListedPosition(
    directory.get(holding.ticker)??{ticker:holding.ticker,name:holding.name,kind:'Stock',exchange:''},
    holding.cents/100,holding.cents/review.totalCents,undefined,true)),review};
}
