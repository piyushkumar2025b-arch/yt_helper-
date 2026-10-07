import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Image as ImageIcon,
  Globe,
  Plus,
  Check,
  ExternalLink,
  Loader2,
  Maximize2,
  X,
  Layers,
  Newspaper,
  BookOpen,
  Play,
  ChevronDown,
  FileText,
  Code2,
  MessageSquare,
  Headphones,
  Star,
  GitFork,
  CheckCircle2,
  Bookmark,
  Clock,
  Sparkles,
  Link2,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import {
  WebSearchResult,
  ImageSearchResult,
  NewsSearchResult,
  BookSearchResult,
  YouTubeSearchResult,
  AcademicPaperResult,
  GitHubRepoResult,
  CommunityDiscussionResult,
  PodcastDatasetResult,
  ExactVideoResource,
  VideoMetadata,
  TranscriptSegment,
  ThemeId,
} from '../types';
import { APP_THEMES } from '../constants';
import { extractSmartTermsFromSummary } from '../services/termExtractionService';
import { extractExactVideoResources } from '../services/exactResourceExtractor';
import {
  createCustomExactResource,
  deleteCustomExactResource,
  loadLocalCustomResources,
  recordUserActivity,
} from '../services/listsService';
import { SmartImage } from './SmartImage';

interface ResearchVisualsPanelProps {
  summaryMarkdown: string;
  videoTitle: string;
  videoMetadata?: VideoMetadata | null;
  transcriptSegments?: TranscriptSegment[];
  customResources?: ExactVideoResource[];
  onRefreshCustomResources?: (resources: ExactVideoResource[]) => void;
  onSeekToTimestamp?: (seconds: number) => void;
  onAppendWebResult: (result: WebSearchResult) => void;
  onAppendImageResult: (image: ImageSearchResult) => void;
  onAppendNewsResult?: (news: NewsSearchResult) => void;
  onAppendBookResult?: (book: BookSearchResult) => void;
  onAppendAcademicResult?: (paper: AcademicPaperResult) => void;
  onAppendCustomMarkdown?: (snippet: string, noticeLabel?: string) => void;
  onAppendBatch: (
    webResults: WebSearchResult[],
    images: ImageSearchResult[],
    newsResults?: NewsSearchResult[],
    books?: BookSearchResult[],
    papers?: AcademicPaperResult[]
  ) => void;
  onSelectVideoUrl?: (url: string) => void;
  onSaveToList?: (item: {
    itemType: 'video' | 'summary' | 'book' | 'article' | 'note';
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }) => void;
  currentTheme?: ThemeId;
  initialQuery?: string;
}

