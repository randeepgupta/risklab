import React from 'react';
import {Edit3, RefreshCw} from 'lucide-react';
import type {PortfolioPosition} from '../types/risk';

const COLORS = ['bg-emerald-400', 'bg-sky-400', 'bg-violet-400', 'bg-amber-400', 'bg-teal-400', 'bg-rose-400', 'bg-indigo-400'];

export function PortfolioSnapshot({positions, isSample, onEdit, onNewSample, loading}: {
  positions: PortfolioPosition[]; isSample: boolean; onEdit: () => void; onNewSample: () => void; loading: boolean;
}) {
  const total = positions.reduce((sum, position) => sum + position.investment, 0);
  const amount = (value: number) => '$' + Math.round(value).toLocaleString('en-US');
  return <section aria-labelledby="portfolio-snapshot-heading" className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2"><h1 id="portfolio-snapshot-heading" className="text-xl font-bold text-white">{isSample ? 'Your sample portfolio' : 'Your portfolio'}</h1>{isSample && <span className="rounded border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">Example</span>}</div>
        <p className="mt-1 text-sm text-slate-400">{amount(total)} across {positions.length} holdings{isSample ? ' · An example allocation you can edit.' : ''}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {isSample && <button type="button" onClick={onNewSample} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Loading sample…' : 'Try another sample'}</button>}
        <button type="button" onClick={onEdit} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"><Edit3 className="h-3.5 w-3.5" />Edit this portfolio</button>
      </div>
    </div>
    <div aria-hidden="true" className="mt-5 flex h-2 overflow-hidden rounded-full bg-slate-800">{positions.map((position, i) => <div key={position.ticker} className={COLORS[i % COLORS.length]} style={{width: `${total > 0 ? position.investment / total * 100 : 0}%`}} />)}</div>
    <ul className="mt-5 grid gap-x-6 gap-y-4" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))'}}>
      {positions.map((position, i) => <li key={position.ticker} className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${COLORS[i % COLORS.length]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-bold text-white">{position.ticker}</span><span className="shrink-0 text-xs font-semibold text-slate-200">{(total > 0 ? position.investment / total * 100 : 0).toFixed(1)}% <span className="ml-1 font-normal text-slate-400">{amount(position.investment)}</span></span></div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{position.name}</p>
        </div>
      </li>)}
    </ul>
  </section>;
}
