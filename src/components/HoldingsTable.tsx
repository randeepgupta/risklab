import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Info } from 'lucide-react';
import { PortfolioPosition } from '../types/risk';
import { ASSET_DATABASE } from '../utils/quantEngine';

interface HoldingsTableProps {
  positions: PortfolioPosition[];
  onUpdatePositions: (newPositions: PortfolioPosition[]) => void;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  positions,
  onUpdatePositions,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTicker, setNewTicker] = useState('AAPL');
  const [newInvestment, setNewInvestment] = useState('25000');

  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>('');

  const totalValue = positions.reduce((sum, p) => sum + p.investment, 0);

  const availableTickers = Object.keys(ASSET_DATABASE).filter(
    t => !positions.some(p => p.ticker === t)
  );

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newInvestment);
    if (isNaN(amount) || amount <= 0) return;

    const meta = ASSET_DATABASE[newTicker] || {
      name: newTicker,
      assetClass: 'Other',
      price: 100,
      volatility: 0.25,
      beta: 1.0,
    };

    const newPositions = [
      ...positions,
      {
        ticker: newTicker,
        name: meta.name,
        assetClass: meta.assetClass,
        investment: amount,
        weight: 0, // recalculated below
        price: meta.price,
      },
    ];

    const newTotal = newPositions.reduce((sum, p) => sum + p.investment, 0);
    const updated = newPositions.map(p => ({
      ...p,
      weight: newTotal > 0 ? p.investment / newTotal : 0,
    }));

    onUpdatePositions(updated);
    setIsAdding(false);
    if (availableTickers.length > 1) {
      setNewTicker(availableTickers.find(t => t !== newTicker) || 'AAPL');
    }
  };

  const handleRemovePosition = (ticker: string) => {
    if (positions.length <= 1) return; // keep at least 1 position
    const filtered = positions.filter(p => p.ticker !== ticker);
    const newTotal = filtered.reduce((sum, p) => sum + p.investment, 0);
    const updated = filtered.map(p => ({
      ...p,
      weight: newTotal > 0 ? p.investment / newTotal : 0,
    }));
    onUpdatePositions(updated);
  };

  const handleStartEdit = (pos: PortfolioPosition) => {
    setEditingTicker(pos.ticker);
    setEditingAmount(pos.investment.toString());
  };

  const handleSaveEdit = (ticker: string) => {
    const amount = parseFloat(editingAmount);
    if (isNaN(amount) || amount <= 0) return;

    const updatedPositions = positions.map(p => {
      if (p.ticker === ticker) {
        return { ...p, investment: amount };
      }
      return p;
    });

    const newTotal = updatedPositions.reduce((sum, p) => sum + p.investment, 0);
    const updated = updatedPositions.map(p => ({
      ...p,
      weight: newTotal > 0 ? p.investment / newTotal : 0,
    }));

    onUpdatePositions(updated);
    setEditingTicker(null);
  };

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Portfolio Positions</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono-nums font-normal lowercase">
              {positions.length} assets
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure allocations to recalibrate risk, correlations, and stress outcomes.
          </p>
        </div>

        {!isAdding ? (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Asset</span>
          </button>
        ) : (
          <form onSubmit={handleAddPosition} className="flex items-center space-x-2">
            <select
              aria-label="Select asset to add"
              value={newTicker}
              onChange={e => setNewTicker(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {availableTickers.map(t => (
                <option key={t} value={t}>
                  {t} - {ASSET_DATABASE[t]?.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400 text-xs">$</span>
              <input
                type="number"
                aria-label="Investment amount"
                value={newInvestment}
                onChange={e => setNewInvestment(e.target.value)}
                placeholder="25000"
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded pl-5 pr-2 py-1.5 w-28 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono-nums"
              />
            </div>

            <button
              type="submit"
              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
              title="Confirm Add"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 uppercase font-mono-nums text-[11px] tracking-wider">
              <th className="py-3 px-4">Asset</th>
              <th className="py-3 px-4">Class</th>
              <th className="py-3 px-4 text-right">Investment ($)</th>
              <th className="py-3 px-4 text-right">Weight (%)</th>
              <th className="py-3 px-4 text-right">Ann. Vol (σ)</th>
              <th className="py-3 px-4 text-right">Beta (β)</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-slate-300">
            {positions.map(pos => {
              const meta = ASSET_DATABASE[pos.ticker] || {
                volatility: 0.25,
                beta: 1.0,
                assetClass: 'Other',
              };
              const weightPct = totalValue > 0 ? (pos.investment / totalValue) * 100 : 0;
              const isEditing = editingTicker === pos.ticker;

              return (
                <tr key={pos.ticker} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white font-mono-nums">{pos.ticker}</span>
                      <span className="text-slate-400 truncate max-w-[140px] sm:max-w-[200px]" title={pos.name}>
                        {pos.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                      {meta.assetClass}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono-nums">
                    {isEditing ? (
                      <div className="flex items-center justify-end space-x-1">
                        <span className="text-slate-400 text-xs">$</span>
                        <input
                          type="number"
                          aria-label={`Investment amount for ${pos.ticker}`}
                          value={editingAmount}
                          onChange={e => setEditingAmount(e.target.value)}
                          className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-right w-24 text-white text-xs font-mono-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(pos.ticker)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTicker(null)}
                          className="p-1 text-slate-400 hover:text-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-100">
                        ${pos.investment.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-nums">
                    <div className="flex items-center justify-end space-x-2">
                      <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full"
                          style={{ width: `${Math.min(100, weightPct)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right">{weightPct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono-nums">
                    <span className={meta.volatility > 0.35 ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                      {(meta.volatility * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono-nums">
                    <span className={meta.beta > 1.5 ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                      {meta.beta.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(pos)}
                          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Edit Amount"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePosition(pos.ticker)}
                        disabled={positions.length <= 1}
                        className={`p-1 transition-colors ${
                          positions.length <= 1
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-400 hover:text-rose-400'
                        }`}
                        title={positions.length <= 1 ? 'Minimum 1 asset required' : 'Remove Position'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-800 bg-slate-950/60 font-mono-nums font-semibold text-white">
              <td className="py-3 px-4">Total Portfolio</td>
              <td className="py-3 px-4 text-slate-400 font-normal">Aggregated</td>
              <td className="py-3 px-4 text-right text-emerald-400">
                ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </td>
              <td className="py-3 px-4 text-right">100.0%</td>
              <td className="py-3 px-4 text-right text-slate-400">-</td>
              <td className="py-3 px-4 text-right text-slate-400">-</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
