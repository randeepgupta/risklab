import {formatDate,parseUSDate} from './utils/dateFormat';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PortfolioPosition } from './types/risk';
import {createRandomSamplePortfolio, SAMPLE_PORTFOLIO_VALUE} from './utils/samplePortfolio';
import {
  ASSET_DATABASE,
  buildPositionCorrelationMatrix,
  calculatePortfolioRisk,
} from './utils/quantEngine';
import { Header } from './components/Header';
import { PortfolioSetup } from './components/PortfolioSetup';
import { HoldingsTable } from './components/HoldingsTable';
import { RiskMetricsCard } from './components/RiskMetricsCard';
import { PortfolioSummary } from './components/PortfolioSummary';
import { RiskContributionChart } from './components/RiskContributionChart';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { MonteCarloView } from './components/MonteCarloView';
import { StressTestingView } from './components/StressTestingView';
import {CopilotPanel} from './components/CopilotPanel';
import {WelcomePage} from './components/WelcomePage';
import {PortfolioSnapshot} from './components/PortfolioSnapshot';
import { DesktopInstallModal } from './components/DesktopInstallModal';
import { DesktopCommandPalette } from './components/DesktopCommandPalette';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import {loadRiskSnapshot, applyHistoricalSnapshot, type RiskSnapshot} from './utils/riskSnapshot';
import {PortfolioLibraryDialog,downloadPortfolioBackup} from './components/PortfolioLibraryDialog';
import {usePortfolioLibrary} from './hooks/usePortfolioLibrary';
import {createScenarioSession,DEFAULT_FUTURE_SETTINGS,localDate} from './utils/workspaceSettings';
import {validateSavedPortfolio,workspaceFingerprint} from './utils/savedPortfolios';
import type {FutureSettings,ScenarioSession,SavedPortfolio} from './types/workspace';
import {CsvImportDialog,type CsvImportRequest} from './components/CsvImportDialog';
import {buildCsvPositions} from './utils/csvPortfolio';

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

type RiskLabTab = 'risk' | 'monte-carlo' | 'stress';
function initialPage(): 'welcome' | 'lab' {
  return typeof window !== 'undefined' && (window.location.pathname === '/lab' || new URLSearchParams(window.location.search).has('tab')) ? 'lab' : 'welcome';
}