export const ResearchVisualsPanel: React.FC<ResearchVisualsPanelProps> = ({
  summaryMarkdown,
  videoTitle,
  videoMetadata = null,
  transcriptSegments = [],
  customResources: externalCustomResources,
  onRefreshCustomResources,
  onSeekToTimestamp,
  onAppendWebResult,
  onAppendImageResult,
  onAppendNewsResult,
  onAppendBookResult,
  onAppendAcademicResult,
  onAppendCustomMarkdown,
  onAppendBatch,
  onSelectVideoUrl,
  onSaveToList,
  currentTheme = 'midnight',
  initialQuery,
}) => {
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [activeQuery, setActiveQuery] = useState(initialQuery || '');
  const [activeTab, setActiveTab] = useState<
    | 'all'
    | 'exact'
    | 'papers'
    | 'code'
    | 'discussions'
    | 'podcasts'
    | 'books'
    | 'videos'
    | 'web'
    | 'news'
    | 'images'
  >('all');

  // Custom user-added exact resources synced with Firebase Firestore
  const [localCustomResources, setLocalCustomResources] = useState<ExactVideoResource[]>(() =>
    loadLocalCustomResources()
  );
  const customResources = externalCustomResources ?? localCustomResources;

  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<ExactVideoResource['type']>('Custom Resource');
  const [newSourceAuthor, setNewSourceAuthor] = useState('');
  const [newSourceTimestamp, setNewSourceTimestamp] = useState('');
  const [newSourceDescription, setNewSourceDescription] = useState('');
  const [newSourceQuote, setNewSourceQuote] = useState('');

  const extractedExactResources = React.useMemo(() => {
    return extractExactVideoResources(videoMetadata, transcriptSegments, summaryMarkdown);
  }, [videoMetadata, transcriptSegments, summaryMarkdown]);

  const exactResources = React.useMemo(() => {
    return [...customResources, ...extractedExactResources];
  }, [customResources, extractedExactResources]);

  const handleAddCustomResource = async (e: React.FormEvent, alsoAppendToSummary: boolean = false) => {
    e.preventDefault();
    const cleanTitle = newSourceTitle.trim();
    if (!cleanTitle) return;
    const rawUrl = newSourceUrl.trim();
    const finalUrl = rawUrl
      ? /^https?:\/\//i.test(rawUrl)
        ? rawUrl
        : `https://${rawUrl}`
      : `https://www.google.com/search?q=${encodeURIComponent(cleanTitle)}`;

    let formattedTime: string | undefined;
    if (newSourceTimestamp.trim()) {
      const parts = newSourceTimestamp.trim().replace(/[\[\]]/g, '').split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        formattedTime = `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
      }
    }

    const created = await createCustomExactResource({
      videoId: videoMetadata?.videoId || '',
      title: cleanTitle,
      type: newSourceType,
      description:
        newSourceDescription.trim() ||
        `User-added exact resource for "${videoTitle}".`,
      exactQuote: newSourceQuote.trim() || undefined,
      formattedTime,
      primaryUrl: finalUrl,
      authorOrCreator: newSourceAuthor.trim() || undefined,
    });

    const next = [created, ...customResources.filter((r) => r.id !== created.id)];
    setLocalCustomResources(next);
    onRefreshCustomResources?.(next);

    if (alsoAppendToSummary && onAppendCustomMarkdown) {
      const md = `\n\n### [${created.title}](${created.primaryUrl}) — *${created.type}${
        created.authorOrCreator ? ` · ${created.authorOrCreator}` : ''
      }${created.formattedTime ? ` · [${created.formattedTime}]` : ''}*\n${created.description}${
        created.exactQuote ? `\n> "${created.exactQuote}"` : ''
      }\n`;
      onAppendCustomMarkdown(md, `Saved "${created.title}" to Firebase & Summary`);
      setAppendedIds((prev) => new Set(prev).add(created.id));
    }

    setNewSourceTitle('');
    setNewSourceUrl('');
    setNewSourceAuthor('');
    setNewSourceTimestamp('');
    setNewSourceDescription('');
    setNewSourceQuote('');
    setIsAddSourceOpen(false);
  };

  const handleDeleteCustomResource = async (id: string) => {
    await deleteCustomExactResource(id);
    const next = customResources.filter((r) => r.id !== id);
    setLocalCustomResources(next);
    onRefreshCustomResources?.(next);
  };

  const handleAppendExactResource = (res: ExactVideoResource) => {
    if (onAppendCustomMarkdown) {
      const md = `\n\n### [${res.title}](${res.primaryUrl}) — *${res.type}${
        res.authorOrCreator ? ` · ${res.authorOrCreator}` : ''
      }${res.formattedTime ? ` · [${res.formattedTime}]` : ''}*\n${res.description}${
        res.exactQuote ? `\n> "${res.exactQuote}"` : ''
      }\n`;
      onAppendCustomMarkdown(md, `Added exact resource "${res.title}" to Summary`);
    }
    setAppendedIds((prev) => new Set(prev).add(res.id));
  };

  const [academicResults, setAcademicResults] = useState<AcademicPaperResult[]>([]);
  const [codeResults, setCodeResults] = useState<GitHubRepoResult[]>([]);
  const [discussionResults, setDiscussionResults] = useState<CommunityDiscussionResult[]>([]);
  const [podcastResults, setPodcastResults] = useState<PodcastDatasetResult[]>([]);
  const [webResults, setWebResults] = useState<WebSearchResult[]>([]);
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
  const [newsResults, setNewsResults] = useState<NewsSearchResult[]>([]);
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [ytResults, setYtResults] = useState<YouTubeSearchResult[]>([]);

  // Pagination & Infinite Scroll state
  const [page, setPage] = useState<number>(0);
  const [ytNextPageToken, setYtNextPageToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [appendedIds, setAppendedIds] = useState<Set<string>>(new Set());
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<ImageSearchResult | null>(null);

  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const consecutiveZeroAddsRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, []);

  const smartTerms = React.useMemo(() => {
    return extractSmartTermsFromSummary(summaryMarkdown, videoTitle);
  }, [summaryMarkdown, videoTitle]);

  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      performSearch(initialQuery, true);
    } else if (smartTerms.length > 0 && !searchQuery) {
      const initialTerm = smartTerms[0];
      setSearchQuery(initialTerm);
      performSearch(initialTerm, false);
    }
  }, [smartTerms.length, initialQuery]);

  const performSearch = async (termToSearch: string, isUserInitiated: boolean = true) => {
    const q = termToSearch.trim();
    if (!q) return;

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsLoading(true);
    isFetchingRef.current = true;
    setErrorMsg(null);
    setActiveQuery(q);
    setPage(0);
    setYtNextPageToken(null);
    setHasMore(true);
    setBrokenImageIds(new Set());
    consecutiveZeroAddsRef.current = 0;

    try {
      const storedYtKey = typeof window !== 'undefined' ? localStorage.getItem('youtube_api_key') : null;
      const safeFetchJson = async (url: string, headers?: Record<string, string>) => {
        try {
          const r = await fetch(url, { signal: controller.signal, headers });
          if (!r.ok) return { ok: false, data: {} };
          const d = await r.json().catch(() => ({}));
          return { ok: true, data: d };
        } catch {
          return { ok: false, data: {} };
        }
      };

      const ytHeaders = storedYtKey ? { 'x-youtube-api-key': storedYtKey } : undefined;

      const [acadRes, codeRes, commRes, podRes, webRes, imgRes, newsRes, booksRes, ytRes] =
        await Promise.all([
          safeFetchJson(`/api/academic-search?q=${encodeURIComponent(q)}&page=0`),
          safeFetchJson(`/api/github-search?q=${encodeURIComponent(q)}&page=0`),
          safeFetchJson(`/api/community-search?q=${encodeURIComponent(q)}&page=0`),
          safeFetchJson(`/api/podcasts-datasets?q=${encodeURIComponent(q)}&page=0`),
          safeFetchJson(`/api/web-search?q=${encodeURIComponent(q)}&page=0`),
          safeFetchJson(`/api/image-search?q=${encodeURIComponent(q)}&page=0`),
          safeFetchJson(`/api/news-search?q=${encodeURIComponent(q)}&page=0`),
          safeFetchJson(`/api/books-search?q=${encodeURIComponent(q)}&page=0`),
          safeFetchJson(`/api/youtube-search?q=${encodeURIComponent(q)}&page=0`, ytHeaders),
        ]);

      if (controller.signal.aborted) return;

      setAcademicResults(acadRes.ok && Array.isArray(acadRes.data.papers) ? acadRes.data.papers : []);
      setCodeResults(codeRes.ok && Array.isArray(codeRes.data.repos) ? codeRes.data.repos : []);
      setDiscussionResults(
        commRes.ok && Array.isArray(commRes.data.discussions) ? commRes.data.discussions : []
      );
      setPodcastResults(podRes.ok && Array.isArray(podRes.data.items) ? podRes.data.items : []);
      setWebResults(webRes.ok && Array.isArray(webRes.data.results) ? webRes.data.results : []);
      setImageResults(imgRes.ok && Array.isArray(imgRes.data.images) ? imgRes.data.images : []);
      setNewsResults(newsRes.ok && Array.isArray(newsRes.data.news) ? newsRes.data.news : []);
      setBookResults(booksRes.ok && Array.isArray(booksRes.data.books) ? booksRes.data.books : []);
      setYtResults(ytRes.ok && Array.isArray(ytRes.data.videos) ? ytRes.data.videos : []);
      setYtNextPageToken(ytRes.data.nextPageToken || null);

      if (isUserInitiated) {
        const totalFound =
          (acadRes.data?.papers?.length || 0) +
          (webRes.data?.results?.length || 0) +
          (booksRes.data?.books?.length || 0) +
          (newsRes.data?.news?.length || 0);
        recordUserActivity({
          actionType: 'search',
          title: `Multi-Source Research Search: ${q}`,
          query: q,
          details: `Searched 55+ academic, web, book, code & news sources for "${q}" (${totalFound}+ primary results).`,
          videoId: videoMetadata?.videoId || '',
          videoTitle,
        }).catch(() => {});
      }
    } catch {
      // handled per-request
    } finally {
      if (searchAbortRef.current === controller) {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    }
  };

  const loadMoreResults = useCallback(async () => {
    if (isFetchingRef.current || isLoading || isLoadingMore || !activeQuery || !hasMore) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const storedYtKey = typeof window !== 'undefined' ? localStorage.getItem('youtube_api_key') : null;
      const ytTokenParam = ytNextPageToken ? `&pageToken=${encodeURIComponent(ytNextPageToken)}` : '';
      const ytHeaders = storedYtKey ? { 'x-youtube-api-key': storedYtKey } : undefined;
      const [acadRes, codeRes, commRes, podRes, webRes, imgRes, newsRes, booksRes, ytRes] =
        await Promise.all([
          fetch(`/api/academic-search?q=${encodeURIComponent(activeQuery)}&page=${nextPage}`),
          fetch(`/api/github-search?q=${encodeURIComponent(activeQuery)}&page=${nextPage}`),
          fetch(`/api/community-search?q=${encodeURIComponent(activeQuery)}&page=${nextPage}`),
          fetch(`/api/podcasts-datasets?q=${encodeURIComponent(activeQuery)}&page=${nextPage}`),
          fetch(`/api/web-search?q=${encodeURIComponent(activeQuery)}&page=${nextPage}`),
          fetch(`/api/image-search?q=${encodeURIComponent(activeQuery)}&page=${nextPage}`),
          fetch(`/api/news-search?q=${encodeURIComponent(activeQuery)}&page=${nextPage}`),
          fetch(`/api/books-search?q=${encodeURIComponent(activeQuery)}&page=${nextPage}`),
          fetch(
            `/api/youtube-search?q=${encodeURIComponent(activeQuery)}&page=${nextPage}${ytTokenParam}`,
            { headers: ytHeaders }
          ),
        ]);

      const [acadData, codeData, commData, podData, webData, imgData, newsData, booksData, ytData] =
        await Promise.all([
          acadRes.json().catch(() => ({})),
          codeRes.json().catch(() => ({})),
          commRes.json().catch(() => ({})),
          podRes.json().catch(() => ({})),
          webRes.json().catch(() => ({})),
          imgRes.json().catch(() => ({})),
          newsRes.json().catch(() => ({})),
          booksRes.json().catch(() => ({})),
          ytRes.json().catch(() => ({})),
        ]);

      let addedCount = 0;

      if (acadRes.ok && Array.isArray(acadData.papers) && acadData.papers.length > 0) {
        setAcademicResults((prev) => {
          const existingTitles = new Set(prev.map((x) => x.title.toLowerCase()));
          const fresh = acadData.papers.filter(
            (x: AcademicPaperResult) => !existingTitles.has(x.title.toLowerCase())
          );
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
      }

      if (codeRes.ok && Array.isArray(codeData.repos) && codeData.repos.length > 0) {
        setCodeResults((prev) => {
          const existingUrls = new Set(prev.map((x) => x.url));
          const fresh = codeData.repos.filter((x: GitHubRepoResult) => !existingUrls.has(x.url));
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
      }

      if (commRes.ok && Array.isArray(commData.discussions) && commData.discussions.length > 0) {
        setDiscussionResults((prev) => {
          const existingUrls = new Set(prev.map((x) => x.url));
          const fresh = commData.discussions.filter(
            (x: CommunityDiscussionResult) => !existingUrls.has(x.url)
          );
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
      }

      if (podRes.ok && Array.isArray(podData.items) && podData.items.length > 0) {
        setPodcastResults((prev) => {
          const existingUrls = new Set(prev.map((x) => x.url));
          const fresh = podData.items.filter((x: PodcastDatasetResult) => !existingUrls.has(x.url));
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
      }

      if (webRes.ok && Array.isArray(webData.results) && webData.results.length > 0) {
        setWebResults((prev) => {
          const existingUrls = new Set(prev.map((x) => x.url));
          const fresh = webData.results.filter((x: WebSearchResult) => !existingUrls.has(x.url));
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
      }

      if (imgRes.ok && Array.isArray(imgData.images) && imgData.images.length > 0) {
        setImageResults((prev) => {
          const existingUrls = new Set(prev.map((x) => x.url));
          const fresh = imgData.images.filter((x: ImageSearchResult) => !existingUrls.has(x.url));
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
      }

      if (newsRes.ok && Array.isArray(newsData.news) && newsData.news.length > 0) {
        setNewsResults((prev) => {
          const existingUrls = new Set(prev.map((x) => x.url));
          const fresh = newsData.news.filter((x: NewsSearchResult) => !existingUrls.has(x.url));
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
      }

      if (booksRes.ok && Array.isArray(booksData.books) && booksData.books.length > 0) {
        setBookResults((prev) => {
          const existingIds = new Set(prev.map((x) => `${x.title.toLowerCase()}-${x.authors[0] || ''}`));
          const fresh = booksData.books.filter(
            (x: BookSearchResult) => !existingIds.has(`${x.title.toLowerCase()}-${x.authors[0] || ''}`)
          );
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
      }

      if (ytRes.ok && Array.isArray(ytData.videos) && ytData.videos.length > 0) {
        setYtResults((prev) => {
          const existingIds = new Set(prev.map((x) => x.videoId));
          const fresh = ytData.videos.filter((x: YouTubeSearchResult) => !existingIds.has(x.videoId));
          addedCount += fresh.length;
          return [...prev, ...fresh];
        });
        setYtNextPageToken(ytData.nextPageToken || null);
      }

      setPage(nextPage);

      const anySourceReturnedItems =
        (acadData.papers?.length || 0) > 0 ||
        (codeData.repos?.length || 0) > 0 ||
        (commData.discussions?.length || 0) > 0 ||
        (podData.items?.length || 0) > 0 ||
        (webData.results?.length || 0) > 0 ||
        (imgData.images?.length || 0) > 0 ||
        (newsData.news?.length || 0) > 0 ||
        (booksData.books?.length || 0) > 0 ||
        (ytData.videos?.length || 0) > 0;

      if (addedCount === 0) {
        consecutiveZeroAddsRef.current += 1;
      } else {
        consecutiveZeroAddsRef.current = 0;
      }

      if ((!anySourceReturnedItems && addedCount === 0) || consecutiveZeroAddsRef.current >= 2) {
        setHasMore(false);
      }
    } catch (e) {
      // ignore transient pagination error
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [activeQuery, hasMore, isLoading, isLoadingMore, page, ytNextPageToken]);

  // Automatic Infinite Scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting && !isLoading && !isLoadingMore && hasMore && activeQuery) {
          loadMoreResults();
        }
      },
      {
        root: null,
        rootMargin: '700px',
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreResults, isLoading, isLoadingMore, hasMore, activeQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim());
    }
  };

  const handleSelectChip = (term: string) => {
    setSearchQuery(term);
    performSearch(term);
  };

  const handleAppendWeb = (item: WebSearchResult) => {
    onAppendWebResult(item);
    setAppendedIds((prev) => new Set(prev).add(item.id));
  };

  const handleAppendImage = (item: ImageSearchResult) => {
    onAppendImageResult(item);
    setAppendedIds((prev) => new Set(prev).add(item.id));
  };

  const handleAppendNews = (item: NewsSearchResult) => {
    if (onAppendNewsResult) {
      onAppendNewsResult(item);
    }
    setAppendedIds((prev) => new Set(prev).add(item.id));
  };

  const handleAppendBook = (item: BookSearchResult) => {
    if (onAppendBookResult) {
      onAppendBookResult(item);
    }
    setAppendedIds((prev) => new Set(prev).add(item.id));
  };

  const handleAppendPaper = (item: AcademicPaperResult) => {
    if (onAppendAcademicResult) {
      onAppendAcademicResult(item);
    }
    setAppendedIds((prev) => new Set(prev).add(item.id));
  };

  const handleAppendCode = (repo: GitHubRepoResult) => {
    if (onAppendCustomMarkdown) {
      const snippet = `\n\n### [${repo.fullName}](${repo.url}) — *${repo.source} (${repo.language || 'Code'}) · ★ ${repo.stars.toLocaleString()}*\n> ${repo.description}\n`;
      onAppendCustomMarkdown(snippet);
    }
    setAppendedIds((prev) => new Set(prev).add(repo.id));
  };

  const handleAppendDiscussion = (disc: CommunityDiscussionResult) => {
    if (onAppendCustomMarkdown) {
      const snippet = `\n\n> **[${disc.title}](${disc.url})** — *${disc.community} (${disc.score} pts · ${disc.commentsCount} replies)*\n> "${disc.snippet}"\n`;
      onAppendCustomMarkdown(snippet);
    }
    setAppendedIds((prev) => new Set(prev).add(disc.id));
  };

  const handleAppendPodcast = (item: PodcastDatasetResult) => {
    if (onAppendCustomMarkdown) {
      const snippet = `\n\n### [${item.title}](${item.url}) — *${item.category} by ${item.creator}*\n> ${item.description}\n`;
      onAppendCustomMarkdown(snippet);
    }
    setAppendedIds((prev) => new Set(prev).add(item.id));
  };

  const handleAppendAll = () => {
    const unappendedWeb = webResults.filter((w) => !appendedIds.has(w.id));
    const unappendedImg = imageResults.filter((i) => !appendedIds.has(i.id));
    const unappendedNews = newsResults.filter((n) => !appendedIds.has(n.id));
    const unappendedBooks = bookResults.filter((b) => !appendedIds.has(b.id));
    const unappendedPapers = academicResults.filter((p) => !appendedIds.has(p.id));

    onAppendBatch(unappendedWeb, unappendedImg, unappendedNews, unappendedBooks, unappendedPapers);

    const newSet = new Set(appendedIds);
    unappendedWeb.forEach((w) => newSet.add(w.id));
    unappendedImg.forEach((i) => newSet.add(i.id));
    unappendedNews.forEach((n) => newSet.add(n.id));
    unappendedBooks.forEach((b) => newSet.add(b.id));
    unappendedPapers.forEach((p) => newSet.add(p.id));
    setAppendedIds(newSet);
  };

  const totalCount =
    exactResources.length +
    academicResults.length +
    codeResults.length +
    discussionResults.length +
    podcastResults.length +
    webResults.length +
    imageResults.length +
    newsResults.length +
    bookResults.length +
    ytResults.length;

  const currentLookupTerm = (activeQuery || searchQuery || videoTitle || 'Research').trim();
  const directExternalSources = [
    {
      name: 'Google Scholar',
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'Semantic Scholar',
      url: `https://www.semanticscholar.org/search?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'arXiv.org',
      url: `https://arxiv.org/search/?query=${encodeURIComponent(currentLookupTerm)}&searchtype=all`,
    },
    {
      name: 'Connected Papers',
      url: `https://www.connectedpapers.com/search?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'Consensus AI',
      url: `https://consensus.app/results/?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'OpenLibrary',
      url: `https://openlibrary.org/search?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'Project Gutenberg',
      url: `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'Internet Archive',
      url: `https://archive.org/search?query=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'WorldCat Books',
      url: `https://search.worldcat.org/search?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'GitHub Code',
      url: `https://github.com/search?q=${encodeURIComponent(currentLookupTerm)}&type=repositories`,
    },
    {
      name: 'HuggingFace Hub',
      url: `https://huggingface.co/search/full-text?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'Papers With Code',
      url: `https://paperswithcode.com/search?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'PyPI Python',
      url: `https://pypi.org/search/?q=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'Wikipedia',
      url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'Wikidata Graph',
      url: `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(currentLookupTerm)}`,
    },
    {
      name: 'Library of Congress',
      url: `https://www.loc.gov/search/?q=${encodeURIComponent(currentLookupTerm)}`,
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Unboxed Header and Search Controls */}
      <div className={`pb-3 border-b ${themeConfig.borderLight} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
              Exact Video Resources &amp; 55+ Live Research Sources
            </h2>
            <p className={`text-[11px] ${themeConfig.textMuted}`}>
              Explore exact books, papers, datasets, and timestamped mentions from this video—plus live academic, code, book, podcast, and community sources.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAddSourceOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                isAddSourceOpen
                  ? `${themeConfig.accentBg} ${themeConfig.accent}`
                  : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>{isAddSourceOpen ? 'Close Form' : '+ Add Exact Resource / Source'}</span>
            </button>

            {(academicResults.length > 0 ||
              webResults.length > 0 ||
              imageResults.length > 0 ||
              newsResults.length > 0 ||
              bookResults.length > 0) && (
              <button
                type="button"
                onClick={handleAppendAll}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded ${themeConfig.primaryButton} text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
              >
                <Layers className="w-3 h-3" />
                <span>+ Add All to Summary ({totalCount - ytResults.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Add Custom Exact Resource / Source Form */}
        {isAddSourceOpen && (
          <form
            onSubmit={(e) => handleAddCustomResource(e, false)}
            className={`p-3 rounded-lg border ${themeConfig.borderLight} bg-slate-500/5 space-y-2.5`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${themeConfig.textPrimary} flex items-center gap-1.5`}>
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                Add Exact Resource or Custom Source
              </span>
              <button
                type="button"
                onClick={() => setIsAddSourceOpen(false)}
                className={`text-[11px] ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={newSourceTitle}
                onChange={(e) => setNewSourceTitle(e.target.value)}
                placeholder="Resource Title (e.g. Neural Networks Book, Paper, Repo) *"
                className={`px-2.5 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none`}
              />
              <input
                type="text"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="Exact URL / Link (https://... or leave blank to auto-link)"
                className={`px-2.5 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none`}
              />
              <select
                value={newSourceType}
                onChange={(e) => setNewSourceType(e.target.value as ExactVideoResource['type'])}
                className={`px-2.5 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
              >
                <option value="Custom Resource">Custom Exact Resource</option>
                <option value="Book / Publication">Book / Publication</option>
                <option value="Research Paper">Research Paper</option>
                <option value="Tool / Framework">Tool / Code / Framework</option>
                <option value="Dataset / Benchmark">Dataset / Benchmark</option>
                <option value="Person / Pioneer">Person / Pioneer</option>
                <option value="Organization / Lab">Organization / Lab</option>
                <option value="Historical / Key Reference">Historical / Key Reference</option>
                <option value="Primary Video Source">Primary Video Citation</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newSourceAuthor}
                onChange={(e) => setNewSourceAuthor(e.target.value)}
                placeholder="Author / Creator (optional)"
                className={`px-2.5 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none`}
              />
              <input
                type="text"
                value={newSourceTimestamp}
                onChange={(e) => setNewSourceTimestamp(e.target.value)}
                placeholder="Video Timestamp (e.g. 04:15, optional)"
                className={`px-2.5 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none`}
              />
              <input
                type="text"
                value={newSourceQuote}
                onChange={(e) => setNewSourceQuote(e.target.value)}
                placeholder="Exact quote or context from video (optional)"
                className={`px-2.5 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={newSourceDescription}
                onChange={(e) => setNewSourceDescription(e.target.value)}
                placeholder="Why this resource matters or key details..."
                className={`flex-1 min-w-[220px] px-2.5 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-45 focus:outline-none`}
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  + Add to Exact Resources
                </button>
                <button
                  type="button"
                  onClick={(e) => handleAddCustomResource(e as any, true)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold ${themeConfig.primaryButton} cursor-pointer`}
                >
                  + Add to Resources &amp; Summary
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Topic Suggestions */}
        {smartTerms.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] ${themeConfig.textMuted}`}>Topics:</span>
            {smartTerms.map((term, idx) => {
              const isActive = searchQuery.toLowerCase() === term.toLowerCase();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectChip(term)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer truncate max-w-[220px] ${
                    isActive
                      ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                      : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15`
                  }`}
                >
                  {term}
                </button>
              );
            })}
          </div>
        )}

        {/* Search Input & Tabs */}
        <div className="flex flex-col gap-2.5">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 w-full max-w-xl">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across 55+ sources: papers, books, GitHub, HuggingFace, PyPI, Reddit, LOC..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none`}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1 whitespace-nowrap ${
                isLoading || !searchQuery.trim()
                  ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-400'
                  : `${themeConfig.primaryButton}`
              }`}
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
          </form>

          {/* Direct External Engines Lookup Bar */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${themeConfig.textMuted} mr-1`}>
              Direct Sources:
            </span>
            {directExternalSources.map((src) => (
              <a
                key={src.name}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/5 hover:bg-slate-500/15 transition-colors`}
                title={`Search "${currentLookupTerm}" directly on ${src.name}`}
              >
                <span>{src.name}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'all'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('exact')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'exact'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `text-emerald-400 hover:bg-emerald-500/10`
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Exact Resources ({exactResources.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('papers')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'papers'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Papers ({academicResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'code'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>Code &amp; AI ({codeResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('discussions')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'discussions'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>Q&amp;A &amp; Forum ({discussionResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('podcasts')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'podcasts'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <Headphones className="w-3 h-3" />
              <span>Podcasts &amp; Archives ({podcastResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('books')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'books'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>Books ({bookResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('videos')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'videos'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <Play className="w-3 h-3" />
              <span>YouTube ({ytResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('web')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'web'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Web ({webResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('news')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'news'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <Newspaper className="w-3 h-3" />
              <span>News ({newsResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('images')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'images'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Figures ({imageResults.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Initial Loading State */}
      {isLoading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
          <p className={`text-xs ${themeConfig.textMuted}`}>
            Querying 55+ live research, book, code, Q&amp;A, podcast, archive, and academic APIs for &ldquo;{searchQuery}&rdquo;...
          </p>
        </div>
      )}

      {/* Error State */}
      {errorMsg && !isLoading && (
        <div className="py-3 text-rose-400 text-xs">{errorMsg}</div>
      )}

      {/* Results View */}
      {!isLoading && (
        <div className="space-y-12">
          {/* SECTION 00: EXACT VIDEO RESOURCES & PRIMARY MENTIONS */}
          {(activeTab === 'all' || activeTab === 'exact') && exactResources.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                    00. Exact Video Resources &amp; Primary Citations (Directly Mentioned in This Video)
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                    Verified Exact Links
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {onSaveToList && (
                    <button
                      type="button"
                      onClick={() => {
                        exactResources.forEach((r) => {
                          onSaveToList({
                            itemType: r.type === 'Book / Publication' ? 'book' : 'article',
                            title: r.title,
                            url: r.primaryUrl,
                            subtitle: `${r.type}${r.authorOrCreator ? ` · ${r.authorOrCreator}` : ''}`,
                            content: r.description,
                            notes: r.exactQuote,
                          });
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer transition-colors"
                    >
                      <FolderOpen className="w-3 h-3" />
                      <span>+ Save All to Artifacts ({exactResources.length})</span>
                    </button>
                  )}
                  <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                    {exactResources.length} exact resources
                  </span>
                </div>
              </div>

              <div className={`divide-y ${themeConfig.borderLight}`}>
                {exactResources.map((res) => {
                  const isAppended = appendedIds.has(res.id);
                  const isCustom = res.id.startsWith('custom-res-');
                  return (
                    <div
                      key={res.id}
                      className="py-3.5 first:pt-0 flex flex-col gap-2"
                    >
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
                                  if (onSeekToTimestamp && res.timestampSeconds !== undefined) {
                                    onSeekToTimestamp(res.timestampSeconds);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
                                title="Jump to this exact moment in the video"
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
                            className={`text-sm font-semibold ${themeConfig.textPrimary} hover:${themeConfig.accent} inline-flex items-center gap-1.5 transition-colors`}
                          >
                            <span>{res.title}</span>
                            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                          </a>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 flex-wrap shrink-0">
                          <a
                            href={res.primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${themeConfig.primaryButton}`}
                          >
                            <span>{res.primaryLabel}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleSelectChip(res.title)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} cursor-pointer`}
                            title="Search all 55+ live sources for this exact resource"
                          >
                            <Search className="w-2.5 h-2.5" />
                            <span>Deep Search</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAppendExactResource(res)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                              isAppended
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : `bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`
                            }`}
                          >
                            {isAppended ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                            <span>{isAppended ? 'Added' : '+ Summary'}</span>
                          </button>

                          {onSaveToList && (
                            <button
                              type="button"
                              onClick={() =>
                                onSaveToList({
                                  itemType: res.type === 'Book / Publication' ? 'book' : 'article',
                                  title: res.title,
                                  url: res.primaryUrl,
                                  subtitle: `${res.type}${res.authorOrCreator ? ` · ${res.authorOrCreator}` : ''}`,
                                  content: res.description,
                                  notes: res.exactQuote,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 cursor-pointer"
                            >
                              <FolderOpen className="w-2.5 h-2.5" />
                              <span>+ Save to Artifacts</span>
                            </button>
                          )}

                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomResource(res.id)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Remove custom resource"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className={`text-xs leading-relaxed ${themeConfig.textSecondary}`}>
                        {res.description}
                      </p>

                      {res.exactQuote && (
                        <blockquote
                          className={`pl-2.5 border-l-2 border-emerald-500/40 text-[11px] italic ${themeConfig.textMuted}`}
                        >
                          &ldquo;{res.exactQuote}&rdquo;
                        </blockquote>
                      )}

                      {res.secondaryLinks && res.secondaryLinks.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className={`text-[10px] ${themeConfig.textMuted}`}>Exact Cross-Links:</span>
                          {res.secondaryLinks.map((lnk, i) => (
                            <a
                              key={i}
                              href={lnk.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} transition-colors`}
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
            </section>
          )}

          {/* SECTION 1: PEER-REVIEWED ACADEMIC PAPERS */}
          {(activeTab === 'all' || activeTab === 'papers') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  01. Peer-Reviewed Papers &amp; Preprints (OpenAlex · Semantic Scholar · arXiv · Crossref · PubMed · Europe PMC · DOAJ · DBLP · HAL)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {academicResults.length} papers loaded
                </span>
              </div>

              {academicResults.length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No academic papers found for this query.
                </p>
              ) : (
                <div className={`divide-y ${themeConfig.borderLight}`}>
                  {academicResults.map((paper) => {
                    const isAppended = appendedIds.has(paper.id);
                    return (
                      <div
                        key={paper.id}
                        className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 max-w-4xl">
                          <div className={`flex items-center gap-2 text-xs ${themeConfig.textMuted} flex-wrap tabular-nums`}>
                            <span className="text-indigo-400 font-medium">{paper.source}</span>
                            <span aria-hidden="true">·</span>
                            <span>{paper.authors.join(', ')}</span>
                            {paper.year && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{paper.year}</span>
                              </>
                            )}
                            {paper.venue && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{paper.venue}</span>
                              </>
                            )}
                            {paper.citationCount !== undefined && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-400 font-medium">
                                  {paper.citationCount.toLocaleString()} citations
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`text-sm sm:text-base font-semibold hover:underline ${themeConfig.textPrimary} inline-flex items-center gap-1.5`}
                            >
                              <span>{paper.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                            </a>

                            {paper.pdfUrl && (
                              <a
                                href={paper.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-indigo-400 hover:underline"
                              >
                                [Open PDF]
                              </a>
                            )}
                          </div>

                          {paper.abstract && (
                            <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                              {paper.abstract}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => handleAppendPaper(paper)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                              isAppended
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                            }`}
                          >
                            {isAppended ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            <span>{isAppended ? 'Added' : 'Add to Summary'}</span>
                          </button>

                          {onSaveToList && (
                            <button
                              type="button"
                              onClick={() =>
                                onSaveToList({
                                  itemType: 'article',
                                  title: paper.title,
                                  url: paper.url,
                                  subtitle: `${paper.source} · ${paper.authors.join(', ')}${paper.year ? ` (${paper.year})` : ''}`,
                                  content: paper.abstract || '',
                                })
                              }
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer whitespace-nowrap`}
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
              )}
            </section>
          )}

          {/* SECTION 2: OPEN-SOURCE CODE, AI MODELS & PACKAGES */}
          {(activeTab === 'all' || activeTab === 'code') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  02. Open-Source Code, AI Models, Spaces &amp; Packages (GitHub · HuggingFace Models, Datasets &amp; Spaces · PyPI · npm)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {codeResults.length} repositories &amp; models loaded
                </span>
              </div>

              {codeResults.length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No repositories or AI models found for this query.
                </p>
              ) : (
                <div className={`divide-y ${themeConfig.borderLight}`}>
                  {codeResults.map((repo) => {
                    const isAppended = appendedIds.has(repo.id);
                    return (
                      <div
                        key={repo.id}
                        className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 max-w-4xl">
                          <div className={`flex items-center gap-2 text-xs ${themeConfig.textMuted} flex-wrap tabular-nums`}>
                            <span className="text-cyan-400 font-medium">{repo.source}</span>
                            {repo.language && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{repo.language}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                              <Star className="w-3 h-3" />
                              {repo.stars.toLocaleString()}
                            </span>
                            {repo.forks !== undefined && repo.forks > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <GitFork className="w-3 h-3" />
                                  {repo.forks.toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>

                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`text-sm sm:text-base font-semibold hover:underline ${themeConfig.textPrimary} inline-flex items-center gap-1.5 font-mono`}
                          >
                            <span>{repo.fullName}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          </a>

                          <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                            {repo.description}
                          </p>

                          {repo.topics && repo.topics.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              {repo.topics.map((t, i) => (
                                <span
                                  key={i}
                                  className={`text-[11px] font-mono ${themeConfig.textMuted}`}
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAppendCode(repo)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors shrink-0 self-start whitespace-nowrap ${
                            isAppended
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                          }`}
                        >
                          {isAppended ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          <span>{isAppended ? 'Appended' : 'Append'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: TECHNICAL Q&A & COMMUNITY DISCUSSIONS */}
          {(activeTab === 'all' || activeTab === 'discussions') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  03. Technical Q&amp;A &amp; Community Threads (StackOverflow · CrossValidated SE · Reddit · DEV.to · Hacker News · GitHub Discussions)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {discussionResults.length} discussions loaded
                </span>
              </div>

              {discussionResults.length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No community threads found for this query.
                </p>
              ) : (
                <div className={`divide-y ${themeConfig.borderLight}`}>
                  {discussionResults.map((disc) => {
                    const isAppended = appendedIds.has(disc.id);
                    return (
                      <div
                        key={disc.id}
                        className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 max-w-4xl">
                          <div className={`flex items-center gap-2 text-xs ${themeConfig.textMuted} flex-wrap tabular-nums`}>
                            <span className="text-amber-400 font-medium">{disc.community}</span>
                            <span aria-hidden="true">·</span>
                            <span>by {disc.author}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-400 font-medium">{disc.score} pts</span>
                            <span aria-hidden="true">·</span>
                            <span>{disc.commentsCount} comments</span>
                            {disc.isAnswered && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-400 inline-flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Answered
                                </span>
                              </>
                            )}
                          </div>

                          <a
                            href={disc.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`text-sm sm:text-base font-semibold hover:underline ${themeConfig.textPrimary} inline-flex items-center gap-1.5`}
                          >
                            <span>{disc.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          </a>

                          <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                            {disc.snippet}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAppendDiscussion(disc)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors shrink-0 self-start whitespace-nowrap ${
                            isAppended
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                          }`}
                        >
                          {isAppended ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          <span>{isAppended ? 'Appended' : 'Append'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION 4: PODCAST EPISODES, CERN ZENODO DATASETS & INTERNET ARCHIVE */}
          {(activeTab === 'all' || activeTab === 'podcasts') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  04. Podcasts, Scientific Datasets &amp; Archival Records (Apple Podcasts · CERN Zenodo · Internet Archive · Library of Congress)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {podcastResults.length} items loaded
                </span>
              </div>

              {podcastResults.length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No podcasts or open datasets found for this query.
                </p>
              ) : (
                <div className={`divide-y ${themeConfig.borderLight}`}>
                  {podcastResults.map((item) => {
                    const isAppended = appendedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="flex items-start gap-4 max-w-4xl">
                          <SmartImage
                            src={item.thumbnailUrl}
                            alt={item.title}
                            variant="podcast"
                            badgeText={item.category.split(' ')[0]}
                            className="w-14 h-14 rounded-lg object-cover shrink-0 bg-black/20"
                          />
                          <div className="space-y-1.5">
                            <div className={`flex items-center gap-2 text-xs ${themeConfig.textMuted} flex-wrap`}>
                              <span className="text-indigo-400 font-medium">{item.category}</span>
                              <span aria-hidden="true">·</span>
                              <span>{item.creator}</span>
                              {item.durationOrSize && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{item.durationOrSize}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`text-sm sm:text-base font-semibold hover:underline ${themeConfig.textPrimary} inline-flex items-center gap-1.5`}
                              >
                                <span>{item.title}</span>
                                <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                              </a>

                              {item.audioOrDownloadUrl && (
                                <a
                                  href={item.audioOrDownloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-emerald-400 hover:underline"
                                >
                                  [Listen Audio Stream]
                                </a>
                              )}
                            </div>

                            <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAppendPodcast(item)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors shrink-0 self-start whitespace-nowrap ${
                            isAppended
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                          }`}
                        >
                          {isAppended ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          <span>{isAppended ? 'Appended' : 'Append'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION 5: BOOKS & PUBLISHED LITERATURE */}
          {(activeTab === 'all' || activeTab === 'books') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  05. Books &amp; Full-Text Editions (Google Books · OpenLibrary · Project Gutenberg Full Text · Internet Archive Texts)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {bookResults.length} volumes loaded
                </span>
              </div>

              {bookResults.length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No books found for this query.
                </p>
              ) : (
                <div className={`divide-y ${themeConfig.borderLight}`}>
                  {bookResults.map((book) => {
                    const isAppended = appendedIds.has(book.id);
                    return (
                      <div
                        key={book.id}
                        className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-5"
                      >
                        <div className="flex items-start gap-4 max-w-4xl">
                          <SmartImage
                            src={book.thumbnailUrl}
                            alt={book.title}
                            variant="book"
                            className="w-14 sm:w-16 h-20 sm:h-22 rounded object-cover shrink-0 bg-black/20"
                          />
                          <div className="space-y-1.5">
                            <div className={`flex items-center gap-2 text-xs ${themeConfig.textMuted} flex-wrap`}>
                              <span className="text-indigo-400 font-medium">
                                {book.authors.join(', ')}
                              </span>
                              {book.publishedDate && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{book.publishedDate}</span>
                                </>
                              )}
                              {book.publisher && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{book.publisher}</span>
                                </>
                              )}
                              {book.pageCount && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{book.pageCount} pages</span>
                                </>
                              )}
                            </div>

                            <a
                              href={book.infoLink}
                              target="_blank"
                              rel="noreferrer"
                              className={`text-sm sm:text-base font-semibold hover:underline ${themeConfig.textPrimary} inline-flex items-center gap-1.5`}
                            >
                              <span>{book.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                            </a>

                            {book.description && (
                              <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                                {book.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => handleAppendBook(book)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                              isAppended
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                            }`}
                          >
                            {isAppended ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            <span>{isAppended ? 'Added' : 'Add to Summary'}</span>
                          </button>

                          {onSaveToList && (
                            <button
                              type="button"
                              onClick={() =>
                                onSaveToList({
                                  itemType: 'book',
                                  title: book.title,
                                  url: book.infoLink,
                                  subtitle: book.authors.join(', '),
                                  content: book.description || '',
                                })
                              }
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer whitespace-nowrap`}
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
              )}
            </section>
          )}

          {/* SECTION 6: RELATED YOUTUBE VIDEOS */}
          {(activeTab === 'all' || activeTab === 'videos') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  06. Related YouTube Presentations (YouTube Data API v3)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {ytResults.length} videos loaded
                </span>
              </div>

              {ytResults.length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No related YouTube videos found for this query.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {ytResults.map((vid) => (
                    <div key={vid.videoId} className="space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div
                          onClick={() => onSelectVideoUrl && onSelectVideoUrl(vid.url)}
                          className="relative aspect-video rounded-lg overflow-hidden bg-black/30 cursor-pointer group"
                        >
                          <SmartImage
                            src={vid.thumbnailUrl}
                            fallbackSrc={
                              vid.videoId
                                ? `https://i.ytimg.com/vi/${vid.videoId}/mqdefault.jpg`
                                : undefined
                            }
                            alt={vid.title}
                            variant="video"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <h4
                            onClick={() => onSelectVideoUrl && onSelectVideoUrl(vid.url)}
                            className={`text-xs sm:text-sm font-semibold line-clamp-2 leading-snug cursor-pointer hover:text-indigo-400 transition-colors ${themeConfig.textPrimary}`}
                          >
                            {vid.title}
                          </h4>
                          <p className={`text-xs ${themeConfig.textMuted}`}>
                            {vid.channelTitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-1 flex-wrap">
                        {onSelectVideoUrl && (
                          <button
                            type="button"
                            onClick={() => onSelectVideoUrl(vid.url)}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>Summarize Video</span>
                          </button>
                        )}
                        {onSaveToList && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveToList({
                                itemType: 'video',
                                title: vid.title,
                                url: vid.url,
                                subtitle: vid.channelTitle,
                                content: vid.description || '',
                              })
                            }
                            className={`text-xs ${themeConfig.textSecondary} hover:text-indigo-400 cursor-pointer inline-flex items-center gap-1`}
                          >
                            <Bookmark className="w-3 h-3" />
                            <span>Save to List</span>
                          </button>
                        )}
                        <a
                          href={vid.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`text-xs ${themeConfig.textMuted} hover:${themeConfig.textPrimary} inline-flex items-center gap-1`}
                        >
                          <span>Watch</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 7: WEB & CUSTOM SEARCH */}
          {(activeTab === 'all' || activeTab === 'web') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  07. Web &amp; Encyclopedia References (Google Custom Search · Wikipedia · DuckDuckGo)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {webResults.length} sources loaded
                </span>
              </div>

              {webResults.length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No web sources found for this query.
                </p>
              ) : (
                <div className={`divide-y ${themeConfig.borderLight}`}>
                  {webResults.map((web) => {
                    const isAppended = appendedIds.has(web.id);
                    return (
                      <div
                        key={web.id}
                        className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 max-w-4xl">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-indigo-400 font-medium">{web.source}</span>
                            <span aria-hidden="true" className={themeConfig.textMuted}>·</span>
                            <a
                              href={web.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`text-sm sm:text-base font-semibold hover:underline ${themeConfig.textPrimary} inline-flex items-center gap-1.5`}
                            >
                              <span>{web.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                            </a>
                          </div>

                          <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                            {web.snippet}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => handleAppendWeb(web)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                              isAppended
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                            }`}
                          >
                            {isAppended ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            <span>{isAppended ? 'Added' : 'Add to Summary'}</span>
                          </button>

                          {onSaveToList && (
                            <button
                              type="button"
                              onClick={() =>
                                onSaveToList({
                                  itemType: 'article',
                                  title: web.title,
                                  url: web.url,
                                  subtitle: web.source,
                                  content: web.snippet,
                                })
                              }
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer whitespace-nowrap`}
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
              )}
            </section>
          )}

          {/* SECTION 8: NEWS & MEDIA COVERAGE */}
          {(activeTab === 'all' || activeTab === 'news') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  08. Media Coverage &amp; Industry News (Google News RSS · Hacker News)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {newsResults.length} articles loaded
                </span>
              </div>

              {newsResults.length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No news coverage found for this query.
                </p>
              ) : (
                <div className={`divide-y ${themeConfig.borderLight}`}>
                  {newsResults.map((news) => {
                    const isAppended = appendedIds.has(news.id);
                    return (
                      <div
                        key={news.id}
                        className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 max-w-4xl">
                          <div className={`flex items-center gap-2 text-xs ${themeConfig.textMuted} tabular-nums`}>
                            <span className="text-emerald-400 font-medium">{news.source}</span>
                            {news.publishedAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{new Date(news.publishedAt).toLocaleDateString()}</span>
                              </>
                            )}
                            {news.score !== undefined && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{news.score} pts</span>
                              </>
                            )}
                          </div>

                          <a
                            href={news.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`text-sm sm:text-base font-semibold hover:underline ${themeConfig.textPrimary} inline-flex items-center gap-1.5`}
                          >
                            <span>{news.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          </a>

                          <p className={`text-xs sm:text-sm leading-relaxed ${themeConfig.textSecondary}`}>
                            {news.snippet}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAppendNews(news)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors shrink-0 self-start whitespace-nowrap ${
                            isAppended
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                          }`}
                        >
                          {isAppended ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          <span>{isAppended ? 'Appended' : 'Append'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION 9: IMAGES */}
          {(activeTab === 'all' || activeTab === 'images') && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
                  09. Contextual Figures &amp; Media (Google Images · Openverse CC · Wikimedia Commons · Wikipedia)
                </h3>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  {imageResults.length} figures loaded
                </span>
              </div>

              {imageResults.filter((img) => !brokenImageIds.has(img.id)).length === 0 ? (
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  No figures found for this query.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {imageResults
                    .filter((img) => !brokenImageIds.has(img.id))
                    .map((img) => {
                      const isAppended = appendedIds.has(img.id);
                      return (
                        <div key={img.id} className="group space-y-2">
                          <div
                            className="relative aspect-video rounded-lg bg-black/30 cursor-pointer overflow-hidden"
                            onClick={() => setPreviewImage(img)}
                          >
                            <SmartImage
                              src={img.thumbnailUrl}
                              fallbackSrc={img.url}
                              alt={img.title}
                              variant="figure"
                              onFatalError={() =>
                                setBrokenImageIds((prev) => new Set(prev).add(img.id))
                              }
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 className="w-4 h-4 text-white" />
                            </div>
                          </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-medium truncate ${themeConfig.textPrimary}`} title={img.title}>
                            {img.title}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleAppendImage(img)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                              isAppended
                                ? 'text-emerald-400'
                                : 'text-indigo-400 hover:text-indigo-300'
                            }`}
                          >
                            {isAppended ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            <span>{isAppended ? 'Added' : 'Append'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Infinite Scroll Sentinel & Status Footer */}
          <div ref={loadMoreSentinelRef} className="py-8 flex flex-col items-center justify-center gap-3">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading next batch of results across 30+ APIs (Page {page + 2})...</span>
              </div>
            )}

            {!isLoadingMore && hasMore && totalCount > 0 && (
              <button
                type="button"
                onClick={loadMoreResults}
                className={`px-4 py-2 rounded-md text-xs font-medium cursor-pointer transition-colors ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/20 flex items-center gap-1.5`}
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Scroll down or click to load more results ({totalCount} loaded so far)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`relative max-w-3xl w-full ${themeConfig.cardBg} rounded-xl overflow-hidden shadow-2xl space-y-3`}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700/40">
              <div className="truncate pr-4">
                <h3 className={`text-sm font-bold truncate ${themeConfig.textPrimary}`}>
                  {previewImage.title}
                </h3>
                <span className={`text-xs ${themeConfig.textMuted}`}>{previewImage.sourceName}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-hidden flex items-center justify-center bg-black/40 px-4">
              <SmartImage
                src={previewImage.url}
                fallbackSrc={previewImage.thumbnailUrl}
                alt={previewImage.title}
                variant="figure"
                className="max-h-[62vh] max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="p-4 flex items-center justify-between gap-3 border-t border-slate-700/40">
              <div className="text-xs text-slate-400 truncate">
                {previewImage.description || 'Public Domain / Creative Commons image'}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewImage.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`}
                >
                  <span>Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    handleAppendImage(previewImage);
                    setPreviewImage(null);
                  }}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${themeConfig.primaryButton} flex items-center gap-1.5`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Append to Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
