import React from 'react';
import {
  X,
  Download,
  Monitor,
  CheckCircle,
  Zap,
  WifiOff,
  Keyboard,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface DesktopInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerInstall: () => void;
  installPromptAvailable: boolean;
  isStandalone: boolean;
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({
  isOpen,
  onClose,
  onTriggerInstall,
  installPromptAvailable,
  isStandalone,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Install RiskLab Desktop App
              </h3>
              <p className="text-xs text-slate-400">
                Native desktop workstation for quantitative portfolio risk engineering
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main Hero Callout */}
          {isStandalone ? (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-emerald-300">
                  RiskLab is Already Running as a Desktop App
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  You are currently using RiskLab in standalone desktop mode. You have full offline simulation access, keyboard shortcuts, and native window controls.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">One-Click Desktop Installation</h4>
                  <p className="text-xs text-slate-400">
                    Installs instantly on macOS, Windows, Linux, and ChromeOS without large downloads.
                  </p>
                </div>
                {installPromptAvailable ? (
                  <button
                    type="button"
                    onClick={onTriggerInstall}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-102 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install Now</span>
                  </button>
                ) : (
                  <span className="text-[11px] px-2.5 py-1 rounded bg-slate-700/60 text-slate-300 border border-slate-600">
                    Browser Ready
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Desktop Workstation Capabilities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start space-x-2.5">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-slate-200">Zero-Latency Engine</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Portfolio risk and future-outcome calculations run directly in client memory with no server roundtrips.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start space-x-2.5">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-slate-200">100% Offline Capable</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pre-cached service worker keeps all pricing kernels and simulation models active off-grid.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start space-x-2.5">
              <Keyboard className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-slate-200">Terminal Shortcuts</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Fast navigation with ⌘K Command Palette, ⌘1-4 Tab jumping, and F11 Fullscreen mode.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start space-x-2.5">
              <Layers className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-slate-200">Dock & Taskbar Pinning</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Launches in an isolated borderless window with direct jump shortcuts into each risk module.
                </p>
              </div>
            </div>
          </div>

          {/* Browser Specific Instructions */}
          {!isStandalone && (
            <div className="border-t border-slate-800 pt-4 space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Manual Browser Install Steps
              </h5>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Chrome & Edge:</strong> Click the <span className="text-emerald-400">Install icon</span> in your URL address bar or select <span className="font-mono text-slate-200">Menu &gt; Install RiskLab</span>.
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Safari (macOS Sonoma+):</strong> Click <span className="font-mono text-slate-200">File &gt; Add to Dock</span> to install as a native Mac app.
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Brave & Opera:</strong> Click the install badge in the search/URL bar.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            PWA Standalone • Manifest v2 • ServiceWorker Active
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
