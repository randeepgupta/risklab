import React, { useState } from 'react';
import { CorrelationMatrixData } from '../types/risk';
import { Layers, Info } from 'lucide-react';

interface CorrelationMatrixProps {
  data: CorrelationMatrixData;
}

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ data }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    t1: string;
    t2: string;
    val: number;
  } | null>(null);

  const { tickers, matrix } = data;

  // Helper to color-code correlation value
  const getCellColor = (val: number) => {
    if (val === 1.0) return 'bg-slate-800 text-slate-400 font-semibold';
    if (val < 0) return 'bg-sky-950/70 text-sky-300 border border-sky-800/40'; // negative correlation hedge
    if (val < 0.3) return 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/30'; // low correlation
    if (val < 0.6) return 'bg-amber-950/40 text-amber-200 border border-amber-800/30'; // moderate
    if (val < 0.8) return 'bg-orange-950/60 text-orange-200 border border-orange-800/40 font-semibold'; // strong
    return 'bg-rose-950/70 text-rose-300 border border-rose-800/50 font-bold'; // very strong tech clustering
  };

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Cross-Asset Correlation Matrix
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-nums border border-slate-700">
              ρ(i, j)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Empirical pairwise correlations. Values close to +1.0 indicate clustered risk that drops together.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] font-mono-nums">
          <span className="flex items-center gap-1 text-sky-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-900/80 border border-sky-700" /> Negative (&lt;0)
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-900/80 border border-emerald-700" /> Low (0–0.3)
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-900/80 border border-amber-700" /> Moderate (0.3–0.6)
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-900/80 border border-rose-700" /> High (&gt;0.8)
          </span>
        </div>
      </div>

      <div className="pt-4 overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <table className="border-collapse text-xs font-mono-nums mx-auto">
            <thead>
              <tr>
                <th className="p-2 text-left text-slate-500 text-[10px] uppercase">Asset</th>
                {tickers.map(t => (
                  <th key={t} className="p-2 text-center text-slate-300 font-bold w-16">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickers.map((rowTicker, i) => (
                <tr key={rowTicker}>
                  <td className="p-2 text-slate-300 font-bold pr-3 text-right">
                    {rowTicker}
                  </td>
                  {tickers.map((colTicker, j) => {
                    const val = matrix[i][j];
                    const isHovered =
                      hoveredCell &&
                      hoveredCell.t1 === rowTicker &&
                      hoveredCell.t2 === colTicker;

                    return (
                      <td key={`${rowTicker}-${colTicker}`} className="p-1">
                        <div
                          onMouseEnter={() =>
                            setHoveredCell({ t1: rowTicker, t2: colTicker, val })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`w-14 h-9 rounded flex items-center justify-center transition-transform cursor-pointer ${getCellColor(
                            val
                          )} ${isHovered ? 'ring-2 ring-emerald-400 scale-105 z-10' : ''}`}
                        >
                          {val.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hoveredCell ? (
        <div className="mt-4 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between font-mono-nums">
          <div>
            Correlation between <span className="font-bold text-white">{hoveredCell.t1}</span> and{' '}
            <span className="font-bold text-white">{hoveredCell.t2}</span>:
          </div>
          <div className="text-emerald-400 font-bold text-sm">
            ρ = {hoveredCell.val.toFixed(2)}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-center text-[11px] text-slate-500 font-mono-nums">
          Hover over any correlation cell to inspect pairwise diversification dynamics.
        </div>
      )}
    </div>
  );
};
