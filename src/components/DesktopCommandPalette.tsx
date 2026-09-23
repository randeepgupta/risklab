import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Activity,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Maximize2,
  Minimize2,
  Download,
  FileJson,
  FileSpreadsheet,
  Sliders,
  RefreshCw,
  X,
  Layers
} from 'lucide-react';

interface CommandItem {
  id: string;
  category: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface DesktopCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: 'risk' | 'monte-carlo' | 'stress' | 'hedging') => void;
  onSelectPreset: (presetKey: string) => void;
  onToggleCompactMode: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onOpenInstallModal: () => void;
  onResetToMvp: () => void;
}

export const DesktopCommandPalette: React.FC<DesktopCommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  onSelectPreset,
  onToggleCompactMode,
  onExportJson,
  onExportCsv,
  onOpenInstallModal,
  onResetToMvp,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    // Tabs
    {
      id: 'tab-risk',
      category: 'Analysis Views',
      label: 'Portfolio Risk & VaR Analysis',
      description: 'Parametric VaR, CVaR, Euler risk decomposition, and correlation matrix',
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      shortcut: '⌘1',
      action: () => {
        setActiveTab('risk');
        onClose();
      },
    },
    {
      id: 'tab-monte-carlo',
      category: 'Analysis Views',
      label: 'Monte Carlo Simulation Engine',
      description: 'Geometric Brownian Motion stochastic path projections (1,000 runs)',
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      shortcut: '⌘2',
      action: () => {
        setActiveTab('monte-carlo');
        onClose();
      },
    },
    {
      id: 'tab-stress',
      category: 'Analysis Views',
      label: 'Macro Stress Testing & Scenario Engine',
      description: 'Tech Crash, Rates Spike, Stagflation, and Custom multi-factor shocks',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
      shortcut: '⌘3',
      action: () => {
        setActiveTab('stress');
        onClose();
      },
    },
    {
      id: 'tab-hedging',
      category: 'Analysis Views',
      label: 'Options Hedging Lab & AI Copilot',
      description: 'Black-Scholes protective puts, collar strategies, and Gemini quant analyst',
      icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
      shortcut: '⌘4',
      action: () => {
        setActiveTab('hedging');
        onClose();
      },
    },

    // Presets
    {
      id: 'preset-mvp',
      category: 'Portfolio Presets',
      label: 'Load MVP Tech Growth ($250,000)',
      description: 'SPY, QQQM, NVDA, TSLA standard prompt scenario',
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      action: () => {
        onSelectPreset('mvp');
        onClose();
      },
    },
    {
      id: 'preset-balanced',
      category: 'Portfolio Presets',
      label: 'Load Balanced 60/40 Core',
      description: 'Equities (SPY, AAPL) + Fixed Income (BND) + Gold (GLD)',
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      action: () => {
        onSelectPreset('balanced');
        onClose();
      },
    },
    {
      id: 'preset-semi',
      category: 'Portfolio Presets',
      label: 'Load Semiconductor & AI Heavy',
      description: 'NVDA, TSM, AMD, MSFT concentrated hardware exposure',
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      action: () => {
        onSelectPreset('semi_heavy');
        onClose();
      },
    },
    {
      id: 'preset-all-weather',
      category: 'Portfolio Presets',
      label: 'Load All-Weather Macro Portfolio',
      description: 'Diversified stocks, long-term treasuries, energy, and gold',
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      action: () => {
        onSelectPreset('all_weather');
        onClose();
      },
    },

    // Workstation Tools
    {
      id: 'toggle-fullscreen',
      category: 'App Controls',
      label: 'Toggle Fullscreen Mode',
      description: 'Maximize window to display-grade workstation canvas',
      icon: <Maximize2 className="w-4 h-4 text-slate-300" />,
      shortcut: 'F11',
      action: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
        onClose();
      },
    },
    {
      id: 'toggle-density',
      category: 'App Controls',
      label: 'Toggle Compact Layout',
      description: 'Switch between spacious and compact analysis layouts',
      icon: <Sliders className="w-4 h-4 text-slate-300" />,
      shortcut: '⌘D',
      action: () => {
        onToggleCompactMode();
        onClose();
      },
    },
    {
      id: 'export-json',
      category: 'App Controls',
      label: 'Export Portfolio Snapshot (JSON)',
      description: 'Download full portfolio positions and risk metrics snapshot',
      icon: <FileJson className="w-4 h-4 text-emerald-400" />,
      shortcut: '⌘E',
      action: () => {
        onExportJson();
        onClose();
      },
    },
    {
      id: 'export-csv',
      category: 'App Controls',
      label: 'Export Holdings Spreadsheet (CSV)',
      description: 'Download comma-separated holdings table',
      icon: <FileSpreadsheet className="w-4 h-4 text-cyan-400" />,
      action: () => {
        onExportCsv();
        onClose();
      },
    },
    {
      id: 'install-desktop',
      category: 'App Controls',
      label: 'Install RiskLab Desktop App (PWA)',
      description: 'Launch installation flow for macOS / Windows / Linux desktop',
      icon: <Download className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onOpenInstallModal();
        onClose();
      },
    },
    {
      id: 'reset-mvp',
      category: 'App Controls',
      label: 'Load Growth Demo Portfolio',
      description: 'Load the $250K sample growth portfolio',
      icon: <RefreshCw className="w-4 h-4 text-rose-400" />,
      action: () => {
        onResetToMvp();
        onClose();
      },
    },
  ];

  const filtered = commands.filter((cmd) => {
    const text = `${cmd.category} ${cmd.label} ${cmd.description || ''}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950/70">
          <Search className="w-5 h-5 text-emerald-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, scenario, preset or view..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline px-2 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400 ml-2">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden p-1 text-slate-400 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-800/50">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="shrink-0 p-1.5 rounded-md bg-slate-950 border border-slate-800">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold truncate">{item.label}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950/80 text-slate-500 border border-slate-800">
                          {item.category}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {item.shortcut && (
                    <kbd className="shrink-0 ml-3 px-2 py-0.5 text-[10px] font-mono rounded bg-slate-950 border border-slate-800 text-slate-400">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center space-x-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to dismiss</span>
          </div>
          <span>RiskLab</span>
        </div>
      </div>
    </div>
  );
};
