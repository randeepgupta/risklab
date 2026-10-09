import React from 'react';
import {ChevronDown} from 'lucide-react';

// Native disclosure works with mouse, touch, and keyboard; closed by default.
export function Explanation({label = 'What does this mean?', children}: {label?: string; children: React.ReactNode}) {
  return <details className="mt-2 text-xs text-slate-400" onClick={event => event.stopPropagation()}>
    <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
      <ChevronDown className="h-3.5 w-3.5 shrink-0" />{label}
    </summary>
    <div className="mt-2 leading-relaxed">{children}</div>
  </details>;
}
