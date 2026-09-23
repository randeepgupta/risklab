import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PortfolioPosition } from './types/risk';
import {
  ASSET_DATABASE,
  buildCorrelationMatrix,
  calculatePortfolioRisk,
} from './utils/quantEngine';
import { Header } from './components/Header';
import { PortfolioSetup } from './components/PortfolioSetup';
import { HoldingsTable } from './components/HoldingsTable';
import { RiskMetricsCard } from './components/RiskMetricsCard';
import { RiskContributionChart } from './components/RiskContributionChart';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { MonteCarloView } from './components/MonteCarloView';
import { StressTestingView } from './components/StressTestingView';
import { HedgingLabView } from './components/HedgingLabView';
import { DesktopInstallModal } from './components/DesktopInstallModal';
import { DesktopCommandPalette } from './components/DesktopCommandPalette';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';

const MVP_PORTFOLIO: PortfolioPosition[] = [
  {
    ticker: 'SPY',
    name: ASSET_DATABASE.SPY.name,
    assetClass: ASSET_DATABASE.SPY.assetClass,
    investment: 100000,
    weight: 0.40,
    price: ASSET_DATABASE.SPY.price,
  },
  {
    ticker: 'QQQM',
    name: ASSET_DATABASE.QQQM.name,
    assetClass: ASSET_DATABASE.QQQM.assetClass,
    investment: 70000,
    weight: 0.28,
    price: ASSET_DATABASE.QQQM.price,
  },
  {
    ticker: 'NVDA',
    name: ASSET_DATABASE.NVDA.name,
    assetClass: ASSET_DATABASE.NVDA.assetClass,
    investment: 50000,
    weight: 0.20,
    price: ASSET_DATABASE.NVDA.price,
  },
  {
    ticker: 'TSLA',
    name: ASSET_DATABASE.TSLA.name,
    assetClass: ASSET_DATABASE.TSLA.assetClass,
    investment: 30000,
    weight: 0.12,
    price: ASSET_DATABASE.TSLA.price,
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

const PRESET_NAMES: Record<string, string> = {
  mvp: 'Growth demo',
  balanced: 'Balanced core',
  semi_heavy: 'Semiconductor & AI',
  all_weather: 'All-weather macro',
};

export default function App() {
  const [positions, setPositions] = useState<PortfolioPosition[]>(MVP_PORTFOLIO);
  const [portfolioReady, setPortfolioReady] = useState(false);
  const [portfolioName, setPortfolioName] = useState('Custom portfolio');
  const [setupSeedPositions, setSetupSeedPositions] = useState<PortfolioPosition[]>([]);
  const [setupInitialValue, setSetupInitialValue] = useState(100000);
  const [activeTab, setActiveTab] = useState<RiskLabTab>(getInitialTab);

  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as any).standalone === true;
      setIsStandalone(isDisplayStandalone || isNavigatorStandalone);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (event: MediaQueryListEvent) => setIsStandalone(event.matches);
    mediaQuery.addEventListener('change', handleMediaChange);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const metrics = useMemo(() => calculatePortfolioRisk(positions), [positions]);

  const correlationData = useMemo(
    () => buildCorrelationMatrix(positions.map((position) => position.ticker)),
    [positions],
  );

  const handleAnalyzePortfolio = (newPositions: PortfolioPosition[], portfolioValue: number) => {
    setPositions(newPositions);
    setSetupSeedPositions(newPositions);
    setSetupInitialValue(portfolioValue);
    setPortfolioName('Custom portfolio');
    setActiveTab('risk');
    setPortfolioReady(true);
  };

  const handleUseSample = () => {
    setPositions(MVP_PORTFOLIO);
    setSetupSeedPositions(MVP_PORTFOLIO);
    setSetupInitialValue(250000);
    setPortfolioName(PRESET_NAMES.mvp);
    setActiveTab('risk');
    setPortfolioReady(true);
  };

  const handleEditPortfolio = () => {
    setSetupSeedPositions(positions);
    setSetupInitialValue(positions.reduce((sum, position) => sum + position.investment, 0));
    setPortfolioReady(false);
  };

  const handleSelectPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;

    setPositions(preset);
    setSetupSeedPositions(preset);
    setSetupInitialValue(preset.reduce((sum, position) => sum + position.investment, 0));
    setPortfolioName(PRESET_NAMES[key] || 'Preset portfolio');
    setActiveTab('risk');
    setPortfolioReady(true);
  };

  const handleResetToMvp = () => handleSelectPreset('mvp');

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

  const handleExportJson = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      app: 'RiskLab',
      version: '0.1',
      portfolio: {
        name: portfolioName,
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
  }, [metrics, portfolioName, positions]);

  const handleExportCsv = useCallback(() => {
    const headers = ['Ticker', 'Name', 'Asset Class', 'Price', 'Investment ($)', 'Weight (%)'];
    const rows = positions.map((position) => [
      position.ticker,
      `"${position.name.replace(/"/g, '""')}"`,
      position.assetClass,
      position.price.toFixed(2),
      position.investment.toFixed(2),
      (position.weight * 100).toFixed(2),
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `risklab-holdings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [positions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!portfolioReady) return;

      const target = event.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && !isInput) {
        if (event.key === '1') {
          event.preventDefault();
          setActiveTab('risk');
        } else if (event.key === '2') {
          event.preventDefault();
          setActiveTab('monte-carlo');
        } else if (event.key === '3') {
          event.preventDefault();
          setActiveTab('stress');
        } else if (event.key === '4') {
          event.preventDefault();
          setActiveTab('hedging');
        } else if (event.key.toLowerCase() === 'd') {
          event.preventDefault();
          setIsCompactMode((compact) => !compact);
        } else if (event.key.toLowerCase() === 'e') {
          event.preventDefault();
          handleExportJson();
        }
      }

      if (event.key === '?' && !isInput) {
        event.preventDefault();
        setIsShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportJson, portfolioReady]);

  if (!portfolioReady) {
    return (
      <PortfolioSetup
        initialPositions={setupSeedPositions}
        initialPortfolioValue={setupInitialValue}
        onAnalyze={handleAnalyzePortfolio}
        onUseSample={handleUseSample}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 font-sans">
      <Header
        portfolioName={portfolioName}
        totalValue={metrics.totalValue}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onEditPortfolio={handleEditPortfolio}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenHelpModal={() => setIsShortcutsModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isStandalone={isStandalone}
        isCompactMode={isCompactMode}
        onToggleCompactMode={() => setIsCompactMode((compact) => !compact)}
      />

      <main className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 transition-all ${
        isCompactMode ? 'py-3 space-y-4' : 'py-6 space-y-6'
      }`}>
        {activeTab === 'risk' && (
          <div className={`animate-fadeIn ${isCompactMode ? 'space-y-4' : 'space-y-6'}`}>
            <RiskMetricsCard metrics={metrics} />

            <HoldingsTable
              positions={positions}
              onUpdatePositions={setPositions}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RiskContributionChart
                contributions={metrics.riskContributions}
                portfolioVol={metrics.annualizedVolatility}
              />
              <CorrelationMatrix data={correlationData} />
            </div>
          </div>
        )}

        {activeTab === 'monte-carlo' && (
          <div className="animate-fadeIn">
            <MonteCarloView
              initialValue={metrics.totalValue}
              expectedReturn={metrics.expectedAnnualReturn}
              volatility={metrics.annualizedVolatility}
            />
          </div>
        )}

        {activeTab === 'stress' && (
          <div className="animate-fadeIn">
            <StressTestingView positions={positions} />
          </div>
        )}

        {activeTab === 'hedging' && (
          <div className="animate-fadeIn">
            <HedgingLabView positions={positions} metrics={metrics} />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900/90 py-5 mt-10 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span><strong className="text-slate-400">RiskLab</strong> · Quantitative portfolio risk analytics</span>
          <span>Educational analytics only · Not investment advice</span>
        </div>
      </footer>

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
        onToggleCompactMode={() => setIsCompactMode((compact) => !compact)}
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
