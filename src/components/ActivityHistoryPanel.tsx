import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Search,
  Trash2,
  ExternalLink,
  Play,
  Globe,
  MessageSquare,
  FileText,
  FolderOpen,
  Cloud,
  LogIn,
  Sparkles,
  RotateCcw,
  Check,
  Filter,
  Volume2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ActivityHistoryItem,
  ActivityActionType,
  subscribeToActivityHistory,
  subscribeToLocalActivityHistory,
  loadLocalActivityHistory,
  deleteActivityHistoryItem,
  clearActivityHistoryForDate,
  clearAllActivityHistory,
  formatDateKeyReadable,
} from '../services/listsService';
import { APP_THEMES } from '../constants';
import { ThemeId } from '../types';

interface ActivityHistoryPanelProps {
  currentTheme: ThemeId;
  user: User | null;
  onSignIn?: () => void;
  onOpenVideoUrl?: (url: string) => void;
  onOpenResearchQuery?: (query: string) => void;
  onOpenWordLookup?: (query: string) => void;
  onOpenTechWordLookup?: (query: string) => void;
}

const ACTION_META: Record<
  ActivityActionType,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  video: {
    label: 'Video Loaded',
    badgeClass: 'bg-indigo-500/15 text-indigo-400',
    icon: Play,
  },
  summary: {
    label: 'Summary Generated',
    badgeClass: 'bg-emerald-500/15 text-emerald-400',
    icon: Sparkles,
  },
  research_search: {
    label: 'Research Search',
    badgeClass: 'bg-sky-500/15 text-sky-400',
    icon: Search,
  },
  word_lookup: {
    label: 'Word & Concept Lookup',
    badgeClass: 'bg-amber-500/15 text-amber-400',
    icon: Globe,
  },
  ai_question: {
    label: 'AI Video Question',
    badgeClass: 'bg-rose-500/15 text-rose-400',
    icon: MessageSquare,
  },
  transcript_search: {
    label: 'Transcript Import / Search',
    badgeClass: 'bg-slate-500/20 text-slate-300',
    icon: FileText,
  },
  artifact_saved: {
    label: 'Saved Artifact',
    badgeClass: 'bg-purple-500/15 text-purple-400',
    icon: FolderOpen,
  },
  audio_narration: {
    label: 'Audio Narration',
    badgeClass: 'bg-teal-500/15 text-teal-400',
    icon: Volume2,
  },
};

