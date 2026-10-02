import React, { useState, useMemo, useEffect } from 'react';
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
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import {
  CrucialTermItem,
  KeyTakeawayItem,
  DictionaryKnowledgeResult,
  ThemeId,
  ParsedSegment,
} from '../types';
import { APP_THEMES } from '../constants';
import {
  extractCrucialKnowledge,
  formatKnowledgeAsMarkdown,
  buildKnowledgeSources,
} from '../services/knowledgeExtractionService';
import { recordUserActivity } from '../services/listsService';
import { speechService } from '../services/speechService';
import { SmartImage } from './SmartImage';

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

  const findSegmentMatchForText = (
    queries: string[],
    explicitFormattedTime?: string,
    explicitSeconds?: number
  ): { seconds: number; label: string } | null => {
    if (explicitSeconds !== undefined && explicitFormattedTime) {
      return { seconds: explicitSeconds, label: explicitFormattedTime };
    }
    if (explicitFormattedTime) {
      const cleanTs = explicitFormattedTime.replace(/[\[\]]/g, '').trim();
      const parts = cleanTs.split(':').map(Number);
      if (parts.length >= 2 && parts.every((n) => !Number.isNaN(n))) {
        const sec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
        return { seconds: sec, label: cleanTs };
      }
    }
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

  // Live 12-Source Knowledge Graph & Dictionary Lookup state
  const [dictQuery, setDictQuery] = useState('');
  const [dictResult, setDictResult] = useState<DictionaryKnowledgeResult | null>(null);
  const [isDictLoading, setIsDictLoading] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const [dictAppended, setDictAppended] = useState(false);

  // Deep AI + Multi-Source enriched terms & takeaways state
  const [aiTerms, setAiTerms] = useState<CrucialTermItem[]>([]);
  const [aiTakeaways, setAiTakeaways] = useState<KeyTakeawayItem[]>([]);
  const [isEnrichingKnowledge, setIsEnrichingKnowledge] = useState(false);

  const baseKnowledge = useMemo(() => {
    return extractCrucialKnowledge(summaryMarkdown, videoTitle, transcriptSegments);
  }, [summaryMarkdown, videoTitle, transcriptSegments]);

  useEffect(() => {
    let cancelled = false;
    const transcriptSample = transcriptSegments
      .slice(0, 120)
      .map((s) => `[${s.formattedTime}] ${s.text}`)
      .join('\n');

    if (!summaryMarkdown && !transcriptSample) return;

    setIsEnrichingKnowledge(true);
    fetch('/api/extract-key-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoTitle,
        summaryMarkdown: summaryMarkdown.slice(0, 6000),
        transcriptSample: transcriptSample.slice(0, 4000),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) {
          if (Array.isArray(data.terms) && data.terms.length > 0) {
            setAiTerms(data.terms);
          }
          if (Array.isArray(data.takeaways) && data.takeaways.length > 0) {
            setAiTakeaways(data.takeaways);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsEnrichingKnowledge(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoTitle, summaryMarkdown]);

  // Merge AI-enriched key ideas & words with deterministic base extraction (deduplicated & zero placeholders)
  const { terms, takeaways } = useMemo(() => {
    const mergedTakeaways: KeyTakeawayItem[] = [];
    const seenPrinciples = new Set<string>();

    for (const tk of [...aiTakeaways, ...baseKnowledge.takeaways]) {
      const key = tk.principle.toLowerCase().slice(0, 22).trim();
      if (seenPrinciples.has(key)) continue;
      seenPrinciples.add(key);
      mergedTakeaways.push({
        ...tk,
        sources: tk.sources && tk.sources.length > 0 ? tk.sources : buildKnowledgeSources(tk.principle),
      });
    }

    const mergedTerms: CrucialTermItem[] = [];
    const seenTerms = new Set<string>();

    for (const tm of [...aiTerms, ...baseKnowledge.terms]) {
      const key = tm.term.toLowerCase().trim();
      if (seenTerms.has(key)) continue;
      seenTerms.add(key);
      mergedTerms.push({
        ...tm,
        sources:
          tm.sources && tm.sources.length > 0
            ? tm.sources
            : buildKnowledgeSources(tm.fullForm || tm.term),
      });
    }

    return {
      terms: mergedTerms,
      takeaways: mergedTakeaways,
    };
  }, [aiTerms, aiTakeaways, baseKnowledge]);

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
        (t.whyItMatters && t.whyItMatters.toLowerCase().includes(lower)) ||
        (t.contextInVideo && t.contextInVideo.toLowerCase().includes(lower))
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
        type: `Key Idea · ${t.category.replace('_', ' ')}`,
        frontTitle: t.principle,
        frontSubtitle: t.quote ? `"${t.quote}"` : undefined,
        backMain: t.description,
        backExtra: t.actionableLesson ? `How to apply this: ${t.actionableLesson}` : undefined,
      });
    }

    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      deck.push({
        id: `fc-term-${i}`,
        type: term.tag || (term.category === 'acronym' ? 'Abbreviation' : 'Key Concept'),
        frontTitle: term.term,
        frontSubtitle: term.fullForm || undefined,
        backMain: term.definition,
        backExtra: term.whyItMatters
          ? `Why it matters: ${term.whyItMatters}`
          : term.contextInVideo
          ? `In video: "${term.contextInVideo}"`
          : undefined,
      });
    }
    return deck;
  }, [takeaways, terms]);

  const performDictionaryLookup = async (termToLookup: string, isUserAction: boolean = true) => {
    const q = termToLookup.trim();
    if (!q) return;
    setViewMode('dictionary');
    setDictQuery(q);
    setIsDictLoading(true);
    setDictError(null);
    setDictAppended(false);

    try {
      const res = await fetch(
        `/api/dictionary-knowledge?q=${encodeURIComponent(q)}&context=${encodeURIComponent(videoTitle)}`
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to query Knowledge Graph.');
      }
      const result: DictionaryKnowledgeResult = data.result;
      setDictResult(result);

      if (isUserAction) {
        recordUserActivity({
          actionType: 'dictionary',
          title: `Word & Concept Lookup: ${q}`,
          query: q,
          details:
            result.plainEnglish?.summary ||
            result.wikipedia?.extract ||
            result.definitions?.[0]?.definition ||
            result.wikidata?.description ||
            '',
          videoTitle,
        }).catch(() => {});
      }
    } catch {
      const matchingTerm = terms.find(
        (t) =>
          t.term.toLowerCase() === q.toLowerCase() ||
          (t.fullForm && t.fullForm.toLowerCase() === q.toLowerCase())
      );
      setDictResult({
        query: q,
        plainEnglish: matchingTerm
          ? {
              summary: matchingTerm.definition,
              whyItMatters: matchingTerm.whyItMatters || '',
              realWorldExample: matchingTerm.realWorldExample,
              fullForm: matchingTerm.fullForm,
            }
          : undefined,
        definitions: matchingTerm
          ? [
              {
                partOfSpeech: matchingTerm.tag || 'concept',
                definition: matchingTerm.definition,
                example: matchingTerm.contextInVideo,
              },
            ]
          : [],
        synonyms: [],
        relatedTerms: terms
          .filter((t) => t.term.toLowerCase() !== q.toLowerCase())
          .slice(0, 6)
          .map((t) => ({
            word: t.term,
            def: t.definition,
          })),
      });
    } finally {
      setIsDictLoading(false);
    }
  };

  const handleAppendDictResult = () => {
    if (!dictResult) return;
    const plainBlock = dictResult.plainEnglish
      ? `\n* **In Plain English:** ${dictResult.plainEnglish.summary}${
          dictResult.plainEnglish.whyItMatters ? `\n* **Why It Matters:** ${dictResult.plainEnglish.whyItMatters}` : ''
        }${
          dictResult.plainEnglish.realWorldExample
            ? `\n* **Real-World Example:** ${dictResult.plainEnglish.realWorldExample}`
            : ''
        }`
      : '';
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

    const md = `\n\n### Knowledge Graph Entry: ${dictResult.query} ${
      dictResult.phonetic ? `\`${dictResult.phonetic}\`` : ''
    }${plainBlock}${wdLine}${defLines ? `\n${defLines}` : ''}${wikiLine}\n`;
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
    const snippet = `\n\n> **Key Idea:** ${item.principle}${
      item.formattedTime ? ` \`[${item.formattedTime}]\`` : ''
    }\n>\n> *Explanation:* ${item.description}\n${item.quote ? `> *Speaker Quote:* "${item.quote}"\n` : ''}${
      item.actionableLesson ? `> *How to Apply It:* ${item.actionableLesson}\n` : ''
    }`;
    onAppendToSummary(snippet);
  };

  const handleAppendSingleTerm = (item: CrucialTermItem) => {
    const snippet = `\n\n* **${item.term}**${item.fullForm ? ` (*${item.fullForm}*)` : ''}${
      item.formattedTime ? ` \`[${item.formattedTime}]\`` : ''
    }: ${item.definition}${item.whyItMatters ? ` *Why it matters:* ${item.whyItMatters}` : ''}${
      item.contextInVideo ? ` *(In video: "${item.contextInVideo}")*` : ''
    }\n`;
    onAppendToSummary(snippet);
  };

  const handleListen = (id: string, text: string, audioUrl?: string) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {
        speechService.speakSingle(text, id);
      });
      return;
    }
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
    <div className="w-full space-y-6">
      {/* Clean Header & Filter Bar */}
      <div className={`pb-3.5 border-b ${themeConfig.borderLight} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
                Key Ideas, Crucial Words &amp; 12-Source Knowledge Lookup
              </h2>
              {isEnrichingKnowledge ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-400">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>Enriching from Knowledge Sources...</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Wikipedia · Wikidata · Wiktionary · OpenAlex · arXiv · Crossref · StackOverflow</span>
                </span>
              )}
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] ${themeConfig.textMuted} tabular-nums flex-wrap`}>
              <span>{takeaways.length} key ideas &amp; lessons</span>
              <span aria-hidden="true">·</span>
              <span>{terms.filter((t) => t.category === 'acronym').length} abbreviations</span>
              <span aria-hidden="true">·</span>
              <span>{terms.filter((t) => t.category !== 'acronym').length} explained concepts &amp; terms</span>
              <span aria-hidden="true">·</span>
              <span>Plain-English explanations with verified sources</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Mode Switcher */}
            <div className="flex items-center gap-0.5 bg-slate-500/10 p-0.5 rounded">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  viewMode === 'list'
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                }`}
              >
                Key Ideas &amp; Words
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('flashcards');
                  setIsFlipped(false);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                  viewMode === 'flashcards'
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Flashcards ({flashcards.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('dictionary');
                  if (!dictResult && terms.length > 0) {
                    performDictionaryLookup(terms[0].fullForm || terms[0].term, false);
                  }
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                  viewMode === 'dictionary'
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>12-Source Word Lookup</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyAll}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap`}
            >
              {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
            </button>

            <button
              type="button"
              onClick={handleAppendAll}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded ${themeConfig.primaryButton} text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
            >
              {appendedAll ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              <span>{appendedAll ? 'Added' : '+ Add All to Summary'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls & Search when in List Mode */}
        {viewMode === 'list' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { id: 'all', label: `All (${takeaways.length + terms.length})` },
                { id: 'takeaways', label: `Key Ideas & Lessons (${takeaways.length})` },
                { id: 'acronyms', label: `Abbreviations (${terms.filter((t) => t.category === 'acronym').length})` },
                { id: 'concepts', label: `Crucial Words & Concepts (${terms.filter((t) => t.category !== 'acronym').length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                    filterType === tab.id
                      ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                      : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 min-w-[240px] sm:max-w-sm">
              <div className="relative flex-1">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter or look up any word or idea..."
                  className={`w-full pl-7 pr-2.5 py-1 text-[11px] rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none`}
                />
              </div>
              {searchTerm.trim() && (
                <button
                  type="button"
                  onClick={() => performDictionaryLookup(searchTerm.trim(), true)}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 cursor-pointer whitespace-nowrap"
                >
                  Look Up &ldquo;{searchTerm.trim().slice(0, 14)}&rdquo; →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODE 2: INTERACTIVE FLASHCARDS DECK */}
      {viewMode === 'flashcards' && currentCard && (
        <div className="max-w-3xl mx-auto py-3 space-y-4">
          <div className="flex items-center justify-between text-[11px]">
            <span className={`${themeConfig.textMuted} tabular-nums`}>
              Card {cardIndex + 1} of {flashcards.length} · {masteredIds.size} Mastered
            </span>
            <div className="flex items-center gap-1.5">
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
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  speakingItem === currentCard.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`
                }`}
              >
                <Volume2 className="w-3 h-3" />
                <span>Read Card</span>
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
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  masteredIds.has(currentCard.id)
                    ? 'text-emerald-400 bg-emerald-500/15 font-semibold'
                    : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`
                }`}
              >
                <Check className="w-3 h-3" />
                <span>{masteredIds.has(currentCard.id) ? 'Mastered' : 'Mark Mastered'}</span>
              </button>
            </div>
          </div>

          <div
            onClick={() => setIsFlipped((prev) => !prev)}
            className={`min-h-[220px] p-6 sm:p-8 rounded-xl border ${themeConfig.border} ${themeConfig.cardBg} flex flex-col justify-between cursor-pointer select-none transition-all hover:border-indigo-500/50`}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-indigo-400 font-semibold uppercase tracking-wider">
                {currentCard.type}
              </span>
              <span className={themeConfig.textMuted}>
                {isFlipped ? 'Plain-English Answer (Click to flip)' : 'Concept / Key Idea (Click to flip)'}
              </span>
            </div>

            {!isFlipped ? (
              <div className="py-6 space-y-2 text-center">
                <h3 className={`text-lg sm:text-xl font-bold ${themeConfig.textPrimary}`}>
                  {currentCard.frontTitle}
                </h3>
                {currentCard.frontSubtitle && (
                  <p className={`text-xs sm:text-sm ${themeConfig.textSecondary} max-w-xl mx-auto`}>
                    {currentCard.frontSubtitle}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-5 space-y-3">
                <p className={`text-sm sm:text-base leading-relaxed ${themeConfig.textPrimary}`}>
                  {currentCard.backMain}
                </p>
                {currentCard.backExtra && (
                  <p className="text-xs text-amber-400 font-medium pt-2 border-t border-slate-500/20">
                    {currentCard.backExtra}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-500/15 text-[11px]">
              <span className={themeConfig.textMuted}>Click anywhere on card to flip</span>
              <RotateCcw className="w-3 h-3 opacity-50" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsFlipped(false);
                setCardIndex((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFlipped((prev) => !prev)}
              className={`px-3 py-1 rounded text-[11px] font-semibold cursor-pointer ${themeConfig.primaryButton}`}
            >
              {isFlipped ? 'Show Front' : 'Reveal Explanation'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFlipped(false);
                setCardIndex((prev) => (prev + 1) % flashcards.length);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`}
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MODE 3: 12-SOURCE WORD & CONCEPT LOOKUP */}
      {viewMode === 'dictionary' && (
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performDictionaryLookup(dictQuery, true);
            }}
            className="flex items-center gap-1.5 max-w-2xl"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
              <input
                type="text"
                value={dictQuery}
                onChange={(e) => setDictQuery(e.target.value)}
                placeholder="Search any word, concept, person, acronym, or phrase across 12 knowledge sources..."
                className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg border ${themeConfig.borderLight} bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none focus:border-indigo-500`}
              />
            </div>
            <button
              type="submit"
              disabled={isDictLoading || !dictQuery.trim()}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${themeConfig.primaryButton} flex items-center gap-1.5 whitespace-nowrap`}
            >
              {isDictLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              <span>Search 12 Sources</span>
            </button>
          </form>

          {/* Quick Term Chips from Active Video */}
          {terms.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[11px] font-medium ${themeConfig.textMuted}`}>Words from this video:</span>
              {terms.slice(0, 14).map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => performDictionaryLookup(t.fullForm || t.term, true)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
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
            <div className="py-10 text-center space-y-2">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-400" />
              <p className={`text-xs ${themeConfig.textMuted}`}>
                Querying Wikipedia, Wikidata, Wiktionary, Dictionary API, StackOverflow Wiki, OpenAlex, arXiv, Crossref &amp; OpenLibrary...
              </p>
            </div>
          )}

          {dictError && !isDictLoading && (
            <p className="text-xs text-rose-400">{dictError}</p>
          )}

          {dictResult && !isDictLoading && (
            <div className="space-y-6">
              <div className={`pb-4 border-b ${themeConfig.borderLight} flex flex-wrap items-start justify-between gap-3`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className={`text-lg sm:text-xl font-bold ${themeConfig.textPrimary}`}>
                      {dictResult.query}
                    </h3>
                    {dictResult.plainEnglish?.fullForm && (
                      <span className={`text-xs sm:text-sm font-semibold ${themeConfig.textSecondary}`}>
                        — {dictResult.plainEnglish.fullForm}
                      </span>
                    )}
                    {dictResult.phonetic && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                        {dictResult.phonetic}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleListen(
                          `dict-${dictResult.query}`,
                          `${dictResult.query}. ${dictResult.plainEnglish?.summary || dictResult.definitions?.[0]?.definition || ''}`,
                          dictResult.audioUrl
                        )
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                      title="Listen to pronunciation & plain-English explanation"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Listen</span>
                    </button>
                  </div>
                  {dictResult.wikidata && (
                    <div className={`text-xs ${themeConfig.textMuted} flex items-center gap-2 flex-wrap`}>
                      <span className="font-mono text-[11px] text-indigo-400 font-semibold">
                        Wikidata {dictResult.wikidata.id}
                      </span>
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

                <div className="flex items-center gap-1.5">
                  {onSaveToList && (
                    <button
                      type="button"
                      onClick={() =>
                        onSaveToList({
                          itemType: 'note',
                          title: `${dictResult.query}${dictResult.plainEnglish?.fullForm ? ` (${dictResult.plainEnglish.fullForm})` : ''}`,
                          url: dictResult.wikipedia?.url || dictResult.wikidata?.url,
                          subtitle: `12-Source Knowledge Entry · "${videoTitle}"`,
                          content:
                            dictResult.plainEnglish?.summary ||
                            dictResult.wikipedia?.extract ||
                            dictResult.definitions?.[0]?.definition ||
                            '',
                          notes: dictResult.plainEnglish?.whyItMatters || '',
                        })
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer`}
                    >
                      <Bookmark className="w-3 h-3" />
                      <span>Save to Artifacts</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAppendDictResult}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded ${themeConfig.primaryButton} text-[11px] font-semibold cursor-pointer`}
                  >
                    {dictAppended ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    <span>{dictAppended ? 'Added to Summary' : '+ Add to Summary'}</span>
                  </button>
                </div>
              </div>

              {/* Verified Sources Badges */}
              {dictResult.sourcesUsed && dictResult.sourcesUsed.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className={`font-semibold ${themeConfig.textMuted}`}>Verified across:</span>
                  {dictResult.sourcesUsed.map((src) => (
                    <span
                      key={src}
                      className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium"
                    >
                      ✓ {src}
                    </span>
                  ))}
                </div>
              )}

              {/* Plain-English Breakdown Card */}
              {dictResult.plainEnglish && (
                <div className={`p-4 rounded-xl border ${themeConfig.borderLight} bg-indigo-500/5 space-y-3`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>In Plain English (Easy-to-Understand Breakdown)</span>
                  </div>
                  <p className={`text-sm sm:text-base leading-relaxed ${themeConfig.textPrimary}`}>
                    {dictResult.plainEnglish.summary}
                  </p>
                  {dictResult.plainEnglish.whyItMatters && (
                    <div className="text-xs sm:text-sm pt-2 border-t border-slate-500/15">
                      <span className="font-semibold text-amber-400">Why it matters: </span>
                      <span className={themeConfig.textSecondary}>{dictResult.plainEnglish.whyItMatters}</span>
                    </div>
                  )}
                  {dictResult.plainEnglish.realWorldExample && (
                    <div className="text-xs sm:text-sm">
                      <span className="font-semibold text-indigo-400">Real-world example: </span>
                      <span className={themeConfig.textSecondary}>{dictResult.plainEnglish.realWorldExample}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Wikipedia REST Summary */}
              {dictResult.wikipedia && (
                <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl bg-slate-500/5">
                  {dictResult.wikipedia.thumbnailUrl && (
                    <SmartImage
                      src={dictResult.wikipedia.thumbnailUrl}
                      alt={dictResult.wikipedia.title}
                      variant="wiki"
                      className="w-24 sm:w-32 rounded-lg object-cover shrink-0 bg-black/20"
                    />
                  )}
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Wikipedia Encyclopedia Overview ({dictResult.wikipedia.title})</span>
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

              {/* StackOverflow Technical Wiki (if applicable) */}
              {dictResult.technicalWiki && (
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">
                      Technical &amp; Developer Encyclopedia ({dictResult.technicalWiki.tag})
                    </span>
                    <a
                      href={dictResult.technicalWiki.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>StackOverflow Tag Wiki</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textPrimary}`}>
                    {dictResult.technicalWiki.excerpt}
                  </p>
                </div>
              )}

              {/* Lexical & Wiktionary Definitions */}
              {dictResult.definitions.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                    Lexical &amp; Wiktionary Definitions
                  </h4>
                  <div className={`divide-y ${themeConfig.borderLight}`}>
                    {dictResult.definitions.map((d, i) => (
                      <div key={i} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-mono font-semibold text-indigo-400">
                            {d.partOfSpeech}
                          </span>
                          <p className={`text-sm ${themeConfig.textPrimary}`}>{d.definition}</p>
                        </div>
                        {d.example && (
                          <p className={`text-xs italic ${themeConfig.textMuted} pl-10`}>
                            &ldquo;{d.example}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Peer-Reviewed Academic Papers (OpenAlex, arXiv, Crossref) */}
              {dictResult.academicPapers && dictResult.academicPapers.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted} flex items-center gap-1.5`}>
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Peer-Reviewed Academic Papers &amp; Preprints (OpenAlex · arXiv · Crossref)</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {dictResult.academicPapers.map((paper, idx) => (
                      <a
                        key={idx}
                        href={paper.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-lg bg-slate-500/5 hover:bg-slate-500/10 transition-colors space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xs font-bold ${themeConfig.textPrimary} hover:underline line-clamp-2`}>
                            {paper.title}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-50 mt-0.5" />
                        </div>
                        <div className={`text-[11px] ${themeConfig.textMuted} flex items-center gap-1.5 flex-wrap`}>
                          <span>{paper.authors}</span>
                          {paper.year && <span>· {paper.year}</span>}
                          {paper.citationCount !== undefined && <span>· {paper.citationCount} citations</span>}
                          <span className="text-indigo-400 font-medium">· {paper.source}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Published Books (OpenLibrary) */}
              {dictResult.books && dictResult.books.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                    Published Books &amp; Literature (OpenLibrary)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {dictResult.books.map((bk, idx) => (
                      <a
                        key={idx}
                        href={bk.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-lg bg-slate-500/5 hover:bg-slate-500/10 transition-colors space-y-1"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className={`text-xs font-bold ${themeConfig.textPrimary} line-clamp-1`}>
                            {bk.title}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                        </div>
                        <div className={`text-[11px] ${themeConfig.textMuted}`}>
                          {bk.author} {bk.year ? `(${bk.year})` : ''}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Datamuse Semantic Concept Neighbors */}
              {dictResult.relatedTerms.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                    Related Words &amp; Connected Concepts (Click to Look Up)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {dictResult.relatedTerms.map((rt, i) => (
                      <div
                        key={i}
                        onClick={() => performDictionaryLookup(rt.word, true)}
                        className="p-2.5 rounded-lg bg-slate-500/5 hover:bg-slate-500/10 cursor-pointer transition-colors space-y-1"
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

      {/* MODE 1: USER-FRIENDLY KEY IDEAS & CRUCIAL WORDS LIST */}
      {viewMode === 'list' && (
        <>
          {/* 1. Key Ideas & Big Lessons Worth Remembering */}
          {filteredTakeaways.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                  Key Ideas &amp; Big Lessons Worth Remembering ({filteredTakeaways.length})
                </h3>
              </div>

              <div className={`divide-y ${themeConfig.borderLight}`}>
                {filteredTakeaways.map((item) => {
                  const isSpeaking = speakingItem === item.id;
                  const tsMatch = findSegmentMatchForText(
                    [item.quote || '', item.description, item.principle],
                    item.formattedTime,
                    item.timestampSeconds
                  );
                  const isSyncedTime =
                    tsMatch && activeTimestamp !== null && Math.abs(activeTimestamp - tsMatch.seconds) < 10;
                  const sources = item.sources || buildKnowledgeSources(item.principle);

                  return (
                    <div
                      key={item.id}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-start justify-between gap-3"
                    >
                      <div className="space-y-2 max-w-4xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-sm sm:text-base font-bold ${themeConfig.textPrimary}`}>
                            {item.principle}
                          </h4>
                          {tsMatch && onSeekToTimestamp && (
                            <button
                              type="button"
                              onClick={() => onSeekToTimestamp(tsMatch.seconds)}
                              className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded cursor-pointer tabular-nums transition-colors ${
                                isSyncedTime
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                              }`}
                              title={`Jump video to [${tsMatch.label}]`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>[{tsMatch.label}]</span>
                            </button>
                          )}
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 capitalize">
                            {item.category.replace('_', ' ')}
                          </span>
                        </div>

                        <p className={`text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                          {item.description}
                        </p>

                        {item.quote && (
                          <blockquote className={`pl-3 border-l-2 border-amber-500/60 text-xs italic ${themeConfig.textMuted}`}>
                            &ldquo;{item.quote}&rdquo;
                          </blockquote>
                        )}

                        {item.actionableLesson && (
                          <div className="text-xs pt-0.5">
                            <span className="font-semibold text-emerald-400">How to apply this in real life: </span>
                            <span className={themeConfig.textSecondary}>{item.actionableLesson}</span>
                          </div>
                        )}

                        {/* Multi-Source Knowledge Links for this Key Idea */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                          <span className={`${themeConfig.textMuted} text-[10px] font-semibold uppercase tracking-wider`}>
                            Sources:
                          </span>
                          {sources.slice(0, 4).map((src) => (
                            <a
                              key={src.label}
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} text-[10px]`}
                            >
                              <span>{src.label}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            handleListen(item.id, `${item.principle}. ${item.description}. ${item.actionableLesson}`)
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                            isSpeaking
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15`
                          }`}
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => performDictionaryLookup(item.principle, true)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <Globe className="w-2.5 h-2.5" />
                          <span>Deep Lookup</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAppendSingleTakeaway(item)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 cursor-pointer transition-colors whitespace-nowrap`}
                        >
                          <Plus className="w-3 h-3 text-amber-400" />
                          <span>+ Summary</span>
                        </button>

                        {onSaveToList && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveToList({
                                itemType: 'note',
                                title: item.principle,
                                subtitle: `Key Idea from "${videoTitle}"`,
                                content: `${item.description}\n\n**How to apply this:** ${item.actionableLesson}`,
                                notes: item.quote ? `Quote: "${item.quote}"` : '',
                              })
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 cursor-pointer transition-colors whitespace-nowrap`}
                          >
                            <Bookmark className="w-3 h-3 text-indigo-400" />
                            <span>Save</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. Crucial Words, Concepts & Abbreviations Explained */}
          {filteredTerms.length > 0 && (
            <section className="space-y-4">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Key Words, Concepts &amp; Abbreviations Explained in Plain English ({filteredTerms.length})
              </h3>

              <div className={`divide-y ${themeConfig.borderLight}`}>
                {filteredTerms.map((termItem, idx) => {
                  const isSpeaking = speakingItem === `term-${idx}`;
                  const tsMatch = findSegmentMatchForText(
                    [termItem.contextInVideo || '', termItem.term, termItem.fullForm || ''],
                    termItem.formattedTime,
                    termItem.timestampSeconds
                  );
                  const isSyncedTime =
                    tsMatch && activeTimestamp !== null && Math.abs(activeTimestamp - tsMatch.seconds) < 10;
                  const sources = termItem.sources || buildKnowledgeSources(termItem.fullForm || termItem.term);

                  return (
                    <div
                      key={idx}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-start justify-between gap-3"
                    >
                      <div className="space-y-1.5 max-w-4xl">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-bold text-indigo-400">
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
                              className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded cursor-pointer tabular-nums transition-colors ${
                                isSyncedTime
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                              }`}
                              title={`Jump video to [${tsMatch.label}]`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>[{tsMatch.label}]</span>
                            </button>
                          )}
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400">
                            {termItem.tag || termItem.category}
                          </span>
                        </div>

                        <p className={`text-sm leading-relaxed ${themeConfig.textPrimary}`}>
                          {termItem.definition}
                        </p>

                        {termItem.whyItMatters && (
                          <p className={`text-xs leading-relaxed ${themeConfig.textSecondary}`}>
                            <span className="font-semibold text-emerald-400">Why it matters: </span>
                            {termItem.whyItMatters}
                          </p>
                        )}

                        {termItem.realWorldExample && (
                          <p className={`text-xs leading-relaxed ${themeConfig.textSecondary}`}>
                            <span className="font-semibold text-amber-400">Real-world example: </span>
                            {termItem.realWorldExample}
                          </p>
                        )}

                        {termItem.contextInVideo && (
                          <p className={`text-xs italic ${themeConfig.textMuted}`}>
                            In video: &ldquo;{termItem.contextInVideo}&rdquo;
                          </p>
                        )}

                        {/* Multi-Source Knowledge Links */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                          <span className={`${themeConfig.textMuted} text-[10px] font-semibold uppercase tracking-wider`}>
                            Knowledge Sources:
                          </span>
                          {sources.map((src) => (
                            <a
                              key={src.label}
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} text-[10px]`}
                            >
                              <span>{src.label}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            handleListen(
                              `term-${idx}`,
                              `${termItem.term}. ${termItem.fullForm || ''}. ${termItem.definition}. ${termItem.whyItMatters || ''}`
                            )
                          }
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            isSpeaking
                              ? 'text-amber-400 bg-amber-500/10'
                              : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15`
                          }`}
                          title="Listen"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => performDictionaryLookup(termItem.fullForm || termItem.term, true)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 cursor-pointer transition-colors whitespace-nowrap font-medium"
                          title="Look up across 12 encyclopedic, dictionary & academic sources"
                        >
                          <Globe className="w-2.5 h-2.5" />
                          <span>12-Source Lookup</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onExploreTerm(termItem.fullForm || termItem.term)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <span>Research</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAppendSingleTerm(termItem)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 cursor-pointer transition-colors whitespace-nowrap`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>+ Summary</span>
                        </button>

                        {onSaveToList && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveToList({
                                itemType: 'note',
                                title: `${termItem.term}${termItem.fullForm ? ` (${termItem.fullForm})` : ''}`,
                                subtitle: `Key Term from "${videoTitle}"`,
                                content: `${termItem.definition}${termItem.whyItMatters ? `\n\n**Why it matters:** ${termItem.whyItMatters}` : ''}`,
                                notes: termItem.contextInVideo ? `In video: "${termItem.contextInVideo}"` : '',
                              })
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 cursor-pointer transition-colors whitespace-nowrap`}
                          >
                            <Bookmark className="w-2.5 h-2.5 text-indigo-400" />
                            <span>Save</span>
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
                No local matches for &ldquo;{searchTerm}&rdquo;
              </h4>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => performDictionaryLookup(searchTerm.trim(), true)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Look Up &ldquo;{searchTerm.trim()}&rdquo; Across 12 Knowledge Sources →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-500/20 text-xs font-semibold cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
