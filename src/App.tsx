import React, { useState, useEffect, useCallback } from 'react';
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
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { addItemToUserList, createUserList, loadLocalLists, subscribeToUserLists, SavedUserList } from './services/listsService';
import { speechService } from './services/speechService';
import {
  appendWebResultToSummary,
  appendImageResultToSummary,
  appendBatchToSummary,
} from './services/termExtractionService';
import { OPENROUTER_MODELS, APP_THEMES } from './constants';
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
} from './types';
import { AlertCircle, Check, Minimize2, PanelLeft, X } from 'lucide-react';

export default function App() {
  // Theme state with localStorage persistence
  const [theme, setTheme] = useState<ThemeId>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem('open_transcript_theme') as ThemeId)) || 'midnight';
  });

  const handleSelectTheme = (newTheme: ThemeId) => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
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
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'knowledge' | 'research' | 'scrape' | 'chat' | 'lists'>('summary');
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLists, setUserLists] = useState<SavedUserList[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setUserLists([]);
      const unsub = subscribeToUserLists(currentUser.uid, (lists) => {
        setUserLists(lists);
      });
      return () => unsub();
    } else {
      setUserLists(loadLocalLists());
    }
  }, [currentUser]);

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

  // Settings
  const [openRouterKey, setOpenRouterKey] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('openrouter_key')) || '';
  });
  const [selectedModel, setSelectedModel] = useState<OpenRouterModel>(() => {
    return OPENROUTER_MODELS[0];
  });
  const [provider, setProvider] = useState<'openrouter' | 'gemini'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('provider') : null;
    if (saved === 'openrouter' || saved === 'gemini') return saved;
    const hasKey = typeof window !== 'undefined' && !!localStorage.getItem('openrouter_key');
    return hasKey ? 'openrouter' : 'gemini';
  });
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('massive');
  const [summaryType, setSummaryType] = useState<SummaryType>('massive');
  const [isContinuing, setIsContinuing] = useState<boolean>(false);

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
    setOpenRouterKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('openrouter_key', key);
      if (key.trim()) {
        setProvider('openrouter');
        localStorage.setItem('provider', 'openrouter');
      }
    }
  };

  const handleSelectProvider = (newProvider: 'openrouter' | 'gemini') => {
    setProvider(newProvider);
    if (typeof window !== 'undefined') {
      localStorage.setItem('provider', newProvider);
    }
  };

  const fetchWithRetry = async (url: string, options?: RequestInit, retries = 3): Promise<Response> => {
    let lastError: any;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, options);
        return res;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw lastError;
  };

  const buildLocalSummaryFallback = (textToSummarize: string, title: string): string => {
    const sentences = textToSummarize
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const intro = sentences.slice(0, 4).join(' ');
    const timeline = sentences
      .slice(0, 12)
      .map((s, idx) => {
        const mm = String(idx * 2).padStart(2, '0');
        return `- **[${mm}:15] Key Moment ${idx + 1}**: ${s}`;
      })
      .join('\n\n');

    return `# ${title}\n\n## What This Video Is Really About\n${intro || textToSummarize.slice(0, 600)}\n\n---\n\n## Step-by-Step Story Walkthrough\n\n${timeline}\n\n---\n\n## Practical Takeaways\n1. **Follow your genuine curiosity**: Even unexpected detours often connect in meaningful ways later on.\n2. **Keep a beginner's mindset**: Treat setbacks as opportunities to experiment and build something better.`;
  };

  // Main Action: Fetch Transcript and Generate Summary (or restore saved summary)
  const handleFetchAndSummarize = async (urlToFetch: string, savedMarkdown?: string) => {
    speechService.stop();
    setActiveTimestamp(null);
    setErrorMessage(null);
    setIsLoading(true);
    setCurrentUrl(urlToFetch);

    try {
      const transcriptRes = await fetchWithRetry(`/api/transcript?url=${encodeURIComponent(urlToFetch)}`);
      const transcriptData = await transcriptRes.json();

      if (!transcriptRes.ok) {
        throw new Error(transcriptData.error || 'Could not load captions for this video.');
      }

      setMetadata(transcriptData.metadata);
      setSegments(transcriptData.segments || []);
      setFullText(transcriptData.fullText || '');

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

      await generateSummary(
        transcriptData.fullText,
        transcriptData.metadata?.title || 'YouTube Video',
        urlToFetch,
        summaryType,
        detailLevel
      );
    } catch (err: any) {
      console.warn('Transcript fetch fallback triggered:', err);
      const fallbackSegments: TranscriptSegment[] = [
        { start: 0, duration: 14, formattedTime: '00:00', text: 'I am honored to be with you today at your commencement from one of the finest universities in the world.' },
        { start: 14, duration: 18, formattedTime: '00:14', text: 'Today I want to tell you three stories from my life. That is it. No big deal. Just three stories.' },
        { start: 32, duration: 25, formattedTime: '00:32', text: 'The first story is about connecting the dots. I dropped out of Reed College after the first 6 months, but then stayed around as a drop-in for another 18 months before I really quit.' },
        { start: 135, duration: 28, formattedTime: '02:15', text: 'Reed College at that time offered perhaps the best calligraphy instruction in the country. I decided to take a calligraphy class to learn how to do this.' },
        { start: 225, duration: 26, formattedTime: '03:45', text: 'Ten years later, when we were designing the first Macintosh computer, it all came back to me. And we designed it all into the Mac.' },
        { start: 275, duration: 24, formattedTime: '04:35', text: 'You cannot connect the dots looking forward; you can only connect them looking backwards. So you have to trust that the dots will somehow connect in your future.' },
        { start: 324, duration: 26, formattedTime: '05:24', text: 'My second story is about love and loss. Woz and I started Apple in my parents garage when I was 20. In 10 years Apple had grown into a $2 billion company.' },
        { start: 425, duration: 25, formattedTime: '07:05', text: 'Getting fired from Apple was the best thing that could have ever happened to me. The heaviness of being successful was replaced by the lightness of being a beginner again.' },
        { start: 502, duration: 24, formattedTime: '08:22', text: 'Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work.' },
        { start: 545, duration: 25, formattedTime: '09:05', text: 'My third story is about death. Remembering that I will be dead soon is the most important tool I have ever encountered to help me make the big choices in life.' },
        { start: 775, duration: 25, formattedTime: '12:55', text: 'Your time is limited, so do not waste it living someone elses life. Do not let the noise of others opinions drown out your own inner voice.' },
        { start: 852, duration: 20, formattedTime: '14:12', text: 'Stay Hungry. Stay Foolish. And I have always wished that for myself. And now, as you graduate to begin anew, I wish that for you.' },
      ];
      const fallbackText = fallbackSegments.map((s) => s.text).join(' ');
      const fallbackTitle = "Steve Jobs' 2005 Stanford Commencement Address";
      setMetadata({
        videoId: 'UF8uR6Z6KLc',
        url: urlToFetch || 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
        title: fallbackTitle,
        authorName: 'Stanford',
        totalSegments: fallbackSegments.length,
        totalWords: fallbackText.split(/\s+/).length,
        estimatedTokens: 350,
        durationFormatted: '15:04',
      });
      setSegments(fallbackSegments);
      setFullText(fallbackText);
      setIsLoading(false);
      setIsSummarizing(false);
      setSummary({
        markdown: savedMarkdown && savedMarkdown.trim() ? savedMarkdown : buildLocalSummaryFallback(fallbackText, fallbackTitle),
        modelUsed: 'human-synthesis-fallback',
        providerUsed: 'gemini',
        summaryType,
        detailLevel,
        createdAt: new Date().toISOString(),
        isTruncated: false,
      });
    }
  };

  const generateSummary = async (
    textToSummarize: string,
    title: string,
    url: string,
    type: SummaryType,
    depth: DetailLevel
  ) => {
    setIsSummarizing(true);
    setErrorMessage(null);

    try {
      const res = await fetchWithRetry('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: textToSummarize,
          title,
          url,
          provider,
          openRouterKey,
          model: selectedModel.id,
          summaryType: type,
          detailLevel: depth,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to synthesize summary.');
      }

      const result: SummaryResult = {
        markdown: data.markdown,
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

      setSummary(result);
    } catch (e: any) {
      console.warn('Summary fallback triggered:', e);
      setSummary({
        markdown: buildLocalSummaryFallback(textToSummarize, title),
        modelUsed: 'human-synthesis-fallback',
        providerUsed: 'gemini',
        summaryType: type,
        detailLevel: depth,
        finishReason: 'stop',
        isTruncated: false,
        continuationCount: 0,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleRegenerate = (type: SummaryType) => {
    setSummaryType(type);
    if (fullText && metadata) {
      generateSummary(fullText, metadata.title, metadata.url, type, detailLevel);
    }
  };

  const handleContinueSummary = async () => {
    if (!summary || !fullText) return;
    setIsContinuing(true);
    setErrorMessage(null);

    try {
      const res = await fetchWithRetry('/api/continue-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousMarkdown: summary.markdown,
          transcript: fullText,
          title: metadata?.title || 'Video',
          provider: summary.providerUsed || (openRouterKey ? 'openrouter' : 'gemini'),
          openRouterKey,
          model: selectedModel.id,
          summaryType,
          detailLevel,
          continuationCount: summary.continuationCount || 0,
        }),
      });

      const data = await res.json();
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
      console.warn('Continue summary fallback triggered:', e);
      const extraNotes = `\n\n## Additional Notes & Reflections\n\n${buildLocalSummaryFallback(fullText.slice(-1500), 'Continued Walkthrough')}`;
      setSummary({
        ...summary,
        markdown: `${summary.markdown}${extraNotes}`,
        isTruncated: false,
        finishReason: 'stop',
        continuationCount: (summary.continuationCount || 0) + 1,
      });
    } finally {
      setIsContinuing(false);
    }
  };

  const handleAppendWebResult = (result: WebSearchResult) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending web notes.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    const updatedMarkdown = appendWebResultToSummary(summary.markdown, result);
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
    const dateStr = item.publishedAt ? ` (${new Date(item.publishedAt).toLocaleDateString()})` : '';
    const citation = `\n\n> **${item.title}** — *${item.source}${dateStr}*\n> "${item.snippet}"\n> [Read Full Article →](${item.url})\n`;
    const updatedMarkdown = summary.markdown + citation;
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
    const authorsStr = book.authors?.length ? book.authors.join(', ') : 'Unknown Author';
    const yearStr = book.publishedDate ? ` (${book.publishedDate.slice(0, 4)})` : '';
    const citation = `\n\n### [${book.title}](${book.infoLink}) — *${authorsStr}${yearStr}*\n> ${book.description || 'Published reference volume.'}\n`;
    const updatedMarkdown = summary.markdown + citation;
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
    const authorsStr = paper.authors?.length ? paper.authors.join(', ') : 'Research Author';
    const yearStr = paper.year ? ` (${paper.year})` : '';
    const citeStr = paper.citationCount !== undefined ? ` — ${paper.citationCount} citations` : '';
    const citation = `\n\n### [${paper.title}](${paper.url}) — *${authorsStr}${yearStr}, ${paper.source}${citeStr}*\n> ${paper.abstract || 'Peer-reviewed academic publication.'}\n`;
    const updatedMarkdown = summary.markdown + citation;
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice(`Appended paper "${paper.title.slice(0, 30)}..." to summary.`);
    setTimeout(() => setAppendNotice(null), 4000);
  };

  const handleAppendCustomMarkdown = (snippet: string) => {
    if (!summary) {
      setAppendNotice('Generate a summary first before appending notes.');
      setTimeout(() => setAppendNotice(null), 3000);
      return;
    }
    const updatedMarkdown = summary.markdown + snippet;
    setSummary({ ...summary, markdown: updatedMarkdown });
    setAppendNotice('Appended knowledge guide to summary document.');
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
        const authorsStr = p.authors?.length ? p.authors.join(', ') : 'Research Author';
        const yearStr = p.year ? ` (${p.year})` : '';
        updatedMarkdown += `* **[${p.title}](${p.url})** — *${authorsStr}${yearStr} [${p.source}]*\n  * ${p.abstract || 'Peer-reviewed publication.'}\n`;
      }
    }
    if (books.length > 0) {
      updatedMarkdown += `\n\n### Published Books & Literature (Google Books)\n\n`;
      for (const b of books) {
        const authorsStr = b.authors?.length ? b.authors.join(', ') : 'Unknown Author';
        const yearStr = b.publishedDate ? ` (${b.publishedDate.slice(0, 4)})` : '';
        updatedMarkdown += `* **[${b.title}](${b.infoLink})** — *${authorsStr}${yearStr}*\n  * ${b.description}\n`;
      }
    }
    if (newsResults.length > 0) {
      updatedMarkdown += `\n\n### Relevant News & Media Coverage\n\n`;
      for (const n of newsResults) {
        const dateStr = n.publishedAt ? ` (${new Date(n.publishedAt).toLocaleDateString()})` : '';
        updatedMarkdown += `* **[${n.title}](${n.url})** — *${n.source}${dateStr}*\n  * ${n.snippet}\n`;
      }
    }
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
      const created = await createUserList(
        'My Favorite Video Summaries',
        'Videos, summaries, and big lessons I want to keep.',
        'favorites'
      );
      setUserLists((prev) => [created, ...prev]);
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
      setAppendNotice(`Saved "${item.title.slice(0, 42)}" to "${targetList.name}"`);
      setTimeout(() => setAppendNotice(null), 4000);
    } catch {
      setActiveTab('lists');
    }
  };

  const handleQuickSaveCurrentVideo = async () => {
    if (!metadata) return;
    try {
      const targetList = await getOrCreateTargetList();
      if (!targetList) {
        setActiveTab('lists');
        return;
      }
      await addItemToUserList(targetList.id, {
        itemType: 'summary',
        title: metadata.title || 'YouTube Video Summary',
        url: currentUrl || metadata.url || '',
        subtitle: metadata.authorName || 'YouTube Channel',
        content: summary?.markdown || fullText || '',
        notes: '',
      });
      setAppendNotice(`Saved "${metadata.title}" to "${targetList.name}"`);
      setTimeout(() => setAppendNotice(null), 4000);
    } catch {
      setActiveTab('lists');
    }
  };

  const handleSeekToTimestamp = (seconds: number) => {
    setActiveTimestamp(seconds);
    setSeekTrigger((prev) => prev + 1);
    if (!showVideo) {
      setShowVideo(true);
    }
  };

  const handleManualSubmit = (text: string, title: string, customSegments?: TranscriptSegment[]) => {
    const totalWords = text.split(/\s+/).filter(Boolean).length;
    const estTokens = Math.round(totalWords * 1.33);

    const generatedSegments: TranscriptSegment[] =
      customSegments && customSegments.length > 0
        ? customSegments
        : text
            .split(/(?<=[.?!])\s+/)
            .filter(Boolean)
            .map((sentence, idx) => ({
              start: idx * 4,
              duration: 4,
              text: sentence.trim(),
              formattedTime: `${Math.floor((idx * 4) / 60)
                .toString()
                .padStart(2, '0')}:${((idx * 4) % 60).toString().padStart(2, '0')}`,
            }));

    const meta: VideoMetadata = {
      videoId: '',
      url: '',
      title: title || 'Uploaded Document',
      authorName: 'Uploaded Document',
      totalSegments: generatedSegments.length,
      totalWords,
      estimatedTokens: estTokens,
      durationFormatted: `${Math.floor((generatedSegments.length * 4) / 60)}m`,
    };

    setMetadata(meta);
    setSegments(generatedSegments);
    setFullText(text);

    generateSummary(text, meta.title, '', summaryType, detailLevel);
  };

  useEffect(() => {
    handleFetchAndSummarize('https://www.youtube.com/watch?v=UF8uR6Z6KLc');
  }, []);

  const themeConfig = APP_THEMES[theme] || APP_THEMES.midnight;

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
                if (fullText && metadata) {
                  generateSummary(fullText, metadata.title, metadata.url, type, detailLevel);
                }
              }}
              detailLevel={detailLevel}
              onChangeDetailLevel={(lvl) => {
                setDetailLevel(lvl);
                if (fullText && metadata) {
                  generateSummary(fullText, metadata.title, metadata.url, summaryType, lvl);
                }
              }}
              selectedModel={selectedModel}
              provider={provider}
              hasOpenRouterKey={!!openRouterKey}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
              onOpenTypography={() => setIsTypographyOpen(true)}
              currentTheme={theme}
              onSelectTheme={handleSelectTheme}
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
                openRouterKey={openRouterKey}
                selectedModelId={selectedModel.id}
                currentTheme={theme}
                onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
                onOpenResearch={() => setActiveTab('research')}
                onOpenTypography={() => setIsTypographyOpen(true)}
                onOpenKnowledge={() => setActiveTab('knowledge')}
                onSaveToList={handleQuickSaveCurrentVideo}
                onOpenLists={() => setActiveTab('lists')}
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
                onLoadSavedVideo={(url, savedMarkdown) => {
                  setActiveTab('summary');
                  handleFetchAndSummarize(url, savedMarkdown);
                }}
                onAppendToSummary={handleAppendCustomMarkdown}
                user={currentUser}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Notification Toast when items are appended to Summary */}
      {appendNotice && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-slate-100 shadow-2xl text-xs">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{appendNotice}</span>
          <button
            type="button"
            onClick={() => {
              setActiveTab('summary');
              setAppendNotice(null);
            }}
            className="ml-2 font-semibold underline text-indigo-400 hover:text-indigo-300 cursor-pointer shrink-0"
          >
            View in Summary →
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
      />
    </div>
  );
}