function getInitialTab(): RiskLabTab {
  if (typeof window === 'undefined') return 'risk';
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (tab === 'monte-carlo' || tab === 'stress' || tab === 'risk') {
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
  const [page, setPage] = useState(initialPage);
  const [isSampleLoading, setIsSampleLoading] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'hedging');
  const closeCopilot = useCallback(() => setIsCopilotOpen(false), []);
  const openCopilot = useCallback(() => setIsCopilotOpen(true), []);
  const navigateTo = useCallback((next: 'welcome' | 'lab') => {
    setPage(next);
    setIsCopilotOpen(false);
    window.history.pushState({}, '', next === 'lab' ? '/lab' : '/');
    window.scrollTo({top: 0});
  }, []);
  useEffect(() => {
    const onPopState = () => {setPage(initialPage()); setIsCopilotOpen(false);};
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [riskSnapshot, setRiskSnapshot] = useState<RiskSnapshot | null>(null);
  const [modelError, setModelError] = useState('');
  useEffect(() => {if (page === 'lab') loadRiskSnapshot().then(setRiskSnapshot).catch(error => setModelError(error.message));}, [page]);
  const retryRiskSnapshot = () => {setModelError(''); loadRiskSnapshot().then(setRiskSnapshot).catch(error => setModelError(error.message));};
  const historicalTickers = useMemo(() => new Set<string>(Object.keys(riskSnapshot?.symbols || {})), [riskSnapshot]);
  const [positions, setPositions] = useState<PortfolioPosition[]>(MVP_PORTFOLIO);
  const [portfolioReady, setPortfolioReady] = useState(false);
  const [isSamplePortfolio, setIsSamplePortfolio] = useState(false);
  const [portfolioName, setPortfolioName] = useState('Custom portfolio');
  const [setupSeedPositions, setSetupSeedPositions] = useState<PortfolioPosition[]>([]);
  const [setupInitialValue, setSetupInitialValue] = useState(100000);
  const [activeTab, setActiveTab] = useState<RiskLabTab>(getInitialTab);
  const library = usePortfolioLibrary();
  const [libraryOpen,setLibraryOpen] = useState(false);
  const [importOpen,setImportOpen] = useState(false);
  const [pendingResume,setPendingResume] = useState<SavedPortfolio|null>(null);
  const [activeSavedId,setActiveSavedId] = useState<string|null>(null);
  const [activeSavedVersion,setActiveSavedVersion] = useState<string|undefined>();
  const [valuationDate,setValuationDate] = useState(localDate);
  const [futureSettings,setFutureSettings] = useState<FutureSettings>({...DEFAULT_FUTURE_SETTINGS});
  const [scenarioSession,setScenarioSession] = useState<ScenarioSession>(createScenarioSession);
  const [workspaceGeneration,setWorkspaceGeneration] = useState(0);
  const [resumeNote,setResumeNote] = useState('');
  const openLibrary = () => {library.setMessage('');setPendingResume(null);setIsCopilotOpen(false);setLibraryOpen(true);};
  const openImport = () => {setIsCopilotOpen(false);setImportOpen(true);};
  const resetAnalysisSettings = () => {
    setFutureSettings({...DEFAULT_FUTURE_SETTINGS});setScenarioSession(createScenarioSession());
    setActiveSavedId(null);setActiveSavedVersion(undefined);setValuationDate(localDate());
    setResumeNote('');setWorkspaceGeneration(value=>value+1);
  };


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
    () => buildPositionCorrelationMatrix(positions),
    [positions],
  );

  const handleAnalyzePortfolio = (newPositions: PortfolioPosition[], portfolioValue: number) => {
    let analyzed = newPositions;
    try {
      if (!riskSnapshot) throw new Error('Historical snapshot is still loading. Please retry.');
      analyzed = applyHistoricalSnapshot(newPositions, riskSnapshot);
    } catch (error) {setModelError(error instanceof Error ? error.message : 'Could not calculate historical risk.'); return;}
    setModelError('');
    setPositions(analyzed);
    setSetupSeedPositions(analyzed);
    setSetupInitialValue(portfolioValue);
    setIsSamplePortfolio(false);
    if(isSamplePortfolio&&!activeSavedId) setPortfolioName('Custom portfolio');
    setActiveTab('risk');
    setPortfolioReady(true);
  };

  const handleImportPortfolio = (request:CsvImportRequest):string|null => {
    try {
      if(!riskSnapshot) throw new Error('Historical models are still loading. Retry before importing.');
      if(!request.name.trim()||request.name.length>80||parseUSDate(formatDate(request.valuationDate))!==request.valuationDate||request.valuationDate>localDate()) throw new Error('Check the portfolio name and valuation date.');
      const imported=buildCsvPositions(request.table,request.mapping,new Set(Object.keys(riskSnapshot.symbols)),request.symbols,request.combineDuplicates);
      // Compute every model before changing any open or saved inputs.
      const calibrated=applyHistoricalSnapshot(imported.positions,riskSnapshot);
      resetAnalysisSettings();
      setPositions(calibrated);setSetupSeedPositions(calibrated);setSetupInitialValue(imported.total);
      setPortfolioName(request.name.trim());setValuationDate(request.valuationDate);
      setIsSamplePortfolio(false);setActiveTab('risk');setPortfolioReady(true);setModelError('');
      setImportOpen(false);setIsCopilotOpen(false);
      if(page!=='lab')navigateTo('lab');
      return null;
    } catch(error) {return error instanceof Error?error.message:'The import could not be applied. Your open inputs are unchanged.';}
  };
  const importDialog=<CsvImportDialog open={importOpen} onClose={()=>setImportOpen(false)} covered={historicalTickers}
    snapshotAsOf={riskSnapshot?.asOf} modelError={riskSnapshot?'':modelError} onRetrySnapshot={retryRiskSnapshot}
    replacesOpen={portfolioReady||setupSeedPositions.length>0} onImport={handleImportPortfolio}/>;

  const handleUseSample = async () => {
    if (isSampleLoading) return;
    setIsSampleLoading(true);
    let sample = createRandomSamplePortfolio();
    try {
      const snapshot = riskSnapshot ?? await loadRiskSnapshot();
      setRiskSnapshot(snapshot);
      sample = applyHistoricalSnapshot(sample, snapshot);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Could not calculate sample risk.');
      setIsSampleLoading(false);
      return;
    }
    setModelError('');
    resetAnalysisSettings();
    setPositions(sample);
    setSetupSeedPositions(sample);
    setSetupInitialValue(SAMPLE_PORTFOLIO_VALUE);
    if (page !== 'lab') navigateTo('lab');
    setIsCopilotOpen(false);
    setIsSamplePortfolio(true);
    setIsSampleLoading(false);
    setPortfolioName('Random sample portfolio');
    setActiveTab('risk');
    setPortfolioReady(true);
  };

  const handleUpdatePositions = (newPositions: PortfolioPosition[]) => {
    try {
      if (!riskSnapshot) throw new Error('Historical snapshot is still loading. Please retry.');
      const next = applyHistoricalSnapshot(newPositions, riskSnapshot);
      setPositions(next); setModelError('');
      setIsSamplePortfolio(false);
      if(!activeSavedId) setPortfolioName('Custom portfolio');
    } catch (error) {setModelError(error instanceof Error ? error.message : 'Unable to update risk models.');}
  };

  const handleEditPortfolio = () => {
    setIsCopilotOpen(false);
    setSetupSeedPositions(positions);
    setSetupInitialValue(positions.reduce((sum, position) => sum + position.investment, 0));
    setPortfolioReady(false);
  };

  const handleSelectPreset = async (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;

    let calibrated: PortfolioPosition[];
    try {
      const snapshot = riskSnapshot ?? await loadRiskSnapshot();
      setRiskSnapshot(snapshot);
      calibrated = applyHistoricalSnapshot(preset, snapshot);
    } catch (error) {setModelError(error instanceof Error ? error.message : 'Could not load portfolio history.'); return;}
    setModelError('');
    resetAnalysisSettings();
    setPositions(calibrated);
    setSetupSeedPositions(calibrated);
    setSetupInitialValue(preset.reduce((sum, position) => sum + position.investment, 0));
    setIsSamplePortfolio(true);
    setPortfolioName(PRESET_NAMES[key] || 'Preset portfolio');
    setActiveTab('risk');
    setPortfolioReady(true);
  };

  const handleResetToMvp = () => handleSelectPreset('mvp');

  const workspaceInput = {
    name:portfolioName,valuationDate,
    holdings:positions.map(({ticker,name,investment})=>({ticker,name,investment})),
    settings:{activeTab,future:futureSettings,scenario:scenarioSession},
  };
  const activeSaved = library.library.portfolios.find(portfolio=>portfolio.id===activeSavedId);
  const hasUnsavedChanges = !activeSaved || workspaceFingerprint(workspaceInput)!==workspaceFingerprint(activeSaved);
  const prepareCurrentSave = (name:string,date:string,copy:boolean) => {
    if(!portfolioReady || !riskSnapshot) throw new Error('Open an analyzed portfolio before saving.');
    if(date>localDate()) throw new Error('Allocation values cannot be dated in the future.');
    const now=new Date().toISOString();
    return validateSavedPortfolio({
      ...workspaceInput,name,valuationDate:date,id:!copy&&activeSavedId?activeSavedId:crypto.randomUUID(),
      createdAt:!copy&&activeSaved?activeSaved.createdAt:now,updatedAt:now,currency:'USD',
      modelContext:{asOf:riskSnapshot.asOf,capturedAt:riskSnapshot.capturedAt,sourceRevision:riskSnapshot.sourceRevision},
    });
  };
  const handleSavePortfolio = (name:string,date:string,copy:boolean) => {
    try {
      const portfolio=prepareCurrentSave(name,date,copy);
      if(library.save(portfolio,!copy?activeSavedVersion:undefined)) {
        setPortfolioName(portfolio.name);setValuationDate(portfolio.valuationDate);
        setActiveSavedId(portfolio.id);setActiveSavedVersion(portfolio.updatedAt);
      }
    } catch(error) {library.setMessage(error instanceof Error?error.message:'Could not save the portfolio.');}
  };
  const handleDownloadCurrent = (name:string,date:string) => {
    try {downloadPortfolioBackup({app:'RiskLab',schemaVersion:1,portfolios:[prepareCurrentSave(name,date,true)]});}
    catch(error) {library.setMessage(error instanceof Error?error.message:'Could not prepare this backup.');}
  };
  const handleResumePortfolio = async (portfolio:SavedPortfolio,discardOpenChanges=false) => {
    if(isSampleLoading) return;
    if(portfolioReady&&hasUnsavedChanges&&!discardOpenChanges) {setPendingResume(portfolio);setLibraryOpen(true);return;}
    setPendingResume(null);
    setIsSampleLoading(true);setModelError('');
    try {
      const saved=validateSavedPortfolio(portfolio);
      const snapshot=riskSnapshot??await loadRiskSnapshot();
      setRiskSnapshot(snapshot);
      const total=saved.holdings.reduce((sum,p)=>sum+p.investment,0);
      const restored:PortfolioPosition[]=saved.holdings.map(p=>({...p,weight:p.investment/total,price:0,assetClass:ASSET_DATABASE[p.ticker]?.assetClass??'Other'}));
      setSetupSeedPositions(restored);setSetupInitialValue(total);
      setPortfolioName(saved.name);setValuationDate(saved.valuationDate);
      setFutureSettings(saved.settings.future);setScenarioSession(saved.settings.scenario);
      setActiveSavedId(saved.id);setActiveSavedVersion(saved.updatedAt);
      setWorkspaceGeneration(value=>value+1);setIsSamplePortfolio(false);
      setIsCopilotOpen(false);setLibraryOpen(false);
      if(page!=='lab') navigateTo('lab');
      try {
        const calibrated=applyHistoricalSnapshot(restored,snapshot);
        setPositions(calibrated);setPortfolioReady(true);setActiveTab(saved.settings.activeTab);
        const changed=JSON.stringify(saved.modelContext)!==JSON.stringify({asOf:snapshot.asOf,capturedAt:snapshot.capturedAt,sourceRevision:snapshot.sourceRevision});
        setResumeNote(changed
          ? `The model snapshot has changed since this save. Results were recalculated using data through ${formatDate(snapshot.asOf)}.`
          : `Resumed “${saved.name}”. Results use the current snapshot through ${formatDate(snapshot.asOf)}. Simulations are rerun from your saved assumptions.`);
      } catch(error) {
        setPortfolioReady(false);
        setModelError(`Your saved allocation has been kept. ${error instanceof Error?error.message:'Historical models are unavailable.'} Review the holdings below before analyzing.`);
      }
    } catch(error) {library.setMessage(error instanceof Error?error.message:'Could not resume this saved portfolio.');}
    finally {setIsSampleLoading(false);}
  };
  const libraryDialog=<PortfolioLibraryDialog open={libraryOpen} onClose={()=>{setLibraryOpen(false);setPendingResume(null);}}
    pendingResume={pendingResume} onConfirmResume={()=>pendingResume&&handleResumePortfolio(pendingResume,true)}
    library={library.library} error={library.error} blocked={library.blocked} message={library.message}
    current={portfolioReady?{id:activeSavedId,name:portfolioName,valuationDate,dirty:hasUnsavedChanges}:undefined}
    loading={isSampleLoading} onSave={handleSavePortfolio} onDownloadCurrent={handleDownloadCurrent} onResume={handleResumePortfolio}
    onDelete={id=>{if(library.remove(id)&&id===activeSavedId){setActiveSavedId(null);setActiveSavedVersion(undefined);}}}
    onRestore={library.restore} onClear={library.clearUnreadable} onRetry={library.retry}/>;


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
    const headers = ['Ticker', 'Name', 'Asset Class', 'Price', 'Investment ($)', 'Weight (%)', 'Risk Proxy', 'Risk Model', 'Data Through'];
    const rows = positions.map((position) => [
      position.ticker,
      `"${position.name.replace(/"/g, '""')}"`,
      position.assetClass,
      position.price > 0 ? position.price.toFixed(2) : '',
      position.investment.toFixed(2),
      (position.weight * 100).toFixed(2),
      position.riskProxyTicker || '',
      position.historicalModel ? 'Historical snapshot' : 'Preset assumptions',
      position.historicalModel?.endDate || '',
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
      if (!portfolioReady || page !== 'lab' || libraryOpen || importOpen) return;

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
          setActiveTab('stress');
        } else if (event.key === '3') {
          event.preventDefault();
          setActiveTab('monte-carlo');
        } else if (event.key === '4') {
          event.preventDefault();
          setIsCopilotOpen(open => !open);
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
  }, [handleExportJson, portfolioReady, page, libraryOpen, importOpen]);

  if (page === 'welcome') return <><WelcomePage onEnterLab={() => navigateTo('lab')}
    onUseSample={handleUseSample} hasPortfolio={portfolioReady} isSampleLoading={isSampleLoading} error={modelError} onOpenSaved={openLibrary}
    savedPortfolios={library.library.portfolios} onResumeSaved={handleResumePortfolio} />{libraryDialog}{importDialog}</>;

  if (!portfolioReady) {
    return (
      <>
      <PortfolioSetup
        onHome={() => navigateTo('welcome')}
        onOpenSaved={openLibrary}
        onImportCsv={openImport}
        isSampleLoading={isSampleLoading}
        initialPositions={setupSeedPositions}
        initialPortfolioValue={setupInitialValue}
        onAnalyze={handleAnalyzePortfolio}
        onUseSample={handleUseSample}
        historicalTickers={historicalTickers} snapshotAsOf={riskSnapshot?.asOf} modelError={modelError} onRetrySnapshot={retryRiskSnapshot}
      />
      {libraryDialog}{importDialog}</>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 font-sans">
      <Header
        portfolioName={portfolioName}
        onOpenSaved={openLibrary}
        onImportCsv={openImport}
        hasUnsavedChanges={hasUnsavedChanges}
        totalValue={metrics.totalValue}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onHome={() => navigateTo('welcome')}
        onOpenCopilot={() => setIsCopilotOpen(open => !open)}
        isCopilotOpen={isCopilotOpen}
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
      } ${isCopilotOpen ? 'lg:mr-[460px] lg:w-[calc(100%-460px)]' : ''}`}>
        {modelError && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{modelError}</p>}
        {activeTab === 'risk' && <PortfolioSnapshot positions={positions} isSample={isSamplePortfolio}
          onEdit={handleEditPortfolio} onNewSample={handleUseSample} loading={isSampleLoading} />}
        {activeTab === 'risk' && (
          <div className={`animate-fadeIn ${isCompactMode ? 'space-y-4' : 'space-y-6'}`}>
            <PortfolioSummary
              metrics={metrics}
              positions={positions}
              onOpenStress={() => setActiveTab('stress')}
              onOpenFuture={() => setActiveTab('monte-carlo')}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RiskContributionChart
                contributions={metrics.riskContributions}
                portfolioVol={metrics.annualizedVolatility}
              />
              <CorrelationMatrix data={correlationData} />
            </div>

            <HoldingsTable
              positions={positions}
              onUpdatePositions={handleUpdatePositions}
              historicalTickers={historicalTickers}
            />

            <details className="group bg-slate-900/40 border border-slate-800 rounded-xl p-5">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">Advanced risk metrics</div>
                  <div className="text-xs text-slate-400 mt-0.5">VaR, expected shortfall, Sharpe, Sortino, beta, and model assumptions.</div>
                </div>
                <span className="text-xs text-slate-500 group-open:text-emerald-400">Show details</span>
              </summary>
              <div className="mt-5 pt-5 border-t border-slate-800">
                <RiskMetricsCard metrics={metrics} />
              </div>
            </details>
          </div>
        )}

        {activeTab === 'monte-carlo' && (
          <div className="animate-fadeIn">
            <MonteCarloView
              key={workspaceGeneration}
              settings={futureSettings} onSettingsChange={setFutureSettings}
              initialValue={metrics.totalValue}
              volatilitySource="Estimated from historical prices and correlations"
              volatility={metrics.annualizedVolatility}
            />
          </div>
        )}

        {activeTab === 'stress' && (
          <div className="animate-fadeIn">
            <StressTestingView key={workspaceGeneration} positions={positions} session={scenarioSession} onSessionChange={setScenarioSession} />
          </div>
        )}

        {resumeNote && <p role="status" className="text-xs leading-relaxed text-slate-400">{resumeNote}</p>}
        {positions[0]?.historicalModel && <details className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-slate-300">
          <summary className="cursor-pointer font-semibold text-emerald-300">Historical risk · Data through {formatDate(positions[0].historicalModel.endDate)} · About this model</summary>
          <p className="mt-1">{formatDate(positions[0].historicalModel.startDate)} to {formatDate(positions[0].historicalModel.endDate)} · {positions[0].historicalModel.observations} matched daily returns · SPY benchmark · Prices as of {formatDate(positions[0].priceAsOf)}</p>
          <p className="mt-1 text-slate-400">Volatility, correlations and beta use split/dividend-adjusted history. Advanced risk metrics use the historical annualized mean; Future uses a separately selected growth assumption. Neither is a forecast. VaR and simulations retain distribution assumptions. What If estimates joint historical responses to your specified market and 10-year Treasury yield moves; large shocks extrapolate beyond observed daily changes.</p>
          <p className="mt-1 text-slate-400">The batch quarantines unexplained extreme returns and uses an earlier cutoff when corporate-action feeds lag prices. Public-source errors can remain; the as-of date and coverage may change after quality checks.</p>
          <a href="https://fred.stlouisfed.org/series/DGS10" target="_blank" rel="noreferrer" className="mt-1 block text-emerald-400 underline">Treasury yields: Federal Reserve H.15 / FRED DGS10</a>
          <a href="https://www.dolthub.com/repositories/post-no-preference/stocks" target="_blank" rel="noreferrer" className="text-emerald-400 underline">Data: post-no-preference/stocks · CC BY-SA 4.0 · RiskLab adjusted snapshot</a>
        </details>}
      </main>

      <footer className="border-t border-slate-900/90 py-5 mt-10 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span><strong className="text-slate-400">RiskLab</strong> · Quantitative portfolio risk analytics</span>
          <span>Educational analytics only · Not investment advice</span>
        </div>
      </footer>

      {libraryDialog}
      {importDialog}
      <CopilotPanel open={isCopilotOpen} onClose={closeCopilot} positions={positions} metrics={metrics} />

      <DesktopInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        onTriggerInstall={handleTriggerInstall}
        installPromptAvailable={Boolean(deferredPrompt)}
        isStandalone={isStandalone}
      />

      <DesktopCommandPalette
        onOpenCopilot={openCopilot}
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
