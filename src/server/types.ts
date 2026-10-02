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
  };
}

export interface YouTubeVideoListResponse {
  items?: YouTubeVideoItem[];
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
