import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
  Download,
  Command,
  HelpCircle,
  Laptop,
  CheckCircle2,
  FileSpreadsheet,
  FileJson,
  Sliders,
  Sparkles
} from 'lucide-react';

interface DesktopTitlebarProps {
  isStandalone: boolean;
  onOpenInstallModal: () => void;
  onOpenCommandPalette: () => void;
  onOpenHelpModal: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  isCompactMode: boolean;
  onToggleCompactMode: () => void;
  installPromptAvailable: boolean;
}

export const DesktopTitlebar: React.FC<DesktopTitlebarProps> = ({
  isStandalone,
  onOpenInstallModal,
  onOpenCommandPalette,
  onOpenHelpModal,
  onExportJson,
  onExportCsv,
  isCompactMode,
  onToggleCompactMode,
  installPromptAvailable,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  return (
    <div className="bg-slate-950 border-b border-slate-800/80 select-none text-xs text-slate-300 px-3 py-1.5 flex items-center justify-between z-50 sticky top-0">
      {/* Left: Window Traffic Lights & App Identity */}
      <div className="flex items-center space-x-3">
        {/* macOS style traffic lights */}
        <div className="flex items-center space-x-1.5 pr-2 border-r border-slate-800">
          <button
            type="button"
            title="Reset active workstation view"
            onClick={() => window.location.reload()}
            className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 border border-rose-600/40 transition-colors flex items-center justify-center group"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-rose-950 font-black">×</span>
          </button>
          <button
            type="button"
            title="Toggle compact workstation layout"
            onClick={onToggleCompactMode}
            className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 border border-amber-600/40 transition-colors flex items-center justify-center group"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-amber-950 font-black">-</span>
          </button>
          <button
            type="button"
            title="Toggle fullscreen mode"
            onClick={toggleFullscreen}
            className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-600/40 transition-colors flex items-center justify-center group"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-emerald-950 font-black">+</span>
          </button>
        </div>

        {/* Brand Tag */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-bold font-mono tracking-tight text-xs">
            <Monitor className="w-3.5 h-3.5" />
            <span>RISKLAB DESKTOP</span>
          </div>
          <span className="text-[10px] text-slate-500 hidden md:inline">|</span>
          <span className="text-slate-400 text-[11px] hidden md:inline">Quantitative Workstation v0.1</span>
        </div>

        {/* Mode Status Pill */}
        {isStandalone ? (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Standalone App</span>
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700">
            <Laptop className="w-3 h-3 text-slate-400" />
            <span>Desktop Web</span>
          </span>
        )}
      </div>

      {/* Center: Command Palette Hotkey Trigger */}
      <div className="hidden lg:flex items-center">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center space-x-2 px-3 py-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all text-[11px]"
        >
          <Command className="w-3 h-3 text-emerald-400" />
          <span>Quick Actions / Search...</span>
          <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Engine Status, Actions, Install & Fullscreen */}
      <div className="flex items-center space-x-2">
        {/* Network status */}
        <div
          className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded text-slate-400 bg-slate-900 border border-slate-800"
          title={isOnline ? 'Connected to Gemini & Market Data Services' : 'Offline Mode — Local quant calculation active'}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="hidden xl:inline text-[10px] text-slate-300">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-300">Offline</span>
            </>
          )}
        </div>

        {/* Quant Engine kernel badge */}
        <div className="hidden md:flex items-center space-x-1.5 text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">GBM & BS Kernel</span>
        </div>

        {/* Compact / Dense layout toggle */}
        <button
          type="button"
          onClick={onToggleCompactMode}
          title={isCompactMode ? 'Switch to Standard Layout' : 'Switch to High-Density Workstation Layout'}
          className={`p-1.5 rounded border text-[11px] flex items-center space-x-1 transition-colors ${
            isCompactMode
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
          }`}
        >
          <Sliders className="w-3 h-3" />
          <span className="hidden xl:inline text-[10px]">
            {isCompactMode ? 'Dense' : 'Normal'}
          </span>
        </button>

        {/* Export Portfolio / Analytics Snapshot Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center space-x-1 text-[11px]"
            title="Export portfolio data"
          >
            <Download className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {exportDropdownOpen && (
            <div
              className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1 z-50 text-xs"
              onMouseLeave={() => setExportDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  onExportJson();
                  setExportDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
              >
                <FileJson className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export Portfolio (JSON)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportCsv();
                  setExportDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export Holdings (CSV)</span>
              </button>
            </div>
          )}
        </div>

        {/* Install Desktop App Button */}
        {!isStandalone && (
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-[11px] shadow-sm shadow-emerald-500/20 flex items-center space-x-1.5 transition-all hover:scale-102 cursor-pointer"
            title="Install RiskLab to your desktop"
          >
            <Download className="w-3 h-3 text-slate-950" />
            <span>Install App</span>
            {installPromptAvailable && (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
            )}
          </button>
        )}

        {/* Keyboard shortcut help */}
        <button
          type="button"
          onClick={onOpenHelpModal}
          title="Keyboard Shortcuts (?)"
          className="p-1 rounded text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (F11)'}
          className="p-1 rounded text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
