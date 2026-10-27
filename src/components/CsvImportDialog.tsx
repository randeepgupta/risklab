import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,FileSpreadsheet,Upload,X} from 'lucide-react';
import {buildCsvPositions,csvMappingErrors,parsePortfolioCsv,parseUsdCents,readPortfolioCsvFile,reviewPortfolioCsv,suggestCsvMapping,type CsvMapping,type CsvTable} from '../utils/csvPortfolio';
import {loadSymbolDirectory,type ListedSymbol} from '../utils/symbolDirectory';
import {formatDate,parseUSDate} from '../utils/dateFormat';
import {localDate} from '../utils/workspaceSettings';

const example='Ticker,Market Value,Currency\nSPY,65000.25,USD\nBND,29999.75,USD\nGLD,5000.00,USD';
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
const inputStyle='mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40';
export interface CsvImportRequest {table:CsvTable;mapping:CsvMapping;symbols:ListedSymbol[];combineDuplicates:boolean;name:string;valuationDate:string}

export function CsvImportDialog({open,onClose,covered,snapshotAsOf,modelError,onRetrySnapshot,replacesOpen,onImport}: {
  open:boolean;onClose:()=>void;covered:Set<string>;snapshotAsOf?:string;modelError:string;onRetrySnapshot:()=>void;
  replacesOpen:boolean;onImport:(request:CsvImportRequest)=>string|null;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const readGeneration=useRef(0);
  const [step,setStep]=useState<'choose'|'map'|'review'>('choose');
  const [table,setTable]=useState<CsvTable|null>(null);
  const [mapping,setMapping]=useState<CsvMapping>({ticker:-1,value:-1,currency:-1});
  const [symbols,setSymbols]=useState<ListedSymbol[]>([]);
  const [directoryError,setDirectoryError]=useState('');
  const [directoryAttempt,setDirectoryAttempt]=useState(0);
  const [error,setError]=useState('');
  const [reading,setReading]=useState(false);
  const [pasteOpen,setPasteOpen]=useState(false);
  const [paste,setPaste]=useState('');
  const [name,setName]=useState('Imported portfolio');
  const [date,setDate]=useState(()=>formatDate(localDate()));
  const [expectedTotal,setExpectedTotal]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [combine,setCombine]=useState(false);
  const [page,setPage]=useState(0);
  useEffect(()=>{
    if(!open){setTable(null);setPaste('');return;}
    setStep('choose');setTable(null);setError('');setReading(false);setPasteOpen(false);setPaste('');
    setName('Imported portfolio');setDate(formatDate(localDate()));setExpectedTotal('');setConfirmed(false);setCombine(false);setPage(0);
    const focus=document.activeElement as HTMLElement|null;
    dialog.current?.showModal();
    return ()=>{readGeneration.current++;dialog.current?.close();focus?.focus();};
  },[open]);
  useEffect(()=>{
    if(!open)return;
    let cancelled=false;setDirectoryError('');
    loadSymbolDirectory().then(directory=>{if(!cancelled)setSymbols(directory.symbols);})
      .catch(()=>{if(!cancelled)setDirectoryError('Holding names could not be loaded. Retry before importing.');});
    return ()=>{cancelled=true;};
  },[open,directoryAttempt]);
  const review=useMemo(()=>table?reviewPortfolioCsv(table,mapping,covered,symbols,!!snapshotAsOf):null,[table,mapping,covered,symbols,snapshotAsOf]);
  if(!open)return null;
  const acceptText=(raw:string)=>{
    const parsed=parsePortfolioCsv(raw);readGeneration.current++;setReading(false);setTable(parsed);setMapping(suggestCsvMapping(parsed.headers));
    setStep('map');setError('');setPaste('');setConfirmed(false);setCombine(false);setPage(0);
  };
  const readFile=async(file:File|undefined)=>{
    if(!file)return;
    const generation=++readGeneration.current;setReading(true);setError('');
    try {const raw=await readPortfolioCsvFile(file);if(generation===readGeneration.current)acceptText(raw);}
    catch(cause){if(generation===readGeneration.current)setError(cause instanceof Error?cause.message:'The CSV could not be read.');}
    finally{if(generation===readGeneration.current)setReading(false);if(fileInput.current)fileInput.current.value='';}
  };
  const isoDate=parseUSDate(date);
  const dateError=!isoDate?'Enter a valid date as MM/DD/YYYY.':isoDate>localDate()?'Values cannot be dated in the future.':'';
  const expectedCents=expectedTotal.trim()?parseUsdCents(expectedTotal):null;
  const totalError=expectedTotal.trim()&&review&&!review.completeTotal?'Resolve the values and currencies before reconciling the total.':
    expectedTotal.trim()&&(expectedCents===null||expectedCents<=0)?'Enter a positive USD total with at most two decimal places.':
    expectedTotal.trim()&&review&&expectedCents!==review.totalCents?'The expected total does not match the file. Resolve the difference before importing.':'';
  const mappingErrors=table?csvMappingErrors(table.headers,mapping):[];
  const blocked=!review?.canImport||!confirmed||!name.trim()||!!dateError||!!totalError||!symbols.length||!!directoryError||!!(review?.duplicateTickers.length&&!combine);
  const apply=()=>{
    if(blocked||!table||!isoDate)return;
    try {
      // Validate again before calling the application, which also checks its
      // current snapshot and calibrates atomically before replacing any inputs.
      buildCsvPositions(table,mapping,covered,symbols,combine);
      const message=onImport({table,mapping,symbols,combineDuplicates:combine,name:name.trim(),valuationDate:isoDate});
      if(message)setError(message);
    } catch(cause){setError(cause instanceof Error?cause.message:'The import could not be applied.');}
  };
  const selectColumn=(label:string,key:keyof CsvMapping,optional=false)=><label className="block text-xs font-semibold text-slate-300">{label}<select value={mapping[key]} onChange={event=>{setMapping(current=>({...current,[key]:Number(event.target.value)}));setConfirmed(false);setCombine(false);setError('');}} className={inputStyle}>
    <option value={-1}>{optional?'No currency column · confirm USD below':'Choose a column'}</option>
    {table?.headers.map((header,index)=><option key={index} value={index}>{header}</option>)}
  </select></label>;
  const invalidRows=review?.rows.filter(row=>row.issues.length).length??0;
  const visibleRows=review?.rows.slice(page*50,(page+1)*50)??[];
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="csv-import-title" className="m-auto w-[min(95vw,880px)] max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#0b0f19] p-0 text-slate-200 shadow-2xl backdrop:bg-black/70">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-[#0b0f19] p-5 sm:p-6">
      <div><h2 id="csv-import-title" className="flex items-center gap-2 text-xl font-bold text-white"><FileSpreadsheet className="h-5 w-5 text-emerald-400"/>Import a portfolio</h2>
        <p className="mt-1 text-xs text-slate-400">Choose a CSV → Map columns → Review and import</p></div>
      <button type="button" onClick={onClose} aria-label="Close CSV import" className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
    </header>
    <div className="space-y-5 p-5 sm:p-6">
      {error&&<p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">{error}</p>}
      {step==='choose'?<>
        <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/50 px-5 py-8 text-center">
          <h3 className="text-lg font-bold text-white">Bring your holdings to the Lab.</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-400">Use a stock and ETF holdings export with ticker symbols and current market values in USD. You’ll review everything before replacing any inputs.</p>
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 focus-within:ring-2 focus-within:ring-emerald-200"><Upload className="h-4 w-4"/>{reading?'Reading CSV…':'Choose CSV file'}
            <input ref={fileInput} type="file" accept=".csv,text/csv" aria-label="Portfolio CSV file" disabled={reading} onChange={event=>void readFile(event.target.files?.[0])} className="sr-only"/>
          </label>
          <p className="mt-3 text-xs text-slate-500">UTF-8 CSV · up to 1 MB · up to 30 distinct holdings</p>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">The file is read on this device. Raw rows and account columns are not uploaded, saved or sent to Copilot. Only the reviewed holdings, values and date enter your portfolio.</p>
        <details className="rounded-lg border border-slate-800 p-4 text-xs text-slate-400"><summary className="cursor-pointer font-semibold text-slate-300">See the supported CSV format</summary>
          <pre className="mt-3 overflow-x-auto rounded bg-slate-950 p-3 text-emerald-200">{example}</pre>
          <a href="/examples/portfolio.csv" download="risklab-example-portfolio.csv" className="mt-3 inline-block font-semibold text-emerald-300 underline">Download example CSV</a>
          <p className="mt-3 leading-relaxed">Use a header row, followed by holdings only. Remove report titles, account totals and footnotes. Quoted commas are supported. Dollar values are required; quantities, cost basis and percentage weights are different inputs. Cash, money-market balances, short positions and non-USD values need to be resolved in the source file.</p>
        </details>
        <button type="button" disabled={reading} onClick={()=>setPasteOpen(value=>!value)} aria-expanded={pasteOpen} className="text-xs font-semibold text-emerald-300">{pasteOpen?'Hide pasted CSV':'Paste CSV instead'}</button>
        {pasteOpen&&<div className="space-y-3"><label className="block text-xs text-slate-300">CSV text<textarea rows={6} value={paste} onChange={event=>setPaste(event.target.value)} maxLength={1024*1024} placeholder={example} className={`${inputStyle} font-mono`}/></label>
          <button type="button" disabled={reading||!paste.trim()} onClick={()=>{try{acceptText(paste);}catch(cause){setError(cause instanceof Error?cause.message:'Invalid CSV.');}}} className="rounded-lg border border-emerald-500/30 px-4 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-40">Read pasted CSV</button></div>}
      </>:<>
        {step==='map'&&<>
          <div><h3 className="text-lg font-bold text-white">Match your columns</h3><p className="mt-1 text-sm text-slate-400">{table?.rows.length} holding rows found. Check the suggested mapping. Risk weights use current market value, not purchase cost or number of shares.</p></div>
          <div className="grid gap-4 sm:grid-cols-3">{selectColumn('Ticker column','ticker')}{selectColumn('USD market-value column','value')}{selectColumn('Currency column','currency',true)}</div>
          {mappingErrors.length>0&&<ul className="list-inside list-disc space-y-1 text-xs text-amber-300">{mappingErrors.map(message=><li key={message}>{message}</li>)}</ul>}
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-300">Portfolio name<input value={name} maxLength={80} onChange={event=>setName(event.target.value)} className={inputStyle}/></label>
            <label className="text-xs font-semibold text-slate-300">Allocation values as of<input value={date} onChange={event=>setDate(event.target.value)} maxLength={10} placeholder="MM/DD/YYYY" aria-describedby="csv-date-help" className={inputStyle}/></label></div>
          <p id="csv-date-help" className="text-xs text-slate-500">MM/DD/YYYY. Use the valuation date of your export; RiskLab does not update these amounts with live prices.</p>
          {dateError&&<p role="alert" className="text-xs text-amber-300">{dateError}</p>}
          <label className="block max-w-sm text-xs font-semibold text-slate-300">Expected portfolio total in USD (optional)<input value={expectedTotal} onChange={event=>setExpectedTotal(event.target.value)} inputMode="decimal" placeholder="e.g. 100000.00" className={inputStyle}/><span className="mt-1 block font-normal text-slate-500">Compare the CSV total with your holdings statement.</span></label>
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4"><button type="button" onClick={()=>{readGeneration.current++;setStep('choose');setTable(null);setError('');}} className="inline-flex items-center gap-1 text-xs text-slate-300"><ArrowLeft className="h-3.5 w-3.5"/>Choose another CSV</button>
            <button type="button" disabled={!!mappingErrors.length||!name.trim()||!!dateError} onClick={()=>{setStep('review');setConfirmed(false);setPage(0);setError('');}} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-40">Review import<ArrowRight className="h-4 w-4"/></button></div>
        </>}
        {step==='review'&&review&&<>
          <div><h3 className="text-lg font-bold text-white">Review your portfolio</h3><p className="mt-1 text-sm text-slate-400">{name} · Values as of {formatDate(isoDate)}. Every nonempty row must be resolved before import.</p></div>
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div><p className="text-xs text-slate-400">{review.completeTotal?'File total':'USD total unavailable'}</p><p className="mt-1 break-words text-lg font-bold text-white">{review.completeTotal?money(review.totalCents):'—'}</p></div>
            <div><p className="text-xs text-slate-400">Rows → holdings</p><p className="mt-1 text-lg font-bold text-white">{review.rows.length} → {review.holdings.length}</p></div>
            <div><p className="text-xs text-slate-400">Rows to resolve</p><p className={`mt-1 text-lg font-bold ${invalidRows?'text-amber-300':'text-emerald-300'}`}>{invalidRows}</p></div>
          </div>
          {!!expectedTotal.trim()&&<p role={totalError?'alert':undefined} className={`text-xs ${totalError?'text-amber-300':'text-emerald-300'}`}>{totalError||`Expected total matches ${money(expectedCents!)}.`}</p>}
          {!!review.errors.length&&<ul className="list-inside list-disc space-y-1 text-xs text-amber-300">{review.errors.map(message=><li key={message}>{message}</li>)}</ul>}
          <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-left text-xs"><caption className="px-4 py-3 text-left font-semibold text-slate-300">Mapped rows · only these fields enter the portfolio</caption>
            <thead className="bg-slate-900 text-slate-400"><tr><th className="px-4 py-2">CSV line</th><th className="px-4 py-2">Ticker</th><th className="px-4 py-2 text-right">Market value</th><th className="px-4 py-2 text-right">Share of total</th><th className="px-4 py-2">Review</th></tr></thead>
            <tbody>{visibleRows.map(row=><tr key={row.line} className="border-t border-slate-800"><td className="px-4 py-3 text-slate-500">{row.line}</td><td className="max-w-32 break-words px-4 py-3 font-bold text-white">{row.ticker||'Missing'}</td><td className="max-w-40 break-words px-4 py-3 text-right font-mono-nums">{row.cents===null?row.rawValue||'Missing':row.currency==='USD'?money(row.cents):`${(row.cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} ${row.currency||'Currency missing'}`}</td><td className="px-4 py-3 text-right text-slate-400">{review.canImport&&row.cents!==null?`${(row.cents/review.totalCents*100).toFixed(2)}%`:'—'}</td><td className={`min-w-48 px-4 py-3 ${row.issues.length?'text-amber-300':'text-emerald-300'}`}>{row.issues.length?row.issues.join(' '):review.duplicateTickers.includes(row.ticker)?'Covered · repeated ticker':'Covered'}</td></tr>)}</tbody>
          </table></div>
          {review.rows.length>50&&<div className="flex items-center justify-between text-xs text-slate-400"><button type="button" disabled={page===0} onClick={()=>setPage(value=>value-1)} className="disabled:opacity-30">Previous rows</button><span>Rows {page*50+1}–{Math.min((page+1)*50,review.rows.length)} of {review.rows.length}</span><button type="button" disabled={(page+1)*50>=review.rows.length} onClick={()=>setPage(value=>value+1)} className="disabled:opacity-30">Next rows</button></div>}
          {!!review.duplicateTickers.length&&<div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs"><p className="font-semibold text-amber-200">Repeated tickers</p><ul className="mt-2 space-y-1 text-slate-300">{review.holdings.filter(holding=>holding.lines.length>1).map(holding=><li key={holding.ticker}>{holding.ticker} · lines {holding.lines.join(', ')} → {money(holding.cents)}</li>)}</ul>
            <label className="mt-3 flex items-start gap-2 text-slate-200"><input type="checkbox" checked={combine} onChange={event=>setCombine(event.target.checked)} className="mt-0.5 accent-emerald-400"/>Combine repeated tickers by adding their market values.</label></div>}
          {invalidRows>0&&<p className="text-xs leading-relaxed text-amber-200">Fix the mapping or source CSV, then try again. Cash and money-market balances have no cash model in this release. Incomplete coverage blocks the whole import; no row is excluded or replaced with another security.</p>}
          <label className="flex items-start gap-2 text-sm leading-relaxed text-slate-300"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} className="mt-1 accent-emerald-400"/>I checked the rows and total. These are stock/ETF holdings with current USD market values for the complete portfolio I want to analyze.</label>
          <p className="text-xs leading-relaxed text-slate-500">Importing replaces any open portfolio inputs and analysis settings. Saved portfolios are kept. The imported portfolio is not saved until you choose Save portfolio.</p>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4"><button type="button" onClick={()=>{setStep('map');setError('');setConfirmed(false);}} className="inline-flex items-center gap-1 text-xs text-slate-300"><ArrowLeft className="h-3.5 w-3.5"/>Edit mapping</button>
            <button type="button" disabled={blocked} onClick={apply} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{replacesOpen?'Replace open portfolio':'Import portfolio'}<ArrowRight className="h-4 w-4"/></button></div>
          <p className="text-xs text-slate-500">{snapshotAsOf?`Historical models through ${formatDate(snapshotAsOf)}. Allocation amounts keep your export’s valuation date.`:'Loading historical models…'}{table?.blankRows?` ${table.blankRows} entirely blank ${table.blankRows===1?'row was':'rows were'} ignored.`:''}</p>
        </>}
      </>}
      {directoryError&&<p role="alert" className="text-xs text-amber-300">{directoryError} <button type="button" onClick={()=>setDirectoryAttempt(value=>value+1)} className="underline">Retry holding names</button></p>}
      {modelError&&<p role="alert" className="text-xs text-amber-300">Historical data could not be loaded. <button type="button" onClick={onRetrySnapshot} className="underline">Retry models</button></p>}
    </div>
  </dialog>;
}
