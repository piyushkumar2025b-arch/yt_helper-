export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
  formattedTime: string;
}

export type ParsedSegment = TranscriptSegment;

export type MediaSourceType =
  | 'youtube'
  | 'vimeo'
  | 'dailymotion'
  | 'twitch'
  | 'ted'
  | 'loom'
  | 'podcast_rss'
  | 'podcast_description'
  | 'direct_audio'
  | 'direct_video'
  | 'direct_subtitle'
  | 'uploaded_file'
  | 'web_article'
  | 'direct_text';

export interface PodcastEpisodeItem {
  id?: string;
  title: string;
  audioUrl: string;
  duration?: string;
  durationSeconds?: number;
  pubDate?: string;
  description?: string;
  transcriptUrl?: string;
}

export interface VideoMetadata {
  videoId: string;
  url: string;
  title: string;
  sourceType?: MediaSourceType;
  sourceKind?: 'live_transcript' | 'saved_summary_only';
  mediaUrl?: string;
  embedUrl?: string;
  authorName?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  durationFormatted?: string;
  language?: string;
  totalSegments: number;
  totalWords: number;
  estimatedTokens: number;
  availableLanguages?: Array<{ code: string; name: string }>;
  podcastFeedUrl?: string;
  episodes?: PodcastEpisodeItem[];
  selectedEpisodeIndex?: number;
  // YouTube Data API v3 enriched metadata
  description?: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
  topicCategories?: string[];
  definition?: 'hd' | 'sd' | string;
  hasCaptions?: boolean;
  channelId?: string;
  playlistId?: string;
  playlistTitle?: string;
  playlistVideos?: Array<{
    videoId: string;
    title: string;
    url: string;
    thumbnailUrl?: string;
    channelTitle?: string;
  }>;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  isFree: boolean;
  description: string;
  recommended?: boolean;
}

export type SummaryType = 
  | 'massive' 
  | 'chronological' 
  | 'concepts' 
  | 'actionable' 
  | 'study_guide' 
  | 'comprehensive';

export type DetailLevel = 'massive' | 'extensive' | 'balanced';

export type AIProvider =
  | 'gemini'
  | 'openrouter'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'local-extractive';

export interface SummaryConfig {
  provider: 'openrouter' | 'gemini';
  openRouterKey: string;
  model: string;
  summaryType: SummaryType;
  detailLevel: DetailLevel;
  customPrompt?: string;
  includeTimestamps: boolean;
}

export interface SummaryResult {
  markdown: string;
  modelUsed: string;
  providerUsed: AIProvider;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  summaryType: SummaryType;
  detailLevel?: DetailLevel;
  createdAt: string;
  isTruncated?: boolean;
  finishReason?: string;
  continuationCount?: number;
  lastContinuationText?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface WorkflowStep {
  id: 'metadata' | 'transcript' | 'context' | 'summary' | 'complete';
  title: string;
  detail: string;
  status: 'idle' | 'running' | 'success' | 'error';
  errorMessage?: string;
}

export interface SampleVideo {
  id: string;
  title: string;
  channel: string;
  duration: string;
  category: string;
  url: string;
  sourceType?: MediaSourceType;
  badge?: string;
  description?: string;
}

export type SampleMediaItem = SampleVideo;

export type ThemeId =
  | 'sepia'
  | 'light'
  | 'solarized'
  | 'alabaster'
  | 'matcha'
  | 'rose'
  | 'nordlight'
  | 'midnight'
  | 'nord'
  | 'coffee'
  | 'forest'
  | 'ocean'
  | 'sunset'
  | 'cyberpunk'
  | 'oled';

export interface WebSearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: string;
  pageId?: number | string;
}

export interface ImageSearchResult {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  sourceUrl?: string;
  sourceName?: string;
  width?: number;
  height?: number;
  description?: string;
}

export interface NewsSearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: string;
  publishedAt?: string;
  score?: number;
  commentsCount?: number;
  mediaType: 'news' | 'discussion' | 'editorial' | 'media';
}

export interface BookSearchResult {
  id: string;
  title: string;
  authors: string[];
  publishedDate?: string;
  publisher?: string;
  description?: string;
  pageCount?: number;
  categories?: string[];
  thumbnailUrl?: string;
  infoLink: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt?: string;
  description?: string;
  thumbnailUrl: string;
  url: string;
}

export interface AcademicPaperResult {
  id: string;
  title: string;
  authors: string[];
  year?: string | number;
  venue?: string;
  citationCount?: number;
  abstract?: string;
  url: string;
  pdfUrl?: string;
  doi?: string;
  source:
    | 'OpenAlex'
    | 'Semantic Scholar'
    | 'arXiv'
    | 'Crossref'
    | 'PubMed'
    | 'Europe PMC'
    | 'DOAJ'
    | 'CORE'
    | 'DBLP'
    | 'HAL Science';
}

export interface GitHubRepoResult {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks?: number;
  language?: string;
  topics?: string[];
  updatedAt?: string;
  ownerAvatar?: string;
  source:
    | 'GitHub'
    | 'HuggingFace Model'
    | 'HuggingFace Dataset'
    | 'HuggingFace Space'
    | 'npm Registry'
    | 'PyPI Package';
}

export interface CommunityDiscussionResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  author: string;
  community: string;
  score: number;
  commentsCount: number;
  isAnswered?: boolean;
  publishedAt?: string;
  tags?: string[];
  source:
    | 'StackOverflow'
    | 'StackExchange'
    | 'Reddit'
    | 'DEV.to'
    | 'Hacker News'
    | 'Lobste.rs'
    | 'GitHub Discussions';
}

