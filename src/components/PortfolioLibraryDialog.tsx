import React,{useEffect,useRef,useState} from 'react';
import {Download,FolderOpen,Save,Trash2,Upload,X} from 'lucide-react';
import type {PortfolioLibrary,SavedPortfolio} from '../types/workspace';
import {MAX_BACKUP_BYTES,parsePortfolioLibrary,PORTFOLIO_STORAGE_KEY} from '../utils/savedPortfolios';
import {localDate} from '../utils/workspaceSettings';

export function downloadPortfolioBackup(library:PortfolioLibrary) {
  downloadText(JSON.stringify(library,null,2),`risklab-backup-${localDate()}.json`);
}
function downloadText(text:string,name:string) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
interface Props {
  open:boolean; onClose:()=>void; pendingResume?:SavedPortfolio|null; onConfirmResume:()=>void; library:PortfolioLibrary; error:string; blocked:boolean; message:string;
  current?:{id:string|null;name:string;valuationDate:string;dirty:boolean}; loading:boolean;
  onSave:(name:string,valuationDate:string,copy:boolean)=>void;
  onDownloadCurrent?:(name:string,valuationDate:string)=>void;
  onResume:(portfolio:SavedPortfolio)=>void; onDelete:(id:string)=>void;
  onRestore:(library:PortfolioLibrary)=>boolean; onClear:()=>void; onRetry:()=>void;
}
export function PortfolioLibraryDialog({open,onClose,pendingResume,onConfirmResume,library,error,blocked,message,current,loading,onSave,onDownloadCurrent,onResume,onDelete,onRestore,onClear,onRetry}:Props) {
  const ref=useRef<HTMLDialogElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const [name,setName]=useState('');
  const [valuationDate,setValuationDate]=useState(localDate);
  const [incoming,setIncoming]=useState<PortfolioLibrary|null>(null);
  const [fileError,setFileError]=useState('');
  const [deleting,setDeleting]=useState<string|null>(null);
  useEffect(()=>{
    if(!open) return;
    setName(current?.name??'');setValuationDate(current?.valuationDate??localDate());setIncoming(null);setFileError('');setDeleting(null);
    const previousFocus=document.activeElement as HTMLElement|null;
    ref.current?.showModal();
    return ()=>{ref.current?.close();previousFocus?.focus();};
  },[open]);
  if(!open) return null;
  const sorted=[...library.portfolios].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const save=async(event:React.FormEvent)=>{event.preventDefault();if(name.trim()) onSave(name.trim(),valuationDate,false);};
  return <dialog ref={ref} onCancel={onClose} aria-labelledby="portfolio-library-title" className="m-auto w-[min(94vw,700px)] max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#0b0f19] p-0 text-slate-200 shadow-2xl backdrop:bg-black/70">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-[#0b0f19] p-5">
      <div><h2 id="portfolio-library-title" className="text-xl font-bold text-white">Saved portfolios</h2><p className="mt-1 text-xs text-slate-400">Stored in this browser on this device. Download backups to keep a separate copy.</p></div>
      <button type="button" onClick={onClose} aria-label="Close saved portfolios" className="rounded p-1 text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
    </div>
    <div className="space-y-5 p-5">
      {error && <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200"><p>{error}</p><button type="button" onClick={onRetry} className="mt-2 underline">Retry browser storage</button></div>}
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      {current && <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="font-semibold text-white">Save your open portfolio</h3>
        <p className="text-xs text-slate-400">{current.dirty?'You have changes that are not saved.':'Save the holdings and analysis settings you want to resume.'} Results will be recalculated when reopened.</p>
        <label className="block text-xs text-slate-300">Portfolio name<input required maxLength={80} value={name} onChange={event=>setName(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"/></label>
        <label className="block text-xs text-slate-300">Allocation values as of<input type="date" required value={valuationDate} max={localDate()} onChange={event=>setValuationDate(event.target.value)} className="mt-1 block rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"/></label>
        <p className="text-xs text-slate-500">This is the date of the dollar amounts you entered, separate from the model’s historical-data date.</p>
        <div className="flex flex-wrap gap-3">
          <button disabled={blocked||loading||!name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"><Save className="h-4 w-4"/>{current.id?'Save changes':'Save portfolio'}</button>
          {onDownloadCurrent&&<button type="button" disabled={loading||!name.trim()} onClick={()=>onDownloadCurrent(name.trim(),valuationDate)} className="text-xs font-semibold text-slate-300 disabled:opacity-40">Download this portfolio</button>}
          {current.id && <button type="button" disabled={blocked||loading||!name.trim()} onClick={()=>onSave(name.trim(),valuationDate,true)} className="text-xs font-semibold text-emerald-300 disabled:opacity-40">Save a copy</button>}
        </div>
      </form>}
      {pendingResume&&<div role="alert" className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200"><p>Opening “{pendingResume.name}” replaces the open inputs. Save your changes above first, or continue with the saved version.</p><button type="button" disabled={loading} onClick={onConfirmResume} className="text-xs font-semibold text-emerald-300">Resume saved version</button></div>}
      <section aria-label="Portfolios saved on this device">
        <h3 className="mb-3 text-sm font-semibold text-white">On this device · {sorted.length}</h3>
        {!sorted.length && <p className="text-sm text-slate-400">No saved portfolios yet. Open or build a portfolio, then choose Save portfolio.</p>}
        <ul className="space-y-3">{sorted.map(portfolio=><li key={portfolio.id} className="rounded-xl border border-slate-800 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-white break-words">{portfolio.name}</p><p className="mt-1 text-xs text-slate-400">${portfolio.holdings.reduce((sum,p)=>sum+p.investment,0).toLocaleString()} · {portfolio.holdings.length} holdings · Values as of {portfolio.valuationDate}</p><p className="mt-1 text-xs text-slate-500">Saved {new Date(portfolio.updatedAt).toLocaleString()} · Model data through {portfolio.modelContext.asOf}</p></div>
            <div className="flex gap-3"><button type="button" disabled={loading} onClick={()=>onResume(portfolio)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 disabled:opacity-40"><FolderOpen className="h-4 w-4"/>Resume {portfolio.name}</button><button type="button" onClick={()=>setDeleting(portfolio.id)} aria-label={`Delete ${portfolio.name}`} className="text-slate-500 hover:text-rose-300"><Trash2 className="h-4 w-4"/></button></div>
          </div>
          {deleting===portfolio.id && <div className="mt-3 text-xs text-amber-200"><p>Delete “{portfolio.name}” from this device? A downloaded backup can restore it.</p><div className="mt-2 flex gap-4"><button type="button" onClick={()=>{onDelete(portfolio.id);setDeleting(null);}} className="font-semibold text-rose-300">Delete saved portfolio</button><button type="button" onClick={()=>setDeleting(null)}>Keep portfolio</button></div></div>}
        </li>)}</ul>
      </section>
      <section className="space-y-3 border-t border-slate-800 pt-4" aria-label="Portfolio backups">
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-300">
          <button type="button" disabled={!sorted.length} onClick={()=>downloadPortfolioBackup(library)} className="inline-flex items-center gap-1.5 disabled:opacity-40"><Download className="h-4 w-4"/>Download backup</button>
          <button type="button" onClick={()=>fileRef.current?.click()} className="inline-flex items-center gap-1.5"><Upload className="h-4 w-4"/>Restore backup</button>
          <input ref={fileRef} aria-label="RiskLab backup file" type="file" accept=".json,application/json" className="sr-only" onChange={async event=>{
            const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
            setFileError('');setIncoming(null);
            try {if(file.size>MAX_BACKUP_BYTES)throw new Error('Choose a RiskLab backup smaller than 1 MB.');setIncoming(parsePortfolioLibrary(await file.text()));}
            catch(error){setFileError(error instanceof Error?error.message:'Could not read this backup.');}
          }}/>
        </div>
        <p className="text-xs text-slate-500">Backups contain portfolio inputs and settings, not stored risk estimates, prices or Copilot conversations. Restore reads the file in your browser. Analysis exports are a different format.</p>
        {fileError && <p role="alert" className="text-xs text-amber-300">{fileError}</p>}
        {incoming && <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 text-sm text-slate-300"><p>Ready to add {incoming.portfolios.length} portfolio{incoming.portfolios.length===1?'':'s'}: {incoming.portfolios.map(p=>p.name).join(', ')||'none'}.</p><p className="mt-1 text-xs">Existing saved portfolios are kept. Matching IDs are restored as separate copies.</p><div className="mt-3 flex gap-4"><button type="button" disabled={blocked||!incoming.portfolios.length} onClick={()=>{if(onRestore(incoming))setIncoming(null);}} className="text-xs font-semibold text-emerald-300 disabled:opacity-40">Add portfolios from backup</button><button type="button" onClick={()=>setIncoming(null)} className="text-xs">Cancel restore</button></div></div>}
        {blocked && <div className="space-y-2 text-xs text-amber-200"><button type="button" className="underline" onClick={()=>{
          try {const raw=window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);if(raw)downloadText(raw,`risklab-stored-data-${localDate()}.json`);}
          catch {setFileError('Browser storage could not be read.');}
        }}>Download original stored data</button><div><button type="button" onClick={()=>setDeleting('library')} className="text-rose-300 underline">Clear unreadable saved data</button></div>{deleting==='library'&&<div><p>Clear RiskLab’s saved data? Download the original first if you want to recover it.</p><button type="button" onClick={()=>{onClear();setDeleting(null);}} className="mt-2 font-semibold text-rose-300">Confirm clear saved data</button></div>}</div>}
      </section>
    </div>
  </dialog>;
}
