import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  Download,
  Play,
  Pause,
  RefreshCw,
  Clock,
  ChevronDown,
  ArrowRightCircle,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  Globe,
  ExternalLink,
  Volume2,
  Type,
  BookOpen,
  X,
  SlidersHorizontal,
  ArrowDownCircle,
  Plus,
  Search,
  Sparkles,
  Link2,
  FolderOpen,
  Cpu,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { speechService, SpeechItem, tokenizeSpeechWords } from '../services/speechService';
import {
  SummaryResult,
  SummaryType,
  ThemeId,
  TypographyConfig,
  VideoMetadata,
  TranscriptSegment,
  ExactVideoResource,
  OpenRouterModel,
} from '../types';
import { SUMMARY_PRESETS, APP_THEMES, OPENROUTER_MODELS } from '../constants';
import { getTypographyStyles, getContentWidthClass } from './TypographySettingsModal';
import { SmartImage } from './SmartImage';
import { isSafeHttpUrl } from '../utils/subtitleParser';
import { extractExactVideoResources } from '../services/exactResourceExtractor';
import { createCustomExactResource, loadLocalCustomResources } from '../services/listsService';

interface SummaryViewerProps {
  summary: SummaryResult | null;
  isLoading: boolean;
  isContinuing?: boolean;
  onRegenerate: (
    type: SummaryType,
    overrideProvider?: 'openrouter' | 'gemini',
    overrideModelId?: string,
    overrideKey?: string
  ) => void;
  onContinueSummary?: () => void;
  onSeekToTimestamp: (seconds: number) => void;
  transcriptText?: string;
  videoTitle?: string;
  videoMetadata?: VideoMetadata | null;
  transcriptSegments?: TranscriptSegment[];
  customResources?: ExactVideoResource[];
  onRefreshCustomResources?: (resources: ExactVideoResource[]) => void;
  onAppendCustomMarkdown?: (snippet: string, noticeLabel?: string) => void;
  provider?: 'openrouter' | 'gemini';
  onSelectProvider?: (provider: 'openrouter' | 'gemini') => void;
  openRouterKey?: string;
  onSaveOpenRouterKey?: (key: string) => void;
  selectedModel?: OpenRouterModel;
  selectedModelId?: string;
  onSelectModel?: (model: OpenRouterModel) => void;
  onOpenSettings?: () => void;
  currentTheme?: ThemeId;
  onOpenVoiceSettings?: () => void;
  onOpenResearch?: () => void;
  onOpenTypography?: () => void;
  onOpenKnowledge?: () => void;
  onSaveToList?: () => void;
  onSaveItemToList?: (item: {
    itemType: 'video' | 'summary' | 'book' | 'article' | 'note';
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }) => void;
  onOpenLists?: () => void;
  onOpenTechWords?: () => void;
  typography?: TypographyConfig;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isOptionsOpen?: boolean;
  onToggleOptions?: () => void;
  activeTimestamp?: number | null;
  onSyncTimestamp?: (seconds: number) => void;
}

// Helper to strip any emojis or pictographs from text and ensure all [MM:SS] timestamps are bolded so they render as interactive seek buttons
function stripEmojis(text: string): string {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/#[ \t]+/g, (m) => m)
    .replace(/(?<!\*)\[(\d{1,2}:\d{2}(?::\d{2})?)\](?!\*|\()/g, '**[$1]**');
}

interface GranularMarkdownBlock {
  raw: string;
  cleanText: string;
  speechIdx: number;
  blockType: 'h1' | 'h2' | 'h3' | 'ul-li' | 'ol-li' | 'blockquote' | 'img' | 'hr' | 'p';
  listNumber?: string;
  timestampBadge?: string;
}

function cleanLineForSpeech(line: string): { cleanText: string; timestampBadge?: string } {
  let timestampBadge: string | undefined;
  const tsMatch = line.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
  if (tsMatch) {
    timestampBadge = tsMatch[0];
  }

  const cleanText = line
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\*\*?\[\d{1,2}:\d{2}(?::\d{2})?\]\*\*?/g, '')
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanText, timestampBadge };
}

function parseGranularMarkdown(markdown: string): {
  blocks: GranularMarkdownBlock[];
  speechItems: SpeechItem[];
} {
  const lines = markdown.split('\n');
  const blocks: GranularMarkdownBlock[] = [];
  const speechItems: SpeechItem[] = [];

  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const raw = paragraphBuffer.join('\n').trim();
    paragraphBuffer = [];
    if (!raw) return;

    const { cleanText, timestampBadge } = cleanLineForSpeech(raw);
    if (cleanText.length > 0) {
      const sIdx = speechItems.length;
      speechItems.push({
        id: sIdx,
        text: cleanText,
        label: cleanText.slice(0, 42),
      });
      blocks.push({
        raw,
        cleanText,
        speechIdx: sIdx,
        blockType: 'p',
        timestampBadge,
      });
    } else {
      blocks.push({ raw, cleanText: '', speechIdx: -1, blockType: 'p' });
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ raw: trimmed, cleanText: '', speechIdx: -1, blockType: 'hr' });
      continue;
    }

    // Standalone image line
    if (/^!\[[^\]]*\]\([^\)]+\)$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ raw: trimmed, cleanText: '', speechIdx: -1, blockType: 'img' });
      continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      flushParagraph();
      const level = hMatch[1].length;
      const { cleanText, timestampBadge } = cleanLineForSpeech(trimmed);
      const sIdx = cleanText ? speechItems.length : -1;
      if (cleanText) {
        speechItems.push({
          id: sIdx,
          text: cleanText,
          label: cleanText.slice(0, 42),
        });
      }
      blocks.push({
        raw: trimmed,
        cleanText,
        speechIdx: sIdx,
        blockType: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3',
        timestampBadge,
      });
      continue;
    }

    // Unordered list item
    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      const { cleanText, timestampBadge } = cleanLineForSpeech(trimmed);
      const sIdx = cleanText ? speechItems.length : -1;
      if (cleanText) {
        speechItems.push({
          id: sIdx,
          text: cleanText,
          label: cleanText.slice(0, 42),
        });
      }
      blocks.push({
        raw: trimmed,
        cleanText,
        speechIdx: sIdx,
        blockType: 'ul-li',
        timestampBadge,
      });
      continue;
    }

    // Ordered list item
    const olMatch = trimmed.match(/^(\d+\.)\s+/);
    if (olMatch) {
      flushParagraph();
      const { cleanText, timestampBadge } = cleanLineForSpeech(trimmed);
      const sIdx = cleanText ? speechItems.length : -1;
      if (cleanText) {
        speechItems.push({
          id: sIdx,
          text: cleanText,
          label: cleanText.slice(0, 42),
        });
      }
      blocks.push({
        raw: trimmed,
        cleanText,
        speechIdx: sIdx,
        blockType: 'ol-li',
        listNumber: olMatch[1],
        timestampBadge,
      });
      continue;
    }

    // Blockquote
    if (/^>\s*/.test(trimmed)) {
      flushParagraph();
      const { cleanText, timestampBadge } = cleanLineForSpeech(trimmed);
      const sIdx = cleanText ? speechItems.length : -1;
      if (cleanText) {
        speechItems.push({
          id: sIdx,
          text: cleanText,
          label: cleanText.slice(0, 42),
        });
      }
      blocks.push({
        raw: trimmed,
        cleanText,
        speechIdx: sIdx,
        blockType: 'blockquote',
        timestampBadge,
      });
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  return { blocks, speechItems };
}

