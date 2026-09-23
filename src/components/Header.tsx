import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Download,
  Edit3,
  FileJson,
  FileSpreadsheet,
  HelpCircle,
  MoreHorizontal,
  Search,
  ShieldAlert,
  Sparkles,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';

interface HeaderProps {
  portfolioName: string;
  totalValue: number;
  activeTab: 'risk' | 'monte-carlo' | 'stress' | 'hedging';
  setActiveTab: (tab: 'risk' | 'monte-carlo' | 'stress' | 'hedging') => void;
  onEditPortfolio: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onOpenCommandPalette: () => void;
  onOpenHelpModal: () => void;
  onOpenInstallModal: () => void;
  isStandalone: boolean;
  isCompactMode: boolean;
  onToggleCompactMode: () => void;
}

const tabs = [
  { id: 'risk' as const, label: 'Risk Overview', icon: BarChart3 },
  { id: 'monte-carlo' as const, label: 'Monte Carlo', icon: TrendingUp },
  { id: 'stress' as const, label: 'Stress Tests', icon: ShieldAlert },
  { id: 'hedging' as const, label: 'Hedging & AI', icon: Sparkles },
];

export const Header: React.FC<HeaderProps> = ({
  portfolioName,
  totalValue,
  activeTab,
  setActiveTab,
  onEditPortfolio,
  onExportJson,
  onExportCsv,
  onOpenCommandPalette,
  onOpenHelpModal,
  onOpenInstallModal,
  isStandalone,
  isCompactMode,
  onToggleCompactMode,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b0f19]/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white">RiskLab</span>
                <span className="hidden sm:inline text-slate-700">/</span>
                <span className="hidden sm:inline text-sm text-slate-300 truncate">{portfolioName}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono-nums">
                ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} portfolio
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEditPortfolio}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit portfolio
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setExportOpen((open) => !open);
                  setMoreOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onExportJson();
                      setExportOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                  >
                    <FileJson className="w-4 h-4 text-emerald-400" />
                    Portfolio snapshot (JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExportCsv();
                      setExportOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                    Holdings (CSV)
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                aria-label="More actions"
                onClick={() => {
                  setMoreOpen((open) => !open);
                  setExportOpen(false);
                }}
                className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-white hover:border-slate-600 transition-colors flex items-center justify-center"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {moreOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onEditPortfolio();
                      setMoreOpen(false);
                    }}
                    className="sm:hidden w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit portfolio
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCommandPalette();
                      setMoreOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Quick actions
                    <span className="ml-auto text-[10px] text-slate-500">⌘K</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCompactMode();
                      setMoreOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {isCompactMode ? 'Standard layout' : 'Compact layout'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenHelpModal();
                      setMoreOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Keyboard shortcuts
                  </button>
                  {!isStandalone && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenInstallModal();
                        setMoreOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Install app
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none" aria-label="RiskLab analysis views">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                  selected
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
