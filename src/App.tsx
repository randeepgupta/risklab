import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PortfolioPosition } from './types/risk';
import {
  ASSET_DATABASE,
  calculatePortfolioRisk,
  buildCorrelationMatrix,
} from './utils/quantEngine';
import { Header } from './components/Header';
import { HoldingsTable } from './components/HoldingsTable';
import { RiskMetricsCard } from './components/RiskMetricsCard';
import { RiskContributionChart } from './components/RiskContributionChart';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { MonteCarloView } from './components/MonteCarloView';
import { StressTestingView } from './components/StressTestingView';
import { HedgingLabView } from './components/HedgingLabView';
import { DesktopTitlebar } from './components/DesktopTitlebar';
import { DesktopInstallModal } from './components/DesktopInstallModal';
import { DesktopCommandPalette } from './components/DesktopCommandPalette';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';

// Preset portfolios
const MVP_PORTFOLIO: PortfolioPosition[] = [
  {
    ticker: 'SPY',
    name: ASSET_DATABASE['SPY'].name,
    assetClass: ASSET_DATABASE['SPY'].assetClass,
    investment: 100000,
    weight: 0.40,
    price: ASSET_DATABASE['SPY'].price,
  },
  {
    ticker: 'QQQM',
    name: ASSET_DATABASE['QQQM'].name,
    assetClass: ASSET_DATABASE['QQQM'].assetClass,
    investment: 70000,
    weight: 0.28,
    price: ASSET_DATABASE['QQQM'].price,
  },
  {
    ticker: 'NVDA',
    name: ASSET_DATABASE['NVDA'].name,
    assetClass: ASSET_DATABASE['NVDA'].assetClass,
    investment: 50000,
    weight: 0.20,
    price: ASSET_DATABASE['NVDA'].price,
  },
  {
    ticker: 'TSLA',
    name: ASSET_DATABASE['TSLA'].name,
    assetClass: ASSET_DATABASE['TSLA'].assetClass,
    investment: 30000,
    weight: 0.12,
    price: ASSET_DATABASE['TSLA'].price,
  },
];

type RiskLabTab = 'risk' | 'monte-carlo' | 'stress' | 'hedging';

function getInitialTab(): RiskLabTab {
  if (typeof window === 'undefined') return 'risk';
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (tab === 'monte-carlo' || tab === 'stress' || tab === 'hedging' || tab === 'risk') {
    return tab;
  }
  return 'risk';
}

const PRESETS: Record<string, PortfolioPosition[]> = {
  mvp: MVP_PORTFOLIO,
  balanced: [
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'US Large Cap', investment: 110000, weight: 0.44, price: 540 },
    { ticker: 'BND', name: 'Total Bond Market ETF', assetClass: 'Fixed Income', investment: 70000, weight: 0.28, price: 72 },
    { ticker: 'GLD', name: 'SPDR Gold Trust', assetClass: 'Commodities', investment: 35000, weight: 0.14, price: 235 },
    { ticker: 'AAPL', name: 'Apple Inc.', assetClass: 'Tech Mega', investment: 35000, weight: 0.14, price: 220 },
  ],
  semi_heavy: [
    { ticker: 'NVDA', name: 'NVIDIA Corporation', assetClass: 'Semiconductors', investment: 90000, weight: 0.36, price: 125 },
    { ticker: 'TSM', name: 'Taiwan Semiconductor Mfg', assetClass: 'Semiconductors', investment: 60000, weight: 0.24, price: 170 },
    { ticker: 'AMD', name: 'Advanced Micro Devices', assetClass: 'Semiconductors', investment: 50000, weight: 0.20, price: 155 },
    { ticker: 'MSFT', name: 'Microsoft Corporation', assetClass: 'Tech Mega', investment: 50000, weight: 0.20, price: 430 },
  ],
  all_weather: [
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'US Large Cap', investment: 75000, weight: 0.30, price: 540 },
    { ticker: 'TLT', name: '20+ Year Treasury Bond ETF', assetClass: 'Fixed Income', investment: 60000, weight: 0.24, price: 93 },
    { ticker: 'GLD', name: 'SPDR Gold Trust', assetClass: 'Commodities', investment: 40000, weight: 0.16, price: 235 },
    { ticker: 'XLE', name: 'Energy Select Sector SPDR', assetClass: 'Energy Equity', investment: 40000, weight: 0.16, price: 88 },
    { ticker: 'BND', name: 'Total Bond Market ETF', assetClass: 'Fixed Income', investment: 35000, weight: 0.14, price: 72 },
  ],
};

