import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { SidebarMenu } from './components/SidebarMenu';
import { MenuSliderDivider } from './components/MenuSliderDivider';
import { VideoPlayerPanel, VideoPlayerSize, VideoPlacementMode } from './components/VideoPlayerPanel';
import { SummaryViewer } from './components/SummaryViewer';
import { TranscriptViewer } from './components/TranscriptViewer';
import { AskVideoAI } from './components/AskVideoAI';
import { OpenRouterSettingsModal } from './components/OpenRouterSettingsModal';
import { ManualTranscriptModal } from './components/ManualTranscriptModal';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { AudioNarrationBar } from './components/AudioNarrationBar';
import { ResearchVisualsPanel } from './components/ResearchVisualsPanel';
import { TypographySettingsModal, DEFAULT_TYPOGRAPHY } from './components/TypographySettingsModal';
import { CrucialKnowledgePanel } from './components/CrucialKnowledgePanel';
import { ScrapedDataViewer } from './components/ScrapedDataViewer';
import { SavedListsPanel } from './components/SavedListsPanel';
import { TechWordsSearcherPanel } from './components/TechWordsSearcherPanel';
import { ActivityHistoryPanel } from './components/ActivityHistoryPanel';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import {
  addItemToUserList,
  ensureCloudListExists,
  loadLocalLists,
  loadLocalSummaries,
  loadLocalCustomResources,
  subscribeToUserLists,
  subscribeToSavedSummaries,
  subscribeToCustomResources,
  saveSummaryToFirestore,
  syncLocalDataToFirestore,
  recordUserActivity,
  SavedUserList,
  SavedCloudSummary,
} from './services/listsService';
import { speechService } from './services/speechService';
import {
  appendWebResultToSummary,
  appendImageResultToSummary,
  appendBatchToSummary,
  escapeMarkdownInline,
} from './services/termExtractionService';
import {
  isSafeHttpUrl,
  extractVideoId,
  parseAnyTranscriptFormat,
  formatTime,
} from './utils/subtitleParser';
import { OPENROUTER_MODELS, APP_THEMES, DEFAULT_SUMMARY_CONFIG } from './constants';
import {
  VideoMetadata,
  TranscriptSegment,
  SummaryResult,
  OpenRouterModel,
  DetailLevel,
  SummaryType,
  ThemeId,
  WebSearchResult,
  ImageSearchResult,
  NewsSearchResult,
  BookSearchResult,
  AcademicPaperResult,
  TypographyConfig,
  ExactVideoResource,
} from './types';
import { AlertCircle, Check, Minimize2, PanelLeft, X } from 'lucide-react';

