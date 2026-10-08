import React from 'react';
import { Keyboard, X, Sparkles } from 'lucide-react';
import { ThemeId } from '../types';
import { APP_THEMES } from '../constants';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme?: ThemeId;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  currentTheme = 'midnight',
}) => {
  if (!isOpen) return null;

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const shortcutGroups = [
    {
      title: 'Navigation & Tabs',
      shortcuts: [
        { key: '1', desc: 'Jump to Video Summary' },
        { key: '2', desc: 'Jump to Transcript & Timeline' },
        { key: '3', desc: 'Jump to Key Ideas & Words' },
        { key: '4', desc: 'Jump to Exact Resources & 70+ Sources' },
        { key: '5', desc: 'Jump to Artifacts Folder' },
        { key: '6', desc: 'Jump to History by Date' },
        { key: '7', desc: 'Jump to Tech & AI Words' },
        { key: '8', desc: 'Jump to Downloads & Scrape' },
        { key: '9', desc: 'Jump to Ask Anything AI' },
      ],
    },
    {
      title: 'Audio & Narration',
      shortcuts: [
        { key: 'Space', desc: 'Play / Pause Read Aloud narration' },
      ],
    },
    {
      title: 'Display & Canvas',
      shortcuts: [
        { key: 'V', desc: 'Toggle floating/docked video player' },
        { key: 'F', desc: 'Toggle Fullscreen immersive mode' },
        { key: 'B / [', desc: 'Toggle sidebar menu' },
        { key: 'T', desc: 'Cycle app color theme' },
        { key: '?', desc: 'Show this keyboard shortcuts guide' },
        { key: 'Esc', desc: 'Close modals & fullscreen' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-xl border ${themeConfig.borderLight} ${themeConfig.cardBg} shadow-2xl overflow-hidden flex flex-col max-h-[85vh]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${themeConfig.borderLight} bg-slate-500/5`}>
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-indigo-400" />
            <h2 id="shortcuts-modal-title" className={`text-sm font-bold ${themeConfig.textPrimary}`}>
              Keyboard Shortcuts
            </h2>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-indigo-500/15 text-indigo-300">
              Pro Tips
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer transition-colors`}
            aria-label="Close keyboard shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className={`text-[11px] font-semibold uppercase tracking-wider text-indigo-400`}>
                {group.title}
              </h3>
              <div className={`rounded-lg border ${themeConfig.borderLight} divide-y ${themeConfig.borderLight} overflow-hidden bg-slate-500/5`}>
                {group.shortcuts.map((sc) => (
                  <div key={sc.key} className="flex items-center justify-between px-3 py-1.5">
                    <span className={themeConfig.textSecondary}>{sc.desc}</span>
                    <kbd className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700 shadow-sm shrink-0">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`px-4 py-2.5 border-t ${themeConfig.borderLight} bg-slate-500/5 flex items-center justify-between text-[11px] ${themeConfig.textMuted}`}>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Shortcuts are active when text fields are not focused.
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1 rounded font-semibold ${themeConfig.primaryButton} cursor-pointer`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