export interface PodcastDatasetResult {
  id: string;
  title: string;
  creator: string;
  description: string;
  url: string;
  audioOrDownloadUrl?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  durationOrSize?: string;
  category:
    | 'Podcast Episode'
    | 'Zenodo Dataset'
    | 'Internet Archive'
    | 'Library of Congress'
    | 'Wikimedia Commons Audio';
}

export interface ExactVideoResource {
  id: string;
  title: string;
  type:
    | 'Primary Video Source'
    | 'Book / Publication'
    | 'Research Paper'
    | 'Person / Pioneer'
    | 'Organization / Lab'
    | 'Tool / Framework'
    | 'Dataset / Benchmark'
    | 'Historical / Key Reference'
    | 'Custom Resource';
  description: string;
  exactQuote?: string;
  timestampSeconds?: number;
  formattedTime?: string;
  primaryUrl: string;
  primaryLabel: string;
  secondaryLinks?: Array<{
    label: string;
    url: string;
    sourceName: string;
  }>;
  authorOrCreator?: string;
  year?: string;
  verified: boolean;
}

export interface DictionaryKnowledgeResult {
  query: string;
  phonetic?: string;
  audioUrl?: string;
  partOfSpeech?: string;
  plainEnglish?: {
    summary: string;
    whyItMatters: string;
    realWorldExample?: string;
    technicalArchitecture?: string;
    fullForm?: string;
    domain?: string;
  };
  definitions: Array<{
    partOfSpeech: string;
    definition: string;
    example?: string;
    source?: string;
  }>;
  wiktionaryDefinitions?: Array<{
    partOfSpeech: string;
    definition: string;
  }>;
  technicalWiki?: {
    tag: string;
    excerpt: string;
    url: string;
    source: string;
  };
  duckDuckGoAbstract?: {
    heading: string;
    abstract: string;
    url: string;
    source: string;
  };
  academicPapers?: Array<{
    title: string;
    authors: string;
    year?: string | number;
    citationCount?: number;
    url: string;
    source: string;
  }>;
  books?: Array<{
    title: string;
    author: string;
    year?: string | number;
    url: string;
  }>;
  sourcesUsed?: string[];
  synonyms: string[];
  relatedTerms: Array<{ word: string; score?: number; def?: string }>;
  wikidata?: {
    id: string;
    label: string;
    description: string;
    url: string;
    aliases?: string[];
  };
  wikipedia?: {
    title: string;
    extract: string;
    url: string;
    thumbnailUrl?: string;
  };
}

export interface TechWordEntry {
  id: string;
  term: string;
  fullForm?: string;
  domain:
    | 'AI & Machine Learning'
    | 'CSE & Algorithms'
    | 'Systems & Cloud'
    | 'Networking & Protocols'
    | 'Hardware & Chips'
    | 'Software Engineering'
    | 'From This Video';
  importance: 'essential' | 'high' | 'core';
  plainMeaning: string;
  techArchitecture: string;
  realWorldExample: string;
  complexityOrMetric?: string;
  relatedWords: string[];
  contextInVideo?: string;
  timestampSeconds?: number;
  formattedTime?: string;
}

export interface YouTubeCommentItem {
  id: string;
  author: string;
  authorProfileImageUrl?: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  timestamps?: Array<{
    seconds: number;
    timeStr: string;
    context: string;
  }>;
}

export interface YouTubeCaptionTrack {
  id: string;
  language: string;
  name: string;
  trackKind: 'standard' | 'ASR' | string;
  isDraft: boolean;
  isAutoSynced?: boolean;
  lastUpdated?: string;
}

export interface YouTubeChannelProfile {
  id: string;
  title: string;
  description?: string;
  customUrl?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
}

export interface CrucialTermItem {
  term: string;
  fullForm?: string;
  category: 'acronym' | 'core_concept' | 'entity' | 'rule_of_thumb';
  definition: string;
  whyItMatters?: string;
  realWorldExample?: string;
  contextInVideo?: string;
  formattedTime?: string;
  timestampSeconds?: number;
  importance: 'critical' | 'high' | 'recommended';
  tag?: string;
  sources?: Array<{
    label: string;
    url: string;
  }>;
}

export interface KeyTakeawayItem {
  id: string;
  principle: string;
  description: string;
  quote?: string;
  actionableLesson: string;
  formattedTime?: string;
  timestampSeconds?: number;
  category: 'mindset' | 'decision_making' | 'execution' | 'craft';
  sources?: Array<{
    label: string;
    url: string;
  }>;
}

export type FontFamilyOption = 'sans' | 'serif' | 'humanist' | 'geometric' | 'mono';
export type FontSizeOption = 'compact' | 'standard' | 'relaxed' | 'spacious';
export type LineHeightOption = 'tight' | 'normal' | 'relaxed';
export type ContentWidthOption = 'focus' | 'balanced' | 'full';

export interface TypographyConfig {
  fontFamily: FontFamilyOption;
  fontSize: FontSizeOption;
  lineHeight: LineHeightOption;
  contentWidth: ContentWidthOption;
}

export interface ScrapedDataPackage {
  scrapedAt: string;
  video: {
    id: string;
    url: string;
    metadata: VideoMetadata | null;
  };
  captions: {
    provider: string;
    totalSegments: number;
    totalWords: number;
    durationSeconds: number;
    segments: ParsedSegment[];
    rawText: string;
    vttFormat: string;
    srtFormat: string;
  };
  research?: {
    web: WebSearchResult[];
    news: NewsSearchResult[];
    images: ImageSearchResult[];
  };
}
