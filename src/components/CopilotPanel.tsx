import React, {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {HedgingLabView} from './HedgingLabView';
import type {PortfolioPosition, PortfolioRiskMetrics} from '../types/risk';

export function CopilotPanel({open, onClose, positions, metrics}: {
  open: boolean; onClose: () => void; positions: PortfolioPosition[]; metrics: PortfolioRiskMetrics;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [hasOpened, setHasOpened] = useState(open);
  useEffect(() => {
    if (!open) return;
    setHasOpened(true);
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); onClose();}};
    document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('keydown', escape); if (previous?.isConnected) previous.focus();};
  }, [open, onClose]);
  return <aside hidden={!open} aria-label="Copilot companion" style={{colorScheme: 'dark'}} className="fixed bottom-0 right-0 top-[108px] z-30 w-full overflow-y-auto border-l border-slate-700 bg-[#0b0f19] shadow-2xl sm:w-[460px]">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-[#0b0f19] px-5 py-4">
      <div><h2 className="text-base font-bold text-white">Copilot</h2><p className="mt-1 text-xs text-slate-400">Ask about your portfolio while you explore the Lab.</p></div>
      <button ref={closeRef} onClick={onClose} aria-label="Close Copilot" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
    </div>
    <div className="p-4">{hasOpened && <HedgingLabView key={positions.map(p => `${p.ticker}:${p.investment}:${p.historicalModel?.endDate}`).join('|')} positions={positions} metrics={metrics} companion />}</div>
  </aside>;
}
