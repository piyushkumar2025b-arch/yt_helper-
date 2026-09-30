import React, { useState, useRef, useEffect } from 'react';
import { PanelLeft, Maximize2, Minimize2, SlidersHorizontal, Tv, Palette, Check, Cloud, LogIn, LogOut, FolderOpen, Cpu } from 'lucide-react';
import { User } from 'firebase/auth';
import { OpenRouterModel, ThemeId } from '../types';
import { APP_THEMES } from '../constants';

interface HeaderProps {
  onOpenSettings: () => void;
  hasOpenRouterKey: boolean;
  selectedModel: OpenRouterModel;
  provider: 'openrouter' | 'gemini';
  currentTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
  onOpenVoiceSettings?: () => void;
  onOpenTypography?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  activeTab?: 'summary' | 'transcript' | 'knowledge' | 'research' | 'scrape' | 'chat' | 'lists' | 'techwords';
  onSelectTab?: (tab: 'summary' | 'transcript' | 'knowledge' | 'research' | 'scrape' | 'chat' | 'lists' | 'techwords') => void;
  isMainOptionsOpen?: boolean;
  onToggleMainOptions?: () => void;
  showVideo?: boolean;
  onToggleShowVideo?: () => void;
  user?: User | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onQuickSaveToCloud?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTheme,
  onSelectTheme,
  onToggleSidebar,
  isSidebarOpen = true,
  isFullscreen = false,
  onToggleFullscreen,
  activeTab = 'summary',
  onSelectTab,
  isMainOptionsOpen = true,
  onToggleMainOptions,
  showVideo = false,
  onToggleShowVideo,
  user = null,
  onSignIn,
  onSignOut,
  onQuickSaveToCloud,
}) => {
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const navLinks = [
    { id: 'summary', label: 'Video Summary' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'knowledge', label: 'Key Ideas & Words' },
    { id: 'research', label: 'Exact Resources & Sources' },
    { id: 'lists', label: 'Artifacts Folder' },
    { id: 'techwords', label: 'Tech, AI & CSE Words' },
    { id: 'scrape', label: 'Downloads & Info' },
    { id: 'chat', label: 'Ask Anything' },
  ] as const;

  return (
    <header
      className={`flex items-center justify-between px-3 py-1 border-b ${themeConfig.borderLight} ${themeConfig.headerBg} backdrop-blur-md z-40 transition-colors shrink-0 text-[11px]`}
    >
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`p-1 rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
            title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
        )}
        <a href="/" className={`font-semibold text-xs tracking-tight ${themeConfig.textPrimary} whitespace-nowrap`}>
          OpenTranscript
        </a>
      </div>

      {/* Zone 2: Clean Formal Navigation Links */}
      {onSelectTab && (
        <nav className="hidden lg:flex items-center gap-3.5 text-[11px] font-medium">
          {navLinks.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-0.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? `${themeConfig.textPrimary} font-semibold underline underline-offset-4 decoration-indigo-500 decoration-2`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Zone 3: Primary View Actions (Artifacts Folder, Tech & AI Words, Firebase Sync, Video, Theme Switcher, Toolbar & Fullscreen) */}
      <div className="flex items-center gap-1">
        {onSelectTab && (
          <button
            type="button"
            onClick={() => onSelectTab('lists')}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'lists'
                ? 'bg-indigo-600 text-white font-semibold'
                : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
            }`}
            title="Open Artifacts Folder (Saved Sources, Summaries, Books & Notes)"
          >
            <FolderOpen className="w-3 h-3 text-amber-400" />
            <span>Artifacts</span>
          </button>
        )}

        {onQuickSaveToCloud && (
          <button
            type="button"
            onClick={onQuickSaveToCloud}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer whitespace-nowrap`}
            title="Save Current Video Summary & Sources to Artifacts Folder"
          >
            <span>+ Save</span>
          </button>
        )}

        {onSelectTab && (
          <button
            type="button"
            onClick={() => onSelectTab('techwords')}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'techwords'
                ? 'bg-indigo-600 text-white font-semibold'
                : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
            }`}
            title="Open Tech, AI & CSE Words Searcher + Multi-Dictionary"
          >
            <Cpu className="w-3 h-3 text-indigo-400" />
            <span>Tech &amp; AI Words</span>
          </button>
        )}

        {user ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectTab?.('lists')}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer whitespace-nowrap"
              title={`Connected to Firebase as ${user.email || user.displayName}`}
            >
              <Cloud className="w-3 h-3" />
              <span className="hidden md:inline max-w-[110px] truncate">
                {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Synced'}
              </span>
            </button>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className={`p-1 rounded ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
                title="Sign Out of Firebase"
              >
                <LogOut className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          onSignIn && (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors cursor-pointer whitespace-nowrap"
              title="Sign in with Google to sync summaries, lists & exact resources with Firebase"
            >
              <LogIn className="w-3 h-3" />
              <span>Sign In</span>
            </button>
          )
        )}

        {onToggleShowVideo && (
          <button
            type="button"
            onClick={onToggleShowVideo}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              showVideo
                ? 'bg-indigo-600 text-white font-semibold'
                : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
            }`}
            title={showVideo ? 'Hide Video Player (V)' : 'Show Movable Multi-Size Video Player (V)'}
          >
            <Tv className="w-3 h-3" />
            <span>{showVideo ? 'Hide Video' : 'Video'}</span>
          </button>
        )}

        {/* Quick 12-Theme Picker Dropdown */}
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer whitespace-nowrap`}
            title="Switch Reading Theme (12 Themes)"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: themeConfig.icon }}
            />
            <Palette className="w-3 h-3 opacity-75" />
            <span className="hidden sm:inline">{themeConfig.name}</span>
          </button>

          {isThemeMenuOpen && (
            <div
              className={`absolute right-0 mt-1.5 w-60 rounded-xl border ${themeConfig.border} ${themeConfig.cardBg} shadow-2xl p-1.5 z-50 space-y-0.5 max-h-[75vh] overflow-y-auto`}
            >
              <div className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Choose Reading Theme (12)
              </div>
              {Object.values(APP_THEMES).map((t) => {
                const isSelected = t.id === currentTheme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTheme(t.id);
                      setIsThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                        : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: t.icon }}
                      />
                      <div className="truncate">
                        <div className="truncate">{t.name}</div>
                        <div className={`text-[10px] truncate ${themeConfig.textMuted}`}>
                          {t.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {onToggleMainOptions && (
          <button
            type="button"
            onClick={onToggleMainOptions}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              isMainOptionsOpen
                ? `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                : `${themeConfig.accentBg} ${themeConfig.accent}`
            }`}
            title={isMainOptionsOpen ? 'Hide Document Toolbar' : 'Show Document Toolbar'}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden sm:inline">{isMainOptionsOpen ? 'Hide Bar' : 'Toolbar'}</span>
          </button>
        )}

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer whitespace-nowrap`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Reading View'}
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
