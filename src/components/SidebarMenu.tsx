import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Loader2,
  FileText,
  List,
  BookOpen,
  Globe,
  Database,
  MessageSquare,
  Play,
  Tv,
  ChevronDown,
  Volume2,
  Type,
  KeyRound,
  Sliders,
  PanelLeftClose,
  Check,
  Search,
  Bookmark,
} from 'lucide-react';
import {
  VideoMetadata,
  SummaryType,
  DetailLevel,
  OpenRouterModel,
  ThemeId,
  SampleVideo,
  YouTubeSearchResult,
} from '../types';
import { SAMPLE_VIDEOS, SUMMARY_PRESETS, APP_THEMES } from '../constants';
import {
  VideoPlayerPanel,
  VideoPlayerSize,
  VideoPlacementMode,
  VIDEO_SIZE_PRESETS,
} from './VideoPlayerPanel';

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  width: number;
  currentUrl: string;
  onSubmitUrl: (url: string) => void;
  isLoading: boolean;
  onOpenManualModal: () => void;
  metadata: VideoMetadata | null;
  activeTimestamp: number | null;
  seekTrigger?: number;
  onTimeUpdate?: (seconds: number) => void;
  showVideo: boolean;
  onToggleShowVideo: () => void;
  videoSize?: VideoPlayerSize;
  onChangeVideoSize?: (size: VideoPlayerSize) => void;
  videoPlacement?: VideoPlacementMode;
  onChangeVideoPlacement?: (mode: VideoPlacementMode) => void;
  activeTab: 'summary' | 'transcript' | 'knowledge' | 'research' | 'scrape' | 'chat' | 'lists';
  onSelectTab: (tab: 'summary' | 'transcript' | 'knowledge' | 'research' | 'scrape' | 'chat' | 'lists') => void;
  summaryType: SummaryType;
  onChangeSummaryType: (type: SummaryType) => void;
  detailLevel: DetailLevel;
  onChangeDetailLevel: (level: DetailLevel) => void;
  selectedModel: OpenRouterModel;
  provider: 'openrouter' | 'gemini';
  hasOpenRouterKey: boolean;
  onOpenSettings: () => void;
  onOpenVoiceSettings: () => void;
  onOpenTypography: () => void;
  currentTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
}

