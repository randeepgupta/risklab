import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      group: 'Analysis Navigation',
      items: [
        { key: '⌘ 1', label: 'Portfolio Overview' },
        { key: '⌘ 2', label: 'What If? Scenarios' },
        { key: '⌘ 3', label: 'Future Outcomes' },
        { key: '⌘ 4', label: 'Advanced Lab' },
      ],
    },
    {
      group: 'Quick Commands',
      items: [
        { key: '⌘ K', label: 'Open Command Palette' },
        { key: 'F11', label: 'Toggle Fullscreen Mode' },
        { key: '⌘ D', label: 'Toggle High-Density Layout' },
        { key: '⌘ E', label: 'Quick Export Portfolio JSON' },
        { key: '?', label: 'Open Keyboard Shortcuts Help' },
        { key: 'ESC', label: 'Dismiss Active Modal / Overlay' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden text-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Keyboard className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              RiskLab Keyboard Shortcuts
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {shortcutGroups.map((group) => (
            <div key={group.group} className="space-y-2.5">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {group.group}
              </h4>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-1 px-2 rounded-md bg-slate-950/60 border border-slate-800/80 text-xs"
                  >
                    <span className="text-slate-300">{item.label}</span>
                    <kbd className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-emerald-400 font-semibold">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="text-[11px] text-slate-500 text-center font-mono">
            Note: On Windows and Linux, use <kbd className="text-slate-400">Ctrl</kbd> in place of <kbd className="text-slate-400">⌘</kbd>.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
