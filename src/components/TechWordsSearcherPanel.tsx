import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Cpu,
  BookOpen,
  Globe,
  Volume2,
  Plus,
  Check,
  FolderOpen,
  ExternalLink,
  Clock,
  Sparkles,
  Code2,
  Database,
  Layers,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import {
  ThemeId,
  ParsedSegment,
  TechWordEntry,
  DictionaryKnowledgeResult,
} from '../types';
import { APP_THEMES } from '../constants';
import {
  getCombinedTechAndVideoWords,
  searchTechWordsHighGrade,
} from '../services/techDictionaryService';
import { speechService } from '../services/speechService';
import { SmartImage } from './SmartImage';

interface TechWordsSearcherPanelProps {
  summaryMarkdown: string;
  videoTitle: string;
  transcriptSegments?: ParsedSegment[];
  currentTheme?: ThemeId;
  onAppendToSummary: (markdownText: string) => void;
  onSaveToList?: (item: {
    itemType: 'video' | 'summary' | 'book' | 'article' | 'note';
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }) => void;
  onOpenArtifacts?: () => void;
  onSeekToTimestamp?: (seconds: number) => void;
  initialSearchQuery?: string;
}

export const TechWordsSearcherPanel: React.FC<TechWordsSearcherPanelProps> = ({
  summaryMarkdown,
  videoTitle,
  transcriptSegments = [],
  currentTheme = 'midnight',
  onAppendToSummary,
  onSaveToList,
  onOpenArtifacts,
  onSeekToTimestamp,
  initialSearchQuery = '',
}) => {
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [selectedWord, setSelectedWord] = useState<TechWordEntry | null>(null);
  const [dictResult, setDictResult] = useState<DictionaryKnowledgeResult | null>(null);
  const [isDictLoading, setIsDictLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [appendedIds, setAppendedIds] = useState<Set<string>>(new Set());
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const { videoMatchedWords, allWords } = useMemo(() => {
    return getCombinedTechAndVideoWords(summaryMarkdown, videoTitle, transcriptSegments);
  }, [summaryMarkdown, videoTitle, transcriptSegments]);

  const filteredWords = useMemo(() => {
    return searchTechWordsHighGrade(searchQuery, allWords, domainFilter);
  }, [searchQuery, allWords, domainFilter]);

  const performDeepDictionaryLookup = async (termToLookup: string, matchedEntry?: TechWordEntry) => {
    const cleanQuery = termToLookup.replace(/\(.*?\)/g, '').trim() || termToLookup.trim();
    if (!cleanQuery) return;

    if (matchedEntry) {
      setSelectedWord(matchedEntry);
    } else {
      const found = allWords.find(
        (w) =>
          w.term.toLowerCase() === cleanQuery.toLowerCase() ||
          w.term.toLowerCase().includes(cleanQuery.toLowerCase())
      );
      setSelectedWord(
        found || {
          id: `custom-lookup-${cleanQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          term: cleanQuery,
          fullForm: 'Live Multi-Dictionary & Technical Lookup',
          domain: 'Software Engineering',
          importance: 'high',
          plainMeaning: `Querying Google Dictionary, Wiktionary Open Dictionary, Wikipedia, Wikidata, and StackOverflow Technical Wikis for "${cleanQuery}"...`,
          techArchitecture:
            'Inspect the live multi-dictionary, Wiktionary, StackOverflow Tag Wiki, Wikipedia, and Wikidata sections below for full lexical and engineering details.',
          realWorldExample: `Searched via High-Grade Tech, AI & CSE Word Searcher.`,
          relatedWords: [],
        }
      );
    }

    setIsDictLoading(true);
    try {
      const res = await fetch(`/api/dictionary-knowledge?q=${encodeURIComponent(cleanQuery)}`);
      const data = await res.json();
      if (res.ok && data.ok && data.result) {
        setDictResult(data.result);
      } else {
        setDictResult(null);
      }
    } catch {
      setDictResult(null);
    } finally {
      setIsDictLoading(false);
    }
  };

  useEffect(() => {
    if (initialSearchQuery.trim()) {
      setSearchQuery(initialSearchQuery);
      performDeepDictionaryLookup(initialSearchQuery);
    } else if (!selectedWord && allWords.length > 0) {
      const first = videoMatchedWords[0] || allWords[0];
      setSelectedWord(first);
      performDeepDictionaryLookup(first.term, first);
    }
  }, [initialSearchQuery]);

  const handleListen = (id: string, text: string, audioUrl?: string) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {
        speechService.speakSingle(text, id);
      });
      return;
    }
    if (speakingId === id) {
      speechService.stop();
      setSpeakingId(null);
    } else {
      speechService.stop();
      setSpeakingId(id);
      speechService.speakSingle(text, id);
    }
  };

  const handleSaveWordToArtifacts = (word: TechWordEntry, includeDict?: DictionaryKnowledgeResult | null) => {
    if (!onSaveToList) return;
    const dictExtra =
      includeDict && includeDict.query.toLowerCase().includes(word.term.replace(/\(.*?\)/g, '').trim().toLowerCase())
        ? [
            includeDict.definitions[0] ? `Dictionary (${includeDict.definitions[0].partOfSpeech}): ${includeDict.definitions[0].definition}` : '',
            includeDict.technicalWiki ? `StackOverflow Tech Wiki: ${includeDict.technicalWiki.excerpt}` : '',
            includeDict.wikipedia ? `Wikipedia: ${includeDict.wikipedia.extract}` : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        : '';

    onSaveToList({
      itemType: 'note',
      title: `${word.term}${word.fullForm ? ` — ${word.fullForm}` : ''}`,
      url:
        includeDict?.wikipedia?.url ||
        includeDict?.technicalWiki?.url ||
        `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(word.term)}`,
      subtitle: `Tech, AI & CSE Word · ${word.domain}`,
      content: `**Plain Meaning:** ${word.plainMeaning}\n\n**Technological & CSE Breakdown:** ${word.techArchitecture}\n\n**Real-World Engineering Example:** ${word.realWorldExample}${
        word.complexityOrMetric ? `\n\n**Complexity / Technical Metric:** \`${word.complexityOrMetric}\`` : ''
      }${dictExtra ? `\n\n${dictExtra}` : ''}`,
      notes: word.contextInVideo || `Saved from Tech, AI & CSE Words Searcher`,
    });

    setSavedIds((prev) => new Set(prev).add(word.id));
  };

  const handleAppendWordToSummary = (word: TechWordEntry, includeDict?: DictionaryKnowledgeResult | null) => {
    const wikiUrl =
      includeDict?.wikipedia?.url ||
      `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(word.term)}`;
    const dictLine =
      includeDict?.definitions?.[0]
        ? `\n* **Dictionary Definition (${includeDict.definitions[0].partOfSpeech}):** ${includeDict.definitions[0].definition}`
        : '';
    const soLine =
      includeDict?.technicalWiki
        ? `\n* **Engineering Wiki (${includeDict.technicalWiki.tag}):** ${includeDict.technicalWiki.excerpt}`
        : '';

    const md = `\n\n### Tech, AI & CSE Term: [${word.term}](${wikiUrl})${
      word.fullForm ? ` (*${word.fullForm}*)` : ''
    }\n* **Domain:** ${word.domain}${
      word.complexityOrMetric ? ` · **Metric/Complexity:** \`${word.complexityOrMetric}\`` : ''
    }\n* **Plain Meaning:** ${word.plainMeaning}\n* **Technological Architecture:** ${
      word.techArchitecture
    }\n* **Engineering Example:** ${word.realWorldExample}${dictLine}${soLine}\n`;

    onAppendToSummary(md);
    setAppendedIds((prev) => new Set(prev).add(word.id));
  };

  const domainTabs = [
    { id: 'all', label: `All Important Words (${allWords.length})` },
    { id: 'From This Video', label: `From This Video (${videoMatchedWords.length})` },
    {
      id: 'AI & Machine Learning',
      label: `AI & ML (${allWords.filter((w) => w.domain === 'AI & Machine Learning').length})`,
    },
    {
      id: 'CSE & Algorithms',
      label: `CSE & Algorithms (${allWords.filter((w) => w.domain === 'CSE & Algorithms').length})`,
    },
    {
      id: 'Systems & Cloud',
      label: `Systems & Cloud (${allWords.filter((w) => w.domain === 'Systems & Cloud').length})`,
    },
    {
      id: 'Hardware & Chips',
      label: `Hardware & Chips (${allWords.filter((w) => w.domain === 'Hardware & Chips').length})`,
    },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Header & High-Grade Search Bar */}
      <div className={`pb-4 border-b ${themeConfig.borderLight} space-y-3.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
                Tech, AI &amp; CSE Words Searcher + Open Multi-Dictionary
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-400">
                Google Dictionary · Wiktionary · StackOverflow Wiki · Wikipedia · Wikidata
              </span>
            </div>
            <p className={`text-[11px] ${themeConfig.textMuted}`}>
              High-grade search for essential AI, Computer Science (CSE), Algorithms, Systems, and Video terms—with plain-English meanings, under-the-hood technological architecture, and live multi-dictionary lookup.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {onOpenArtifacts && (
              <button
                type="button"
                onClick={onOpenArtifacts}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Artifacts Folder</span>
              </button>
            )}
          </div>
        </div>

        {/* High-Grade Search Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              const topMatch = filteredWords[0];
              performDeepDictionaryLookup(searchQuery.trim(), topMatch);
            }
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any AI, CSE, Algorithm, System, or English word (e.g., Transformer, RAG, Big-O, CAP Theorem, LoRA, Mutex, Ephemeral)..."
              className={`w-full pl-9 pr-20 py-2 text-xs rounded-lg border ${themeConfig.borderLight} bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none focus:border-indigo-500`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={!searchQuery.trim() || isDictLoading}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold ${themeConfig.primaryButton} disabled:opacity-40 cursor-pointer whitespace-nowrap`}
          >
            {isDictLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            <span>Deep Multi-Dictionary Search</span>
          </button>
        </form>

        {/* Domain Filter Bar */}
        <div className="flex items-center gap-1 flex-wrap">
          {domainTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDomainFilter(tab.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                domainFilter === tab.id
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Workspace: Left = High-Grade Word Directory, Right = Deep Tech + Multi-Dictionary Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (5 cols): Ranked Tech, AI, CSE & Video Words List */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className={`font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
              {searchQuery.trim()
                ? `Search Matches (${filteredWords.length})`
                : domainFilter === 'all'
                ? `Most Important Tech, AI, CSE & Video Words (${filteredWords.length})`
                : `${domainFilter} (${filteredWords.length})`}
            </span>
            {searchQuery.trim() && filteredWords.length === 0 && (
              <button
                type="button"
                onClick={() => performDeepDictionaryLookup(searchQuery.trim())}
                className="text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                Lookup &ldquo;{searchQuery.trim()}&rdquo; in Live Dictionaries →
              </button>
            )}
          </div>

          {/* If user typed a custom word not in curated list, offer immediate 1-click Live Multi-Dictionary card */}
          {searchQuery.trim() && (
            <div
              onClick={() => performDeepDictionaryLookup(searchQuery.trim())}
              className={`p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-between gap-2 cursor-pointer hover:bg-indigo-500/15 transition-colors`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span className={`text-xs font-bold ${themeConfig.textPrimary}`}>
                    Live Multi-Dictionary Lookup: &ldquo;{searchQuery.trim()}&rdquo;
                  </span>
                </div>
                <p className={`text-[11px] ${themeConfig.textSecondary}`}>
                  Query Google Dictionary, Wiktionary, StackOverflow Tech Wiki, Wikipedia &amp; Wikidata
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
            </div>
          )}

          <div className={`divide-y ${themeConfig.borderLight} max-h-[72vh] overflow-y-auto pr-1`}>
            {filteredWords.map((word) => {
              const isSelected = selectedWord?.id === word.id;
              const isSaved = savedIds.has(word.id);
              const isAppended = appendedIds.has(word.id);

              return (
                <div
                  key={word.id}
                  onClick={() => performDeepDictionaryLookup(word.term, word)}
                  className={`py-3 px-2.5 rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-500/15 border border-indigo-500/30'
                      : 'hover:bg-slate-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs sm:text-sm font-bold ${themeConfig.textPrimary}`}>
                          {word.term}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            word.domain === 'AI & Machine Learning'
                              ? 'bg-purple-500/15 text-purple-400'
                              : word.domain === 'CSE & Algorithms'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : word.domain === 'Systems & Cloud'
                              ? 'bg-sky-500/15 text-sky-400'
                              : word.domain === 'Hardware & Chips'
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-indigo-500/15 text-indigo-400'
                          }`}
                        >
                          {word.domain}
                        </span>
                        {word.formattedTime && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSeekToTimestamp && word.timestampSeconds !== undefined) {
                                onSeekToTimestamp(word.timestampSeconds);
                              }
                            }}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
                            title="Jump to exact moment in video"
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>[{word.formattedTime}]</span>
                          </button>
                        )}
                      </div>

                      {word.fullForm && (
                        <p className={`text-[11px] font-medium ${themeConfig.accent} truncate`}>
                          {word.fullForm}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onSaveToList && (
                        <button
                          type="button"
                          onClick={() => handleSaveWordToArtifacts(word)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                            isSaved
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                          }`}
                          title="Save this tech word & breakdown to Artifacts Folder"
                        >
                          <FolderOpen className="w-2.5 h-2.5" />
                          <span>{isSaved ? 'Saved' : '+ Artifacts'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAppendWordToSummary(word)}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                          isAppended
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : `bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`
                        }`}
                        title="Add to active video summary"
                      >
                        {isAppended ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                        <span>Summary</span>
                      </button>
                    </div>
                  </div>

                  <p className={`mt-1 text-xs ${themeConfig.textSecondary} line-clamp-2 leading-relaxed`}>
                    {word.plainMeaning}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols): Deep Technological Breakdown + Live Multi-Dictionary Results */}
        <div className="lg:col-span-7 space-y-5">
          {selectedWord ? (
            <div className={`p-4 sm:p-5 rounded-xl border ${themeConfig.borderLight} bg-slate-500/5 space-y-5`}>
              {/* Top Word Banner & Actions */}
              <div className={`pb-4 border-b ${themeConfig.borderLight} flex flex-wrap items-start justify-between gap-3`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-lg sm:text-xl font-bold ${themeConfig.textPrimary}`}>
                      {selectedWord.term}
                    </h3>
                    {dictResult?.phonetic && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-500/15 text-indigo-400">
                        {dictResult.phonetic}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-400">
                      {selectedWord.domain}
                    </span>
                    {selectedWord.complexityOrMetric && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400">
                        {selectedWord.complexityOrMetric}
                      </span>
                    )}
                  </div>
                  {selectedWord.fullForm && (
                    <p className={`text-xs sm:text-sm font-medium ${themeConfig.textSecondary}`}>
                      {selectedWord.fullForm}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      handleListen(
                        selectedWord.id,
                        `${selectedWord.term}. ${selectedWord.fullForm || ''}. ${selectedWord.plainMeaning}. Technological breakdown: ${selectedWord.techArchitecture}`,
                        dictResult?.audioUrl
                      )
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                      speakingId === selectedWord.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : `bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Pronounce / Read</span>
                  </button>

                  {onSaveToList && (
                    <button
                      type="button"
                      onClick={() => handleSaveWordToArtifacts(selectedWord, dictResult)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>
                        {savedIds.has(selectedWord.id) ? 'Saved in Artifacts' : '+ Save to Artifacts'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAppendWordToSummary(selectedWord, dictResult)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer transition-colors`}
                  >
                    {appendedIds.has(selectedWord.id) ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{appendedIds.has(selectedWord.id) ? 'Added to Summary' : '+ Add to Summary'}</span>
                  </button>
                </div>
              </div>

              {/* 1. Plain-English Meaning & Technological / CSE Architecture Breakdown */}
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Plain-English Meaning</span>
                  </div>
                  <p className={`text-sm leading-relaxed ${themeConfig.textPrimary}`}>
                    {selectedWord.plainMeaning}
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-500/15">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Technological, AI &amp; CSE Architecture (How It Works Under the Hood)</span>
                  </div>
                  <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                    {selectedWord.techArchitecture}
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-500/15">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Real-World Engineering &amp; Production Example</span>
                  </div>
                  <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                    {selectedWord.realWorldExample}
                  </p>
                </div>

                {selectedWord.contextInVideo && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        Mentioned in Active Video
                      </span>
                      {selectedWord.formattedTime && onSeekToTimestamp && selectedWord.timestampSeconds !== undefined && (
                        <button
                          type="button"
                          onClick={() => onSeekToTimestamp(selectedWord.timestampSeconds!)}
                          className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400 hover:underline cursor-pointer"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Jump to [{selectedWord.formattedTime}]</span>
                        </button>
                      )}
                    </div>
                    <p className={`text-xs italic ${themeConfig.textPrimary}`}>
                      &ldquo;{selectedWord.contextInVideo}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Live Multi-Dictionary & Open-Source Lexicon Section */}
              <div className={`pt-4 border-t ${themeConfig.borderLight} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    <h4 className={`text-xs sm:text-sm font-bold ${themeConfig.textPrimary}`}>
                      Live Google Dictionary, Wiktionary, StackOverflow Wiki &amp; Knowledge Graph
                    </h4>
                  </div>
                  {isDictLoading && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Querying dictionaries...
                    </span>
                  )}
                </div>

                {/* StackOverflow Engineering Tag Wiki (if returned) */}
                {dictResult?.technicalWiki && (
                  <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/25 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5" />
                        <span>StackOverflow CSE &amp; Developer Tag Wiki (`{dictResult.technicalWiki.tag}`)</span>
                      </span>
                      <a
                        href={dictResult.technicalWiki.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                      >
                        <span>Tag Info</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <p className={`text-xs leading-relaxed ${themeConfig.textPrimary}`}>
                      {dictResult.technicalWiki.excerpt}
                    </p>
                  </div>
                )}

                {/* Google / Free Dictionary Definitions */}
                {dictResult?.definitions && dictResult.definitions.length > 0 && (
                  <div className="space-y-2">
                    <div className={`text-[11px] font-bold uppercase tracking-wider ${themeConfig.textMuted}`}>
                      Google / Free Dictionary Lexicon Definitions
                    </div>
                    <div className="space-y-2">
                      {dictResult.definitions.map((d, i) => (
                        <div key={i} className="text-xs space-y-0.5 pl-3 border-l-2 border-indigo-500/40">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-400 font-semibold">
                              {d.partOfSpeech}
                            </span>
                            {d.source && (
                              <span className={`text-[10px] ${themeConfig.textMuted}`}>{d.source}</span>
                            )}
                          </div>
                          <p className={`${themeConfig.textPrimary} leading-relaxed`}>{d.definition}</p>
                          {d.example && (
                            <p className={`text-[11px] italic ${themeConfig.textMuted}`}>
                              Example: &ldquo;{d.example}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wiktionary Open-Source Dictionary Senses */}
                {dictResult?.wiktionaryDefinitions && dictResult.wiktionaryDefinitions.length > 0 && (
                  <div className="space-y-2">
                    <div className={`text-[11px] font-bold uppercase tracking-wider ${themeConfig.textMuted}`}>
                      Wiktionary Open-Source Dictionary Senses
                    </div>
                    <div className="space-y-1.5">
                      {dictResult.wiktionaryDefinitions.slice(0, 4).map((wd, idx) => (
                        <div key={idx} className="text-xs pl-3 border-l-2 border-emerald-500/40 space-y-0.5">
                          <span className="font-mono text-[10px] uppercase text-emerald-400 font-semibold">
                            {wd.partOfSpeech}
                          </span>
                          <p className={`${themeConfig.textSecondary} leading-relaxed`}>{wd.definition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wikipedia Technical Encyclopedia Extract */}
                {dictResult?.wikipedia && (
                  <div className="p-3 rounded-lg bg-slate-500/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${themeConfig.textPrimary}`}>
                        Wikipedia Technical Encyclopedia: {dictResult.wikipedia.title}
                      </span>
                      <a
                        href={dictResult.wikipedia.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${themeConfig.accent} hover:underline`}
                      >
                        <span>Full Article</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-start">
                      {dictResult.wikipedia.thumbnailUrl && (
                        <SmartImage
                          src={dictResult.wikipedia.thumbnailUrl}
                          alt={dictResult.wikipedia.title}
                          className="w-20 h-20 rounded object-cover shrink-0 bg-slate-800"
                        />
                      )}
                      <p className={`text-xs leading-relaxed ${themeConfig.textSecondary}`}>
                        {dictResult.wikipedia.extract}
                      </p>
                    </div>
                  </div>
                )}

                {/* DuckDuckGo Instant Technical Abstract (if different from Wikipedia) */}
                {dictResult?.duckDuckGoAbstract && !dictResult?.wikipedia && (
                  <div className="p-3 rounded-lg bg-slate-500/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${themeConfig.textPrimary}`}>
                        {dictResult.duckDuckGoAbstract.heading} ({dictResult.duckDuckGoAbstract.source})
                      </span>
                      <a
                        href={dictResult.duckDuckGoAbstract.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-xs ${themeConfig.accent} hover:underline`}
                      >
                        <span>Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className={`text-xs leading-relaxed ${themeConfig.textSecondary}`}>
                      {dictResult.duckDuckGoAbstract.abstract}
                    </p>
                  </div>
                )}

                {/* Wikidata Structured Entity */}
                {dictResult?.wikidata && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 border-t border-slate-500/15">
                    <div>
                      <span className="font-mono text-[11px] text-indigo-400 font-semibold mr-2">
                        Wikidata {dictResult.wikidata.id}
                      </span>
                      <span className={themeConfig.textSecondary}>{dictResult.wikidata.description}</span>
                    </div>
                    <a
                      href={dictResult.wikidata.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 text-[11px] ${themeConfig.accent} hover:underline`}
                    >
                      <span>Wikidata Graph</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}

                {/* Related Tech Concepts & Datamuse Semantic Words */}
                {(selectedWord.relatedWords.length > 0 ||
                  (dictResult?.relatedTerms && dictResult.relatedTerms.length > 0)) && (
                  <div className="space-y-2 pt-2 border-t border-slate-500/15">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${themeConfig.textMuted}`}>
                      Connected Tech, AI &amp; Lexical Terms (Click to Inspect)
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedWord.relatedWords.map((rw) => (
                        <button
                          key={rw}
                          type="button"
                          onClick={() => performDeepDictionaryLookup(rw)}
                          className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 cursor-pointer transition-colors"
                        >
                          {rw}
                        </button>
                      ))}
                      {(dictResult?.relatedTerms || []).slice(0, 8).map((rt) => (
                        <button
                          key={rt.word}
                          type="button"
                          onClick={() => performDeepDictionaryLookup(rt.word)}
                          className={`px-2 py-0.5 rounded text-[11px] bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} cursor-pointer transition-colors`}
                          title={rt.def || `Inspect "${rt.word}"`}
                        >
                          {rt.word}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct External Dictionary & CSE Reference Portals */}
                <div className="pt-2 border-t border-slate-500/15 flex items-center gap-2 flex-wrap text-[11px]">
                  <span className={themeConfig.textMuted}>Direct Dictionary Portals:</span>
                  {[
                    {
                      name: 'Google Dictionary Search',
                      url: `https://www.google.com/search?q=define+${encodeURIComponent(selectedWord.term)}`,
                    },
                    {
                      name: 'Wiktionary',
                      url: `https://en.wiktionary.org/wiki/${encodeURIComponent(
                        selectedWord.term.replace(/\(.*?\)/g, '').trim()
                      )}`,
                    },
                    {
                      name: 'Wikipedia CS',
                      url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(
                        selectedWord.term
                      )}`,
                    },
                    {
                      name: 'Papers With Code',
                      url: `https://paperswithcode.com/search?q=${encodeURIComponent(selectedWord.term)}`,
                    },
                    {
                      name: 'StackOverflow Tag',
                      url: `https://stackoverflow.com/questions/tagged/${encodeURIComponent(
                        selectedWord.term
                          .replace(/\(.*?\)/g, '')
                          .trim()
                          .toLowerCase()
                          .replace(/\s+/g, '-')
                      )}`,
                    },
                  ].map((portal) => (
                    <a
                      key={portal.name}
                      href={portal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`}
                    >
                      <span>{portal.name}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
