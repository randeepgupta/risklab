import React, { useState } from 'react';
import { CorrelationMatrixData } from '../types/risk';
import { ChevronDown } from 'lucide-react';

interface CorrelationMatrixProps {
  data: CorrelationMatrixData;
}

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ data }) => {
  const [hoveredCell, setHoveredCell] = useState<{ t1: string; t2: string; val: number } | null>(null);
  const { tickers, matrix } = data;

  const getCellColor = (val: number) => {
    if (val === 1.0) return 'bg-slate-800 text-slate-400 font-semibold';
    if (val < 0) return 'bg-sky-950/70 text-sky-300 border border-sky-800/40';
    if (val < 0.3) return 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/30';
    if (val < 0.6) return 'bg-amber-950/40 text-amber-200 border border-amber-800/30';
    if (val < 0.8) return 'bg-orange-950/60 text-orange-200 border border-orange-800/40 font-semibold';
    return 'bg-rose-950/70 text-rose-300 border border-rose-800/50 font-bold';
  };

  const avgPairwise = (() => {
    let total = 0;
    let count = 0;
    for (let i = 0; i < matrix.length; i += 1) {
      for (let j = i + 1; j < matrix.length; j += 1) {
        total += matrix[i][j];
        count += 1;
      }
    }
    return count ? total / count : 0;
  })();

  const relationship = avgPairwise >= 0.7 ? 'move together a lot' : avgPairwise >= 0.45 ? 'often move together' : 'show useful differences in how they move';

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
      <div className="pb-4 border-b border-slate-800">
        <h3 className="text-base font-bold text-white">Which investments move together?</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Your holdings {relationship}. When several investments fall at the same time, owning more tickers may not provide as much diversification as it appears.
        </p>
      </div>

      <div className="pt-4 overflow-x-auto">
        <div className="min-w-[460px]">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `72px repeat(${tickers.length}, minmax(46px, 1fr))` }}
          >
            <div />
            {tickers.map(ticker => (
              <div key={ticker} className="text-[10px] text-center text-slate-400 font-mono-nums font-semibold py-1">
                {ticker}
              </div>
            ))}

            {matrix.map((row, i) => (
              <React.Fragment key={tickers[i]}>
                <div className="text-[10px] text-right pr-2 text-slate-400 font-mono-nums font-semibold flex items-center justify-end">
                  {tickers[i]}
                </div>
                {row.map((val, j) => (
                  <div
                    key={`${i}-${j}`}
                    onMouseEnter={() => setHoveredCell({ t1: tickers[i], t2: tickers[j], val })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`rounded-md px-1 py-2 text-center text-[10px] font-mono-nums transition-transform hover:scale-105 ${getCellColor(val)}`}
                    title={`${tickers[i]} / ${tickers[j]}: ${val.toFixed(2)}`}
                  >
                    {val.toFixed(2)}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-5 text-[11px] text-slate-400">
        {hoveredCell ? (
          <span>
            <strong className="text-white">{hoveredCell.t1}</strong> and <strong className="text-white">{hoveredCell.t2}</strong>{' '}
            have modeled correlation of <strong className="text-emerald-300">{hoveredCell.val.toFixed(2)}</strong>.
          </span>
        ) : (
          <span>Hover a cell to see the relationship between two holdings.</span>
        )}
      </div>

      <details className="mt-3 group border-t border-slate-800 pt-3 text-xs text-slate-400">
        <summary className="cursor-pointer list-none flex items-center gap-1.5 hover:text-slate-200">
          <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
          What do these numbers mean?
        </summary>
        <p className="mt-2 leading-relaxed">
          Correlation ranges from -1 to +1. Values near +1 mean two assets tend to move in the same direction, values near 0 mean their movements are less related, and negative values mean they often move in opposite directions. Technical notation: ρ(i, j).
        </p>
      </details>
    </div>
  );
};
