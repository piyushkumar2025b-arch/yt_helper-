/**
 * Typed server request and response interfaces.
 * Resolves BUG-005 (weak typing and extensive `as any` casts).
 */

export type ServerAIProvider =
  | 'gemini'
  | 'openrouter'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'local-extractive';

export interface YouTubeOEmbedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  html?: string;
  width?: number;
  height?: number;
}

export interface YouTubeVideoThumbnail {
  url?: string;
  width?: number;
  height?: number;
}

export interface YouTubeVideoSnippet {
  title?: string;
  description?: string;
  channelTitle?: string;
  channelId?: string;
  publishedAt?: string;
  tags?: string[];
  categoryId?: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  thumbnails?: {
    default?: YouTubeVideoThumbnail;
    medium?: YouTubeVideoThumbnail;
    high?: YouTubeVideoThumbnail;
    standard?: YouTubeVideoThumbnail;
    maxres?: YouTubeVideoThumbnail;
  };
}

export interface YouTubeVideoItem {
  id?: string;
  snippet?: YouTubeVideoSnippet;
  contentDetails?: {
    duration?: string;
    dimension?: string;
    definition?: string;
    caption?: string;
    licensedContent?: boolean;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    favoriteCount?: string;
    commentCount?: string;
  };
  topicDetails?: {
    topicCategories?: string[];
  };
}

export interface YouTubeVideoListResponse {
  items?: YouTubeVideoItem[];
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

export function parseIso8601Duration(duration?: string): number {
  if (!duration || typeof duration !== 'string') return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export interface TranscriptRequestBody {
  url?: string;
  videoId?: string;
  language?: string;
}

export interface SummarizeRequestBody {
  transcript?: string;
  title?: string;
  videoUrl?: string;
  videoId?: string;
  summaryType?: string;
  detailLevel?: string;
  provider?: ServerAIProvider;
  openRouterKey?: string;
  model?: string;
  segments?: Array<{ start?: number; formattedTime?: string; text?: string }>;
}

export interface ChatRequestBody {
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  transcript?: string;
  title?: string;
  videoId?: string;
  provider?: ServerAIProvider;
  openRouterKey?: string;
  model?: string;
  segments?: Array<{ start?: number; formattedTime?: string; text?: string }>;
}

export interface DeepDiveRequestBody {
  topic?: string;
  transcript?: string;
  title?: string;
  provider?: ServerAIProvider;
  openRouterKey?: string;
  model?: string;
  segments?: Array<{ start?: number; formattedTime?: string; text?: string }>;
}

export interface ContinueSummaryRequestBody {
  previousMarkdown?: string;
  transcript?: string;
  title?: string;
  provider?: ServerAIProvider;
  openRouterKey?: string;
  model?: string;
  summaryType?: string;
  detailLevel?: string;
  continuationCount?: number;
}

export interface TranslateRequestBody {
  markdown?: string;
  targetLang?: string;
  provider?: ServerAIProvider;
  openRouterKey?: string;
  model?: string;
}
