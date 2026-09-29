import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Plus,
  Search,
  Volume2,
  ArrowRight,
  Filter,
  BookOpen,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Globe,
  Layers,
  Bookmark,
  Clock,
} from 'lucide-react';
import {
  CrucialTermItem,
  KeyTakeawayItem,
  DictionaryKnowledgeResult,
  ThemeId,
  ParsedSegment,
} from '../types';
import { APP_THEMES } from '../constants';
import { extractCrucialKnowledge, formatKnowledgeAsMarkdown } from '../services/knowledgeExtractionService';
import { speechService } from '../services/speechService';

interface CrucialKnowledgePanelProps {
  summaryMarkdown: string;
  videoTitle: string;
  transcriptSegments?: ParsedSegment[];
  currentTheme?: ThemeId;
  onAppendToSummary: (markdownText: string) => void;
  onExploreTerm: (term: string) => void;
  onSaveToList?: (item: {
    itemType: 'video' | 'summary' | 'book' | 'article' | 'note';
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }) => void;
  onSeekToTimestamp?: (seconds: number) => void;
  activeTimestamp?: number | null;
}

export const CrucialKnowledgePanel: React.FC<CrucialKnowledgePanelProps> = ({
  summaryMarkdown,
  videoTitle,
  transcriptSegments = [],
  currentTheme = 'midnight',
  onAppendToSummary,
  onExploreTerm,
  onSaveToList,
  onSeekToTimestamp,
  activeTimestamp = null,
}) => {
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const findSegmentMatchForText = (queries: string[]): { seconds: number; label: string } | null => {
    for (const q of queries) {
      if (!q) continue;
      const explicitTs = q.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
      if (explicitTs) {
        const parts = explicitTs[1].split(':').map(Number);
        const sec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
        return { seconds: sec, label: explicitTs[1] };
      }
    }
    if (!transcriptSegments || transcriptSegments.length === 0) return null;
    for (const q of queries) {
      const cleaned = q.replace(/[^a-zA-Z0-9\s]/g, '').trim().toLowerCase();
      if (cleaned.length < 3) continue;
      const words = cleaned.split(/\s+/).filter((w) => w.length > 3);
      const searchSnippet = words.slice(0, 3).join(' ') || cleaned;
      const found = transcriptSegments.find((s) => s.text.toLowerCase().includes(searchSnippet));
      if (found) {
        return { seconds: found.start, label: found.formattedTime };
      }
    }
    return null;
  };

  const [viewMode, setViewMode] = useState<'list' | 'flashcards' | 'dictionary'>('list');
  const [filterType, setFilterType] = useState<'all' | 'takeaways' | 'acronyms' | 'concepts'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [appendedAll, setAppendedAll] = useState(false);
  const [speakingItem, setSpeakingItem] = useState<string | null>(null);

  // Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  // Live Dictionary & Wikidata Knowledge Graph Lookup state
  const [dictQuery, setDictQuery] = useState('');
  const [dictResult, setDictResult] = useState<DictionaryKnowledgeResult | null>(null);
  const [isDictLoading, setIsDictLoading] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const [dictAppended, setDictAppended] = useState(false);

  const { terms, takeaways } = useMemo(() => {
    return extractCrucialKnowledge(summaryMarkdown, videoTitle, transcriptSegments);
  }, [summaryMarkdown, videoTitle, transcriptSegments]);

  const filteredTakeaways = useMemo(() => {
    if (filterType === 'acronyms' || filterType === 'concepts') return [];
    if (!searchTerm.trim()) return takeaways;
    const lower = searchTerm.toLowerCase();
    return takeaways.filter(
      (t) =>
        t.principle.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        (t.quote && t.quote.toLowerCase().includes(lower)) ||
        t.actionableLesson.toLowerCase().includes(lower)
    );
  }, [takeaways, filterType, searchTerm]);

  const filteredTerms = useMemo(() => {
    if (filterType === 'takeaways') return [];
    let list = terms;
    if (filterType === 'acronyms') {
      list = list.filter((t) => t.category === 'acronym');
    } else if (filterType === 'concepts') {
      list = list.filter((t) => t.category !== 'acronym');
    }
    if (!searchTerm.trim()) return list;
    const lower = searchTerm.toLowerCase();
    return list.filter(
      (t) =>
        t.term.toLowerCase().includes(lower) ||
        (t.fullForm && t.fullForm.toLowerCase().includes(lower)) ||
        t.definition.toLowerCase().includes(lower) ||
        t.contextInVideo.toLowerCase().includes(lower)
    );
  }, [terms, filterType, searchTerm]);

  // Combined flashcard deck
  const flashcards = useMemo(() => {
    const deck: Array<{
      id: string;
      type: string;
      frontTitle: string;
      frontSubtitle?: string;
      backMain: string;
      backExtra?: string;
    }> = [];

    for (const t of takeaways) {
      deck.push({
        id: `fc-takeaway-${t.id}`,
        type: `Core Principle · ${t.category.replace('_', ' ')}`,
        frontTitle: t.principle,
        frontSubtitle: t.quote ? `"${t.quote}"` : 'What is the core insight and actionable lesson?',
        backMain: t.description,
        backExtra: `Actionable Lesson: ${t.actionableLesson}`,
      });
    }

    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      deck.push({
        id: `fc-term-${i}`,
        type: term.category === 'acronym' ? 'Acronym / Full Form' : 'Technical Concept',
        frontTitle: term.term,
        frontSubtitle: term.fullForm ? `Full Form: ${term.fullForm}` : 'Define this concept in context',
        backMain: term.definition,
        backExtra: term.contextInVideo ? `Context: "${term.contextInVideo}"` : undefined,
      });
    }
    return deck;
  }, [takeaways, terms]);

  const performDictionaryLookup = async (termToLookup: string) => {
    const q = termToLookup.trim();
    if (!q) return;
    setViewMode('dictionary');
    setDictQuery(q);
    setIsDictLoading(true);
    setDictError(null);
    setDictAppended(false);

    try {
      const res = await fetch(`/api/dictionary-knowledge?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to query Knowledge Graph.');
      }
      setDictResult(data.result);
    } catch (err: any) {
      setDictError(err.message || 'Lookup failed.');
    } finally {
      setIsDictLoading(false);
    }
  };

  const handleAppendDictResult = () => {
    if (!dictResult) return;
    const defLines = dictResult.definitions
      .slice(0, 3)
      .map((d) => `  * *(${d.partOfSpeech})* ${d.definition}`)
      .join('\n');
    const wikiLine = dictResult.wikipedia
      ? `\n> **Wikipedia Summary:** ${dictResult.wikipedia.extract} ([Read Article](${dictResult.wikipedia.url}))`
      : '';
    const wdLine = dictResult.wikidata
      ? `\n* **Wikidata Entity:** [${dictResult.wikidata.label} (${dictResult.wikidata.id})](${dictResult.wikidata.url}) — ${dictResult.wikidata.description}`
      : '';

    const md = `\n\n### Knowledge Graph Entry: ${dictResult.query} ${dictResult.phonetic ? `\`${dictResult.phonetic}\`` : ''}${wdLine}\n${defLines}${wikiLine}\n`;
    onAppendToSummary(md);
    setDictAppended(true);
    setTimeout(() => setDictAppended(false), 3000);
  };

  const handleCopyAll = () => {
    const md = formatKnowledgeAsMarkdown(terms, takeaways);
    navigator.clipboard.writeText(md);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleAppendAll = () => {
    const md = formatKnowledgeAsMarkdown(terms, takeaways);
    onAppendToSummary(md);
    setAppendedAll(true);
    setTimeout(() => setAppendedAll(false), 3000);
  };

  const handleAppendSingleTakeaway = (item: KeyTakeawayItem) => {
    const snippet = `\n\n> **Key Principle to Keep in Mind:** ${item.principle}\n>\n> *Insight:* ${item.description}\n${item.quote ? `> *Quote:* "${item.quote}"\n` : ''}> *Actionable Takeaway:* ${item.actionableLesson}\n`;
    onAppendToSummary(snippet);
  };

  const handleAppendSingleTerm = (item: CrucialTermItem) => {
    const snippet = `\n\n* **${item.term}**${item.fullForm ? ` (*${item.fullForm}*)` : ''}: ${item.definition} *(Context: ${item.contextInVideo})*\n`;
    onAppendToSummary(snippet);
  };

  const handleListen = (id: string, text: string) => {
    if (speakingItem === id) {
      speechService.stop();
      setSpeakingItem(null);
    } else {
      speechService.stop();
      setSpeakingItem(id);
      speechService.speakSingle(text, id);
    }
  };

  const currentCard = flashcards[cardIndex] || flashcards[0];

  return (
    <div className="w-full space-y-10">
      {/* Clean Unboxed Header & Filter Bar */}
      <div className={`pb-5 border-b ${themeConfig.borderLight} space-y-5`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className={`text-lg sm:text-xl font-bold tracking-tight ${themeConfig.textPrimary}`}>
              Key Lessons, Helpful Words &amp; Flashcards
            </h2>
            <div className={`flex items-center gap-2 text-xs ${themeConfig.textMuted} tabular-nums flex-wrap`}>
              <span>{takeaways.length} big lessons</span>
              <span aria-hidden="true">·</span>
              <span>{terms.filter((t) => t.category === 'acronym').length} abbreviations</span>
              <span aria-hidden="true">·</span>
              <span>{terms.filter((t) => t.category !== 'acronym').length} helpful terms</span>
              <span aria-hidden="true">·</span>
              <span>Instant Word &amp; Wikipedia Lookup</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-500/10 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  viewMode === 'list'
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                }`}
              >
                Lessons &amp; Words
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('flashcards');
                  setIsFlipped(false);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                  viewMode === 'flashcards'
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Flashcards ({flashcards.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('dictionary');
                  if (!dictResult && terms.length > 0) {
                    performDictionaryLookup(terms[0].fullForm || terms[0].term);
                  }
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                  viewMode === 'dictionary'
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Look Up Any Word</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap`}
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
            </button>

            <button
              type="button"
              onClick={handleAppendAll}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md ${themeConfig.primaryButton} text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap`}
            >
              {appendedAll ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{appendedAll ? 'Added to Summary' : 'Add All to Summary'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls & Search when in List Mode */}
        {viewMode === 'list' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: `All (${takeaways.length + terms.length})` },
                { id: 'takeaways', label: `Big Lessons (${takeaways.length})` },
                { id: 'acronyms', label: `Abbreviations (${terms.filter((t) => t.category === 'acronym').length})` },
                { id: 'concepts', label: `Helpful Words (${terms.filter((t) => t.category !== 'acronym').length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                    filterType === tab.id
                      ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                      : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px] sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter terms & principles..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none`}
              />
            </div>
          </div>
        )}
      </div>

      {/* MODE 2: INTERACTIVE FLASHCARDS DECK */}
      {viewMode === 'flashcards' && currentCard && (
        <div className="max-w-3xl mx-auto py-4 space-y-6">
          <div className="flex items-center justify-between text-xs">
            <span className={`${themeConfig.textMuted} tabular-nums`}>
              Card {cardIndex + 1} of {flashcards.length} · {masteredIds.size} Mastered
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  handleListen(
                    currentCard.id,
                    isFlipped
                      ? `${currentCard.backMain}. ${currentCard.backExtra || ''}`
                      : `${currentCard.frontTitle}. ${currentCard.frontSubtitle || ''}`
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                  speakingItem === currentCard.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Read Card Aloud</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMasteredIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(currentCard.id)) next.delete(currentCard.id);
                    else next.add(currentCard.id);
                    return next;
                  });
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                  masteredIds.has(currentCard.id)
                    ? 'text-emerald-400 bg-emerald-500/15 font-semibold'
                    : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{masteredIds.has(currentCard.id) ? 'Mastered' : 'Mark Mastered'}</span>
              </button>
            </div>
          </div>

          <div
            onClick={() => setIsFlipped((prev) => !prev)}
            className={`min-h-[280px] p-8 sm:p-10 rounded-xl border ${themeConfig.border} ${themeConfig.cardBg} flex flex-col justify-between cursor-pointer select-none transition-all hover:border-indigo-500/50`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-indigo-400 font-semibold uppercase tracking-wider">
                {currentCard.type}
              </span>
              <span className={themeConfig.textMuted}>
                {isFlipped ? 'Answer / Definition (Click to flip)' : 'Prompt / Term (Click to flip)'}
              </span>
            </div>

            {!isFlipped ? (
              <div className="py-8 space-y-3 text-center">
                <h3 className={`text-xl sm:text-2xl font-bold ${themeConfig.textPrimary}`}>
                  {currentCard.frontTitle}
                </h3>
                {currentCard.frontSubtitle && (
                  <p className={`text-sm ${themeConfig.textSecondary} max-w-xl mx-auto`}>
                    {currentCard.frontSubtitle}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-6 space-y-4">
                <p className={`text-base sm:text-lg leading-relaxed ${themeConfig.textPrimary}`}>
                  {currentCard.backMain}
                </p>
                {currentCard.backExtra && (
                  <p className="text-xs sm:text-sm text-amber-400 font-medium pt-2 border-t border-slate-500/20">
                    {currentCard.backExtra}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-500/15 text-xs">
              <span className={themeConfig.textMuted}>Click anywhere on card to flip</span>
              <RotateCcw className="w-3.5 h-3.5 opacity-50" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsFlipped(false);
                setCardIndex((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Card</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFlipped((prev) => !prev)}
              className={`px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${themeConfig.primaryButton}`}
            >
              {isFlipped ? 'Show Front' : 'Reveal Answer'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFlipped(false);
                setCardIndex((prev) => (prev + 1) % flashcards.length);
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`}
            >
              <span>Next Card</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODE 3: LIVE DICTIONARY, DATAMUSE SEMANTIC GRAPH & WIKIDATA KNOWLEDGE GRAPH */}
      {viewMode === 'dictionary' && (
        <div className="space-y-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performDictionaryLookup(dictQuery);
            }}
            className="flex items-center gap-2 max-w-2xl"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
              <input
                type="text"
                value={dictQuery}
                onChange={(e) => setDictQuery(e.target.value)}
                placeholder="Look up any term, entity, or concept in Free Dictionary, Datamuse & Wikidata..."
                className={`w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-md bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none`}
              />
            </div>
            <button
              type="submit"
              disabled={isDictLoading || !dictQuery.trim()}
              className={`px-4 py-2 rounded-md text-xs sm:text-sm font-semibold cursor-pointer ${themeConfig.primaryButton} flex items-center gap-1.5`}
            >
              {isDictLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              <span>Lookup API</span>
            </button>
          </form>

          {/* Quick Term Chips from Glossary */}
          {terms.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs ${themeConfig.textMuted}`}>Glossary Terms:</span>
              {terms.slice(0, 12).map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => performDictionaryLookup(t.fullForm || t.term)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                    dictQuery.toLowerCase() === (t.fullForm || t.term).toLowerCase()
                      ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                      : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`
                  }`}
                >
                  {t.term}
                </button>
              ))}
            </div>
          )}

          {isDictLoading && (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
              <p className={`text-xs ${themeConfig.textMuted}`}>
                Querying Free Dictionary API, Datamuse Semantic Graph, Wikidata &amp; Wikipedia REST v1...
              </p>
            </div>
          )}

          {dictError && !isDictLoading && (
            <p className="text-xs text-rose-400">{dictError}</p>
          )}

          {dictResult && !isDictLoading && (
            <div className="space-y-8">
              <div className={`pb-5 border-b ${themeConfig.borderLight} flex flex-wrap items-start justify-between gap-4`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className={`text-xl font-bold ${themeConfig.textPrimary}`}>
                      {dictResult.query}
                    </h3>
                    {dictResult.phonetic && (
                      <span className="text-sm font-mono text-indigo-400">
                        {dictResult.phonetic}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleListen(`dict-${dictResult.query}`, dictResult.query)}
                      className={`p-1.5 rounded-md ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                      title="Pronounce with Studio Neural TTS"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  {dictResult.wikidata && (
                    <div className={`text-xs ${themeConfig.textMuted} flex items-center gap-2 flex-wrap`}>
                      <span className="text-emerald-400 font-mono font-semibold">
                        Wikidata {dictResult.wikidata.id}
                      </span>
                      <span>·</span>
                      <span>{dictResult.wikidata.description}</span>
                      <a
                        href={dictResult.wikidata.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Entity Graph</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAppendDictResult}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md ${themeConfig.primaryButton} text-xs font-semibold cursor-pointer`}
                >
                  {dictAppended ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{dictAppended ? 'Appended to Summary' : 'Append Entry to Summary'}</span>
                </button>
              </div>

              {/* Wikipedia REST Summary */}
              {dictResult.wikipedia && (
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  {dictResult.wikipedia.thumbnailUrl && (
                    <img
                      src={dictResult.wikipedia.thumbnailUrl}
                      alt={dictResult.wikipedia.title}
                      referrerPolicy="no-referrer"
                      className="w-28 sm:w-36 rounded-lg object-cover shrink-0 bg-black/20"
                    />
                  )}
                  <div className="space-y-2 max-w-3xl">
                    <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Wikipedia REST v1 Encyclopedia Extract</span>
                    </div>
                    <p className={`text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                      {dictResult.wikipedia.extract}
                    </p>
                    <a
                      href={dictResult.wikipedia.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Read full Wikipedia article</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Lexical Definitions */}
              {dictResult.definitions.length > 0 && (
                <div className="space-y-3">
                  <h4 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                    Lexical Definitions (Free Dictionary API)
                  </h4>
                  <div className={`divide-y ${themeConfig.borderLight}`}>
                    {dictResult.definitions.map((d, i) => (
                      <div key={i} className="py-3 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-mono font-semibold text-indigo-400">
                            {d.partOfSpeech}
                          </span>
                          <p className={`text-sm ${themeConfig.textPrimary}`}>{d.definition}</p>
                        </div>
                        {d.example && (
                          <p className={`text-xs italic ${themeConfig.textMuted} pl-12`}>
                            &ldquo;{d.example}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Datamuse Semantic Concept Neighbors */}
              {dictResult.relatedTerms.length > 0 && (
                <div className="space-y-3">
                  <h4 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                    Semantically Related Concepts (Datamuse Lexical Graph API)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dictResult.relatedTerms.map((rt, i) => (
                      <div
                        key={i}
                        onClick={() => performDictionaryLookup(rt.word)}
                        className="p-3 rounded-lg bg-slate-500/5 hover:bg-slate-500/10 cursor-pointer transition-colors space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${themeConfig.textPrimary}`}>
                            {rt.word}
                          </span>
                          <ArrowRight className="w-3 h-3 opacity-40" />
                        </div>
                        {rt.def && (
                          <p className={`text-xs line-clamp-2 ${themeConfig.textMuted}`}>
                            {rt.def}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 1: STANDARD GLOSSARY LIST */}
      {viewMode === 'list' && (
        <>
          {/* 1. Core Principles & Mental Models */}
          {filteredTakeaways.length > 0 && (
            <section className="space-y-6">
              <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                Big Lessons &amp; Ideas Worth Remembering
              </h3>

              <div className={`divide-y ${themeConfig.borderLight}`}>
                {filteredTakeaways.map((item) => {
                  const isSpeaking = speakingItem === item.id;
                  const tsMatch = findSegmentMatchForText([
                    item.quote || '',
                    item.description,
                    item.principle,
                  ]);
                  const isSyncedTime =
                    tsMatch && activeTimestamp !== null && Math.abs(activeTimestamp - tsMatch.seconds) < 10;
                  return (
                    <div
                      key={item.id}
                      className="py-5 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                    >
                      <div className="space-y-2 max-w-4xl">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className={`text-base font-bold ${themeConfig.textPrimary}`}>
                            {item.principle}
                          </h4>
                          {tsMatch && onSeekToTimestamp && (
                            <button
                              type="button"
                              onClick={() => onSeekToTimestamp(tsMatch.seconds)}
                              className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded cursor-pointer tabular-nums transition-colors ${
                                isSyncedTime
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                              }`}
                              title={`Jump video to [${tsMatch.label}]`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>[{tsMatch.label}]</span>
                            </button>
                          )}
                          <span className={`text-xs ${themeConfig.textMuted}`}>
                            · {item.category.replace('_', ' ')}
                          </span>
                        </div>

                        <p className={`text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                          {item.description}
                        </p>

                        {item.quote && (
                          <blockquote className={`pl-4 border-l-2 border-amber-500/60 text-xs italic ${themeConfig.textMuted}`}>
                            &ldquo;{item.quote}&rdquo;
                          </blockquote>
                        )}

                        <div className="text-xs pt-1">
                          <span className="font-semibold text-amber-400">Actionable Takeaway: </span>
                          <span className={themeConfig.textSecondary}>{item.actionableLesson}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleListen(item.id, `${item.principle}. ${item.description}. ${item.actionableLesson}`)
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                            isSpeaking
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{isSpeaking ? 'Listening...' : 'Listen'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAppendSingleTakeaway(item)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer transition-colors whitespace-nowrap`}
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-400" />
                          <span>Add to Summary</span>
                        </button>

                        {onSaveToList && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveToList({
                                itemType: 'note',
                                title: item.principle,
                                subtitle: `Key Lesson from "${videoTitle}"`,
                                content: `${item.description}\n\n**How to use this:** ${item.actionableLesson}`,
                                notes: item.quote ? `Quote: "${item.quote}"` : '',
                              })
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer transition-colors whitespace-nowrap`}
                          >
                            <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Save to List</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. Full Forms & Crucial Terminology Glossary */}
          {filteredTerms.length > 0 && (
            <section className="space-y-6">
              <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                Helpful Words, Terms &amp; Abbreviations Explained
              </h3>

              <div className={`divide-y ${themeConfig.borderLight}`}>
                {filteredTerms.map((termItem, idx) => {
                  const isSpeaking = speakingItem === `term-${idx}`;
                  const tsMatch = findSegmentMatchForText([
                    termItem.contextInVideo || '',
                    termItem.term,
                    termItem.fullForm || '',
                  ]);
                  const isSyncedTime =
                    tsMatch && activeTimestamp !== null && Math.abs(activeTimestamp - tsMatch.seconds) < 10;
                  return (
                    <div
                      key={idx}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 max-w-4xl">
                        <div className="flex items-baseline gap-2.5 flex-wrap">
                          <span className="text-sm font-mono font-bold text-indigo-400">
                            {termItem.term}
                          </span>
                          {termItem.fullForm && (
                            <span className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                              — {termItem.fullForm}
                            </span>
                          )}
                          {tsMatch && onSeekToTimestamp && (
                            <button
                              type="button"
                              onClick={() => onSeekToTimestamp(tsMatch.seconds)}
                              className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded cursor-pointer tabular-nums transition-colors ${
                                isSyncedTime
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                              }`}
                              title={`Jump video to [${tsMatch.label}]`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>[{tsMatch.label}]</span>
                            </button>
                          )}
                          <span className={`text-xs ${themeConfig.textMuted}`}>
                            · {termItem.tag || termItem.category}
                          </span>
                        </div>

                        <p className={`text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                          {termItem.definition}
                        </p>

                        {termItem.contextInVideo && (
                          <p className={`text-xs italic ${themeConfig.textMuted}`}>
                            Context: &ldquo;{termItem.contextInVideo}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            handleListen(
                              `term-${idx}`,
                              `${termItem.term}. ${termItem.fullForm || ''}. ${termItem.definition}`
                            )
                          }
                          className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                            isSpeaking
                              ? 'text-amber-400 bg-amber-500/10'
                              : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                          }`}
                          title="Listen"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => performDictionaryLookup(termItem.fullForm || termItem.term)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer transition-colors whitespace-nowrap"
                          title="Look up plain-English meaning and Wikipedia background"
                        >
                          <Globe className="w-3 h-3" />
                          <span>Look Up Meaning</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onExploreTerm(termItem.fullForm || termItem.term)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <span>Find Videos &amp; Books</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAppendSingleTerm(termItem)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer transition-colors whitespace-nowrap`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add to Summary</span>
                        </button>

                        {onSaveToList && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveToList({
                                itemType: 'note',
                                title: `${termItem.term}${termItem.fullForm ? ` (${termItem.fullForm})` : ''}`,
                                subtitle: `Term from "${videoTitle}"`,
                                content: termItem.definition,
                                notes: termItem.contextInVideo ? `In video: "${termItem.contextInVideo}"` : '',
                              })
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer transition-colors whitespace-nowrap`}
                          >
                            <Bookmark className="w-3 h-3 text-indigo-400" />
                            <span>Save to List</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty State */}
          {filteredTakeaways.length === 0 && filteredTerms.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <Filter className="w-7 h-7 mx-auto opacity-30 text-amber-400" />
              <h4 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                No terms matching &ldquo;{searchTerm}&rdquo;
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('all');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