function isLikelyYouTubeUrlOrId(input: string): boolean {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return true;
  if (/youtube\.com|youtu\.be/i.test(trimmed)) return true;
  return false;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  isOpen,
  onClose,
  width,
  currentUrl,
  onSubmitUrl,
  isLoading,
  onOpenManualModal,
  metadata,
  activeTimestamp,
  seekTrigger = 0,
  onTimeUpdate,
  showVideo,
  onToggleShowVideo,
  videoSize = 'md',
  onChangeVideoSize,
  videoPlacement = 'floating',
  onChangeVideoPlacement,
  activeTab,
  onSelectTab,
  summaryType,
  onChangeSummaryType,
  detailLevel,
  onChangeDetailLevel,
  selectedModel,
  provider,
  hasOpenRouterKey,
  onOpenSettings,
  onOpenVoiceSettings,
  onOpenTypography,
  currentTheme,
  onSelectTheme,
}) => {
  const [sourceMode, setSourceMode] = useState<'url' | 'search'>('url');
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [ytQuery, setYtQuery] = useState('');
  const [ytResults, setYtResults] = useState<YouTubeSearchResult[]>([]);
  const [ytNextPageToken, setYtNextPageToken] = useState<string | null>(null);
  const [ytPage, setYtPage] = useState<number>(0);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [isLoadingMoreYt, setIsLoadingMoreYt] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

  const [isSamplesOpen, setIsSamplesOpen] = useState(false);
  const samplesRef = useRef<HTMLDivElement>(null);

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  useEffect(() => {
    setUrlInput(currentUrl);
  }, [currentUrl]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (samplesRef.current && !samplesRef.current.contains(e.target as Node)) {
        setIsSamplesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const performYouTubeSearch = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setIsSearchingYt(true);
    setYtError(null);
    setYtPage(0);
    setYtNextPageToken(null);
    try {
      const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}&page=0`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to search YouTube.');
      }
      setYtResults(data.videos || []);
      setYtNextPageToken(data.nextPageToken || null);
    } catch (err: any) {
      setYtError(err.message || 'Search failed.');
    } finally {
      setIsSearchingYt(false);
    }
  };

  const loadMoreYouTubeResults = async () => {
    const q = ytQuery.trim();
    if (!q || isSearchingYt || isLoadingMoreYt) return;
    setIsLoadingMoreYt(true);
    const nextPage = ytPage + 1;
    try {
      const tokenParam = ytNextPageToken ? `&pageToken=${encodeURIComponent(ytNextPageToken)}` : '';
      const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}&page=${nextPage}${tokenParam}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.videos) && data.videos.length > 0) {
        setYtResults((prev) => {
          const existing = new Set(prev.map((v) => v.videoId));
          const fresh = data.videos.filter((v: YouTubeSearchResult) => !existing.has(v.videoId));
          return [...prev, ...fresh];
        });
        setYtNextPageToken(data.nextPageToken || null);
        setYtPage(nextPage);
      }
    } catch {
      // ignore transient error
    } finally {
      setIsLoadingMoreYt(false);
    }
  };

  const handleYtListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      loadMoreYouTubeResults();
    }
  };

  const handleSubmitUrlForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed || isLoading) return;

    if (isLikelyYouTubeUrlOrId(trimmed)) {
      onSubmitUrl(trimmed);
    } else {
      // User typed a search query in the URL box — switch to YouTube Search and execute
      setSourceMode('search');
      setYtQuery(trimmed);
      performYouTubeSearch(trimmed);
    }
  };

  const handleSubmitYtSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytQuery.trim() || isSearchingYt) return;
    if (isLikelyYouTubeUrlOrId(ytQuery.trim())) {
      onSubmitUrl(ytQuery.trim());
      return;
    }
    performYouTubeSearch(ytQuery);
  };

  const handleSelectSample = (sample: SampleVideo) => {
    setUrlInput(sample.url);
    setIsSamplesOpen(false);
    onSubmitUrl(sample.url);
  };

  const handleSelectYtVideo = (video: YouTubeSearchResult) => {
    setUrlInput(video.url);
    onSubmitUrl(video.url);
  };

  const navItems = [
    { id: 'summary', label: 'Video Summary', icon: FileText },
    { id: 'transcript', label: 'Full Transcript', icon: List },
    { id: 'knowledge', label: 'Key Ideas & Words', icon: BookOpen },
    { id: 'research', label: 'Explore Videos & Books', icon: Globe },
    { id: 'lists', label: 'My Saved Lists (Firebase)', icon: Bookmark },
    { id: 'scrape', label: 'Downloads & Info', icon: Database },
    { id: 'chat', label: 'Ask Anything', icon: MessageSquare },
  ] as const;

  if (!isOpen) return null;

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`h-full shrink-0 flex flex-col ${themeConfig.pageBg} select-none transition-all duration-75 relative z-20 overflow-hidden`}
    >
      {/* Top Header of Sidebar */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
          Menu
        </span>
        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable Content Inside Sidebar */}
      <div className="flex-1 overflow-y-auto px-3 py-1.5 space-y-3.5 text-[11px]">
        {/* 1. Source Input & YouTube Search Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSourceMode('url')}
                className={`text-[11px] font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                  sourceMode === 'url'
                    ? `${themeConfig.textPrimary} underline underline-offset-4 decoration-indigo-500`
                    : `${themeConfig.textMuted} hover:${themeConfig.textSecondary}`
                }`}
              >
                Source URL
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('search')}
                className={`text-[11px] font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                  sourceMode === 'search'
                    ? `${themeConfig.textPrimary} underline underline-offset-4 decoration-indigo-500`
                    : `${themeConfig.textMuted} hover:${themeConfig.textSecondary}`
                }`}
              >
                YouTube Search
              </button>
            </div>

            <div className="relative" ref={samplesRef}>
              <button
                type="button"
                onClick={() => setIsSamplesOpen(!isSamplesOpen)}
                className={`text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} transition-colors cursor-pointer flex items-center gap-1`}
              >
                <span>Import</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {isSamplesOpen && (
                <div
                  className={`absolute right-0 mt-1.5 w-64 rounded-lg ${themeConfig.cardBg} shadow-2xl p-1.5 z-50 space-y-0.5`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsSamplesOpen(false);
                      onOpenManualModal();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-left ${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer font-medium`}
                  >
                    <FileText className="w-3.5 h-3.5 opacity-70" />
                    <span>Import or paste transcript</span>
                  </button>
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider opacity-50">
                    Reference Presentations
                  </div>
                  {SAMPLE_VIDEOS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSample(s)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs ${themeConfig.textSecondary} hover:bg-slate-500/10 text-left transition-colors cursor-pointer truncate`}
                    >
                      <span className="truncate pr-2">{s.title.split('|')[0]}</span>
                      <Play className="w-3 h-3 opacity-40 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {sourceMode === 'url' ? (
            <form onSubmit={handleSubmitUrlForm} className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube URL or search topic..."
                  className={`w-full pl-3 pr-8 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none focus:bg-slate-500/15`}
                  disabled={isLoading}
                />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => setUrlInput('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!urlInput.trim() || isLoading}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md text-xs font-semibold ${themeConfig.primaryButton} transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reading video...</span>
                  </>
                ) : (
                  <span>Summarize Video</span>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <form onSubmit={handleSubmitYtSearch} className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={ytQuery}
                    onChange={(e) => setYtQuery(e.target.value)}
                    placeholder="Search YouTube lectures, talks..."
                    className={`w-full pl-3 pr-7 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none focus:bg-slate-500/15`}
                    disabled={isSearchingYt}
                  />
                  {ytQuery && (
                    <button
                      type="button"
                      onClick={() => setYtQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!ytQuery.trim() || isSearchingYt}
                  className={`p-2 rounded-md ${themeConfig.primaryButton} disabled:opacity-40 cursor-pointer shrink-0`}
                  title="Search YouTube"
                >
                  {isSearchingYt ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                </button>
              </form>

              {ytError && (
                <p className="text-[11px] text-rose-400">{ytError}</p>
              )}

              {ytResults.length > 0 && (
                <div
                  onScroll={handleYtListScroll}
                  className={`divide-y ${themeConfig.borderLight} max-h-96 overflow-y-auto pr-1`}
                >
                  {ytResults.map((vid) => (
                    <button
                      key={vid.videoId}
                      type="button"
                      onClick={() => handleSelectYtVideo(vid)}
                      className="w-full py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5 text-left hover:bg-slate-500/10 rounded-md px-1.5 transition-colors cursor-pointer group"
                    >
                      <img
                        src={vid.thumbnailUrl}
                        alt={vid.title}
                        referrerPolicy="no-referrer"
                        className="w-16 aspect-video object-cover rounded shrink-0 bg-black/30 mt-0.5"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className={`text-xs font-medium line-clamp-2 leading-snug ${themeConfig.textPrimary} group-hover:text-indigo-400 transition-colors`}>
                          {vid.title}
                        </p>
                        <p className={`text-[10px] truncate ${themeConfig.textMuted}`}>
                          {vid.channelTitle}
                        </p>
                      </div>
                    </button>
                  ))}

                  <div className="py-2 text-center">
                    {isLoadingMoreYt ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-indigo-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading more videos...</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={loadMoreYouTubeResults}
                        className={`text-[11px] font-medium ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
                      >
                        Scroll or click for more ({ytResults.length} loaded)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Navigation Views Section */}
        <div className="space-y-2">
          <label className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted} block`}>
            Sections
          </label>
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                      : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-75" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Active Document Metadata & Player Toggle */}
        {metadata && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Active Source
              </span>
              {metadata.videoId && (
                <button
                  type="button"
                  onClick={onToggleShowVideo}
                  className={`text-xs font-medium flex items-center gap-1.5 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} transition-colors cursor-pointer whitespace-nowrap`}
                >
                  <Tv className="w-3.5 h-3.5 opacity-75" />
                  <span>{showVideo ? 'Hide Video' : 'Show Video'}</span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className={`font-medium leading-snug ${themeConfig.textPrimary}`}>
                {metadata.title}
              </div>
              <div className={`text-[11px] ${themeConfig.textMuted} flex items-center gap-1.5 tabular-nums flex-wrap`}>
                <span>{metadata.authorName || 'Source'}</span>
                {metadata.durationFormatted && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{metadata.durationFormatted}</span>
                  </>
                )}
                {metadata.totalWords > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{metadata.totalWords.toLocaleString()} words</span>
                  </>
                )}
              </div>
            </div>

            {showVideo && metadata.videoId && (
              <div className="pt-1 space-y-2">
                {/* Quick Size & Placement Selector in Sidebar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={themeConfig.textMuted}>Player Size:</span>
                    <div className="flex items-center gap-1">
                      {(['sm', 'md', 'lg', 'xl'] as VideoPlayerSize[]).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => onChangeVideoSize?.(sz)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                            videoSize === sz
                              ? `${themeConfig.accentBg} ${themeConfig.accent}`
                              : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} bg-slate-500/10`
                          }`}
                          title={VIDEO_SIZE_PRESETS[sz].label}
                        >
                          {VIDEO_SIZE_PRESETS[sz].shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    {([
                      { id: 'floating', label: 'Float Anywhere' },
                      { id: 'docked-top', label: 'Top of Page' },
                      { id: 'sidebar', label: 'In Sidebar' },
                    ] as Array<{ id: VideoPlacementMode; label: string }>).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => onChangeVideoPlacement?.(mode.id)}
                        className={`py-1 px-1.5 rounded font-medium cursor-pointer text-center truncate transition-colors ${
                          videoPlacement === mode.id
                            ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                            : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} bg-slate-500/10`
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {videoPlacement === 'sidebar' && (
                  <VideoPlayerPanel
                    metadata={metadata}
                    activeTimestamp={activeTimestamp}
                    seekTrigger={seekTrigger}
                    onTimeUpdate={onTimeUpdate}
                    currentTheme={currentTheme}
                    size={videoSize}
                    onChangeSize={onChangeVideoSize}
                    placement={videoPlacement}
                    onChangePlacement={onChangeVideoPlacement}
                    onClose={onToggleShowVideo}
                    embeddedInSidebar
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Synthesis Configuration */}
        <div className="space-y-3">
          <label className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted} block`}>
            Summary Style
          </label>

          <div className="space-y-3">
            <div>
              <span className={`text-[11px] ${themeConfig.textSecondary} block mb-1.5`}>How should we write it?</span>
              <select
                value={summaryType}
                onChange={(e) => onChangeSummaryType(e.target.value as SummaryType)}
                className={`w-full py-2 px-3 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} cursor-pointer focus:outline-none`}
              >
                {SUMMARY_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className={`text-[11px] ${themeConfig.textSecondary} block mb-1.5`}>How much detail?</span>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { id: 'balanced', label: 'Normal' },
                  { id: 'extensive', label: 'Detailed' },
                  { id: 'massive', label: 'Everything' },
                ] as Array<{ id: DetailLevel; label: string }>).map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => onChangeDetailLevel(lvl.id)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer text-center whitespace-nowrap ${
                      detailLevel === lvl.id
                        ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                        : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Preferences */}
        <div className="space-y-2">
          <label className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted} block`}>
            Reading &amp; Voice
          </label>

          <div className="space-y-0.5">
            <button
              type="button"
              onClick={onOpenTypography}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
            >
              <div className="flex items-center gap-2.5">
                <Type className="w-4 h-4 opacity-75" />
                <span>Font &amp; Text Size</span>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenVoiceSettings}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
            >
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 opacity-75" />
                <span>Read-Aloud Voice</span>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <KeyRound className="w-4 h-4 shrink-0 opacity-75" />
                <span className="truncate">
                  {provider === 'gemini' ? 'Gemini 3.8 Flash' : selectedModel.name}
                </span>
              </div>
              <Sliders className="w-3.5 h-3.5 opacity-50 shrink-0" />
            </button>
          </div>
        </div>

        {/* 6. Theme Selector */}
        <div className="space-y-2">
          <label className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted} block`}>
            Appearance (12 Themes)
          </label>
          <div className="grid grid-cols-2 gap-1">
            {Object.values(APP_THEMES).map((t) => {
              const isSelected = t.id === currentTheme;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTheme(t.id)}
                  title={t.description}
                  className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                      : `${themeConfig.textSecondary} hover:bg-slate-500/10`
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.icon }}
                    />
                    <span className="truncate">{t.name}</span>
                  </div>
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