export const SummaryViewer: React.FC<SummaryViewerProps> = ({
  summary,
  isLoading,
  isContinuing = false,
  onRegenerate,
  onContinueSummary,
  onSeekToTimestamp,
  transcriptText = '',
  videoTitle = '',
  videoMetadata = null,
  transcriptSegments = [],
  customResources: externalCustomResources,
  onRefreshCustomResources,
  onAppendCustomMarkdown,
  provider = 'gemini',
  onSelectProvider,
  openRouterKey = '',
  onSaveOpenRouterKey,
  selectedModel,
  selectedModelId = 'meta-llama/llama-3.3-70b-instruct:free',
  onSelectModel,
  onOpenSettings,
  currentTheme = 'sepia',
  onOpenVoiceSettings,
  onOpenResearch,
  onOpenTypography,
  onOpenKnowledge,
  onSaveToList,
  onSaveItemToList,
  onOpenLists,
  onOpenTechWords,
  typography,
  isFullscreen = false,
  onToggleFullscreen,
  isOptionsOpen = true,
  onToggleOptions,
  activeTimestamp = null,
  onSyncTimestamp,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(-1);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState<boolean>(speechService.getAutoScroll());
  const [activePreset, setActivePreset] = useState<SummaryType>(summary?.summaryType || 'massive');

  const [isOpenRouterMenuOpen, setIsOpenRouterMenuOpen] = useState(false);
  const [draftKey, setDraftKey] = useState(openRouterKey || '');
  const [showKey, setShowKey] = useState(false);
  const [keySavedBadge, setKeySavedBadge] = useState(false);
  const openRouterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftKey(openRouterKey || '');
  }, [openRouterKey]);

  const activeModelObj = useMemo(() => {
    return (
      selectedModel ||
      OPENROUTER_MODELS.find((m) => m.id === selectedModelId) ||
      OPENROUTER_MODELS[0]
    );
  }, [selectedModel, selectedModelId]);

  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [targetLang, setTargetLang] = useState<string>('en');
  const [translatedMarkdown, setTranslatedMarkdown] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [summarySearch, setSummarySearch] = useState<string>('');

  // Exact Video Resources & Custom Resources state synced with Firebase
  const [localCustomResources, setLocalCustomResources] = useState<ExactVideoResource[]>(() =>
    loadLocalCustomResources()
  );
  const customResources = externalCustomResources ?? localCustomResources;
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [newResTitle, setNewResTitle] = useState('');
  const [newResUrl, setNewResUrl] = useState('');
  const [newResType, setNewResType] = useState<ExactVideoResource['type']>('Book / Publication');
  const [newResDesc, setNewResDesc] = useState('');
  const [appendedResIds, setAppendedResIds] = useState<Set<string>>(new Set());
  const [savedArtifactResIds, setSavedArtifactResIds] = useState<Set<string>>(new Set());

  const exactResources = useMemo(() => {
    const extracted = extractExactVideoResources(
      videoMetadata,
      transcriptSegments,
      summary?.markdown || transcriptText
    );
    return [...customResources, ...extracted];
  }, [videoMetadata, transcriptSegments, summary?.markdown, transcriptText, customResources]);

  const handleAddCustomResourceInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newResTitle.trim();
    if (!cleanTitle) return;
    const rawUrl = newResUrl.trim();
    const finalUrl = rawUrl
      ? /^https?:\/\//i.test(rawUrl)
        ? rawUrl
        : `https://${rawUrl}`
      : `https://scholar.google.com/scholar?q=${encodeURIComponent(cleanTitle)}`;

    const description =
      newResDesc.trim() || `User-added exact resource for "${videoTitle || 'this video'}".`;

    const created = await createCustomExactResource({
      videoId: videoMetadata?.videoId || '',
      title: cleanTitle,
      type: newResType,
      description,
      primaryUrl: finalUrl,
    });

    const next = [created, ...customResources.filter((r) => r.id !== created.id)];
    setLocalCustomResources(next);
    onRefreshCustomResources?.(next);

    if (onAppendCustomMarkdown) {
      const md = `\n\n### [${created.title}](${created.primaryUrl}) — *${created.type}*\n${created.description}\n`;
      onAppendCustomMarkdown(md, `Saved "${created.title}" to Firebase & Summary`);
      setAppendedResIds((prev) => new Set(prev).add(created.id));
    }

    setNewResTitle('');
    setNewResUrl('');
    setNewResDesc('');
    setIsAddResourceOpen(false);
  };

  // Deep Dive Expansion state
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandTopic, setExpandTopic] = useState('');
  const [expansionResults, setExpansionResults] = useState<Array<{ topic: string; content: string }>>([]);
  const [isExpandModalOpen, setIsExpandModalOpen] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  const actionsRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const lastWordTopRef = useRef<number>(0);
  const translateAbortRef = useRef<AbortController | null>(null);

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.sepia;

  useEffect(() => {
    if (summary?.summaryType) {
      setActivePreset(summary.summaryType);
    }
  }, [summary?.summaryType]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setIsActionsOpen(false);
      }
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) {
        setIsStyleOpen(false);
      }
      if (openRouterRef.current && !openRouterRef.current.contains(e.target as Node)) {
        setIsOpenRouterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Subscribe to speech service state, item start, word boundaries, and auto-scroll
  useEffect(() => {
    const unsubState = speechService.subscribeStateChange((playing, paused, curIdx) => {
      setIsSpeaking(playing);
      setIsPaused(paused);
      setSpeakingIndex(curIdx);
      if (!playing) {
        setActiveWordIndex(-1);
      }
    });

    const unsubStart = speechService.subscribeItemStart((idx) => {
      setSpeakingIndex(idx);
      setActiveWordIndex(0);
      if (speechService.getAutoScroll()) {
        const el = blockRefs.current[idx];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    const unsubWord = speechService.subscribeWordBoundary((progress) => {
      setSpeakingIndex(progress.itemIndex);
      setActiveWordIndex(progress.wordIndex);
      if (speechService.getAutoScroll()) {
        requestAnimationFrame(() => {
          const wordEl = activeWordRef.current;
          if (wordEl) {
            const rect = wordEl.getBoundingClientRect();
            const vh = window.innerHeight;
            const outOfCenterBand = rect.top < vh * 0.18 || rect.bottom > vh * 0.78;
            if (outOfCenterBand && Math.abs(rect.top - lastWordTopRef.current) > 24) {
              lastWordTopRef.current = rect.top;
              wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        });
      }
    });

    const unsubScroll = speechService.subscribeAutoScroll((enabled) => {
      setAutoScroll(enabled);
    });

    return () => {
      unsubState();
      unsubStart();
      unsubWord();
      unsubScroll();
    };
  }, []);

  useEffect(() => {
    if (translateAbortRef.current) {
      translateAbortRef.current.abort();
      translateAbortRef.current = null;
    }
    setIsTranslating(false);
    setTargetLang('en');
    setTranslatedMarkdown(null);
  }, [summary?.markdown]);

  const handleSelectLanguage = async (langCode: string) => {
    if (translateAbortRef.current) {
      translateAbortRef.current.abort();
      translateAbortRef.current = null;
    }
    setTargetLang(langCode);
    if (langCode === 'en' || !summary?.markdown) {
      setIsTranslating(false);
      setTranslatedMarkdown(null);
      return;
    }
    const controller = new AbortController();
    translateAbortRef.current = controller;
    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: stripEmojis(summary.markdown),
          targetLang: langCode,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!controller.signal.aborted && res.ok && data.translatedText) {
        setTranslatedMarkdown(data.translatedText);
      }
    } catch {
      // ignore translation error or abort
    } finally {
      if (translateAbortRef.current === controller) {
        setIsTranslating(false);
      }
    }
  };

  const formalMarkdown = useMemo(() => {
    if (translatedMarkdown && targetLang !== 'en') {
      return stripEmojis(translatedMarkdown);
    }
    if (!summary?.markdown) return '';
    return stripEmojis(summary.markdown);
  }, [summary?.markdown, translatedMarkdown, targetLang]);

  const { parsedBlocks, summarySpeechItems } = useMemo(() => {
    if (!formalMarkdown) {
      return { parsedBlocks: [] as GranularMarkdownBlock[], summarySpeechItems: [] as SpeechItem[] };
    }
    const { blocks, speechItems } = parseGranularMarkdown(formalMarkdown);
    return { parsedBlocks: blocks, summarySpeechItems: speechItems };
  }, [formalMarkdown]);

  const handleToggleAudio = () => {
    if (isSpeaking && !isPaused) {
      speechService.pause();
      return;
    }
    if (isSpeaking && isPaused) {
      speechService.resume();
      return;
    }
    speechService.playItems(summarySpeechItems, speakingIndex >= 0 ? speakingIndex : 0);
  };

  const handlePlayFromBlock = (speechIdx: number) => {
    if (speechIdx < 0) return;
    speechService.playItems(summarySpeechItems, speechIdx);
  };

  const handleCopy = async () => {
    if (!formalMarkdown) return;
    try {
      await navigator.clipboard.writeText(formalMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    if (!formalMarkdown) return;
    const blob = new Blob([formalMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(videoTitle || 'summary').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseTimestampToSeconds = (ts: string): number => {
    const clean = ts.replace(/[\[\]]/g, '');
    const parts = clean.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  const handleDeepDive = async (topicToExpand: string) => {
    if (!topicToExpand.trim()) return;
    setIsExpanding(true);
    setExpandError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (openRouterKey?.trim()) {
        headers['X-OpenRouter-Key'] = openRouterKey.trim();
      }
      const res = await fetch('/api/deep-dive', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: topicToExpand,
          transcript: transcriptText,
          title: videoTitle,
          videoId: videoMetadata?.videoId,
          segments: transcriptSegments,
          provider,
          model: selectedModelId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to expand section.');

      setExpansionResults((prev) => [
        ...prev,
        { topic: topicToExpand, content: stripEmojis(data.expansion || '') },
      ]);
      setExpandTopic('');
      setIsExpandModalOpen(false);
    } catch {
      const keywords = topicToExpand
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);

      if (transcriptSegments.length > 0) {
        const matchingSegs = transcriptSegments.filter((seg) => {
          const lower = seg.text.toLowerCase();
          return lower.includes(topicToExpand.toLowerCase()) || keywords.some((k) => lower.includes(k));
        });
        const chosenSegs = (matchingSegs.length > 0 ? matchingSegs : transcriptSegments).slice(0, 6);
        const fallbackContent = `### Closer Look: ${topicToExpand}\n\n${chosenSegs
          .map((seg) => (seg.formattedTime ? `- **[${seg.formattedTime}]** ${seg.text}` : `- ${seg.text}`))
          .join('\n\n')}`;
        setExpansionResults((prev) => [
          ...prev,
          { topic: topicToExpand, content: fallbackContent },
        ]);
      } else {
        const sentences = (transcriptText || '')
          .replace(/\s+/g, ' ')
          .split(/(?<=[.!?])\s+/)
          .filter((s) => s.length > 20)
          .slice(0, 6);
        const fallbackContent = `### Closer Look: ${topicToExpand}\n\n${sentences
          .map((s) => `- ${s}`)
          .join('\n\n')}`;
        setExpansionResults((prev) => [
          ...prev,
          { topic: topicToExpand, content: fallbackContent },
        ]);
      }
      setExpandTopic('');
      setIsExpandModalOpen(false);
    } finally {
      setIsExpanding(false);
    }
  };

  const currentPresetObj = SUMMARY_PRESETS.find((p) => p.id === activePreset) || SUMMARY_PRESETS[0];

  const markdownComponents = useMemo(
    () => ({
      strong: ({ children, ...props }: any) => {
        const text = Array.isArray(children)
          ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
          : String(children || '');
        const timestampMatch = text.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
        if (timestampMatch) {
          const seconds = parseTimestampToSeconds(timestampMatch[0]);
          const isSyncedTime = activeTimestamp !== null && Math.abs(activeTimestamp - seconds) < 8;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSeekToTimestamp(seconds);
              }}
              className={`inline-flex items-center gap-1 font-mono text-xs font-semibold cursor-pointer mr-1.5 align-baseline tabular-nums transition-colors ${
                isSyncedTime
                  ? 'bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow-sm'
                  : 'text-indigo-400 hover:underline'
              }`}
              title={`Jump video to ${timestampMatch[1]}`}
            >
              <Clock className="w-3 h-3 opacity-75" />
              <span>{text}</span>
            </button>
          );
        }
        return (
          <strong className="font-semibold" {...props}>
            {children}
          </strong>
        );
      },
      h1: ({ children, ...props }: any) => (
        <h1 className="text-2xl sm:text-3xl font-bold mt-6 mb-3" {...props}>
          {children}
        </h1>
      ),
      h2: ({ children, ...props }: any) => (
        <h2
          className={`text-xl sm:text-2xl font-bold mt-8 mb-3 pb-2 border-b ${themeConfig.borderLight}`}
          {...props}
        >
          {children}
        </h2>
      ),
      h3: ({ children, ...props }: any) => (
        <h3 className="text-base sm:text-lg font-semibold mt-6 mb-2 text-indigo-400" {...props}>
          {children}
        </h3>
      ),
      p: ({ children, ...props }: any) => (
        <p className="mb-3 leading-relaxed opacity-95" {...props}>
          {children}
        </p>
      ),
      ul: ({ children, ...props }: any) => (
        <ul className="list-disc pl-6 mb-2 space-y-1.5 opacity-95" {...props}>
          {children}
        </ul>
      ),
      ol: ({ children, ...props }: any) => (
        <ol className="list-decimal pl-6 mb-2 space-y-1.5 opacity-95" {...props}>
          {children}
        </ol>
      ),
      blockquote: ({ children, ...props }: any) => (
        <blockquote
          className="border-l-2 border-indigo-500/60 pl-5 py-1 my-3 italic opacity-90"
          {...props}
        >
          {children}
        </blockquote>
      ),
      img: ({ src, alt }: any) => {
        if (!isSafeHttpUrl(src)) return null;
        return (
          <span className="my-6 block text-center">
            <SmartImage
              src={src}
              alt={alt || 'Figure'}
              variant="figure"
              className="rounded-lg max-h-[520px] w-auto max-w-full object-contain mx-auto"
            />
            {alt && (
              <span className="text-xs text-slate-400 mt-2 italic text-center block">
                {alt}
              </span>
            )}
          </span>
        );
      },
      a: ({ children, href, ...props }: any) => {
        const safeHref = isSafeHttpUrl(href) ? href : undefined;
        if (!safeHref) {
          return <span className="underline opacity-80">{children}</span>;
        }
        return (
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline font-medium inline-flex items-center gap-1"
            {...props}
          >
            <span>{children}</span>
            <ExternalLink className="w-3 h-3 opacity-60 inline shrink-0" />
          </a>
        );
      },
    }),
    [themeConfig.borderLight, onSeekToTimestamp, activeTimestamp]
  );

  // Sync activeTimestamp when audio narration steps into a summary block with a timestamp badge
  useEffect(() => {
    if ((isSpeaking || isPaused) && speakingIndex >= 0 && onSyncTimestamp) {
      const matchingBlock = parsedBlocks.find((b) => b.speechIdx === speakingIndex);
      if (matchingBlock?.timestampBadge) {
        onSyncTimestamp(parseTimestampToSeconds(matchingBlock.timestampBadge));
      }
    }
  }, [speakingIndex, isSpeaking, isPaused, parsedBlocks, onSyncTimestamp]);

  /**
   * Renders the active block's words directly inline inside its semantic element (h1, h2, h3, li, blockquote, p)
   * so the exact spoken word lights up in-place with zero duplicate text boxes.
   */
  const renderActiveSynchronizedBlock = (block: GranularMarkdownBlock) => {
    const words = tokenizeSpeechWords(block.cleanText);
    const tsBadge = block.timestampBadge ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSeekToTimestamp(parseTimestampToSeconds(block.timestampBadge!));
        }}
        className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-indigo-400 hover:underline cursor-pointer mr-2 align-baseline tabular-nums"
      >
        <Clock className="w-3 h-3 opacity-60" />
        <span>{block.timestampBadge}</span>
      </button>
    ) : null;

    const wordSpans = words.map((word, wIdx) => {
      const isCurrentWord = wIdx === activeWordIndex;
      const isPastWord = wIdx < activeWordIndex;
      return (
        <React.Fragment key={wIdx}>
          <span
            ref={isCurrentWord ? activeWordRef : undefined}
            className={`inline-block rounded ${
              isCurrentWord
                ? 'bg-indigo-500 text-white font-semibold px-1.5 py-0.5 shadow-sm'
                : isPastWord
                ? `${themeConfig.textPrimary}`
                : `${themeConfig.textSecondary} opacity-85`
            }`}
          >
            {word}
          </span>{' '}
        </React.Fragment>
      );
    });

    if (block.blockType === 'h1') {
      return (
        <h1 className="text-2xl sm:text-3xl font-bold mt-6 mb-3">
          {tsBadge}
          {wordSpans}
        </h1>
      );
    }
    if (block.blockType === 'h2') {
      return (
        <h2 className={`text-xl sm:text-2xl font-bold mt-8 mb-3 pb-2 border-b ${themeConfig.borderLight}`}>
          {tsBadge}
          {wordSpans}
        </h2>
      );
    }
    if (block.blockType === 'h3') {
      return (
        <h3 className="text-base sm:text-lg font-semibold mt-6 mb-2 text-indigo-400">
          {tsBadge}
          {wordSpans}
        </h3>
      );
    }
    if (block.blockType === 'ul-li') {
      return (
        <ul className="list-disc pl-6 mb-2">
          <li className="leading-relaxed">
            {tsBadge}
            {wordSpans}
          </li>
        </ul>
      );
    }
    if (block.blockType === 'ol-li') {
      return (
        <div className="flex items-baseline gap-2 pl-2 mb-2 leading-relaxed">
          <span className="font-semibold text-indigo-400 shrink-0">{block.listNumber || '1.'}</span>
          <div>
            {tsBadge}
            {wordSpans}
          </div>
        </div>
      );
    }
    if (block.blockType === 'blockquote') {
      return (
        <blockquote className="border-l-2 border-indigo-500 pl-5 py-1 my-3 italic">
          {tsBadge}
          {wordSpans}
        </blockquote>
      );
    }
    return (
      <p className="mb-3 leading-relaxed">
        {tsBadge}
        {wordSpans}
      </p>
    );
  };

  if (isLoading) {
    return (
      <div className="py-28 flex flex-col items-center justify-center text-center space-y-3">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-500 opacity-80" />
        <p className={`text-sm font-medium ${themeConfig.textPrimary}`}>
          Writing your video summary...
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="py-28 flex flex-col items-center justify-center text-center space-y-2">
        <p className={`text-sm font-medium ${themeConfig.textPrimary}`}>No video selected yet</p>
        <p className={`text-xs ${themeConfig.textMuted}`}>
          Paste a YouTube link or search for a video in the left sidebar to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      {/* Ultra-Compact Single-Line Options Strip */}
      {isOptionsOpen ? (
        <div className={`flex items-center justify-between gap-2 pb-1.5 border-b ${themeConfig.borderLight} flex-wrap text-[11px]`}>
          {/* Left: Document Title + Compact Word Count */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className={`text-sm sm:text-base font-bold tracking-tight truncate ${themeConfig.textPrimary}`}>
              {videoTitle || 'Video Summary'}
            </h1>
            {videoMetadata?.sourceKind === 'saved_summary_only' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0" title="This summary was loaded from saved artifacts without an active video transcript connection">
                Archived Summary Only
              </span>
            )}
            <span className={`hidden xl:inline text-[10px] ${themeConfig.textMuted} tabular-nums shrink-0`}>
              ({formalMarkdown.split(/\s+/).filter(Boolean).length.toLocaleString()}w · ~{Math.max(1, Math.round((formalMarkdown.split(/\s+/).length || 200) / 220))}m)
            </span>
          </div>

          {/* Right: Ultra-compact single-row controls */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Compact Section Jump Dropdown */}
            {parsedBlocks.some((b) => b.blockType === 'h2') && (
              <select
                defaultValue=""
                onChange={(e) => {
                  const idx = e.target.value;
                  if (idx !== '') {
                    const el = document.getElementById(`summary-block-${idx}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className={`px-1.5 py-0.5 rounded bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} cursor-pointer focus:outline-none max-w-[145px] truncate`}
                title="Jump directly to any section"
              >
                <option value="" className="bg-slate-900 text-white">Jump to section...</option>
                {parsedBlocks
                  .map((b, idx) => ({ b, idx }))
                  .filter(({ b }) => b.blockType === 'h2')
                  .map(({ b, idx }) => (
                    <option key={idx} value={String(idx)} className="bg-slate-900 text-white">
                      {b.cleanText}
                    </option>
                  ))}
              </select>
            )}

            {/* Compact Find Input */}
            <div className="relative">
              <Search className="w-2.5 h-2.5 absolute left-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
              <input
                type="text"
                value={summarySearch}
                onChange={(e) => setSummarySearch(e.target.value)}
                placeholder="Find..."
                className={`pl-5 pr-4 py-0.5 rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none w-24 sm:w-28`}
              />
              {summarySearch && (
                <button
                  type="button"
                  onClick={() => setSummarySearch('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {onContinueSummary && (
              <button
                onClick={onContinueSummary}
                disabled={isContinuing}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  summary.isTruncated
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                }`}
                title="Write more details"
              >
                <ArrowRightCircle className="w-3 h-3" />
                <span>{isContinuing ? 'Writing...' : 'More'}</span>
              </button>
            )}

            <button
              onClick={handleToggleAudio}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isSpeaking
                  ? 'bg-indigo-600 text-white font-semibold'
                  : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
              }`}
              title={isSpeaking && !isPaused ? 'Pause Audio' : 'Read Aloud'}
            >
              {isSpeaking && !isPaused ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isSpeaking && !isPaused ? 'Pause' : 'Listen'}</span>
            </button>

            <button
              type="button"
              onClick={() => speechService.setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer whitespace-nowrap ${
                autoScroll
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
              }`}
              title="Toggle Auto-Scroll while listening"
            >
              <ArrowDownCircle className="w-3 h-3" />
              <span className="hidden sm:inline">{autoScroll ? 'Scroll: On' : 'Scroll: Off'}</span>
            </button>

            {onOpenVoiceSettings && (
              <button
                type="button"
                onClick={onOpenVoiceSettings}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer whitespace-nowrap`}
                title="Voice & Speed"
              >
                <Volume2 className="w-3 h-3 opacity-75" />
                <span className="hidden md:inline">Voice</span>
              </button>
            )}

            {/* Live Neural Translation Selector */}
            <select
              value={targetLang}
              onChange={(e) => handleSelectLanguage(e.target.value)}
              disabled={isTranslating}
              className={`px-1.5 py-0.5 rounded bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} cursor-pointer focus:outline-none`}
              title="Translate Summary"
            >
              <option value="en" className="bg-slate-900 text-white">
                {isTranslating ? '...' : 'EN'}
              </option>
              <option value="es" className="bg-slate-900 text-white">ES</option>
              <option value="fr" className="bg-slate-900 text-white">FR</option>
              <option value="de" className="bg-slate-900 text-white">DE</option>
              <option value="hi" className="bg-slate-900 text-white">HI</option>
              <option value="ja" className="bg-slate-900 text-white">JA</option>
              <option value="ko" className="bg-slate-900 text-white">KO</option>
              <option value="zh-CN" className="bg-slate-900 text-white">ZH</option>
              <option value="ar" className="bg-slate-900 text-white">AR</option>
              <option value="pt" className="bg-slate-900 text-white">PT</option>
              <option value="it" className="bg-slate-900 text-white">IT</option>
              <option value="ru" className="bg-slate-900 text-white">RU</option>
              <option value="tr" className="bg-slate-900 text-white">TR</option>
              <option value="nl" className="bg-slate-900 text-white">NL</option>
            </select>

            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer whitespace-nowrap`}
              title="Copy Markdown"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {onSaveToList && (
              <button
                type="button"
                onClick={onSaveToList}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer whitespace-nowrap`}
                title="Save this video & summary to your Artifacts Folder"
              >
                <Plus className="w-3 h-3 opacity-75" />
                <span>+ Save to Artifacts</span>
              </button>
            )}

            {onOpenLists && (
              <button
                type="button"
                onClick={onOpenLists}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer whitespace-nowrap"
                title="Open your Artifacts Folder (Saved Sources, Summaries, Books & Notes)"
              >
                <FolderOpen className="w-3 h-3" />
                <span>Artifacts Folder</span>
              </button>
            )}

            {onOpenTechWords && (
              <button
                type="button"
                onClick={onOpenTechWords}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors cursor-pointer whitespace-nowrap"
                title="Open Tech, AI & CSE Words Searcher + Google & Open Multi-Dictionary"
              >
                <Cpu className="w-3 h-3" />
                <span>Tech, AI &amp; CSE Words</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('summary-exact-resources-section');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else if (onOpenResearch) {
                  onOpenResearch();
                }
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer whitespace-nowrap"
              title="Jump to Exact Video Resources, Books, Papers & Direct Sources"
            >
              <Sparkles className="w-3 h-3" />
              <span>Exact Resources ({exactResources.length})</span>
            </button>

            {onOpenResearch && (
              <button
                type="button"
                onClick={onOpenResearch}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors cursor-pointer whitespace-nowrap"
                title="Explore 55+ live research sources, academic papers, books, GitHub repos, and figures"
              >
                <Globe className="w-3 h-3" />
                <span>55+ Sources</span>
              </button>
            )}

            {onOpenTypography && (
              <button
                type="button"
                onClick={onOpenTypography}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer whitespace-nowrap`}
                title="Font & Text Size"
              >
                <Type className="w-3 h-3 opacity-75" />
                <span className="hidden md:inline">Font</span>
              </button>
            )}

            {/* Style Selector Dropdown */}
            <div className="relative" ref={styleRef}>
              <button
                type="button"
                onClick={() => setIsStyleOpen(!isStyleOpen)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer whitespace-nowrap`}
                title="Change Summary Style"
              >
                <span>{currentPresetObj.shortLabel}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>

              {isStyleOpen && (
                <div
                  className={`absolute right-0 mt-1 w-52 rounded-lg ${themeConfig.cardBg} shadow-xl p-1 z-50 space-y-0.5`}
                >
                  {SUMMARY_PRESETS.map((p) => {
                    const isSelected = p.id === activePreset;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActivePreset(p.id);
                          onRegenerate(p.id);
                          setIsStyleOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer text-left ${
                          isSelected
                            ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                            : `${themeConfig.textSecondary} hover:bg-slate-500/10`
                        }`}
                      >
                        <span>{p.shortLabel}</span>
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* OpenRouter AI Model & Key Summary Option Dropdown */}
            <div className="relative" ref={openRouterRef}>
              <button
                type="button"
                onClick={() => setIsOpenRouterMenuOpen(!isOpenRouterMenuOpen)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer whitespace-nowrap border ${
                  provider === 'openrouter'
                    ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30'
                    : `${themeConfig.textSecondary} border-transparent hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                }`}
                title="Summary Model: OpenRouter Free Models & Key Configuration"
              >
                <KeyRound className="w-3 h-3 text-purple-400" />
                <span className="font-semibold truncate max-w-[130px] sm:max-w-[180px]">
                  {provider === 'openrouter'
                    ? `OpenRouter: ${activeModelObj.name.replace(/ \(Free\)/i, '')}`
                    : 'AI: Gemini'}
                </span>
                {provider === 'openrouter' && (
                  <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Free
                  </span>
                )}
                {openRouterKey && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Key Active" />
                )}
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>

              {isOpenRouterMenuOpen && (
                <div
                  className={`absolute right-0 mt-1 w-80 sm:w-96 rounded-xl ${themeConfig.cardBg} border ${themeConfig.border} shadow-2xl p-3 z-50 space-y-3 max-h-[82vh] overflow-y-auto`}
                >
                  {/* Top Bar: Engine Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                        Summary AI Engine
                      </span>
                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpenRouterMenuOpen(false);
                            onOpenSettings();
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Advanced Settings
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProvider?.('gemini');
                        }}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          provider === 'gemini'
                            ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold border-indigo-500/50 shadow-sm`
                            : `border-slate-700/50 bg-slate-900/40 ${themeConfig.textSecondary} hover:border-slate-600`
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">Gemini (Built-in)</span>
                          {provider === 'gemini' && <Check className="w-3 h-3" />}
                        </div>
                        <p className={`text-[10px] mt-0.5 line-clamp-1 ${themeConfig.textMuted}`}>
                          Zero setup server fallback
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectProvider?.('openrouter');
                        }}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          provider === 'openrouter'
                            ? 'bg-purple-600/20 text-purple-200 font-semibold border-purple-500/60 shadow-sm'
                            : `border-slate-700/50 bg-slate-900/40 ${themeConfig.textSecondary} hover:border-slate-600`
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">OpenRouter</span>
                          {provider === 'openrouter' && <Check className="w-3 h-3 text-purple-400" />}
                        </div>
                        <p className={`text-[10px] mt-0.5 line-clamp-1 ${themeConfig.textMuted}`}>
                          Free Llama, DeepSeek &amp; Qwen
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* OpenRouter API Key Input */}
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-700/40 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="font-semibold flex items-center gap-1.5 text-slate-200">
                        <KeyRound className="w-3 h-3 text-purple-400" />
                        <span>OpenRouter API Key</span>
                      </label>
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-purple-400 hover:text-purple-300 underline"
                      >
                        Get Free Key
                      </a>
                    </div>

                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={draftKey}
                          onChange={(e) => setDraftKey(e.target.value)}
                          placeholder="sk-or-v1-... (optional for free models)"
                          className="w-full px-2 py-1 pr-7 text-xs rounded bg-slate-900 border border-slate-700 focus:border-purple-500 text-slate-100 placeholder:text-slate-500 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSaveOpenRouterKey?.(draftKey.trim());
                          if (draftKey.trim()) onSelectProvider?.('openrouter');
                          setKeySavedBadge(true);
                          setTimeout(() => setKeySavedBadge(false), 2000);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition-colors"
                      >
                        {keySavedBadge ? 'Saved!' : 'Save'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Free models run via your key or server default. Stored safely in sessionStorage.
                    </p>
                  </div>

                  {/* OpenRouter Free Tier Models */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                        Select Free Model
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1 rounded">
                        11 Free Tier Models
                      </span>
                    </div>

                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {OPENROUTER_MODELS.filter((m) => m.isFree).map((m) => {
                        const isSelected = activeModelObj.id === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              if (onSelectModel) onSelectModel(m);
                              onSelectProvider?.('openrouter');
                            }}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-purple-500/80 bg-purple-500/15'
                                : 'border-slate-700/40 bg-slate-900/30 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-xs font-semibold text-slate-200 truncate">
                                  {m.name}
                                </span>
                                {m.recommended && (
                                  <span className="text-[9px] px-1 py-0.2 rounded font-medium bg-amber-500/20 text-amber-300">
                                    Top
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-mono text-slate-400">
                                  {(m.contextLength / 1000).toFixed(0)}k
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                              {m.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Instant Action: Regenerate Summary with OpenRouter */}
                  <div className="pt-1 border-t border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => {
                        const keyToUse = draftKey.trim();
                        if (keyToUse !== openRouterKey) {
                          onSaveOpenRouterKey?.(keyToUse);
                        }
                        onSelectProvider?.('openrouter');
                        onRegenerate(activePreset, 'openrouter', activeModelObj.id, keyToUse);
                        setIsOpenRouterMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Summarize with {activeModelObj.name}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* More options (Download, Deep Dive, Lists, Explore) */}
            <div className="relative" ref={actionsRef}>
              <button
                type="button"
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                className={`p-1 rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
                title="More Actions"
              >
                <MoreHorizontal className="w-3.5 h-3.5 opacity-75" />
              </button>

              {isActionsOpen && (
                <div
                  className={`absolute right-0 mt-1 w-52 rounded-lg ${themeConfig.cardBg} shadow-xl p-1 z-50 text-xs space-y-0.5`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleDownload();
                      setIsActionsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded ${themeConfig.textSecondary} hover:bg-slate-500/10 transition-colors cursor-pointer text-left`}
                  >
                    <Download className="w-3.5 h-3.5 opacity-75" />
                    <span>Download Notes (.md)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsOpen(false);
                      setIsExpandModalOpen(true);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded ${themeConfig.textSecondary} hover:bg-slate-500/10 transition-colors cursor-pointer text-left`}
                  >
                    <Maximize2 className="w-3.5 h-3.5 opacity-75" />
                    <span>Explain a Part in More Detail</span>
                  </button>

                  {onOpenLists && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onOpenLists();
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded ${themeConfig.textSecondary} hover:bg-slate-500/10 transition-colors cursor-pointer text-left`}
                    >
                      <BookOpen className="w-3.5 h-3.5 opacity-75" />
                      <span>Open My Saved Lists</span>
                    </button>
                  )}

                  {onOpenResearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onOpenResearch();
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded ${themeConfig.textSecondary} hover:bg-slate-500/10 transition-colors cursor-pointer text-left`}
                    >
                      <Globe className="w-3.5 h-3.5 opacity-75" />
                      <span>Explore Videos &amp; Books</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsOpen(false);
                      onRegenerate(activePreset);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded ${themeConfig.textSecondary} hover:bg-slate-500/10 transition-colors cursor-pointer text-left`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 opacity-75" />
                    <span>Rewrite Summary</span>
                  </button>
                </div>
              )}
            </div>

            {onToggleOptions && (
              <button
                type="button"
                onClick={onToggleOptions}
                className={`p-1 rounded ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
                title="Hide Toolbar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pb-1">
          <h1 className={`text-sm sm:text-base font-bold tracking-tight truncate ${themeConfig.textPrimary}`}>
            {videoTitle || 'Video Summary'}
          </h1>
          {onToggleOptions && (
            <button
              type="button"
              onClick={onToggleOptions}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
              title="Show Toolbar"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Toolbar</span>
            </button>
          )}
        </div>
      )}

      {/* Truncation Inline Notice */}
      {summary.isTruncated && onContinueSummary && (
        <div className={`flex items-center justify-between py-1 border-b ${themeConfig.borderLight} text-[11px] text-amber-400`}>
          <span>Summary paused before the end of the video.</span>
          <button
            onClick={onContinueSummary}
            disabled={isContinuing}
            className="font-semibold underline cursor-pointer hover:text-amber-300"
          >
            {isContinuing ? 'Writing more...' : 'Keep writing →'}
          </button>
        </div>
      )}

      {/* Full-Width Unboxed Markdown Reading Canvas with Direct In-Place Word Highlighting */}
      <div
        style={typography ? getTypographyStyles(typography) : undefined}
        className={`leading-relaxed prose ${themeConfig.proseClass} ${getContentWidthClass(
          typography?.contentWidth || 'full'
        )} w-full space-y-1`}
      >
        {parsedBlocks
          .map((block, bIdx) => ({ block, bIdx }))
          .filter(({ block }) => {
            if (!summarySearch.trim()) return true;
            return block.raw.toLowerCase().includes(summarySearch.toLowerCase());
          })
          .map(({ block, bIdx }) => {
          const isCurrentBlock =
            (isSpeaking || isPaused) && block.speechIdx >= 0 && speakingIndex === block.speechIdx;

          return (
            <div
              key={bIdx}
              id={`summary-block-${bIdx}`}
              ref={(el) => {
                if (block.speechIdx >= 0) {
                  blockRefs.current[block.speechIdx] = el;
                }
              }}
              onClick={() => {
                if ((isSpeaking || isPaused) && block.speechIdx >= 0) {
                  handlePlayFromBlock(block.speechIdx);
                }
              }}
              className={`group relative transition-colors duration-150 rounded-lg ${
                isCurrentBlock
                  ? `${themeConfig.accentBg} border-l-2 border-indigo-500 pl-3.5 pr-8 py-1.5 my-1`
                  : block.speechIdx >= 0
                  ? 'hover:bg-slate-500/[0.03] px-1 pr-8'
                  : 'px-1'
              }`}
            >
              {/* Subtle Read-From-Here trigger on hover */}
              {block.speechIdx >= 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayFromBlock(block.speechIdx);
                  }}
                  className={`absolute right-1.5 top-1.5 p-1 rounded-md text-xs transition-opacity cursor-pointer ${
                    isCurrentBlock
                      ? 'opacity-100 text-indigo-400 bg-indigo-500/10'
                      : `opacity-0 group-hover:opacity-80 hover:opacity-100 ${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                  }`}
                  title="Read aloud from this line"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}

              {isCurrentBlock ? (
                renderActiveSynchronizedBlock(block)
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {block.raw}
                </ReactMarkdown>
              )}
            </div>
          );
        })}

        {/* Bottom Continuation Action */}
        {onContinueSummary && (
          <div className="pt-10 pb-4 flex justify-start">
            <button
              onClick={onContinueSummary}
              disabled={isContinuing}
              className={`flex items-center gap-2 px-4 py-2 rounded-md ${themeConfig.primaryButton} disabled:opacity-50 font-medium text-xs sm:text-sm cursor-pointer transition-colors`}
            >
              {isContinuing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Writing the next part...</span>
                </>
              ) : (
                <>
                  <ArrowRightCircle className="w-4 h-4" />
                  <span>Keep writing from where this left off</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Topic Expansions */}
        {expansionResults.length > 0 && (
          <div className={`mt-12 pt-8 border-t ${themeConfig.borderLight} space-y-10`}>
            {expansionResults.map((exp, idx) => (
              <div key={idx} className="space-y-4">
                <h3 className="text-lg font-bold text-indigo-400">
                  Closer Look: {exp.topic}
                </h3>
                <div className={`prose ${themeConfig.proseClass} max-w-none`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {exp.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EXACT VIDEO RESOURCES, CITATIONS & DIRECT SOURCES SECTION (Always Visible in Summary View) */}
        {exactResources.length > 0 && (
          <div
            id="summary-exact-resources-section"
            className={`mt-10 pt-6 border-t ${themeConfig.borderLight} not-prose space-y-4`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-sm sm:text-base font-bold ${themeConfig.textPrimary} flex items-center gap-1.5`}>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Exact Video Resources, Primary Citations &amp; Direct Sources ({exactResources.length})</span>
                  </h2>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                    Verified Links
                  </span>
                </div>
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  Exact books, research papers, archives, datasets, and timestamped references from this video—plus direct academic &amp; library lookup links.
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsAddResourceOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddResourceOpen ? 'Close Form' : '+ Add Exact Resource'}</span>
                </button>

                {onSaveItemToList && (
                  <button
                    type="button"
                    onClick={() => {
                      exactResources.forEach((r) => {
                        onSaveItemToList({
                          itemType: r.type === 'Book / Publication' ? 'book' : 'article',
                          title: r.title,
                          url: r.primaryUrl,
                          subtitle: `${r.type}${r.authorOrCreator ? ` · ${r.authorOrCreator}` : ''}${
                            r.formattedTime ? ` · [${r.formattedTime}]` : ''
                          }`,
                          content: r.description,
                          notes: r.exactQuote || '',
                        });
                      });
                      const nextSet = new Set(savedArtifactResIds);
                      exactResources.forEach((r) => nextSet.add(r.id));
                      setSavedArtifactResIds(nextSet);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer transition-colors"
                    title="Save all exact video resources into your Artifacts Folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>+ Save All to Artifacts</span>
                  </button>
                )}

                {onAppendCustomMarkdown && (
                  <button
                    type="button"
                    onClick={() => {
                      const unappended = exactResources.filter((r) => !appendedResIds.has(r.id));
                      const listToAppend = unappended.length > 0 ? unappended : exactResources;
                      const mdBlock =
                        `\n\n## Verified Exact Video Resources & Primary Citations\n\n` +
                        listToAppend
                          .map(
                            (r) =>
                              `- ${r.formattedTime ? `**[${r.formattedTime}]** ` : ''}[**${r.title}**](${r.primaryUrl}) *(${r.type}${
                                r.authorOrCreator ? ` · ${r.authorOrCreator}` : ''
                              })* — ${r.description}`
                          )
                          .join('\n');
                      onAppendCustomMarkdown(
                        mdBlock,
                        `Appended ${listToAppend.length} exact resources to Summary`
                      );
                      const nextSet = new Set(appendedResIds);
                      listToAppend.forEach((r) => nextSet.add(r.id));
                      setAppendedResIds(nextSet);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer transition-colors`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>+ Insert All into Summary Notes</span>
                  </button>
                )}

                {onOpenResearch && (
                  <button
                    type="button"
                    onClick={onOpenResearch}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 cursor-pointer transition-colors`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Open 55+ Live Research Sources →</span>
                  </button>
                )}
              </div>
            </div>

            {isAddResourceOpen && (
              <form
                onSubmit={handleAddCustomResourceInline}
                className={`p-3 rounded-lg border ${themeConfig.borderLight} bg-slate-500/5 space-y-2.5 text-xs`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${themeConfig.textPrimary} flex items-center gap-1.5`}>
                    <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Add Custom Exact Resource or Direct Source</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddResourceOpen(false)}
                    className={`${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    value={newResTitle}
                    onChange={(e) => setNewResTitle(e.target.value)}
                    placeholder="Resource Title (e.g. Book, Paper, Dataset, Repo) *"
                    className={`px-2.5 py-1.5 rounded bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                  />
                  <input
                    type="text"
                    value={newResUrl}
                    onChange={(e) => setNewResUrl(e.target.value)}
                    placeholder="Direct URL (https://... or leave blank to auto-link)"
                    className={`px-2.5 py-1.5 rounded bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                  />
                  <select
                    value={newResType}
                    onChange={(e) => setNewResType(e.target.value as ExactVideoResource['type'])}
                    className={`px-2.5 py-1.5 rounded bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                  >
                    <option value="Book / Publication">Book / Publication</option>
                    <option value="Research Paper">Research Paper</option>
                    <option value="Tool / Framework">Tool / Code / Framework</option>
                    <option value="Dataset / Benchmark">Dataset / Benchmark</option>
                    <option value="Historical / Key Reference">Historical / Key Reference</option>
                    <option value="Custom Resource">Custom Exact Resource</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newResDesc}
                    onChange={(e) => setNewResDesc(e.target.value)}
                    placeholder="Description or why this resource matters..."
                    className={`flex-1 min-w-[200px] px-2.5 py-1.5 rounded bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 rounded font-semibold ${themeConfig.primaryButton} cursor-pointer`}
                  >
                    + Save &amp; Add to Summary
                  </button>
                </div>
              </form>
            )}

            <div className={`divide-y ${themeConfig.borderLight}`}>
              {exactResources.map((res) => {
                const isAppended = appendedResIds.has(res.id);
                return (
                  <div key={res.id} className="py-3 first:pt-1 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-[240px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-400">
                            {res.type}
                          </span>
                          {res.formattedTime && (
                            <button
                              type="button"
                              onClick={() => {
                                if (res.timestampSeconds !== undefined) {
                                  onSeekToTimestamp(res.timestampSeconds);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
                              title="Jump video to this exact moment"
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>[{res.formattedTime}]</span>
                            </button>
                          )}
                          {res.authorOrCreator && (
                            <span className={`text-[11px] font-medium ${themeConfig.textSecondary}`}>
                              {res.authorOrCreator}
                              {res.year ? ` (${res.year})` : ''}
                            </span>
                          )}
                        </div>

                        <a
                          href={res.primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-sm font-bold ${themeConfig.textPrimary} hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5`}
                        >
                          <span>{res.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        <a
                          href={res.primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                        >
                          <span>{res.primaryLabel}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>

                        {onSaveItemToList && (
                          <button
                            type="button"
                            onClick={() => {
                              onSaveItemToList({
                                itemType: res.type === 'Book / Publication' ? 'book' : 'article',
                                title: res.title,
                                url: res.primaryUrl,
                                subtitle: `${res.type}${res.authorOrCreator ? ` · ${res.authorOrCreator}` : ''}${
                                  res.formattedTime ? ` · [${res.formattedTime}]` : ''
                                }`,
                                content: res.description,
                                notes: res.exactQuote || '',
                              });
                              setSavedArtifactResIds((prev) => new Set(prev).add(res.id));
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                              savedArtifactResIds.has(res.id)
                                ? 'text-amber-400 bg-amber-500/15 font-semibold'
                                : 'text-amber-400/90 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                            }`}
                            title="Save this resource to your Artifacts Folder"
                          >
                            {savedArtifactResIds.has(res.id) ? (
                              <Check className="w-2.5 h-2.5" />
                            ) : (
                              <FolderOpen className="w-2.5 h-2.5" />
                            )}
                            <span>{savedArtifactResIds.has(res.id) ? 'Saved in Artifacts' : '+ Save to Artifacts'}</span>
                          </button>
                        )}

                        {onAppendCustomMarkdown && (
                          <button
                            type="button"
                            onClick={() => {
                              const md = `\n\n### [${res.title}](${res.primaryUrl}) — *${res.type}${
                                res.authorOrCreator ? ` · ${res.authorOrCreator}` : ''
                              }${res.formattedTime ? ` · [${res.formattedTime}]` : ''}*\n${res.description}${
                                res.exactQuote ? `\n> "${res.exactQuote}"` : ''
                              }\n`;
                              onAppendCustomMarkdown(md, `Added "${res.title}" to Summary`);
                              setAppendedResIds((prev) => new Set(prev).add(res.id));
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                              isAppended
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/20`
                            }`}
                          >
                            {isAppended ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                            <span>{isAppended ? 'In Summary' : '+ Note'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p className={`text-xs ${themeConfig.textSecondary} leading-relaxed`}>
                      {res.description}
                    </p>

                    {res.exactQuote && (
                      <blockquote className={`border-l-2 border-emerald-500/50 pl-2.5 py-0.5 text-[11px] italic ${themeConfig.textMuted}`}>
                        &ldquo;{res.exactQuote.replace(/^"+|"+$/g, '')}&rdquo;
                      </blockquote>
                    )}

                    {res.secondaryLinks && res.secondaryLinks.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className={`text-[10px] uppercase tracking-wider ${themeConfig.textMuted}`}>
                          Verify &amp; Cross-Reference:
                        </span>
                        {res.secondaryLinks.map((lnk, lIdx) => (
                          <a
                            key={lIdx}
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/5 hover:bg-slate-500/15 transition-colors`}
                          >
                            <span>{lnk.label}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Expand Topic Modal */}
      {isExpandModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md ${themeConfig.cardBg} rounded-xl p-6 shadow-2xl space-y-4`}
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold ${themeConfig.textPrimary}`}>Explain a Part in More Detail</h3>
              <button
                onClick={() => setIsExpandModalOpen(false)}
                className="p-1 opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs ${themeConfig.textMuted}`}>
              Type any story, idea, or topic mentioned in the video, and we’ll write a deeper, plain-English explanation of it.
            </p>

            <input
              type="text"
              value={expandTopic}
              onChange={(e) => setExpandTopic(e.target.value)}
              placeholder="What would you like explained in more detail?"
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
            />

            {expandError && (
              <div className="text-xs text-rose-500 p-2 rounded-lg bg-rose-500/10">
                {expandError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsExpandModalOpen(false)}
                className={`px-3 py-1.5 text-xs rounded-md ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!expandTopic.trim() || isExpanding}
                onClick={() => handleDeepDive(expandTopic)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md ${themeConfig.primaryButton} disabled:opacity-50 cursor-pointer flex items-center gap-1.5`}
              >
                {isExpanding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{isExpanding ? 'Analyzing...' : 'Generate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