export default function App() {
  const [positions, setPositions] = useState<PortfolioPosition[]>(MVP_PORTFOLIO);
  const [activeTab, setActiveTab] = useState<RiskLabTab>(getInitialTab);
  const [activePreset, setActivePreset] = useState<string>('mvp');

  // Desktop workstation states
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);

  // Check standalone desktop status & listen for PWA install prompt
  useEffect(() => {
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as any).standalone === true;
      setIsStandalone(isDisplayStandalone || isNavigatorStandalone);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mediaQuery.addEventListener('change', handleMediaChange);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Quant metrics recalculated reactively
  const metrics = useMemo(() => {
    return calculatePortfolioRisk(positions);
  }, [positions]);

  const correlationData = useMemo(() => {
    return buildCorrelationMatrix(positions.map(p => p.ticker));
  }, [positions]);

  const handleSelectPreset = (key: string) => {
    if (PRESETS[key]) {
      setPositions(PRESETS[key]);
      setActivePreset(key);
    }
  };

  const handleResetToMvp = () => {
    setPositions(MVP_PORTFOLIO);
    setActivePreset('mvp');
  };

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
      setIsInstallModalOpen(false);
    } else {
      setIsInstallModalOpen(true);
    }
  };

  // Export JSON snapshot
  const handleExportJson = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      app: 'RiskLab Desktop Workstation',
      version: '0.1',
      portfolio: {
        totalValue: metrics.totalValue,
        volatility: metrics.annualizedVolatility,
        sharpeRatio: metrics.sharpeRatio,
        var95_1d: metrics.var95_1d,
        cvar95_1d: metrics.cvar95_1d,
        positions,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `risklab-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [metrics, positions]);

  // Export CSV snapshot
  const handleExportCsv = useCallback(() => {
    const headers = ['Ticker', 'Name', 'Asset Class', 'Price', 'Investment ($)', 'Weight (%)'];
    const rows = positions.map(p => [
      p.ticker,
      `"${p.name.replace(/"/g, '""')}"`,
      p.assetClass,
      p.price.toFixed(2),
      p.investment.toFixed(2),
      (p.weight * 100).toFixed(2),
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `risklab-holdings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [positions]);

  // Global desktop keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Cmd/Ctrl + K: Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // Cmd/Ctrl + 1 to 4: Tabs
      if ((e.metaKey || e.ctrlKey) && !isInput) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('risk');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('monte-carlo');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('stress');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('hedging');
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          setIsCompactMode(prev => !prev);
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          handleExportJson();
        }
      }

      // '?' key for shortcuts help (when outside inputs)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportJson]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 font-sans">
      {/* Desktop Workstation Window Titlebar */}
      <DesktopTitlebar
        isStandalone={isStandalone}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenHelpModal={() => setIsShortcutsModalOpen(true)}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        isCompactMode={isCompactMode}
        onToggleCompactMode={() => setIsCompactMode(prev => !prev)}
        installPromptAvailable={Boolean(deferredPrompt)}
      />

      {/* Institutional Header with Metrics Bar */}
      <Header
        metrics={metrics}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectPreset={handleSelectPreset}
        activePreset={activePreset}
        onResetToMvp={handleResetToMvp}
      />

      {/* Main Content Area with adaptive density */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 transition-all ${
        isCompactMode ? 'py-3 space-y-4' : 'py-6 space-y-6'
      }`}>
        {/* TAB 1: Portfolio Risk & VaR */}
        {activeTab === 'risk' && (
          <div className={`animate-fadeIn ${isCompactMode ? 'space-y-4' : 'space-y-6'}`}>
            {/* 4 Core Quantitative Metrics */}
            <RiskMetricsCard metrics={metrics} />

            {/* Holdings Management Table */}
            <HoldingsTable
              positions={positions}
              onUpdatePositions={setPositions}
            />

            {/* Risk Contribution & Correlation Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RiskContributionChart
                contributions={metrics.riskContributions}
                portfolioVol={metrics.annualizedVolatility}
              />
              <CorrelationMatrix data={correlationData} />
            </div>
          </div>
        )}

        {/* TAB 2: Monte Carlo Simulation */}
        {activeTab === 'monte-carlo' && (
          <div className="animate-fadeIn">
            <MonteCarloView
              initialValue={metrics.totalValue}
              expectedReturn={metrics.expectedAnnualReturn}
              volatility={metrics.annualizedVolatility}
            />
          </div>
        )}

        {/* TAB 3: Stress Testing & Factor Scenario Engine */}
        {activeTab === 'stress' && (
          <div className="animate-fadeIn">
            <StressTestingView positions={positions} />
          </div>
        )}

        {/* TAB 4: Hedging Lab & Conversational AI Copilot */}
        {activeTab === 'hedging' && (
          <div className="animate-fadeIn">
            <HedgingLabView positions={positions} metrics={metrics} />
          </div>
        )}
      </main>

      {/* Institutional Quant Desktop Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-3 mt-12 text-xs text-slate-500 font-mono-nums">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">RiskLab Workstation</span>
            <span>• Quantitative Risk Architecture & PWA Desktop Engine</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span>Kernel: GBM & Black-Scholes</span>
            <span>•</span>
            <span>VaR: Parametric Delta-Normal</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsShortcutsModalOpen(true)}
              className="hover:text-emerald-400 underline transition-colors cursor-pointer"
            >
              Shortcuts (⌘K / ?)
            </button>
            {!isStandalone && (
              <>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setIsInstallModalOpen(true)}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  Install Desktop App
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Modals */}
      <DesktopInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        onTriggerInstall={handleTriggerInstall}
        installPromptAvailable={Boolean(deferredPrompt)}
        isStandalone={isStandalone}
      />

      <DesktopCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
        onSelectPreset={handleSelectPreset}
        onToggleCompactMode={() => setIsCompactMode(prev => !prev)}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onResetToMvp={handleResetToMvp}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
}