export default function App() {
  // Theme state with localStorage persistence (Warm Sepia is default)
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('open_transcript_theme_v2') as ThemeId | null;
      if (saved && APP_THEMES[saved]) return saved;
    }
    return 'sepia';
  });

  const handleSelectTheme = (newTheme: ThemeId) => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('open_transcript_theme_v2', newTheme);
      localStorage.setItem('open_transcript_theme', newTheme);
    }
  };

  // Layout state: Sidebar width, open/closed, main page options closable, and Fullscreen mode
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(235);
  const [isMainOptionsOpen, setIsMainOptionsOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Video & Content State
  const [currentUrl, setCurrentUrl] = useState<string>('https://www.youtube.com/watch?v=UF8uR6Z6KLc');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [fullText, setFullText] = useState<string>('');
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [activeTimestamp, setActiveTimestamp] = useState<number | null>(null);
  const [seekTrigger, setSeekTrigger] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'knowledge' | 'research' | 'scrape' | 'chat' | 'lists' | 'techwords' | 'history'>('summary');
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [videoSize, setVideoSize] = useState<VideoPlayerSize>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('opentranscript_video_size') : null;
    if (saved === 'sm' || saved === 'md' || saved === 'lg' || saved === 'xl') return saved;
    return 'md';
  });
  const [videoPlacement, setVideoPlacement] = useState<VideoPlacementMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('opentranscript_video_placement') : null;
    if (saved === 'floating' || saved === 'docked-top' || saved === 'sidebar') return saved;
    return 'floating';
  });
  const [appendNotice, setAppendNotice] = useState<string | null>(null);

  const handleChangeVideoSize = (newSize: VideoPlayerSize) => {
    setVideoSize(newSize);
    if (typeof window !== 'undefined') {
      localStorage.setItem('opentranscript_video_size', newSize);
    }
  };

  const handleChangeVideoPlacement = (newMode: VideoPlacementMode) => {
    setVideoPlacement(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('opentranscript_video_placement', newMode);
    }
  };
  const [researchInitialQuery, setResearchInitialQuery] = useState<string>('');
  const [techWordsInitialQuery, setTechWordsInitialQuery] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLists, setUserLists] = useState<SavedUserList[]>([]);
  const [savedSummaries, setSavedSummaries] = useState<SavedCloudSummary[]>(() => loadLocalSummaries());
  const [customResources, setCustomResources] = useState<ExactVideoResource[]>(() => loadLocalCustomResources());

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (u) {
        syncLocalDataToFirestore();
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setUserLists([]);
      const unsubLists = subscribeToUserLists(currentUser.uid, (lists) => {
        setUserLists(lists);
      });
      const unsubSummaries = subscribeToSavedSummaries(currentUser.uid, (summaries) => {
        setSavedSummaries(summaries);
      });
      const unsubResources = subscribeToCustomResources(currentUser.uid, (resources) => {
        setCustomResources(resources);
      });
      return () => {
        unsubLists();
        unsubSummaries();
        unsubResources();
      };
    } else {
      setUserLists(loadLocalLists());
      setSavedSummaries(loadLocalSummaries());
      setCustomResources(loadLocalCustomResources());
    }
  }, [currentUser]);

  const handleSignInWithGoogle = async () => {
    try {
      await signInWithGoogle();
      setAppendNotice('Connected to Firebase! Your lists, summaries & exact resources are synced.');
      setTimeout(() => setAppendNotice(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not sign in with Google.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setAppendNotice('Signed out of Firebase. Using local storage.');
      setTimeout(() => setAppendNotice(null), 3500);
    } catch {}
  };

  // Typography state with localStorage persistence (default full width)
  const [isTypographyOpen, setIsTypographyOpen] = useState<boolean>(false);
  const [typography, setTypography] = useState<TypographyConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('opentranscript_typography');
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...DEFAULT_TYPOGRAPHY, ...parsed, contentWidth: parsed.contentWidth || 'full' };
        }
      } catch (e) {}
    }
    return DEFAULT_TYPOGRAPHY;
  });

  const handleSaveTypography = (newConfig: TypographyConfig) => {
    setTypography(newConfig);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('opentranscript_typography', JSON.stringify(newConfig));
      } catch (e) {}
    }
  };

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings (store OpenRouter key in sessionStorage and remove any legacy localStorage copy - C-08)
  const [openRouterKey, setOpenRouterKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const sessionKey = sessionStorage.getItem('openrouter_key');
    if (sessionKey) return sessionKey;
    const legacyKey = localStorage.getItem('openrouter_key');
    if (legacyKey) {
      sessionStorage.setItem('openrouter_key', legacyKey);
      localStorage.removeItem('openrouter_key');
      return legacyKey;
    }
    return '';
  });
  const [selectedModel, setSelectedModel] = useState<OpenRouterModel>(() => {
    return (
      OPENROUTER_MODELS.find((m) => m.id === DEFAULT_SUMMARY_CONFIG.model) ||
      OPENROUTER_MODELS.find((m) => m.isFree) ||
      OPENROUTER_MODELS[0]
    );
  });
  const [provider, setProvider] = useState<'openrouter' | 'gemini'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('provider') : null;
    if (saved === 'openrouter' || saved === 'gemini') return saved;
    const hasKey =
      typeof window !== 'undefined' &&
      Boolean(sessionStorage.getItem('openrouter_key') || localStorage.getItem('openrouter_key'));
    return hasKey ? 'openrouter' : 'gemini';
  });
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('massive');
  const [summaryType, setSummaryType] = useState<SummaryType>('massive');
  const [isContinuing, setIsContinuing] = useState<boolean>(false);

  const fetchAbortRef = useRef<AbortController | null>(null);
  const summarizeAbortRef = useRef<AbortController | null>(null);
  const regenDebounceRef = useRef<number | null>(null);
  const appendedResearchRef = useRef<string>('');

  // Modals & Audio state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState<boolean>(false);

  const [speechState, setSpeechState] = useState<{
    isPlaying: boolean;
    isPaused: boolean;
    currentIndex: number;
    totalItems: number;
    currentLabel: string;
  }>({
    isPlaying: false,
    isPaused: false,
    currentIndex: -1,
    totalItems: 0,
    currentLabel: '',
  });

  useEffect(() => {
    const unsubState = speechService.subscribeStateChange((playing, paused, curIdx) => {
      const state = speechService.getState();
      setSpeechState({
        isPlaying: playing,
        isPaused: paused,
        currentIndex: curIdx,
        totalItems: state.totalItems,
        currentLabel: state.currentItem?.label || (state.currentItem?.text ? state.currentItem.text.slice(0, 35) + '...' : ''),
      });
    });

    const unsubStart = speechService.subscribeItemStart((idx, item) => {
      const state = speechService.getState();
      setSpeechState({
        isPlaying: true,
        isPaused: false,
        currentIndex: idx,
        totalItems: state.totalItems,
        currentLabel: item.label || item.text.slice(0, 35) + '...',
      });
    });

    return () => {
      unsubState();
      unsubStart();
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        if (next && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (!next && document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Natural Keyboard Shortcuts (no UI option/badges added, works intuitively)
  // 1. F / Escape: Toggle Fullscreen main viewing page
  // 2. B / [ / \: Toggle Sidebar Menu open/closed
  // 3. Space: Play / Pause audio narration
  // 4. 1 - 6: Switch views (Summary, Transcript, Knowledge, Research, Scrape, Ask Video)
  // 5. V: Toggle Video player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        return;
      }

      if (isInputFocused || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === 'f') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (key === 'b' || e.key === '[' || e.key === '\\') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      } else if (e.key === ' ') {
        const state = speechService.getState();
        if (state.isPlaying) {
          e.preventDefault();
          if (state.isPaused) {
            speechService.resume();
          } else {
            speechService.pause();
          }
        }
      } else if (key === 'v') {
        e.preventDefault();
        setShowVideo((prev) => !prev);
      } else if (e.key === '1') {
        setActiveTab('summary');
      } else if (e.key === '2') {
        setActiveTab('transcript');
      } else if (e.key === '3') {
        setActiveTab('knowledge');
      } else if (e.key === '4') {
        setActiveTab('research');
      } else if (e.key === '5') {
        setActiveTab('scrape');
      } else if (e.key === '6') {
        setActiveTab('chat');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handleToggleFullscreen]);

  const handleSaveKey = (key: string) => {
    const trimmed = key.trim();
    setOpenRouterKey(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('openrouter_key');
      if (trimmed) {
        sessionStorage.setItem('openrouter_key', trimmed);
        setProvider('openrouter');
        localStorage.setItem('provider', 'openrouter');
      } else {
        sessionStorage.removeItem('openrouter_key');
      }
    }
  };

  const handleSelectProvider = (newProvider: 'openrouter' | 'gemini') => {
    setProvider(newProvider);
    if (typeof window !== 'undefined') {
      localStorage.setItem('provider', newProvider);
    }
  };

  const fetchWithRetry = async (url: string, options?: RequestInit, retries = 2): Promise<Response> => {
    let lastError: any;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (options?.signal?.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        const res = await fetch(url, options);
        return res;
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        lastError = err;
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  };

  const buildLocalSummaryFallback = (
    textToSummarize: string,
    title: string,
    transcriptSegments: TranscriptSegment[] = []
  ): string => {
    const sentences = textToSummarize
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const intro = sentences.slice(0, 4).join(' ');

    let timeline = '';
    if (transcriptSegments.length > 0) {
      const step = Math.max(1, Math.floor(transcriptSegments.length / 10));
      const sampledSegs = transcriptSegments.filter((_, i) => i % step === 0).slice(0, 10);
      timeline = sampledSegs
        .map((seg, idx) => {
          const tsPrefix = seg.formattedTime ? `[${seg.formattedTime}] ` : '';
          return `- **${tsPrefix}Key Point ${idx + 1}**: ${seg.text}`;
        })
        .join('\n\n');
    } else {
      timeline = sentences
        .slice(0, 12)
        .map((s, idx) => `- **Key Point ${idx + 1}**: ${s}`)
        .join('\n\n');
    }

    return `# ${title}\n\n## What This Video Is Really About\n${intro || textToSummarize.slice(0, 600)}\n\n---\n\n## Step-by-Step Story Walkthrough\n\n${timeline}\n\n---\n\n## Practical Takeaways\n1. **Core Insight**: ${sentences[0] || 'Review the transcript segments for verbatim details.'}\n2. **Summary Conclusion**: ${sentences[sentences.length - 1] || 'Synthesized directly from the provided transcript.'}`;
  };

  // Main Action: Fetch Transcript and Generate Summary (or restore saved summary without fake Jobs fallback - C-02, H-09)
  const handleFetchAndSummarize = async (urlToFetch: string, savedMarkdown?: string, savedTitle?: string) => {
    speechService.stop();
    setActiveTimestamp(null);
    setErrorMessage(null);

    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    if (summarizeAbortRef.current) {
      summarizeAbortRef.current.abort();
    }
    appendedResearchRef.current = '';

    // If restoring a saved summary that has no video URL (e.g. manual upload), restore directly without network fetch
    if (!urlToFetch.trim() && savedMarkdown && savedMarkdown.trim()) {
      const words = savedMarkdown.split(/\s+/).filter(Boolean).length;
      setCurrentUrl('');
      setMetadata({
        videoId: '',
        url: '',
        title: savedTitle || 'Saved Summary Document',
        authorName: 'Saved Archive',
        totalSegments: 0,
        totalWords: words,
        estimatedTokens: Math.round(words * 1.33),
        durationFormatted: '00:00',
      });
      setSegments([]);
      setFullText('');
      setSummary({
        markdown: savedMarkdown,
        summaryType,
        detailLevel,
        providerUsed: provider,
        modelUsed: selectedModel.id,
        createdAt: new Date().toISOString(),
        isTruncated: false,
      });
      return;
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;

    // If user pasted raw transcript text, SRT/VTT, or timestamped lines directly into the input box, process it immediately
    const trimmedInput = urlToFetch.trim();
    if (
      !extractVideoId(trimmedInput) &&
      !/^https?:\/\//i.test(trimmedInput) &&
      trimmedInput.length > 40 &&
      (/\s/.test(trimmedInput) || trimmedInput.includes('-->'))
    ) {
      const parsedSegs = parseAnyTranscriptFormat(trimmedInput, true);
      if (parsedSegs.length > 0) {
        const cleanFull = parsedSegs.map((s) => s.text).join(' ');
        handleManualSubmit(cleanFull, savedTitle || 'Pasted Transcript', parsedSegs);
        return;
      }
    }

    setIsLoading(true);
    setCurrentUrl(urlToFetch);

    try {
      const transcriptRes = await fetchWithRetry(
        `/api/transcript?url=${encodeURIComponent(urlToFetch)}`,
        { signal: controller.signal },
        2
      );
      const transcriptData = await transcriptRes.json().catch(() => ({}));

      if (controller.signal.aborted) return;

      if (!transcriptRes.ok) {
        if (transcriptData?.metadata) {
          setMetadata(transcriptData.metadata);
        } else {
          setMetadata(null);
        }
        setSegments([]);
        setFullText('');
        setIsLoading(false);

        if (savedMarkdown && savedMarkdown.trim()) {
          setSummary({
            markdown: savedMarkdown,
            summaryType,
            detailLevel,
            providerUsed: provider,
            modelUsed: selectedModel.id,
            createdAt: new Date().toISOString(),
            isTruncated: false,
          });
          return;
        }

        setSummary(null);
        setErrorMessage(
          transcriptData.error ||
            'Could not load captions for this video. Please check the URL or click "Paste text manually".'
        );
        return;
      }

      setMetadata(transcriptData.metadata);
      setSegments(transcriptData.segments || []);
      setFullText(transcriptData.fullText || '');
      setIsLoading(false);

      recordUserActivity({
        actionType: 'video',
        title: transcriptData.metadata?.title || 'YouTube Video Loaded',
        query: urlToFetch,
        details: `${transcriptData.metadata?.authorName || 'YouTube'} · ${transcriptData.metadata?.durationFormatted || ''} · ${transcriptData.metadata?.totalWords || 0} words`,
        videoId: transcriptData.metadata?.videoId || '',
        videoUrl: urlToFetch,
        videoTitle: transcriptData.metadata?.title || '',
      }).catch(() => {});

      if (savedMarkdown && savedMarkdown.trim()) {
        setSummary({
          markdown: savedMarkdown,
          summaryType,
          detailLevel,
          providerUsed: provider,
          modelUsed: selectedModel.id,
          createdAt: new Date().toISOString(),
          isTruncated: false,
        });
        return;
      }

      await generateSummary(
        transcriptData.fullText,
        transcriptData.metadata?.title || 'YouTube Video',
        urlToFetch,
        summaryType,
        detailLevel,
        transcriptData.segments || []
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('Transcript fetch error:', err);
      setIsLoading(false);
      setIsSummarizing(false);
      setSegments([]);
      setFullText('');

      if (savedMarkdown && savedMarkdown.trim()) {
        setMetadata({
          videoId: '',
          url: urlToFetch,
          title: savedTitle || 'Saved Video Summary',
          authorName: 'Saved Archive',
          totalSegments: 0,
          totalWords: savedMarkdown.split(/\s+/).filter(Boolean).length,
          estimatedTokens: Math.round(savedMarkdown.split(/\s+/).filter(Boolean).length * 1.33),
          durationFormatted: '00:00',
        });
        setSummary({
          markdown: savedMarkdown,
          summaryType,
          detailLevel,
          providerUsed: provider,
          modelUsed: selectedModel.id,
          createdAt: new Date().toISOString(),
          isTruncated: false,
        });
        return;
      }

      setMetadata(null);
      setSummary(null);
      setErrorMessage(
        err?.message || 'Unable to fetch video transcript. Please verify the YouTube URL or paste the transcript manually.'
      );
    }
  };

  const generateSummary = async (
    textToSummarize: string,
    title: string,
    url: string,
    type: SummaryType,
    depth: DetailLevel,
    currentSegments: TranscriptSegment[] = segments,
    overrideProvider?: 'openrouter' | 'gemini',
    overrideModelId?: string,
    overrideKey?: string
  ) => {
    if (!textToSummarize || !textToSummarize.trim()) return;

    if (summarizeAbortRef.current) {
      summarizeAbortRef.current.abort();
    }
    const controller = new AbortController();
    summarizeAbortRef.current = controller;

    setIsSummarizing(true);
    setErrorMessage(null);

    const activeProvider = overrideProvider || provider;
    const activeModelId = overrideModelId || selectedModel.id;
    const activeKey = overrideKey !== undefined ? overrideKey : openRouterKey;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeKey.trim()) {
        headers['X-OpenRouter-Key'] = activeKey.trim();
      }

      const res = await fetchWithRetry(
        '/api/summarize',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            transcript: textToSummarize,
            segments: currentSegments,
            title,
            url,
            provider: activeProvider,
            openRouterKey: activeKey.trim(),
            model: activeModelId,
            summaryType: type,
            detailLevel: depth,
          }),
          signal: controller.signal,
        },
        1
      );

      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!res.ok) {
        throw new Error(data.error || 'Failed to synthesize summary.');
      }

      const baseMarkdown = String(data.markdown || '');
      const preservedResearch = appendedResearchRef.current;
      const finalMarkdown =
        preservedResearch && !baseMarkdown.includes(preservedResearch.trim())
          ? `${baseMarkdown}\n\n${preservedResearch}`
          : baseMarkdown;

      const result: SummaryResult = {
        markdown: finalMarkdown,
        modelUsed: data.modelUsed,
        providerUsed: data.providerUsed,
        tokenUsage: data.tokenUsage,
        summaryType: type,
        detailLevel: depth,
        finishReason: data.finishReason,
        isTruncated: data.isTruncated,
        continuationCount: 0,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      if (data.warning) {
        setAppendNotice(data.warning);
        setTimeout(() => setAppendNotice(null), 5000);
      }

      setSummary(result);
      recordUserActivity({
        actionType: 'summary',
        title: `Summary Generated: ${title}`,
        query: `${type} (${depth})`,
        details: finalMarkdown.replace(/[#*_>`]/g, '').slice(0, 240),
        videoId: extractVideoId(url) || metadata?.videoId || '',
        videoUrl: url,
        videoTitle: title,
      }).catch(() => {});
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('Summary error:', e);
      setErrorMessage(e?.message || 'Summarization failed. Showing local extractive summary.');
      const fallbackMd = buildLocalSummaryFallback(textToSummarize, title, currentSegments);
      const preservedResearch = appendedResearchRef.current;
      setSummary({
        markdown: preservedResearch ? `${fallbackMd}\n\n${preservedResearch}` : fallbackMd,
        modelUsed: 'extractive-fallback',
        providerUsed: 'local-extractive',
        summaryType: type,
        detailLevel: depth,
        finishReason: 'stop',
        isTruncated: false,
        continuationCount: 0,
        createdAt: new Date().toISOString(),
      });
    } finally {
      if (summarizeAbortRef.current === controller) {
        setIsSummarizing(false);
      }
    }
  };

  const scheduleRegenerate = (
    nextType: SummaryType,
    nextDepth: DetailLevel,
    overrideProvider?: 'openrouter' | 'gemini',
    overrideModelId?: string,
    overrideKey?: string
  ) => {
    if (regenDebounceRef.current) {
      window.clearTimeout(regenDebounceRef.current);
    }
    regenDebounceRef.current = window.setTimeout(() => {
      if (fullText && metadata) {
        generateSummary(
          fullText,
          metadata.title,
          metadata.url,
          nextType,
          nextDepth,
          segments,
          overrideProvider,
          overrideModelId,
          overrideKey
        );
      }
    }, 250);
  };

  const handleRegenerate = (
    type: SummaryType,
    overrideProvider?: 'openrouter' | 'gemini',
    overrideModelId?: string,
    overrideKey?: string
  ) => {
    setSummaryType(type);
    if (overrideProvider) setProvider(overrideProvider);
    if (overrideModelId) {
      const found = OPENROUTER_MODELS.find((m) => m.id === overrideModelId);
      if (found) setSelectedModel(found);
    }
    if (overrideKey !== undefined) {
      handleSaveKey(overrideKey);
    }
    scheduleRegenerate(type, detailLevel, overrideProvider, overrideModelId, overrideKey);
  };

  const handleContinueSummary = async () => {
    if (!summary || !fullText) return;
    setIsContinuing(true);
    setErrorMessage(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (openRouterKey.trim()) {
        headers['X-OpenRouter-Key'] = openRouterKey.trim();
      }

      const res = await fetchWithRetry(
        '/api/continue-summary',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            previousMarkdown: summary.markdown,
            transcript: fullText,
            title: metadata?.title || 'Video',
            provider: summary.providerUsed || (openRouterKey ? 'openrouter' : 'gemini'),
            model: selectedModel.id,
            summaryType,
            detailLevel,
            continuationCount: summary.continuationCount || 0,
          }),
        },
        1
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to continue summary.');
      }

      setSummary({
        ...summary,
        markdown: data.fullMarkdown,
        isTruncated: data.isTruncated,
        finishReason: data.finishReason,
        continuationCount: data.continuationCount,
        lastContinuationText: data.continuation,
      });
    } catch (e: any) {
      console.warn('Continue summary error:', e);
      setErrorMessage(e?.message || 'Could not continue summary.');
    } finally {
      setIsContinuing(false);
    }
  };

  const recordAppendedSnippet = (prevMd: string, nextMd: string) => {
    if (nextMd.length > prevMd.length && nextMd.startsWith(prevMd)) {
      appendedResearchRef.current += nextMd.slice(prevMd.length);
    }
  };

  const handleAppendWebResult = (result: WebSearchResult) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending web notes.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    const updatedMarkdown = appendWebResultToSummary(summary.markdown, result);
    recordAppendedSnippet(summary.markdown, updatedMarkdown);
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice(`Appended "${result.title}" to summary`);
    setTimeout(() => setAppendNotice(null), 3500);
  };

  const handleAppendImageResult = (image: ImageSearchResult) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending images.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    const updatedMarkdown = appendImageResultToSummary(summary.markdown, image);
    recordAppendedSnippet(summary.markdown, updatedMarkdown);
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice(`Appended "${image.title}" image to summary`);
    setTimeout(() => setAppendNotice(null), 3500);
  };

  const handleAppendNewsResult = (item: NewsSearchResult) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending news articles.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    if (!isSafeHttpUrl(item.url)) return;
    const dateStr = item.publishedAt ? ` (${new Date(item.publishedAt).toLocaleDateString()})` : '';
    const citation = `\n\n> **${escapeMarkdownInline(item.title)}** — *${escapeMarkdownInline(item.source)}${dateStr}*\n> "${escapeMarkdownInline(item.snippet)}"\n> [Read Full Article →](${item.url})\n`;
    const updatedMarkdown = summary.markdown + citation;
    recordAppendedSnippet(summary.markdown, updatedMarkdown);
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice(`Appended news article "${item.title.slice(0, 30)}..." to summary.`);
    setTimeout(() => setAppendNotice(null), 4000);
  };

  const handleAppendBookResult = (book: BookSearchResult) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending book citations.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    const safeLink = isSafeHttpUrl(book.infoLink) ? book.infoLink : 'https://books.google.com';
    const authorsStr = book.authors?.length ? escapeMarkdownInline(book.authors.join(', ')) : 'Unknown Author';
    const yearStr = book.publishedDate ? ` (${escapeMarkdownInline(book.publishedDate.slice(0, 4))})` : '';
    const citation = `\n\n### [${escapeMarkdownInline(book.title)}](${safeLink}) — *${authorsStr}${yearStr}*\n> ${escapeMarkdownInline(book.description || 'Published reference volume.')}\n`;
    const updatedMarkdown = summary.markdown + citation;
    recordAppendedSnippet(summary.markdown, updatedMarkdown);
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice(`Appended book "${book.title.slice(0, 30)}..." to summary.`);
    setTimeout(() => setAppendNotice(null), 4000);
  };

  const handleAppendAcademicResult = (paper: AcademicPaperResult) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending academic citations.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    const safeUrl = isSafeHttpUrl(paper.url) ? paper.url : 'https://scholar.google.com';
    const authorsStr = paper.authors?.length ? escapeMarkdownInline(paper.authors.join(', ')) : 'Research Author';
    const yearStr = paper.year ? ` (${paper.year})` : '';
    const citeStr = paper.citationCount !== undefined ? ` — ${paper.citationCount} citations` : '';
    const citation = `\n\n### [${escapeMarkdownInline(paper.title)}](${safeUrl}) — *${authorsStr}${yearStr}, ${escapeMarkdownInline(paper.source)}${citeStr}*\n> ${escapeMarkdownInline(paper.abstract || 'Peer-reviewed academic publication.')}\n`;
    const updatedMarkdown = summary.markdown + citation;
    recordAppendedSnippet(summary.markdown, updatedMarkdown);
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice(`Appended paper "${paper.title.slice(0, 30)}..." to summary.`);
    setTimeout(() => setAppendNotice(null), 4000);
  };

  const handleAppendCustomMarkdown = (snippet: string, noticeLabel?: string) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending notes.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    const updatedMarkdown = summary.markdown + snippet;
    recordAppendedSnippet(summary.markdown, updatedMarkdown);
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice(noticeLabel || 'Appended resource to summary document.');
    setTimeout(() => setAppendNotice(null), 4000);
  };

  const handleAppendBatch = (
    webResults: WebSearchResult[],
    images: ImageSearchResult[],
    newsResults: NewsSearchResult[] = [],
    books: BookSearchResult[] = [],
    papers: AcademicPaperResult[] = []
  ) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending research.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    let updatedMarkdown = appendBatchToSummary(summary.markdown, webResults, images);
    if (papers.length > 0) {
      updatedMarkdown += `\n\n### Peer-Reviewed Academic Papers & Preprints\n\n`;
      for (const p of papers) {
        if (!isSafeHttpUrl(p.url)) continue;
        const authorsStr = p.authors?.length ? escapeMarkdownInline(p.authors.join(', ')) : 'Research Author';
        const yearStr = p.year ? ` (${p.year})` : '';
        updatedMarkdown += `* **[${escapeMarkdownInline(p.title)}](${p.url})** — *${authorsStr}${yearStr} [${escapeMarkdownInline(p.source)}]*\n  * ${escapeMarkdownInline(p.abstract || 'Peer-reviewed publication.')}\n`;
      }
    }
    if (books.length > 0) {
      updatedMarkdown += `\n\n### Published Books & Literature (Google Books)\n\n`;
      for (const b of books) {
        const safeLink = isSafeHttpUrl(b.infoLink) ? b.infoLink : 'https://books.google.com';
        const authorsStr = b.authors?.length ? escapeMarkdownInline(b.authors.join(', ')) : 'Unknown Author';
        const yearStr = b.publishedDate ? ` (${escapeMarkdownInline(b.publishedDate.slice(0, 4))})` : '';
        updatedMarkdown += `* **[${escapeMarkdownInline(b.title)}](${safeLink})** — *${authorsStr}${yearStr}*\n  * ${escapeMarkdownInline(b.description)}\n`;
      }
    }
    if (newsResults.length > 0) {
      updatedMarkdown += `\n\n### Relevant News & Media Coverage\n\n`;
      for (const n of newsResults) {
        if (!isSafeHttpUrl(n.url)) continue;
        const dateStr = n.publishedAt ? ` (${new Date(n.publishedAt).toLocaleDateString()})` : '';
        updatedMarkdown += `* **[${escapeMarkdownInline(n.title)}](${n.url})** — *${escapeMarkdownInline(n.source)}${dateStr}*\n  * ${escapeMarkdownInline(n.snippet)}\n`;
      }
    }
    recordAppendedSnippet(summary.markdown, updatedMarkdown);
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice(
      `Appended research batch (${papers.length} papers, ${books.length} books, ${webResults.length} web, ${newsResults.length} news, ${images.length} figures)`
    );
    setTimeout(() => setAppendNotice(null), 4000);
  };

  const getOrCreateTargetList = async (): Promise<SavedUserList | null> => {
    if (currentUser) {
      const validRemote = userLists.find((l) => l.ownerId === currentUser.uid && l.id !== 'list_default_favorites');
      if (validRemote) return validRemote;
      const listId = await ensureCloudListExists(currentUser.uid);
      const created: SavedUserList = {
        id: listId,
        ownerId: currentUser.uid,
        name: 'My Favorite Video Summaries',
        description: 'Videos, summaries, and big lessons I want to keep.',
        category: 'favorites',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUserLists((prev) => (prev.some((l) => l.id === created.id) ? prev : [created, ...prev]));
      return created;
    }
    const local = userLists[0] || loadLocalLists()[0];
    return local || null;
  };

  const handleSaveItemToList = async (item: {
    itemType: 'video' | 'summary' | 'book' | 'article' | 'note';
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }) => {
    try {
      const targetList = await getOrCreateTargetList();
      if (!targetList) {
        setActiveTab('lists');
        return;
      }
      await addItemToUserList(targetList.id, item);
      recordUserActivity({
        actionType: 'artifact',
        title: `Saved ${item.itemType}: ${item.title}`,
        query: item.title,
        details: item.subtitle || (item.content ? item.content.slice(0, 200) : ''),
        videoId: metadata?.videoId || '',
        videoUrl: item.url || currentUrl,
        videoTitle: metadata?.title || '',
      }).catch(() => {});
      setAppendNotice(
        `Saved "${item.title.slice(0, 42)}" to Artifacts Folder${currentUser ? ' (Synced to Firebase)' : ''}`
      );
      setTimeout(() => setAppendNotice(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save item to list.');
    }
  };

  const handleQuickSaveCurrentVideo = async () => {
    if (!metadata) return;
    if (!summary?.markdown?.trim()) {
      setErrorMessage('Please generate a summary first before saving it to your library.');
      return;
    }
    try {
      await saveSummaryToFirestore({
        videoId: metadata.videoId || '',
        videoUrl: currentUrl || metadata.url || '',
        videoTitle: metadata.title || 'YouTube Video Summary',
        authorName: metadata.authorName || 'YouTube Channel',
        summaryType,
        markdown: summary.markdown,
      });
      if (!currentUser) {
        setSavedSummaries(loadLocalSummaries());
      }
      const targetList = await getOrCreateTargetList();
      if (targetList) {
        await addItemToUserList(targetList.id, {
          itemType: 'summary',
          title: metadata.title || 'YouTube Video Summary',
          url: currentUrl || metadata.url || '',
          subtitle: metadata.authorName || 'YouTube Channel',
          content: summary.markdown,
          notes: '',
        });
      }
      setAppendNotice(
        currentUser
          ? `Saved "${metadata.title}" to Firebase Firestore!`
          : `Saved "${metadata.title}" to "${targetList?.name || 'Saved Lists'}" (Sign in to sync to Firebase)`
      );
      setTimeout(() => setAppendNotice(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save summary.');
    }
  };

  const handleSeekToTimestamp = (seconds: number) => {
    setActiveTimestamp(seconds);
    setSeekTrigger((prev) => prev + 1);
    if (!showVideo) {
      setShowVideo(true);
    }
  };

  const handleManualSubmit = (
    text: string,
    title: string,
    customSegments?: TranscriptSegment[],
    customMeta?: Partial<VideoMetadata>
  ) => {
    setErrorMessage(null);
    const generatedSegments: TranscriptSegment[] =
      customSegments && customSegments.length > 0
        ? customSegments
        : parseAnyTranscriptFormat(text, true);

    const cleanFullText =
      generatedSegments.length > 0 ? generatedSegments.map((s) => s.text).join(' ') : text;
    const totalWords = cleanFullText.split(/\s+/).filter(Boolean).length;
    const estTokens = Math.round(totalWords * 1.33);
    const lastSeg = generatedSegments[generatedSegments.length - 1];
    const durationSec = lastSeg ? lastSeg.start + lastSeg.duration : generatedSegments.length * 4;

    const meta: VideoMetadata = {
      videoId: customMeta?.videoId || (customMeta?.mediaUrl ? `media_${Date.now()}` : ''),
      url: customMeta?.url || '',
      title: title || customMeta?.title || 'Uploaded Document',
      authorName: customMeta?.authorName || 'Direct Media',
      sourceType: customMeta?.sourceType || 'uploaded_file',
      mediaUrl: customMeta?.mediaUrl,
      embedUrl: customMeta?.embedUrl,
      thumbnailUrl: customMeta?.thumbnailUrl,
      totalSegments: generatedSegments.length,
      totalWords,
      estimatedTokens: estTokens,
      durationSeconds: Math.round(durationSec),
      durationFormatted: formatTime(durationSec),
      ...customMeta,
    };

    setMetadata(meta);
    setSegments(generatedSegments);
    setFullText(cleanFullText);
    appendedResearchRef.current = '';

    if (meta.mediaUrl || meta.embedUrl) {
      setShowVideo(true);
    }

    recordUserActivity({
      actionType: 'transcript',
      title: `Imported Media: ${meta.title}`,
      query: meta.title,
      details: `${generatedSegments.length} segments · ${totalWords} words (${meta.durationFormatted})`,
      videoTitle: meta.title,
    }).catch(() => {});

    generateSummary(cleanFullText, meta.title, '', summaryType, detailLevel, generatedSegments);
  };

  // Do not auto-fetch or auto-summarize over the network on every page load (H-07)

  const themeConfig = APP_THEMES[theme] || APP_THEMES.sepia;

  return (
    <div className={`h-screen w-screen overflow-hidden ${themeConfig.pageBg} ${themeConfig.textPrimary} flex flex-col antialiased transition-colors`}>
      {/* Top Bar (Hidden when Fullscreen mode is active) */}
      {!isFullscreen && (
        <Header
          onOpenSettings={() => setIsSettingsOpen(true)}
          hasOpenRouterKey={!!openRouterKey}
          selectedModel={selectedModel}
          provider={provider}
          currentTheme={theme}
          onSelectTheme={handleSelectTheme}
          onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
          onOpenTypography={() => setIsTypographyOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          isSidebarOpen={isSidebarOpen}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isMainOptionsOpen={isMainOptionsOpen}
          onToggleMainOptions={() => setIsMainOptionsOpen((prev) => !prev)}
          showVideo={showVideo}
          onToggleShowVideo={() => setShowVideo((prev) => !prev)}
          user={currentUser}
          onSignIn={handleSignInWithGoogle}
          onSignOut={handleSignOut}
          onQuickSaveToCloud={handleQuickSaveCurrentVideo}
        />
      )}

      {/* Full-Width & Full-Height Workspace Container */}
      <div className="flex-1 w-full flex overflow-hidden relative">
        {/* Left Options Sidebar Menu & Slider Divider (Hidden when Fullscreen is active) */}
        {!isFullscreen && (
          <>
            <SidebarMenu
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              width={sidebarWidth}
              currentUrl={currentUrl}
              onSubmitUrl={handleFetchAndSummarize}
              isLoading={isLoading || isSummarizing}
              onOpenManualModal={() => setIsManualModalOpen(true)}
              metadata={metadata}
              activeTimestamp={activeTimestamp}
              seekTrigger={seekTrigger}
              onTimeUpdate={setActiveTimestamp}
              showVideo={showVideo}
              onToggleShowVideo={() => setShowVideo((prev) => !prev)}
              videoSize={videoSize}
              onChangeVideoSize={handleChangeVideoSize}
              videoPlacement={videoPlacement}
              onChangeVideoPlacement={handleChangeVideoPlacement}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              summaryType={summaryType}
              onChangeSummaryType={(type) => {
                setSummaryType(type);
                scheduleRegenerate(type, detailLevel);
              }}
              detailLevel={detailLevel}
              onChangeDetailLevel={(lvl) => {
                setDetailLevel(lvl);
                scheduleRegenerate(summaryType, lvl);
              }}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              provider={provider}
              onSelectProvider={handleSelectProvider}
              hasOpenRouterKey={!!openRouterKey}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
              onOpenTypography={() => setIsTypographyOpen(true)}
              currentTheme={theme}
              onSelectTheme={handleSelectTheme}
              user={currentUser}
              onSignIn={handleSignInWithGoogle}
              onSignOut={handleSignOut}
              savedSummaries={savedSummaries}
              onSaveCurrentToCloud={handleQuickSaveCurrentVideo}
            />

            <MenuSliderDivider
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              onResize={setSidebarWidth}
              currentTheme={theme}
            />
          </>
        )}

        {/* Main Viewing Canvas — Maximum Space for Real Content */}
        <main className="flex-1 h-full w-full overflow-y-auto px-3 sm:px-5 lg:px-7 py-2.5 space-y-2.5 pb-20">
          {/* Fullscreen Floating Minimal Controls */}
          {isFullscreen && (
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-500/15">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsFullscreen(false);
                    setIsSidebarOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                  <span>Open Menu</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
                title="Exit Fullscreen"
              >
                <Minimize2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          )}

          {/* Error Notice (Unboxed inline) */}
          {errorMessage && (
            <div className="py-3 border-b border-rose-500/30 flex items-center justify-between text-xs text-rose-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="underline font-semibold cursor-pointer"
                >
                  Paste text manually
                </button>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="opacity-60 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Video Player in Main View (Docked-Top or Floating Draggable) */}
          {showVideo && metadata?.videoId && (videoPlacement === 'docked-top' || (videoPlacement === 'sidebar' && !isSidebarOpen)) && (
            <div className="w-full">
              <VideoPlayerPanel
                metadata={metadata}
                activeTimestamp={activeTimestamp}
                seekTrigger={seekTrigger}
                onTimeUpdate={setActiveTimestamp}
                currentTheme={theme}
                size={videoSize}
                onChangeSize={handleChangeVideoSize}
                placement="docked-top"
                onChangePlacement={handleChangeVideoPlacement}
                onClose={() => setShowVideo(false)}
              />
            </div>
          )}

          {showVideo && metadata?.videoId && videoPlacement === 'floating' && (
            <VideoPlayerPanel
              metadata={metadata}
              activeTimestamp={activeTimestamp}
              seekTrigger={seekTrigger}
              onTimeUpdate={setActiveTimestamp}
              currentTheme={theme}
              size={videoSize}
              onChangeSize={handleChangeVideoSize}
              placement="floating"
              onChangePlacement={handleChangeVideoPlacement}
              onClose={() => setShowVideo(false)}
            />
          )}

          {/* Active View Content — Full Width & Open Canvas */}
          <div className="w-full">
            {activeTab === 'summary' && (
              <SummaryViewer
                summary={summary}
                isLoading={isSummarizing || isLoading}
                isContinuing={isContinuing}
                onRegenerate={handleRegenerate}
                onContinueSummary={handleContinueSummary}
                onSeekToTimestamp={handleSeekToTimestamp}
                activeTimestamp={activeTimestamp}
                onSyncTimestamp={setActiveTimestamp}
                transcriptText={fullText}
                videoTitle={metadata?.title || 'YouTube Video'}
                videoMetadata={metadata}
                transcriptSegments={segments}
                customResources={customResources}
                onRefreshCustomResources={setCustomResources}
                onAppendCustomMarkdown={handleAppendCustomMarkdown}
                provider={provider}
                onSelectProvider={handleSelectProvider}
                openRouterKey={openRouterKey}
                onSaveOpenRouterKey={handleSaveKey}
                selectedModel={selectedModel}
                selectedModelId={selectedModel.id}
                onSelectModel={setSelectedModel}
                onOpenSettings={() => setIsSettingsOpen(true)}
                currentTheme={theme}
                onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
                onOpenResearch={() => setActiveTab('research')}
                onOpenTypography={() => setIsTypographyOpen(true)}
                onOpenKnowledge={() => setActiveTab('knowledge')}
                onSaveToList={handleQuickSaveCurrentVideo}
                onSaveItemToList={handleSaveItemToList}
                onOpenLists={() => setActiveTab('lists')}
                onOpenTechWords={() => setActiveTab('techwords')}
                typography={typography}
                isFullscreen={isFullscreen}
                onToggleFullscreen={handleToggleFullscreen}
                isOptionsOpen={isMainOptionsOpen}
                onToggleOptions={() => setIsMainOptionsOpen((prev) => !prev)}
              />
            )}

            {activeTab === 'transcript' && (
              <TranscriptViewer
                segments={segments}
                metadata={metadata}
                onSeekToTimestamp={handleSeekToTimestamp}
                activeTimestamp={activeTimestamp}
                onSyncTimestamp={setActiveTimestamp}
                currentTheme={theme}
                onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
                onAppendToSummary={handleAppendCustomMarkdown}
                onSaveToList={handleSaveItemToList}
              />
            )}

            {activeTab === 'knowledge' && (
              <CrucialKnowledgePanel
                summaryMarkdown={summary?.markdown || fullText}
                videoTitle={metadata?.title || 'YouTube Video'}
                transcriptSegments={segments}
                currentTheme={theme}
                onAppendToSummary={handleAppendCustomMarkdown}
                onSaveToList={handleSaveItemToList}
                onSeekToTimestamp={handleSeekToTimestamp}
                activeTimestamp={activeTimestamp}
                onExploreTerm={(term) => {
                  setResearchInitialQuery(term);
                  setActiveTab('research');
                }}
              />
            )}

            {activeTab === 'research' && (
              <ResearchVisualsPanel
                summaryMarkdown={summary?.markdown || fullText}
                videoTitle={metadata?.title || 'YouTube Video'}
                videoMetadata={metadata}
                transcriptSegments={segments}
                customResources={customResources}
                onRefreshCustomResources={setCustomResources}
                onSeekToTimestamp={handleSeekToTimestamp}
                onAppendWebResult={handleAppendWebResult}
                onAppendImageResult={handleAppendImageResult}
                onAppendNewsResult={handleAppendNewsResult}
                onAppendBookResult={handleAppendBookResult}
                onAppendAcademicResult={handleAppendAcademicResult}
                onAppendCustomMarkdown={handleAppendCustomMarkdown}
                onAppendBatch={handleAppendBatch}
                onSaveToList={handleSaveItemToList}
                onSelectVideoUrl={(url) => {
                  setActiveTab('summary');
                  handleFetchAndSummarize(url);
                }}
                currentTheme={theme}
                initialQuery={researchInitialQuery}
              />
            )}

            {activeTab === 'scrape' && (
              <ScrapedDataViewer
                videoId={metadata?.videoId || ''}
                videoUrl={currentUrl}
                metadata={metadata}
                segments={segments}
                currentTheme={theme}
              />
            )}

            {activeTab === 'chat' && (
              <AskVideoAI
                transcript={fullText}
                videoTitle={metadata?.title || 'YouTube Video'}
                videoId={metadata?.videoId || ''}
                transcriptSegments={segments}
                provider={provider}
                openRouterKey={openRouterKey}
                selectedModelId={selectedModel.id}
                currentTheme={theme}
                onSeekToTimestamp={handleSeekToTimestamp}
                onAppendToSummary={handleAppendCustomMarkdown}
                onSaveToList={handleSaveItemToList}
              />
            )}

            {activeTab === 'lists' && (
              <SavedListsPanel
                currentTheme={theme}
                currentVideoMetadata={metadata}
                currentVideoUrl={currentUrl}
                currentSummaryMarkdown={summary?.markdown || fullText}
                currentTranscriptSegments={segments}
                savedSummaries={savedSummaries}
                customResources={customResources}
                onRefreshCustomResources={setCustomResources}
                onLoadSavedVideo={(url, savedMarkdown) => {
                  setActiveTab('summary');
                  handleFetchAndSummarize(url, savedMarkdown);
                }}
                onAppendToSummary={handleAppendCustomMarkdown}
                onOpenTechWords={() => setActiveTab('techwords')}
                user={currentUser}
              />
            )}

            {activeTab === 'techwords' && (
              <TechWordsSearcherPanel
                summaryMarkdown={summary?.markdown || fullText}
                videoTitle={metadata?.title || 'YouTube Video'}
                transcriptSegments={segments}
                currentTheme={theme}
                onAppendToSummary={handleAppendCustomMarkdown}
                onSaveToList={handleSaveItemToList}
                onOpenArtifacts={() => setActiveTab('lists')}
                onSeekToTimestamp={handleSeekToTimestamp}
                initialSearchQuery={techWordsInitialQuery}
              />
            )}

            {activeTab === 'history' && (
              <ActivityHistoryPanel
                currentTheme={theme}
                user={currentUser}
                onSignIn={handleSignInWithGoogle}
                onOpenVideoUrl={(url) => {
                  setActiveTab('summary');
                  handleFetchAndSummarize(url);
                }}
                onOpenResearchQuery={(q) => {
                  setResearchInitialQuery(q);
                  setActiveTab('research');
                }}
                onOpenWordLookup={(q) => {
                  setTechWordsInitialQuery(q);
                  setActiveTab('techwords');
                }}
                onOpenTechWordLookup={(q) => {
                  setTechWordsInitialQuery(q);
                  setActiveTab('techwords');
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Notification Toast when items are appended or saved to Artifacts Folder */}
      {appendNotice && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-slate-100 shadow-2xl text-xs">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{appendNotice}</span>
          <button
            type="button"
            onClick={() => {
              setActiveTab(appendNotice.toLowerCase().includes('artifact') || appendNotice.toLowerCase().includes('saved') ? 'lists' : 'summary');
              setAppendNotice(null);
            }}
            className="ml-2 font-semibold underline text-amber-400 hover:text-amber-300 cursor-pointer shrink-0"
          >
            {appendNotice.toLowerCase().includes('artifact') || appendNotice.toLowerCase().includes('saved')
              ? 'Open Artifacts Folder →'
              : 'View in Summary →'}
          </button>
        </div>
      )}

      {/* Real-time Synchronized Audio Narration Bottom Bar */}
      <AudioNarrationBar
        isPlaying={speechState.isPlaying}
        isPaused={speechState.isPaused}
        currentIndex={speechState.currentIndex}
        totalItems={speechState.totalItems}
        currentLabel={speechState.currentLabel}
        onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
        currentTheme={theme}
      />

      {/* Modals */}
      <VoiceSettingsModal
        isOpen={isVoiceSettingsOpen}
        onClose={() => setIsVoiceSettingsOpen(false)}
        currentTheme={theme}
      />

      <TypographySettingsModal
        isOpen={isTypographyOpen}
        onClose={() => setIsTypographyOpen(false)}
        typography={typography}
        onChangeTypography={handleSaveTypography}
        currentTheme={theme}
      />

      <OpenRouterSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        openRouterKey={openRouterKey}
        onSaveKey={handleSaveKey}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        detailLevel={detailLevel}
        onSelectDetailLevel={setDetailLevel}
        provider={provider}
        onSelectProvider={handleSelectProvider}
      />

      <ManualTranscriptModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmitManual={handleManualSubmit}
        onSubmitUrl={handleFetchAndSummarize}
      />
    </div>
  );
}
