import React, { useEffect, useId, useMemo, useState } from 'react';
import { ASSET_DATABASE } from '../utils/quantEngine';
import { ListedSymbol, loadSymbolDirectory, modeledSymbols, searchSymbols } from '../utils/symbolDirectory';

export function SymbolPicker({value, name, excluded, onSelect, historicalTickers}: {
  value: string; name?: string; excluded: Set<string>; historicalTickers?: Set<string>; onSelect: (symbol: ListedSymbol) => void;
}) {
  const id = useId();
  const [symbols, setSymbols] = useState(modeledSymbols);
  const [status, setStatus] = useState('Loading US stocks and ETFs…');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    setFailed(false); setStatus('Loading US stocks and ETFs…');
    loadSymbolDirectory().then(data => {
      if (!mounted) return;
      const merged = new Map(data.symbols.map(symbol => [symbol.ticker, symbol]));
      for (const symbol of modeledSymbols) if (!merged.has(symbol.ticker)) merged.set(symbol.ticker, symbol);
      setSymbols([...merged.values()]);
      setStatus(`${data.symbols.length.toLocaleString()} listings · Snapshot ${data.capturedAt.slice(0, 10)}`);
    }).catch(() => { if (mounted) {setFailed(true); setStatus('Directory unavailable. Showing built-in assets.');} });
    return () => { mounted = false; };
  }, [retry]);
  const results = useMemo(() => {
    const candidates = !query.trim() && historicalTickers ? symbols.filter(symbol => historicalTickers.has(symbol.ticker)) : symbols;
    return searchSymbols(candidates, query, excluded);
  }, [symbols, query, excluded, historicalTickers]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({block: 'nearest'});
  }, [active, id, open]);
  const selected = symbols.find(symbol => symbol.ticker === value);
  const select = (symbol: ListedSymbol) => {onSelect(symbol); setOpen(false); setQuery('');};
  return <div className="relative min-w-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {setOpen(false); setQuery('');}
  }}>
    <input role="combobox" aria-label="Portfolio holding" aria-expanded={open} aria-controls={`${id}-list`}
      aria-autocomplete="list" aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
      autoComplete="off" placeholder="Search ticker or company / ETF name"
      value={open ? query : value ? `${value} — ${selected?.name ?? name ?? value}` : ''}
      onFocus={() => {setOpen(true); setQuery(''); setActive(0);}}
      onChange={event => {setQuery(event.target.value); setOpen(true); setActive(0);}}
      onKeyDown={event => {
        if (event.key === 'Escape') {setOpen(false); setQuery('');}
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          setActive(index => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter' && open) {event.preventDefault(); if (results[active]) select(results[active]);}
      }} className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
    {open && <div className="absolute z-50 top-full mt-1 w-full min-w-[240px] rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
      <div className="px-3 py-2 text-[11px] text-slate-400">{status} {failed && <button type="button" className="text-emerald-400 underline" onMouseDown={e => e.preventDefault()} onClick={() => setRetry(value => value + 1)}>Retry</button>}</div>
      <ul id={`${id}-list`} role="listbox" className="max-h-64 overflow-y-auto">
        {results.map((symbol, index) => <li key={symbol.ticker} id={`${id}-${index}`} role="option" aria-selected={index === active}
          onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => select(symbol)}
          className={`cursor-pointer px-3 py-2 text-xs ${index === active ? 'bg-emerald-500/15' : 'hover:bg-slate-800'}`}>
          <span className="font-bold text-white">{symbol.ticker}</span> <span className="text-slate-500">{symbol.kind} · {symbol.exchange}</span>
          <div className="text-slate-300">{symbol.name}</div>
          {historicalTickers && <div className={`mt-0.5 text-[10px] ${historicalTickers.has(symbol.ticker) ? 'text-emerald-400' : 'text-amber-300'}`}>{historicalTickers.has(symbol.ticker) ? 'Historical model available' : 'Outside historical snapshot'}</div>}
        </li>)}
        {results.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">No matches. Try another ticker or name.</li>}
      </ul>
      {results.length === 40 && <div className="px-3 py-2 text-[11px] text-slate-500">Showing the first 40 matches. Keep typing to narrow the list.</div>}
    </div>}
  </div>;
}

export function RiskProxyPicker({ticker, value, onChange}: {ticker: string; value: string; onChange: (ticker: string) => void}) {
  if (!ticker || ASSET_DATABASE[ticker]) return null;
  return <div className="mt-2 text-[11px] text-amber-200">
    <label className="block">Risk proxy for {ticker}
      <select aria-label={`Risk proxy for ${ticker}`} value={value} onChange={event => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200">
        <option value="">Choose the closest modeled asset</option>
        {Object.values(ASSET_DATABASE).map(asset => <option key={asset.ticker} value={asset.ticker}>{asset.ticker} — {asset.name}</option>)}
      </select>
    </label>
    <p className="mt-1 text-slate-400">Risk, returns, correlations and stress tests use this proxy’s assumptions. No live prices or ticker-specific history.</p>
  </div>;
}
