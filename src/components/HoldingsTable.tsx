import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { PortfolioPosition } from '../types/risk';
import { ASSET_DATABASE } from '../utils/quantEngine';
import { SymbolPicker, RiskProxyPicker } from './SymbolPicker';
import { ListedSymbol, createListedPosition } from '../utils/symbolDirectory';

interface HoldingsTableProps {
  positions: PortfolioPosition[];
  historicalTickers?: Set<string>;
  onUpdatePositions: (newPositions: PortfolioPosition[]) => void;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  positions,
  onUpdatePositions, historicalTickers,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newSymbol, setNewSymbol] = useState<ListedSymbol | null>(null);
  const [riskProxyTicker, setRiskProxyTicker] = useState('');
  const [newInvestment, setNewInvestment] = useState('25000');

  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>('');

  const totalValue = positions.reduce((sum, p) => sum + p.investment, 0);

  const usedTickers = new Set<string>(positions.map(position => position.ticker));

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newInvestment);
    if (!Number.isFinite(amount) || amount <= 0 || !newSymbol || usedTickers.has(newTicker) || positions.length >= 30 || !(historicalTickers ? historicalTickers.has(newTicker) : ASSET_DATABASE[newTicker] || ASSET_DATABASE[riskProxyTicker])) return;

    const newPositions = [...positions, createListedPosition(newSymbol, amount, 0, riskProxyTicker, historicalTickers?.has(newTicker))];

    const newTotal = newPositions.reduce((sum, p) => sum + p.investment, 0);
    const updated = newPositions.map(p => ({
      ...p,
      weight: newTotal > 0 ? p.investment / newTotal : 0,
    }));

    onUpdatePositions(updated);
    setIsAdding(false);
    setNewTicker(''); setNewSymbol(null); setRiskProxyTicker('');
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
    if (!Number.isFinite(amount) || amount <= 0) return;

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
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Portfolio Positions</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono-nums font-normal lowercase">
              {positions.length} assets
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Your current holdings. Change an amount or add an asset and RiskLab will recalculate the analysis.
          </p>
        </div>

        {!isAdding ? (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            disabled={positions.length >= 30}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Asset</span>
          </button>
        ) : (
          <form onSubmit={handleAddPosition} className="flex flex-wrap items-start gap-2 w-full">
            <div className="min-w-0 flex-1 basis-64">
              <SymbolPicker value={newTicker} excluded={usedTickers} historicalTickers={historicalTickers} onSelect={symbol => {
                setNewTicker(symbol.ticker); setNewSymbol(symbol); setRiskProxyTicker('');
              }} />
              {!historicalTickers && <RiskProxyPicker ticker={newTicker} value={riskProxyTicker} onChange={setRiskProxyTicker} />}
              {historicalTickers && newTicker && !historicalTickers.has(newTicker) && <p className="mt-1 text-xs text-amber-300">This holding is outside the historical snapshot. Use Edit Portfolio to switch to preset assumptions.</p>}
            </div>

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
              disabled={!newSymbol || !(historicalTickers ? historicalTickers.has(newTicker) : ASSET_DATABASE[newTicker] || ASSET_DATABASE[riskProxyTicker]) || !Number.isFinite(Number(newInvestment)) || Number(newInvestment) <= 0}
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
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-slate-300">
            {positions.map(pos => {
              const weightPct = totalValue > 0 ? (pos.investment / totalValue) * 100 : 0;
              const isEditing = editingTicker === pos.ticker;

              return (
                <tr key={pos.ticker} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-start gap-2 w-full">
                      <span className="font-bold text-white font-mono-nums">{pos.ticker}</span>
                      <span className="text-slate-400 truncate max-w-[140px] sm:max-w-[200px]" title={pos.name}>
                        {pos.name}
                      </span>
                    </div>
                    {pos.historicalModel && <p className="mt-1 text-[11px] text-emerald-400">Own historical model · {pos.historicalModel.observations} daily returns</p>}
                    {pos.riskProxyTicker && <p className="mt-1 text-[11px] text-amber-300">Modeled using {pos.riskProxyTicker} · proxy assumptions</p>}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                      {pos.assetClass}
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
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