function formatTimeOfDay(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function extractCleanQuery(queryOrTitle: string): string {
  const colonIdx = queryOrTitle.indexOf(':');
  if (colonIdx !== -1 && colonIdx < 38) {
    return queryOrTitle.slice(colonIdx + 1).trim();
  }
  return queryOrTitle.trim();
}

export const ActivityHistoryPanel: React.FC<ActivityHistoryPanelProps> = ({
  currentTheme,
  user,
  onSignIn,
  onOpenVideoUrl,
  onOpenResearchQuery,
  onOpenWordLookup,
  onOpenTechWordLookup,
}) => {
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const [historyItems, setHistoryItems] = useState<ActivityHistoryItem[]>(() => loadLocalActivityHistory());
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'videos' | 'searches' | 'words' | 'chat' | 'artifacts'
  >('all');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  useEffect(() => {
    if (user) {
      const unsub = subscribeToActivityHistory(user.uid, (items) => {
        setHistoryItems(items);
      });
      return () => unsub();
    } else {
      setHistoryItems(loadLocalActivityHistory());
      const unsubLocal = subscribeToLocalActivityHistory((items) => {
        setHistoryItems(items);
      });
      return () => unsubLocal();
    }
  }, [user]);

  // Distinct dates sorted newest first
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const item of historyItems) {
      if (item.dateKey) set.add(item.dateKey);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [historyItems]);

  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      if (selectedDate !== 'all' && item.dateKey !== selectedDate) {
        return false;
      }
      if (
        categoryFilter === 'videos' &&
        !['video', 'summary', 'transcript_search'].includes(item.actionType)
      ) {
        return false;
      }
      if (categoryFilter === 'searches' && item.actionType !== 'research_search') {
        return false;
      }
      if (categoryFilter === 'words' && item.actionType !== 'word_lookup') {
        return false;
      }
      if (categoryFilter === 'chat' && item.actionType !== 'ai_question') {
        return false;
      }
      if (categoryFilter === 'artifacts' && item.actionType !== 'artifact_saved') {
        return false;
      }
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        item.queryOrTitle.toLowerCase().includes(q) ||
        (item.detail && item.detail.toLowerCase().includes(q)) ||
        item.dateKey.includes(q)
      );
    });
  }, [historyItems, selectedDate, categoryFilter, searchFilter]);

  // Group filtered items by dateKey (YYYY-MM-DD)
  const groupedByDate = useMemo(() => {
    const groups: Array<{ dateKey: string; readableDate: string; items: ActivityHistoryItem[] }> = [];
    const map = new Map<string, ActivityHistoryItem[]>();

    for (const item of filteredItems) {
      const dk = item.dateKey || 'Unknown Date';
      if (!map.has(dk)) {
        map.set(dk, []);
      }
      map.get(dk)!.push(item);
    }

    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    for (const dk of sortedKeys) {
      groups.push({
        dateKey: dk,
        readableDate: formatDateKeyReadable(dk),
        items: map.get(dk)!,
      });
    }
    return groups;
  }, [filteredItems]);

  const handleDeleteSingle = async (id: string) => {
    await deleteActivityHistoryItem(id);
    if (!user) {
      setHistoryItems(loadLocalActivityHistory());
    }
    showNotice('Removed entry from history database.');
  };

  const handleClearDate = async (dateKey: string) => {
    await clearActivityHistoryForDate(dateKey);
    if (!user) {
      setHistoryItems(loadLocalActivityHistory());
    }
    if (selectedDate === dateKey) {
      setSelectedDate('all');
    }
    showNotice(`Cleared history for ${formatDateKeyReadable(dateKey)}.`);
  };

  const handleClearAll = async () => {
    await clearAllActivityHistory();
    if (!user) {
      setHistoryItems([]);
    }
    setSelectedDate('all');
    showNotice('Cleared all activity & search history.');
  };

  return (
    <div className="w-full space-y-5">
      {/* Header & Database Sync Status */}
      <div className={`pb-4 border-b ${themeConfig.borderLight} space-y-3.5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
                Complete Search &amp; Activity History by Date
              </h2>
              {user ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                  <Cloud className="w-3 h-3" />
                  <span>Saved in Cloud Database ({user.email || user.displayName})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400">
                  <Clock className="w-3 h-3" />
                  <span>Saved in Local Database (Sign in to sync across devices)</span>
                </span>
              )}
            </div>
            <p className={`text-[11px] ${themeConfig.textMuted}`}>
              Every video you watch, summary you generate, research query you search, word you look up, and question you ask is automatically saved by date.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!user && onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In to Sync Database</span>
              </button>
            )}

            {historyItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All History</span>
              </button>
            )}
          </div>
        </div>

        {statusNotice && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Search & Date Picker Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: 'all', label: `All Activity (${historyItems.length})` },
              {
                id: 'videos',
                label: `Videos & Summaries (${
                  historyItems.filter((i) =>
                    ['video', 'summary', 'transcript_search'].includes(i.actionType)
                  ).length
                })`,
              },
              {
                id: 'searches',
                label: `Research Searches (${
                  historyItems.filter((i) => i.actionType === 'research_search').length
                })`,
              },
              {
                id: 'words',
                label: `Word & Tech Lookups (${
                  historyItems.filter((i) => i.actionType === 'word_lookup').length
                })`,
              },
              {
                id: 'chat',
                label: `AI Questions (${
                  historyItems.filter((i) => i.actionType === 'ai_question').length
                })`,
              },
              {
                id: 'artifacts',
                label: `Saved Artifacts (${
                  historyItems.filter((i) => i.actionType === 'artifact_saved').length
                })`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  categoryFilter === tab.id
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Keyword Search + Calendar Date Selector */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search your history by word, topic, or date..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border ${themeConfig.borderLight} bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none focus:border-indigo-500`}
              />
            </div>

            <div className="flex items-center gap-1">
              <input
                type="date"
                value={selectedDate === 'all' ? '' : selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || 'all')}
                className={`px-2.5 py-1 text-xs rounded-lg border ${themeConfig.borderLight} bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                title="Filter history by exact calendar date"
              />
              {selectedDate !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('all')}
                  className="px-2 py-1 rounded text-[11px] font-medium bg-slate-500/15 text-indigo-400 hover:bg-slate-500/25 cursor-pointer whitespace-nowrap"
                >
                  All Dates
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date Quick-Select Chips */}
        {availableDates.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className={`text-[11px] font-medium ${themeConfig.textMuted}`}>Dates Recorded:</span>
            <button
              type="button"
              onClick={() => setSelectedDate('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                selectedDate === 'all'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : `bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`
              }`}
            >
              All Dates ({historyItems.length})
            </button>
            {availableDates.map((dk) => {
              const count = historyItems.filter((i) => i.dateKey === dk).length;
              return (
                <button
                  key={dk}
                  type="button"
                  onClick={() => setSelectedDate(dk)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                    selectedDate === dk
                      ? 'bg-indigo-600 text-white font-semibold'
                      : `bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`
                  }`}
                >
                  {formatDateKeyReadable(dk)} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Date-Grouped Timeline */}
      {groupedByDate.length > 0 ? (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <section
              key={group.dateKey}
              className={`rounded-xl border ${themeConfig.borderLight} bg-slate-500/5 overflow-hidden`}
            >
              {/* Date Group Header */}
              <div
                className={`px-4 py-2.5 border-b ${themeConfig.borderLight} bg-slate-500/10 flex flex-wrap items-center justify-between gap-2`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <h3 className={`text-xs sm:text-sm font-bold ${themeConfig.textPrimary}`}>
                    {group.readableDate}
                  </h3>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-500/15 text-indigo-400">
                    {group.dateKey}
                  </span>
                  <span className={`text-[11px] ${themeConfig.textMuted}`}>
                    · {group.items.length} {group.items.length === 1 ? 'activity' : 'activities'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleClearDate(group.dateKey)}
                  className={`inline-flex items-center gap-1 text-[11px] ${themeConfig.textMuted} hover:text-rose-400 cursor-pointer transition-colors`}
                  title={`Delete all history for ${group.readableDate}`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Date</span>
                </button>
              </div>

              {/* Chronological Items for this Date */}
              <div className={`divide-y ${themeConfig.borderLight}`}>
                {group.items.map((item) => {
                  const meta = ACTION_META[item.actionType] || ACTION_META.research_search;
                  const IconComp = meta.icon;
                  const timeStr = formatTimeOfDay(item.createdAt);
                  const cleanQuery = extractCleanQuery(item.queryOrTitle);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-500/5 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 max-w-4xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          {timeStr && (
                            <span className={`font-mono text-[11px] tabular-nums ${themeConfig.textMuted}`}>
                              {timeStr}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${meta.badgeClass}`}
                          >
                            <IconComp className="w-2.5 h-2.5" />
                            <span>{meta.label}</span>
                          </span>
                          <h4 className={`text-xs sm:text-sm font-bold ${themeConfig.textPrimary}`}>
                            {item.queryOrTitle}
                          </h4>
                        </div>

                        {item.detail && (
                          <p className={`text-xs ${themeConfig.textSecondary} line-clamp-2 leading-relaxed`}>
                            {item.detail}
                          </p>
                        )}
                      </div>

                      {/* 1-Click Re-run / Open Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {item.url &&
                          onOpenVideoUrl &&
                          ['video', 'summary', 'transcript_search'].includes(item.actionType) && (
                            <button
                              type="button"
                              onClick={() => onOpenVideoUrl(item.url)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 cursor-pointer transition-colors"
                            >
                              <Play className="w-2.5 h-2.5" />
                              <span>Open Video</span>
                            </button>
                          )}

                        {cleanQuery && onOpenResearchQuery && item.actionType === 'research_search' && (
                          <button
                            type="button"
                            onClick={() => onOpenResearchQuery(cleanQuery)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer transition-colors"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Search Again</span>
                          </button>
                        )}

                        {cleanQuery &&
                          (onOpenWordLookup || onOpenTechWordLookup) &&
                          item.actionType === 'word_lookup' && (
                            <button
                              type="button"
                              onClick={() => (onOpenWordLookup || onOpenTechWordLookup)?.(cleanQuery)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer transition-colors"
                            >
                              <Globe className="w-2.5 h-2.5" />
                              <span>Look Up Word</span>
                            </button>
                          )}

                        {item.url && item.url.startsWith('http') && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`p-1 rounded ${themeConfig.textMuted} hover:${themeConfig.textPrimary} bg-slate-500/10`}
                            title="Open external link"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteSingle(item.id)}
                          className={`p-1 rounded ${themeConfig.textMuted} hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors`}
                          title="Delete this entry"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center space-y-3">
          <Filter className="w-7 h-7 mx-auto opacity-30 text-indigo-400" />
          <h4 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
            {historyItems.length === 0
              ? 'Your Search & Activity History Is Ready'
              : 'No history entries match your current filter'}
          </h4>
          <p className={`text-xs ${themeConfig.textMuted} max-w-md mx-auto`}>
            {historyItems.length === 0
              ? 'Every video you load, summary you generate, research query you run, or word you look up will automatically appear here organized by date.'
              : 'Try clearing your search filter or selecting "All Dates" to see all recorded activities.'}
          </p>
          {(searchFilter || selectedDate !== 'all' || categoryFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchFilter('');
                setSelectedDate('all');
                setCategoryFilter('all');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
            >
              Reset History Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};
