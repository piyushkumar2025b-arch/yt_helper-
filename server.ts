import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dns from 'dns/promises';
import net from 'net';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { XMLParser } from 'fast-xml-parser';
import { EdgeTTS } from 'edge-tts-universal';
import {
  extractVideoId,
  formatTime,
  fetchPipedTranscript,
  parseSubtitlePayload,
  SAMPLE_FALLBACK_TRANSCRIPTS,
  ParsedSegment,
} from './src/server/transcriptHelper.ts';
import { defaultRateLimiter } from './src/server/rateLimiter.ts';
import { getSampleFallbackReport } from './src/server/sampleReports.ts';
import {
  YouTubeOEmbedResponse,
  YouTubeVideoListResponse,
  ServerAIProvider,
} from './src/server/types.ts';
import {
  createTranscriptIndex,
  retrieveRelevantChunks,
  retrieveWithMultiQueryRRF,
  formatRetrievedContextForPrompt,
  buildGroundedExtractiveAnswer,
  buildGroundedDeepDive,
  extractGroundedFacts,
  extractChronologicalTimeline,
  verifyClaimAgainstTranscript,
  extractKeyEntitiesAndConcepts,
  generateHierarchicalGroundedSummary,
  detectContradictionsAndCaveats,
  synthesizeGroundedAnswer,
} from './src/server/ragEngine.ts';
import {
  detectMediaSourceType,
  fetchVimeoMetadataAndTranscript,
  fetchDailymotionMetadataAndTranscript,
  fetchTedTalkMetadataAndTranscript,
  fetchLoomMetadataAndTranscript,
  fetchTwitchMetadataAndTranscript,
  fetchPodcastRssMetadataAndTranscript,
  fetchDirectMediaMetadataAndTranscript,
  fetchWebArticleMetadataAndTranscript,
  transcribeUploadedMedia,
} from './src/server/mediaExtractor.ts';
import { authenticateFirebaseUser, requireAuthOrUserKey } from './src/server/authMiddleware.ts';
import { safeFetch, safeFetchText, safeFetchJson, DEFAULT_MAX_TEXT_BYTES } from './src/server/safeFetch.ts';
import { sha256Digest, BoundedCache } from './src/server/cacheHelper.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  // Read Google and YouTube API keys strictly from environment variables or client headers (C-01)
  const GOOGLE_API_KEY = (process.env.GOOGLE_API_KEY || process.env.YOUTUBE_API_KEY || '').trim();
  const GOOGLE_CSE_ID = (process.env.GOOGLE_CSE_ID || '').trim();

  app.use(express.json({ limit: '15mb' }));

  // Protective security headers (BUG-007)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Configure Express trust proxy ONLY when explicitly configured via TRUST_PROXY (BUG-011)
  const trustProxyEnv = (process.env.TRUST_PROXY || '').trim();
  if (trustProxyEnv === 'true' || trustProxyEnv === '1') {
    app.set('trust proxy', 1);
  } else if (trustProxyEnv && !isNaN(Number(trustProxyEnv))) {
    app.set('trust proxy', Number(trustProxyEnv));
  } else if (trustProxyEnv && trustProxyEnv !== 'false' && trustProxyEnv !== '0') {
    app.set('trust proxy', trustProxyEnv);
  } else {
    app.set('trust proxy', false);
  }

  const allowedOrigins = new Set<string>(
    [
      process.env.APP_URL,
      process.env.PUBLIC_ORIGIN,
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
    ]
      .map((o) => (o || '').trim())
      .filter(Boolean)
      .map((o) => {
        try {
          return new URL(o).origin.toLowerCase();
        } catch {
          return o.toLowerCase();
        }
      })
  );

  // Same-origin / CORS & Rate Limiting protection on /api routes (BUG-003, BUG-014)
  const ALLOWED_SERVER_OPENROUTER_MODELS = new Set([
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'qwen/qwen-2.5-coder-32b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'deepseek/deepseek-chat:free',
    'deepseek/deepseek-chat-v3-0324:free',
    'deepseek/deepseek-r1:free',
    'google/gemini-2.0-flash-exp:free',
    'google/gemini-2.0-flash-thinking-exp:free',
    'openrouter/auto',
  ]);

  function getOpenRouterRequestKey(req: Request): { key: string; isUserKey: boolean } {
    const headerKey = String(req.headers['x-openrouter-key'] || '').trim();
    const bodyKey = String(req.body?.openRouterKey || '').trim();
    const userKey = headerKey || bodyKey;
    if (userKey) {
      return { key: userKey, isUserKey: true };
    }
    const serverKey = (process.env.OPENROUTER_API_KEY || '').trim();
    return { key: serverKey, isUserKey: false };
  }

  function resolveOpenRouterModel(requestedModel: string | undefined, isUserKey: boolean): string {
    const fallbackModel = 'meta-llama/llama-3.3-70b-instruct:free';
    const trimmed = String(requestedModel || '').trim();
    if (!trimmed) return fallbackModel;
    if (isUserKey) return trimmed;
    if (ALLOWED_SERVER_OPENROUTER_MODELS.has(trimmed) || trimmed.endsWith(':free')) {
      return trimmed;
    }
    return fallbackModel;
  }

  function setBoundedCache<K, V>(map: Map<K, V>, key: K, value: V, maxSize = 150) {
    if (map.size >= maxSize && !map.has(key)) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) map.delete(oldest);
    }
    map.set(key, value);
  }

  function isPrivateOrReservedIp(ip: string): boolean {
    const cleanIp = ip.replace(/^::ffff:/i, '');
    if (net.isIPv4(cleanIp)) {
      const parts = cleanIp.split('.').map(Number);
      if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
      if (parts[0] >= 224) return true;
      return false;
    }
    if (net.isIPv6(cleanIp)) {
      const lower = cleanIp.toLowerCase();
      if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
        return true;
      }
      return false;
    }
    return true;
  }

  async function isSafePublicUrl(rawUrl: string): Promise<boolean> {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      if (parsed.username || parsed.password) return false;
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname === 'metadata.google.internal'
      ) {
        return false;
      }
      if (net.isIP(hostname)) {
        return !isPrivateOrReservedIp(hostname);
      }
      const records = await dns.lookup(hostname, { all: true });
      if (!records || records.length === 0) return false;
      return records.every((r) => !isPrivateOrReservedIp(r.address));
    } catch {
      return false;
    }
  }

  app.use('/api', authenticateFirebaseUser);

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const parsedOrigin = new URL(origin);
        const originNormalized = parsedOrigin.origin.toLowerCase();
        const originHost = parsedOrigin.host.toLowerCase();
        const hostHeader = String(req.headers.host || '').trim().toLowerCase();
        const forwardedHost = app.get('trust proxy')
          ? String(req.headers['x-forwarded-host'] || '').split(',')[0].trim().toLowerCase()
          : '';

        const isAllowedOrigin =
          allowedOrigins.has(originNormalized) ||
          allowedOrigins.has(originHost) ||
          (hostHeader && originHost === hostHeader) ||
          (forwardedHost && originHost === forwardedHost) ||
          originHost.endsWith('.run.app') ||
          originHost.endsWith('.aistudio.google.com') ||
          originHost === `localhost:${PORT}` ||
          originHost === `127.0.0.1:${PORT}`;

        if (!isAllowedOrigin) {
          res.status(403).json({ ok: false, error: 'Cross-origin API requests are not permitted.' });
          return;
        }
      } catch {
        res.status(403).json({ ok: false, error: 'Invalid Origin header.' });
        return;
      }
    }

    // Use req.ip (which only honors X-Forwarded-For when trust proxy is explicitly configured)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    // All cost-bearing and generative AI routes categorized under strict rate bucket (BUG-013)
    const isLlmRoute = [
      '/summarize',
      '/chat',
      '/continue-summary',
      '/deep-dive',
      '/translate',
      '/transcribe-audio',
      '/extract-key-ideas',
      '/tts',
    ].includes(req.path);
    const rateCheck = defaultRateLimiter.check(clientIp, isLlmRoute);

    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil(rateCheck.resetInMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        ok: false,
        error: 'Rate limit exceeded. Please wait a moment before trying again.',
        retryAfter: retryAfterSec,
      });
      return;
    }

    // Protect expensive AI routes with authentication or client key (BUG-003)
    const EXPENSIVE_AI_ROUTES = new Set([
      '/summarize',
      '/continue-summary',
      '/deep-dive',
      '/chat',
      '/transcribe-audio',
      '/extract-key-ideas',
      '/tts',
      '/translate',
    ]);

    if (EXPENSIVE_AI_ROUTES.has(req.path)) {
      requireAuthOrUserKey(req, res, next);
      return;
    }

    next();
  });

  // Helper to fetch YouTube metadata via YouTube Data API v3 with oEmbed fallback
  async function fetchVideoOEmbed(videoId: string, apiKeyOverride?: string) {
    const activeKey = (apiKeyOverride || GOOGLE_API_KEY || (process.env.YOUTUBE_API_KEY || '')).trim();
    if (activeKey) {
      try {
        const ytApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(videoId)}&key=${activeKey}`;
        const ytRes = await fetch(ytApiUrl, { signal: AbortSignal.timeout(4500) });
        if (ytRes.ok) {
          const ytData = (await ytRes.json()) as YouTubeVideoListResponse;
          const item = ytData.items?.[0];
          if (item && item.snippet) {
            const snippet = item.snippet;
            const thumbs = snippet.thumbnails || {};
            const bestThumb =
              thumbs.maxres?.url ||
              thumbs.high?.url ||
              thumbs.medium?.url ||
              thumbs.default?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            return {
              title: snippet.title || `YouTube Video (${videoId})`,
              authorName: snippet.channelTitle || 'YouTube Creator',
              authorUrl: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : '',
              thumbnailUrl: bestThumb,
              description: snippet.description || '',
              publishedAt: snippet.publishedAt || '',
            };
          }
        }
      } catch (err) {
        // Fallback to oEmbed below
      }
    }

    try {
      const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as YouTubeOEmbedResponse;
        return {
          title: data.title || `YouTube Video (${videoId})`,
          authorName: data.author_name || 'YouTube Creator',
          authorUrl: data.author_url || '',
          thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          description: '',
          publishedAt: '',
        };
      }
    } catch (e) {
      // Fallback
    }
    return {
      title: `YouTube Video (${videoId})`,
      authorName: 'YouTube Creator',
      authorUrl: '',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      description: '',
      publishedAt: '',
    };
  }

  // 1. GET & POST /api/transcript - Multi-Method Transcript Extractor (YouTube, Mirrors, Gemini Native Video, Direct Subtitle URL, or Raw Text/SRT/VTT/JSON)
  const handleTranscriptRequest = async (req: Request, res: Response) => {
    try {
      const rawInput = String(
        req.body?.url ||
          req.body?.rawText ||
          req.query.url ||
          req.query.videoId ||
          ''
      ).trim();
      const customTitle = String(req.body?.title || req.query.title || '').trim();
      const clientYoutubeKey = String(
        req.headers['x-youtube-api-key'] ||
          req.body?.youtubeApiKey ||
          req.query?.youtubeApiKey ||
          ''
      ).trim();
      const clientCookies = String(
        req.headers['x-youtube-cookies'] ||
          req.body?.cookies ||
          req.query?.cookies ||
          ''
      ).trim();

      if (!rawInput) {
        res.status(400).json({ error: 'Please provide a YouTube video URL, video ID, subtitle URL, or transcript text.' });
        return;
      }

      const detected = detectMediaSourceType(rawInput);

      // Branch A: Vimeo Video
      if (detected.type === 'vimeo') {
        const result = await fetchVimeoMetadataAndTranscript(detected.cleanUrl || rawInput, detected.id);
        res.json({ ok: true, ...result });
        return;
      }

      // Branch B: Dailymotion Video
      if (detected.type === 'dailymotion') {
        const result = await fetchDailymotionMetadataAndTranscript(detected.cleanUrl || rawInput, detected.id);
        res.json({ ok: true, ...result });
        return;
      }

      // Branch C: TED Talks
      if (detected.type === 'ted') {
        const result = await fetchTedTalkMetadataAndTranscript(detected.cleanUrl || rawInput, detected.id);
        res.json({ ok: true, ...result });
        return;
      }

      // Branch C2: Loom Recording (BUG-005)
      if (detected.type === 'loom') {
        const result = await fetchLoomMetadataAndTranscript(detected.cleanUrl || rawInput, detected.id);
        res.json({ ok: true, ...result });
        return;
      }

      // Branch C3: Twitch Broadcast (BUG-006)
      if (detected.type === 'twitch') {
        const result = await fetchTwitchMetadataAndTranscript(detected.cleanUrl || rawInput);
        res.json({ ok: true, ...result });
        return;
      }

      // Branch D: Podcast RSS Feed
      if (detected.type === 'podcast_rss') {
        const epIdx = parseInt(String(req.body?.episodeIndex || req.query.episodeIndex || '0'), 10) || 0;
        const result = await fetchPodcastRssMetadataAndTranscript(detected.cleanUrl || rawInput, epIdx);
        res.json({ ok: true, ...result });
        return;
      }

      // Branch E: Direct Audio or Direct Video URL
      if (detected.type === 'direct_audio' || detected.type === 'direct_video') {
        const result = await fetchDirectMediaMetadataAndTranscript(detected.cleanUrl || rawInput, customTitle);
        res.json({ ok: true, ...result });
        return;
      }

      // Branch F: Direct Subtitle URL with SSRF redirect protection (BUG-009, BUG-011)
      if (detected.type === 'direct_subtitle') {
        try {
          const bodyText = await safeFetchText(rawInput, DEFAULT_MAX_TEXT_BYTES, { timeoutMs: 8000 });
          const parsedSegments = parseSubtitlePayload(bodyText, true);
          if (parsedSegments && parsedSegments.length > 0) {
            const fullText = parsedSegments.map((s) => s.text).join(' ');
            const totalWords = fullText.split(/\s+/).filter(Boolean).length;
            const lastSeg = parsedSegments[parsedSegments.length - 1];
            const durationSeconds = lastSeg ? lastSeg.start + lastSeg.duration : 0;
            res.json({
              ok: true,
              metadata: {
                videoId: '',
                url: rawInput,
                title: customTitle || new URL(rawInput).pathname.split('/').pop() || 'Subtitle Document',
                authorName: new URL(rawInput).hostname,
                durationSeconds: Math.round(durationSeconds),
                durationFormatted: formatTime(durationSeconds),
                sourceType: 'direct_subtitle',
                totalSegments: parsedSegments.length,
                totalWords,
                estimatedTokens: Math.round(totalWords * 1.33),
              },
              segments: parsedSegments,
              fullText,
            });
            return;
          }
        } catch (subErr: any) {
          res.status(400).json({ error: `Could not fetch subtitle file: ${subErr?.message || 'Access restricted'}` });
          return;
        }
      }

      // Branch G: Direct Text or Pasted Subtitles
      if (detected.type === 'direct_text' && rawInput.length > 25 && (rawInput.includes(' ') || rawInput.includes('\n'))) {
        const parsedSegments = parseSubtitlePayload(rawInput, true);
        if (parsedSegments && parsedSegments.length > 0) {
          const fullText = parsedSegments.map((s) => s.text).join(' ');
          const totalWords = fullText.split(/\s+/).filter(Boolean).length;
          const lastSeg = parsedSegments[parsedSegments.length - 1];
          const durationSeconds = lastSeg ? lastSeg.start + lastSeg.duration : 0;
          res.json({
            ok: true,
            metadata: {
              videoId: '',
              url: '',
              title: customTitle || 'Pasted / Uploaded Transcript',
              authorName: 'Direct Input',
              authorUrl: '',
              thumbnailUrl: '',
              durationSeconds: Math.round(durationSeconds),
              durationFormatted: formatTime(durationSeconds),
              sourceType: 'direct_text',
              totalSegments: parsedSegments.length,
              totalWords,
              estimatedTokens: Math.round(totalWords * 1.33),
            },
            segments: parsedSegments,
            fullText,
          });
          return;
        }
      }

      // Branch H: Web Article / Document Link
      if (detected.type === 'web_article') {
        const safe = await isSafePublicUrl(rawInput);
        if (safe) {
          try {
            const result = await fetchWebArticleMetadataAndTranscript(rawInput, customTitle);
            res.json({ ok: true, ...result });
            return;
          } catch (e: any) {
            // fallback
          }
        }
      }

      const videoId = detected.type === 'youtube' ? (detected.id || extractVideoId(rawInput)) : extractVideoId(rawInput);

      if (!videoId) {
        res.status(400).json({ error: 'Unrecognized media URL or transcript. Provide a YouTube, Vimeo, Dailymotion, TED Talk, Podcast RSS link, direct audio/video file, or pasted transcript.' });
        return;
      }

      // Branch B: Valid YouTube Video ID
      const oembed = await fetchVideoOEmbed(videoId, clientYoutubeKey);

      // 1. Instant check for curated sample transcripts
      let segments: ParsedSegment[] | null = SAMPLE_FALLBACK_TRANSCRIPTS[videoId] || null;

      // 2. Multi-method extraction (youtube-transcript, yt-dlp, Direct YouTube, Innertube, Piped, Invidious, Description Chapters, Gemini Native Video & Search Grounding)
      if (!segments || segments.length === 0) {
        segments = await fetchPipedTranscript(videoId, {
          title: oembed.title,
          authorName: oembed.authorName,
          description: oembed.description,
          youtubeApiKey: clientYoutubeKey,
          cookies: clientCookies,
        });
      }

      // Do not fabricate fake transcripts from descriptions or Wikipedia when captions are missing (C-03)
      if (!segments || segments.length === 0) {
        res.status(404).json({
          ok: false,
          error:
            'YouTube captions could not be automatically extracted for this video (bot verification required by YouTube). Use "Paste Text", "Upload Audio/Video", or provide your YouTube API Key / cookies in Settings.',
          requiresManualOrKey: true,
          metadata: {
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: oembed.title,
            authorName: oembed.authorName,
            authorUrl: oembed.authorUrl,
            thumbnailUrl: oembed.thumbnailUrl,
            durationSeconds: 0,
            durationFormatted: '00:00',
            totalSegments: 0,
            totalWords: 0,
            estimatedTokens: 0,
          },
        });
        return;
      }

      // Calculate statistics
      const fullText = segments.map((s) => s.text).join(' ');
      const totalWords = fullText.split(/\s+/).filter(Boolean).length;
      const lastSeg = segments[segments.length - 1];
      const durationSeconds = lastSeg ? lastSeg.start + lastSeg.duration : 0;
      const estimatedTokens = Math.round(totalWords * 1.33);

      res.json({
        ok: true,
        metadata: {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: oembed.title,
          authorName: oembed.authorName,
          authorUrl: oembed.authorUrl,
          thumbnailUrl: oembed.thumbnailUrl,
          durationSeconds: Math.round(durationSeconds),
          durationFormatted: formatTime(durationSeconds),
          totalSegments: segments.length,
          totalWords,
          estimatedTokens,
        },
        segments,
        fullText,
      });
    } catch (error: any) {
      console.error('Error fetching transcript:', error);
      res.status(500).json({
        error: error.message || 'Failed to retrieve transcript. Please try another video or paste manually.',
      });
    }
  };

  app.get('/api/transcript', handleTranscriptRequest);
  app.post('/api/transcript', handleTranscriptRequest);

  // 1b. POST /api/transcribe-audio - Multimodal Gemini speech-to-text for uploaded audio / video files
  app.post('/api/transcribe-audio', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType = 'audio/mp3', filename = 'Uploaded Audio' } = req.body || {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'Please provide valid audioBase64 payload to transcribe.' });
        return;
      }

      const ALLOWED_AUDIO_MIMES = new Set([
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'audio/webm',
        'audio/aac',
        'audio/m4a',
        'audio/x-m4a',
        'audio/flac',
        'audio/opus',
        'video/mp4',
        'video/webm',
      ]);
      const normalizedMime = String(mimeType).toLowerCase().trim().split(';')[0];
      if (!ALLOWED_AUDIO_MIMES.has(normalizedMime)) {
        res.status(400).json({
          error: `Unsupported media format "${normalizedMime}". Supported: mp3, wav, m4a, ogg, webm, mp4.`,
        });
        return;
      }

      const approxBytes = Math.round((audioBase64.length * 3) / 4);
      if (approxBytes > 25 * 1024 * 1024) {
        res.status(400).json({ error: 'Uploaded media file exceeds maximum allowed limit of 25 MB.' });
        return;
      }

      const cleanFilename = String(filename).slice(0, 150).replace(/[^\w\s\.\-]/g, '') || 'Uploaded Media';
      const result = await transcribeUploadedMedia(
        audioBase64,
        normalizedMime,
        cleanFilename
      );
      res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error('Audio transcription error:', err);
      res.status(500).json({ error: err?.message || 'Audio transcription failed.' });
    }
  });

  // 1c. GET /api/podcast-episodes - Inspects podcast RSS feeds and returns episode roster
  app.get('/api/podcast-episodes', async (req: Request, res: Response) => {
    try {
      const feedUrl = String(req.query.url || '').trim();
      if (!feedUrl) {
        res.status(400).json({ error: 'Please provide a podcast RSS feed URL.' });
        return;
      }
      const data = await fetchPodcastRssMetadataAndTranscript(feedUrl, 0);
      res.json({
        ok: true,
        title: data.metadata.title,
        authorName: data.metadata.authorName,
        thumbnailUrl: data.metadata.thumbnailUrl,
        episodes: data.metadata.episodes || [],
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to parse podcast feed.' });
    }
  });

  type ServerAIProvider =
    | 'gemini'
    | 'openrouter'
    | 'groq'
    | 'openai'
    | 'anthropic'
    | 'local-extractive';

  // In-memory cache & rate-limit tracker to preserve free-tier model quotas (stores actual providerUsed - BUG-006)
  const geminiResponseCache = new Map<
    string,
    { text: string; modelUsed: string; providerUsed: ServerAIProvider; finishReason: string }
  >();
  const modelCooldownUntil = new Map<string, number>();

  function findSegmentTimestampForText(
    snippet: string,
    segments?: Array<{ start?: number; formattedTime?: string; text?: string }>
  ): string | null {
    if (!Array.isArray(segments) || segments.length === 0 || !snippet) return null;
    const cleanSnippet = snippet.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanSnippet) return null;
    const words = cleanSnippet.split(' ').filter((w) => w.length > 3);

    let bestSeg: { start?: number; formattedTime?: string; text?: string } | null = null;
    let bestScore = 0;

    for (const seg of segments) {
      const segText = String(seg?.text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!segText) continue;
      if (segText.includes(cleanSnippet.slice(0, 32)) || cleanSnippet.includes(segText.slice(0, 32))) {
        bestSeg = seg;
        bestScore = 100;
        break;
      }
      if (words.length > 0) {
        let hits = 0;
        for (const w of words) {
          if (segText.includes(w)) hits++;
        }
        const score = hits / words.length;
        if (score > bestScore && hits >= 2) {
          bestScore = score;
          bestSeg = seg;
        }
      }
    }

    if (!bestSeg) return null;
    if (bestSeg.formattedTime && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(bestSeg.formattedTime)) {
      return bestSeg.formattedTime;
    }
    if (typeof bestSeg.start === 'number' && !isNaN(bestSeg.start) && bestSeg.start >= 0) {
      return formatTime(bestSeg.start);
    }
    return null;
  }

  function buildDeterministicFallbackReport(
    promptText: string,
    explicitVideoId?: string,
    segments?: Array<{ start?: number; formattedTime?: string; text?: string }>
  ): string {
    const titleMatch = promptText.match(/Video Title:\s*"([^"]+)"/i) || promptText.match(/VIDEO TITLE:\s*"([^"]+)"/i);
    const title = titleMatch ? titleMatch[1] : 'Video Breakdown';
    const urlMatch = promptText.match(/Source URL:\s*([^\s\n]+)/i);
    const extractedVid = explicitVideoId || (urlMatch ? extractVideoId(urlMatch[1]) : null);
    const transcriptIdx = promptText.lastIndexOf('TRANSCRIPT:');
    const rawTranscript = transcriptIdx !== -1 ? promptText.slice(transcriptIdx + 11).trim() : promptText;

    // Only return curated sample reports when the exact sample videoId matches (C-04, BUG-010)
    const curatedReport = extractedVid ? getSampleFallbackReport(extractedVid, title) : null;
    if (curatedReport) {
      return curatedReport;
    }

    const sentences = rawTranscript
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25);

    const totalSentences = sentences.length;
    const intro = sentences.slice(0, Math.min(6, totalSentences)).join(' ');
    const sectionSize = Math.max(4, Math.floor(totalSentences / 6));

    const chronologicalSections: string[] = [];
    for (let i = 0; i < Math.min(6, Math.ceil(totalSentences / sectionSize)); i++) {
      const chunk = sentences.slice(i * sectionSize, (i + 1) * sectionSize);
      if (chunk.length === 0) continue;
      const lead = chunk[0].replace(/^\[?\d{1,2}:\d{2}\]?\s*/, '').slice(0, 75);
      const realTs = findSegmentTimestampForText(chunk[0], segments);
      const tsPrefix = realTs ? `[${realTs}] ` : '';
      chronologicalSections.push(
        `- **${tsPrefix}${lead}...**:\n  ${chunk.join(' ')}`
      );
    }

    const keyStatements = sentences
      .filter((s) => s.length > 60 && s.length < 240)
      .slice(0, 6)
      .map((q) => {
        const realTs = findSegmentTimestampForText(q, segments);
        return realTs ? `> "${q}" — **[${realTs}]**` : `> "${q}"`;
      })
      .join('\n\n');

    return `# ${title}

## What This Video Is Really About
- **The Main Message**: ${sentences[0] || 'Here is a clear, plain-English walkthrough of the main ideas and stories shared in this video.'}
- **The Big Picture**: ${intro || rawTranscript.slice(0, 1200)}

## Step-by-Step Story Walkthrough
${chronologicalSections.join('\n\n') || rawTranscript.slice(0, 2500)}

## Best Quotes to Remember
${keyStatements || `> "${rawTranscript.slice(0, 300)}"`}

## Practical Takeaways
1. **Core Takeaway**: ${sentences[Math.floor(totalSentences * 0.7)] || sentences[0] || 'Review the timeline above to jump directly to any moment in the video.'}
2. **Closing Thought**: ${sentences[totalSentences - 1] || 'Wrapped up directly from the full video transcript.'}

---

## Exact Resources & Direct Research Portals
- [**Google Scholar Academic Citations for "${title}"**](https://scholar.google.com/scholar?q=${encodeURIComponent(title)})
- [**OpenLibrary Books & Publications on "${title}"**](https://openlibrary.org/search?q=${encodeURIComponent(title)})
- [**Internet Archive Primary Scans & Media for "${title}"**](https://archive.org/search?query=${encodeURIComponent(title)})
- [**Wikipedia Reference Index for "${title}"**](https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title)})`;
  }

  function buildHumanDeepDive(
    topic: string,
    transcript: string,
    title: string,
    segments?: Array<{ start?: number; formattedTime?: string; text?: string }>
  ): string {
    const cleanTopic = topic.trim();
    const keywords = cleanTopic
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (Array.isArray(segments) && segments.length > 0) {
      const matchingSegs = segments.filter((seg) => {
        const lower = String(seg.text || '').toLowerCase();
        return lower.includes(cleanTopic.toLowerCase()) || keywords.some((k) => lower.includes(k));
      });
      const chosenSegs = (matchingSegs.length > 0 ? matchingSegs.slice(0, 10) : segments.slice(0, 8));
      return `### What the Video Says About "${cleanTopic}"\n\nIn **${title || 'this video'}**, here is how **${cleanTopic}** comes up and why it matters in plain English:\n\n${chosenSegs
        .map((seg) => {
          const ts =
            seg.formattedTime ||
            (typeof seg.start === 'number' && !isNaN(seg.start) ? formatTime(seg.start) : null);
          return ts ? `- **[${ts}]** ${seg.text}` : `- ${seg.text}`;
        })
        .join('\n\n')}\n\n**In short:** The speaker uses **${cleanTopic}** to ground the bigger message in real-world experience so you can apply the lesson directly.`;
    }

    const sentences = transcript
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const matching = sentences.filter((s) => {
      const lower = s.toLowerCase();
      return lower.includes(cleanTopic.toLowerCase()) || keywords.some((k) => lower.includes(k));
    });

    const chosen = matching.length > 0 ? matching.slice(0, 10) : sentences.slice(0, 8);
    return `### What the Video Says About "${cleanTopic}"\n\nIn **${title || 'this video'}**, here is how **${cleanTopic}** comes up and why it matters in plain English:\n\n${chosen
      .map((s) => {
        const realTs = findSegmentTimestampForText(s, segments);
        return realTs ? `- **[${realTs}]** ${s}` : `- ${s}`;
      })
      .join('\n\n')}\n\n**In short:** The speaker uses **${cleanTopic}** to ground the bigger message in real-world experience so you can apply the lesson directly.`;
  }

  function buildHumanChatAnswer(
    question: string,
    transcript: string,
    title: string,
    videoId?: string,
    segments?: Array<{ start?: number; formattedTime?: string; text?: string }>
  ): string {
    const qLower = question.toLowerCase();
    if (videoId === 'UF8uR6Z6KLc') {
      if (qLower.includes('quote') || qLower.includes('memorable')) {
        return `Here are the most memorable quotes Steve Jobs shared in this speech, along with their exact timestamps:\n\n- **[04:35]** *"You can't connect the dots looking forward; you can only connect them looking backwards."*\n- **[07:05]** *"The heaviness of being successful was replaced by the lightness of being a beginner again."*\n- **[08:22]** *"The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle."*\n- **[12:55]** *"Your time is limited, so don't waste it living someone else's life."*\n- **[14:12]** *"Stay Hungry. Stay Foolish."*`;
      }
      if (qLower.includes('practical') || qLower.includes('advice') || qLower.includes('lesson')) {
        return `Here is the most practical advice from Steve Jobs' talk in plain English:\n\n1. **Follow your curiosity even when it has no obvious career payoff ([02:15])**: Dropping in on a calligraphy class at Reed College seemed useless at the time, but 10 years later it shaped the Macintosh ([03:45]).\n2. **Don't let setbacks convince you it's over ([05:24])**: Getting fired from Apple at 30 freed him to enter the most creative years of his life at NeXT and Pixar ([07:12]).\n3. **Use the morning mirror test ([09:05])**: If you dread what you're about to do for too many days in a row, take it as a clear sign to change something.\n4. **Stay Hungry, Stay Foolish ([14:12])**: Keep a beginner's curiosity and don't let other people's opinions drown out your own inner voice.`;
      }
    }

    const stopWords = new Set(['what', 'where', 'when', 'which', 'about', 'from', 'this', 'video', 'does', 'speaker', 'share', 'there', 'their', 'explain']);
    const keywords = qLower
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    if (Array.isArray(segments) && segments.length > 0) {
      const scoredSegs = segments
        .map((seg, idx) => {
          const text = String(seg.text || '').trim();
          const lower = text.toLowerCase();
          const hits = keywords.reduce((acc, k) => acc + (lower.includes(k) ? 1 : 0), 0);
          return { seg, idx, hits, text };
        })
        .filter((item) => item.text.length > 15 && item.hits > 0)
        .sort((a, b) => b.hits - a.hits);

      const bestSegs = (
        scoredSegs.length > 0
          ? scoredSegs.slice(0, 6)
          : segments
              .filter((s) => String(s.text || '').trim().length > 15)
              .slice(0, 5)
              .map((seg, idx) => ({ seg, idx, hits: 1, text: String(seg.text || '').trim() }))
      ).sort((a, b) => a.idx - b.idx);

      return `Here is what **"${title || 'the video'}"** shares about that in plain English:\n\n${bestSegs
        .map((item) => {
          const ts =
            item.seg.formattedTime ||
            (typeof item.seg.start === 'number' && !isNaN(item.seg.start) ? formatTime(item.seg.start) : null);
          return ts ? `- **[${ts}]** ${item.text}` : `- ${item.text}`;
        })
        .join('\n\n')}`;
    }

    const sentences = transcript
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25);

    const scored = sentences
      .map((s, idx) => {
        const lower = s.toLowerCase();
        const hits = keywords.reduce((acc, k) => acc + (lower.includes(k) ? 1 : 0), 0);
        return { s, idx, hits };
      })
      .filter((item) => item.hits > 0)
      .sort((a, b) => b.hits - a.hits);

    const best = (scored.length > 0 ? scored.slice(0, 6) : sentences.slice(0, 5).map((s, idx) => ({ s, idx, hits: 1 })))
      .sort((a, b) => a.idx - b.idx);

    return `Here is what **"${title || 'the video'}"** shares about that in plain English:\n\n${best
      .map((item) => {
        const realTs = findSegmentTimestampForText(item.s, segments);
        return realTs ? `- **[${realTs}]** ${item.s}` : `- ${item.s}`;
      })
      .join('\n\n')}`;
  }

  // Resilient Gemini helper with automatic model fallback, cooldown tracking, and bounded caching
  async function runGeminiWithFallback(
    promptText: string,
    maxTokens: number = 8192,
    segments?: Array<{ start?: number; formattedTime?: string; text?: string }>
  ): Promise<{
    text: string;
    modelUsed: string;
    providerUsed: ServerAIProvider;
    finishReason: string;
    warning?: string;
  }> {
    const cacheKey = `${maxTokens}:${promptText.slice(0, 400)}:${promptText.slice(-400)}:${promptText.length}`;
    const cached = geminiResponseCache.get(cacheKey);
    if (cached) {
      return { ...cached };
    }

    let lastError = '';
    if (process.env.GEMINI_API_KEY) {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      const now = Date.now();

      for (const m of modelsToTry) {
        const cooldown = modelCooldownUntil.get(m) || 0;
        if (now < cooldown) {
          continue;
        }

        try {
          const response = await ai.models.generateContent({
            model: m,
            contents: promptText,
            config: {
              maxOutputTokens: maxTokens,
              temperature: 0.3,
            },
          });
          const candidate = response.candidates?.[0];
          const finishReason = candidate?.finishReason || 'STOP';
          const result = {
            text: response.text || '',
            modelUsed: m,
            providerUsed: 'gemini' as const,
            finishReason,
          };
          if (result.text) {
            setBoundedCache(geminiResponseCache, cacheKey, result, 150);
            return result;
          }
        } catch (e: any) {
          lastError = String(e?.message || e || 'Gemini error');
          const errStr = lastError.toLowerCase();
          if (
            errStr.includes('429') ||
            errStr.includes('resource_exhausted') ||
            errStr.includes('quota') ||
            errStr.includes('overloaded') ||
            errStr.includes('503') ||
            errStr.includes('unavailable')
          ) {
            modelCooldownUntil.set(m, Date.now() + 5 * 60 * 1000);
          }
        }
      }
    }

    // Safe fallback to Groq LPU API if GROQ_API_KEY is configured
    if (process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: promptText }],
            max_tokens: Math.min(maxTokens, 8000),
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (groqRes.ok) {
          const groqData = (await groqRes.json()) as any;
          const text = groqData.choices?.[0]?.message?.content || '';
          if (text) {
            const resObj = {
              text,
              modelUsed: 'groq/llama-3.3-70b-versatile',
              providerUsed: 'groq' as const,
              finishReason: 'STOP',
            };
            setBoundedCache(geminiResponseCache, cacheKey, resObj, 150);
            return resObj;
          }
        }
      } catch {}
    }

    // Safe fallback to OpenAI API if OPENAI_API_KEY is configured
    if (process.env.OPENAI_API_KEY) {
      try {
        const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptText }],
            max_tokens: Math.min(maxTokens, 8000),
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (oaRes.ok) {
          const oaData = (await oaRes.json()) as any;
          const text = oaData.choices?.[0]?.message?.content || '';
          if (text) {
            const resObj = {
              text,
              modelUsed: 'openai/gpt-4o-mini',
              providerUsed: 'openai' as const,
              finishReason: 'STOP',
            };
            setBoundedCache(geminiResponseCache, cacheKey, resObj, 150);
            return resObj;
          }
        }
      } catch {}
    }

    // Safe fallback to Anthropic Claude API if ANTHROPIC_API_KEY is configured
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const antRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: Math.min(maxTokens, 8000),
            messages: [{ role: 'user', content: promptText }],
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (antRes.ok) {
          const antData = (await antRes.json()) as any;
          const text = antData.content?.[0]?.text || '';
          if (text) {
            const resObj = {
              text,
              modelUsed: 'anthropic/claude-3-5-sonnet',
              providerUsed: 'anthropic' as const,
              finishReason: 'STOP',
            };
            setBoundedCache(geminiResponseCache, cacheKey, resObj, 150);
            return resObj;
          }
        }
      } catch {}
    }

    // When no LLM key is configured or all failed, attribute honestly as local-extractive (C-05)
    const fallbackText = buildDeterministicFallbackReport(promptText, undefined, segments);
    return {
      text: fallbackText,
      modelUsed: 'extractive-fallback',
      providerUsed: 'local-extractive',
      finishReason: 'STOP',
      warning: lastError
        ? `Cloud AI provider error (${lastError.slice(0, 120)}). Generated local extractive breakdown.`
        : 'No server AI key configured. Generated local extractive breakdown.',
    };
  }

  // 2. POST /api/summarize
  app.post('/api/summarize', async (req: Request, res: Response) => {
    try {
      const {
        transcript,
        segments,
        title,
        url,
        provider = 'openrouter',
        openRouterKey,
        model = 'meta-llama/llama-3.3-70b-instruct:free',
        summaryType = 'comprehensive',
        detailLevel = 'extensive',
        customPrompt,
      } = req.body;

      if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
        res.status(400).json({ error: 'Transcript content is required for summarization.' });
        return;
      }

      const videoTitle = title || 'YouTube Video';

      // Build natural, human-friendly instructions so the summary reads like a smart, warm human wrote it
      let typeInstructions = '';
      if (summaryType === 'massive' || summaryType === 'comprehensive') {
        typeInstructions = `Write a complete, rich, deeply human breakdown of this video based on its transcript.
Write in warm, natural, everyday English—like a thoughtful, articulate friend explaining the whole video to someone so they don't miss a single story, example, or insight. Avoid stiff corporate buzzwords, robotic phrasing, or academic jargon.

REQUIRED SECTIONS (Use clean Markdown):
# ${videoTitle}

## What This Video Is Really About
- **The Main Message**: In plain, everyday words, what is the speaker really trying to tell us?
- **Why It Matters**: Why do people care about this topic, and what problem or question does it solve?
- **The Big Picture**: 2-3 natural, engaging paragraphs walking through the heart of the video.

## Step-by-Step Story & Timeline Walkthrough
Walk through the video from start to finish so the reader feels like they watched the whole thing. Include [MM:SS] timestamps for each part:
- **[MM:SS] What Happens / Topic Title**:
  2-3 clear, conversational paragraphs explaining what the speaker says, the stories they tell, how they explain things, and the examples they give.

## The Big Ideas Explained Simply
For each major idea or concept in the video:
- **What It Means in Plain English**: Simple, clear explanation anyone can understand.
- **How It Works**: The practical logic behind it.
- **Real-Life Example**: How it shows up in everyday life or work.

## Stories, Examples & Real Numbers Shared
- Retell every personal story, experiment, historical example, or real-world case mentioned by the speaker so the human details come alive.

## Best Quotes to Remember
- Share 5-8 standout quotes from the video with their [MM:SS] timestamps and a short note on why each quote hits home.

## How You Can Actually Use This
- Clear, down-to-earth advice, habits, and takeaways you can put into practice today, plus common mistakes to avoid.

## Common Questions & Clear Answers
- 5-7 natural questions someone might ask after watching this video, answered clearly and directly.

## People, Books, Exact Resources & Direct Sources Mentioned
- A detailed list of every book, research paper, dataset, tool, person, company, or historical reference mentioned in the video, with [MM:SS] timestamps and direct Markdown reference links (e.g. Wikipedia, Google Scholar, arXiv, OpenLibrary, or official sites) so the reader can explore the exact primary resources.`;
      } else if (summaryType === 'chronological') {
        typeInstructions = `Write a natural, step-by-step walkthrough of the video from start to finish.
Use warm, everyday human language and include [MM:SS] timestamps for every story, topic shift, and example.

REQUIRED SECTIONS:
# ${videoTitle}: Step-by-Step Timeline

## Quick Overview
2 natural paragraphs setting the scene and explaining what the video covers.

## From Start to Finish
For each part of the video:
### [MM:SS] - [MM:SS]: [What's Happening Here]
- **The Full Story**: 2-3 clear, engaging paragraphs explaining what the speaker talks about or shows.
- **Key Points & Examples**: The specific stories, reasons, and examples shared.

## How It All Wraps Up
How the speaker brings everything together at the end.`;
      } else if (summaryType === 'concepts') {
        typeInstructions = `Explain every big idea, concept, and mental model from this video in plain, everyday human language.
Imagine you are explaining these ideas to a curious friend over coffee—clear, concrete, and zero jargon.

REQUIRED SECTIONS:
# ${videoTitle}: Big Ideas Explained Simply

## How Everything Fits Together
A simple overview of how the main ideas in this video connect.

## The Core Ideas
For EACH major idea or concept in the video:
### 1. [Name of the Idea]
- **In Plain English**: What it means without any fancy jargon.
- **How It Actually Works**: Step-by-step explanation.
- **What People Often Get Wrong**: Common misunderstandings.
- **How to Use It**: Real-world example.

## Quick Comparison
How the different ideas or approaches in the video compare to each other.`;
      } else if (summaryType === 'actionable') {
        typeInstructions = `Turn the insights from this video into practical, down-to-earth advice that a real person can actually use in their life or work.
Write in warm, encouraging, direct everyday English.

REQUIRED SECTIONS:
# ${videoTitle}: Practical Advice & Next Steps

## The Main Goal
What can you change or improve in your life using what's in this video?

## What to Do Step-by-Step
- **Things You Can Do Today**: Simple, immediate actions.
- **Habits to Build Over Time**: Longer-term practices that make a real difference.

## Mistakes to Watch Out For
Common traps people fall into and how to avoid them.

## Daily Rules of Thumb
Simple reminders to keep in mind.`;
      } else if (summaryType === 'study_guide') {
        typeInstructions = `Create a friendly, easy-to-read study guide and Q&A from this video transcript in plain, natural English.

REQUIRED SECTIONS:
# ${videoTitle}: Study Notes & Q&A

## Key Terms in Plain English
Simple, clear explanations of the important words and terms used in the video.

## Main Ideas at a Glance
10 clear takeaways and why they matter.

## Questions & Answers
8 thoughtful questions and complete, easy-to-understand answers with [MM:SS] timestamps.`;
      }

      const systemInstruction = `You are a warm, gifted human writer and storyteller who excels at turning video transcripts into clear, engaging, deeply relatable guides.
Write like a real human—natural rhythm, clear everyday words, zero corporate jargon, and zero robotic stiffness.
${typeInstructions}

IMPORTANT RULES:
1. Write Naturally: Sound like a thoughtful human writer, never like a corporate memo or textbook.
2. Be Thorough: Don't skip the good stories, specific details, or real examples from the video.
3. Include Timestamps: Keep [MM:SS] timestamps so the reader can jump right to that moment in the video.
4. Clean Formatting: Use clear headings, bold highlights, blockquotes for real quotes, and bullet points where helpful. Do not use emojis.
5. Stay True to the Video: Stick to what the speaker actually said and shared.`;

      const detailInstructionMap: Record<string, string> = {
        brief: 'Brief & Concise (Keep sections compact; focus on top takeaways and high-level summary)',
        concise: 'Brief & Concise (Keep sections compact; focus on top takeaways and high-level summary)',
        medium: 'Balanced & Structured (Moderate depth with key examples and clear section breakdowns)',
        standard: 'Balanced & Structured (Moderate depth with key examples and clear section breakdowns)',
        detailed: 'Detailed & Thorough (Comprehensive chronological walkthrough, technical nuances, and verbatim quotes)',
        extensive: 'Detailed & Thorough (Comprehensive chronological walkthrough, technical nuances, and verbatim quotes)',
        comprehensive: 'Massive, Exhaustive Detail (Cover every chronological milestone, story, quote, and entity in full depth)',
        massive: 'Massive, Exhaustive Detail (Cover every chronological milestone, story, quote, and entity in full depth)',
      };
      const detailGuidance = detailInstructionMap[String(detailLevel).toLowerCase()] || detailInstructionMap.comprehensive;

      const userPrompt = `Video Title: "${videoTitle}"
Source URL: ${url || 'N/A'}
Requested Detail Level: ${detailLevel} (${detailGuidance})
Summary Mode: ${summaryType}
${customPrompt ? `Special User Request: ${customPrompt}\n` : ''}

TRANSCRIPT:
${transcript.slice(0, 200000)}
`;

      let openRouterWarning = '';

      // Branch 1: OpenRouter (with 55s timeout, model allowlist for server key, and explicit error reporting - C-05, C-06, C-08, H-10)
      if (provider === 'openrouter') {
        const { key: apiKey, isUserKey } = getOpenRouterRequestKey(req);

        if (apiKey) {
          const targetModel = resolveOpenRouterModel(model, isUserKey);
          try {
            const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.APP_URL || 'https://aistudio.google.com',
                'X-Title': 'OpenTranscript AI',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: targetModel,
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: userPrompt },
                ],
                max_tokens: 8192,
                temperature: 0.3,
              }),
              signal: AbortSignal.timeout(55000),
            });

            if (orResponse.ok) {
              const data = (await orResponse.json()) as any;
              const choice = data.choices?.[0];
              const markdown = choice?.message?.content || '';
              if (markdown.trim()) {
                const finishReason = choice?.finish_reason || 'stop';
                const isTruncated = finishReason === 'length';
                const usage = data.usage;

                res.json({
                  ok: true,
                  markdown,
                  modelUsed: targetModel,
                  providerUsed: 'openrouter',
                  finishReason,
                  isTruncated,
                  continuationCount: 0,
                  tokenUsage: usage
                    ? {
                        promptTokens: usage.prompt_tokens,
                        completionTokens: usage.completion_tokens,
                        totalTokens: usage.total_tokens,
                      }
                    : undefined,
                  summaryType,
                  createdAt: new Date().toISOString(),
                });
                return;
              }
            } else {
              const errBody = await orResponse.text().catch(() => '');
              openRouterWarning = `OpenRouter HTTP ${orResponse.status}: ${errBody.slice(0, 160) || orResponse.statusText}`;
              console.warn('OpenRouter non-OK status:', openRouterWarning);
            }
          } catch (orErr: any) {
            openRouterWarning = `OpenRouter request failed: ${orErr?.message || 'timeout'}`;
            console.warn('OpenRouter request failed, falling back:', openRouterWarning);
          }
        } else {
          openRouterWarning = 'No OpenRouter API key provided.';
        }

        // Automatic fallback to Gemini / Deterministic Extractive Guide
        const geminiResult = await runGeminiWithFallback(`${systemInstruction}\n\n${userPrompt}`, 8192, segments);
        const isTruncated = geminiResult.finishReason === 'MAX_TOKENS';
        const combinedWarning = [openRouterWarning, geminiResult.warning].filter(Boolean).join(' ');
        res.json({
          ok: true,
          markdown: geminiResult.text || buildDeterministicFallbackReport(userPrompt, undefined, segments),
          modelUsed: geminiResult.modelUsed,
          providerUsed: geminiResult.providerUsed,
          warning: combinedWarning || undefined,
          summaryType,
          finishReason: geminiResult.finishReason,
          isTruncated,
          continuationCount: 0,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      // Branch 2: Gemini (with honest provider attribution on fallback - C-05)
      const geminiResult = await runGeminiWithFallback(`${systemInstruction}\n\n${userPrompt}`, 8192, segments);
      const isTruncated = geminiResult.finishReason === 'MAX_TOKENS';
      res.json({
        ok: true,
        markdown: geminiResult.text || buildDeterministicFallbackReport(userPrompt, undefined, segments),
        modelUsed: geminiResult.modelUsed,
        providerUsed: geminiResult.providerUsed,
        warning: geminiResult.warning,
        finishReason: geminiResult.finishReason,
        isTruncated,
        continuationCount: 0,
        summaryType,
        createdAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Summarize error:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Summarization failed.',
      });
    }
  });

  // 3. POST /api/continue-summary - Seamlessly continue summary from where it stopped
  app.post('/api/continue-summary', async (req: Request, res: Response) => {
    try {
      const {
        previousMarkdown = '',
        transcript = '',
        title = '',
        provider = 'openrouter',
        openRouterKey,
        model = 'meta-llama/llama-3.3-70b-instruct:free',
        summaryType = 'massive',
        detailLevel = 'massive',
        continuationCount = 0,
      } = req.body;

      if (!previousMarkdown) {
        res.status(400).json({ error: 'Previous summary text is required to continue.' });
        return;
      }
      if (!transcript) {
        res.status(400).json({ error: 'Transcript is required to continue summary.' });
        return;
      }

      const trailingSnippet = previousMarkdown.slice(-3500);
      const headingMatches = previousMarkdown.match(/^#{1,3}\s+.+$/gm) || [];
      const coveredHeadings = headingMatches.slice(-8).join('\n');

      // Detect last covered timestamp to offset transcript for long videos (BUG-048)
      const lastTsMatches = Array.from(trailingSnippet.matchAll(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g));
      const lastMatch = lastTsMatches.length > 0 ? (lastTsMatches[lastTsMatches.length - 1] as unknown as string[]) : null;
      const lastTs = lastMatch && lastMatch[1] ? lastMatch[1] : null;

      let transcriptSlice = transcript;
      if (transcript.length > 190000 && lastTs) {
        const tsPos = transcript.indexOf(`[${lastTs}]`);
        if (tsPos > 1000) {
          transcriptSlice = transcript.slice(tsPos - 500, tsPos + 185000);
        } else {
          transcriptSlice = transcript.slice(0, 190000);
        }
      } else {
        transcriptSlice = transcript.slice(0, 190000);
      }

      const continuationSystemInstruction = `You are a warm, clear human writer continuing an in-depth video breakdown that paused before finishing.

CRITICAL CONTINUATION RULES:
1. SEAMLESS MERGE: Pick up at the EXACT place where the previous text stopped. If it ended mid-sentence, finish that sentence naturally first.
2. ZERO REPETITION: Do NOT repeat sections that were already covered.
3. NO META CHATTER: Start directly with the continuing text.
4. WARM HUMAN VOICE: Keep the writing natural, clear, conversational, and easy to read, with [MM:SS] timestamps.
5. FINISH THE STORY: Cover the remaining parts of the video transcript all the way to the end.`;

      const continuationUserPrompt = `VIDEO TITLE: "${title || 'Video'}"
DETAIL LEVEL: ${detailLevel} (Massive, exhaustive detail)
ORIGINAL SUMMARY TYPE: ${summaryType}

VIDEO FULL TRANSCRIPT:
${transcriptSlice}

==================================================
PREVIOUS HEADINGS ALREADY COVERED:
${coveredHeadings || 'Beginning of document'}

TEXT SNIPPET EXACTLY WHERE THE SUMMARY STOPPED:
"""
${trailingSnippet}
"""
==================================================

TASK:
Resume writing the summary from the EXACT point where the snippet above stopped.
If the last sentence above is unfinished, complete it immediately and then continue generating the next detailed sections and chronological points until the entire video is comprehensively concluded.`;

      let continuationText = '';
      let modelUsed = model;
      let providerUsed: string = provider;
      let finishReason = 'stop';
      let isTruncated = false;
      let warningMsg = '';

      const { key: apiKey, isUserKey } = getOpenRouterRequestKey(req);
      if (provider === 'openrouter' && apiKey) {
        const targetModel = resolveOpenRouterModel(model, isUserKey);
        modelUsed = targetModel;
        try {
          const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': process.env.APP_URL || 'https://aistudio.google.com',
              'X-Title': 'OpenTranscript AI',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: targetModel,
              messages: [
                { role: 'system', content: continuationSystemInstruction },
                { role: 'user', content: continuationUserPrompt },
              ],
              max_tokens: 8192,
              temperature: 0.3,
            }),
            signal: AbortSignal.timeout(55000),
          });

          if (orResponse.ok) {
            const data = (await orResponse.json()) as any;
            const choice = data.choices?.[0];
            continuationText = choice?.message?.content || '';
            finishReason = choice?.finish_reason || 'stop';
            isTruncated = finishReason === 'length';
          } else {
            const errBody = await orResponse.text().catch(() => '');
            warningMsg = `OpenRouter HTTP ${orResponse.status}: ${errBody.slice(0, 150)}`;
          }
        } catch (err: any) {
          warningMsg = `OpenRouter error: ${err?.message || 'timeout'}`;
        }
      }

      if (!continuationText.trim()) {
        const gemResult = await runGeminiWithFallback(`${continuationSystemInstruction}\n\n${continuationUserPrompt}`, 8192);
        continuationText = gemResult.text || '';
        modelUsed = gemResult.modelUsed;
        providerUsed = gemResult.providerUsed;
        finishReason = gemResult.finishReason || 'STOP';
        isTruncated = finishReason === 'MAX_TOKENS';
        warningMsg = [warningMsg, gemResult.warning].filter(Boolean).join(' ');
      }

      const prevTrimmed = previousMarkdown.trimEnd();
      let nextTrimmed = continuationText.trimStart();

      // Seam overlap deduplication (BUG-049)
      const prevLines = prevTrimmed.split('\n').filter(Boolean);
      const prevLastLine = (prevLines[prevLines.length - 1] || '').trim();
      if (prevLastLine && prevLastLine.length > 5 && nextTrimmed.startsWith(prevLastLine)) {
        nextTrimmed = nextTrimmed.slice(prevLastLine.length).trimStart();
      }

      const endsWithSentenceEnd = /[.!?:\n#\-*`]$/.test(prevTrimmed);

      let merged = '';
      if (!endsWithSentenceEnd && !nextTrimmed.startsWith('#') && !nextTrimmed.startsWith('\n') && !nextTrimmed.startsWith('-')) {
        merged = prevTrimmed + ' ' + nextTrimmed;
      } else {
        merged = prevTrimmed + '\n\n' + nextTrimmed;
      }

      res.json({
        ok: true,
        continuation: nextTrimmed,
        fullMarkdown: merged,
        modelUsed,
        providerUsed,
        warning: warningMsg || undefined,
        finishReason,
        isTruncated,
        continuationCount: (continuationCount || 0) + 1,
      });
    } catch (err: any) {
      console.error('Error continuing summary:', err);
      res.status(500).json({
        ok: false,
        error: err.message || 'Failed to continue summary.',
      });
    }
  });

  // 3. POST /api/deep-dive - Expand a specific section or topic with 5x depth
  app.post('/api/deep-dive', async (req: Request, res: Response) => {
    try {
      const {
        topic,
        transcript,
        segments,
        title,
        provider = 'gemini',
        openRouterKey,
        model = 'meta-llama/llama-3.3-70b-instruct:free',
      } = req.body;

      if (!topic || !transcript) {
        res.status(400).json({ error: 'Topic and transcript are required for deep dive expansion.' });
        return;
      }

      // Advanced RAG Retrieval: Multi-Query RRF + Grounded Facts
      const transcriptIndex = createTranscriptIndex(transcript, segments);
      const retrievedPassages = retrieveWithMultiQueryRRF(transcriptIndex, topic, 8, 2);
      const groundedContextBlock = formatRetrievedContextForPrompt(retrievedPassages);
      const keyFacts = extractGroundedFacts(transcriptIndex, topic, 4);
      const factsBlock = keyFacts.length > 0
        ? `\nKEY GROUNDED FACTS & METRICS IN AUDIO:\n${keyFacts.map((f) => `- [${f.timestamp}] ${f.fact}`).join('\n')}\n`
        : '';

      const prompt = `You are a thoughtful, clear human guide. The user wants a deeper, more detailed explanation of "${topic}" from the video "${title || 'Video'}".
Read through the transcript and the exact grounded audio passages below, and explain every nuance, story, example, quote, and practical lesson about "${topic}" in natural, engaging everyday English. Always include helpful [MM:SS] timestamps where the speaker discusses it.

${groundedContextBlock}
${factsBlock}
TRANSCRIPT:
${transcript.slice(0, 120000)}
`;

      let openRouterWarning = '';
      if (provider === 'openrouter') {
        const { key: apiKey, isUserKey } = getOpenRouterRequestKey(req);
        if (apiKey) {
          const targetModel = resolveOpenRouterModel(model, isUserKey);
          try {
            const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.APP_URL || 'https://aistudio.google.com',
                'X-Title': 'OpenTranscript AI',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: targetModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4096,
                temperature: 0.3,
              }),
              signal: AbortSignal.timeout(45000),
            });

            if (orRes.ok) {
              const data = (await orRes.json()) as any;
              const text = data.choices?.[0]?.message?.content || '';
              if (text.trim()) {
                res.json({
                  ok: true,
                  expansion: text,
                  providerUsed: 'openrouter',
                  modelUsed: targetModel,
                });
                return;
              }
            } else {
              const errBody = await orRes.text().catch(() => '');
              openRouterWarning = `OpenRouter HTTP ${orRes.status}: ${errBody.slice(0, 140) || orRes.statusText}`;
            }
          } catch (err: any) {
            openRouterWarning = `OpenRouter error: ${err?.message || 'timeout'}`;
          }
        } else {
          openRouterWarning = 'No OpenRouter API key provided.';
        }
      }

      try {
        const result = await runGeminiWithFallback(prompt, 4096, segments);
        if (result.text && result.providerUsed !== 'local-extractive' && !result.text.startsWith('# ')) {
          res.json({
            ok: true,
            expansion: result.text,
            providerUsed: result.providerUsed,
            modelUsed: result.modelUsed,
            warning: [openRouterWarning, result.warning].filter(Boolean).join(' ') || undefined,
          });
          return;
        }
      } catch {}

      res.json({
        ok: true,
        expansion: buildGroundedDeepDive(topic, title || 'Video', retrievedPassages),
        providerUsed: 'local-extractive',
        modelUsed: 'extractive-fallback',
        warning: openRouterWarning || undefined,
      });
    } catch (e: any) {
      const fallbackIndex = createTranscriptIndex(req.body?.transcript || '', req.body?.segments);
      const fallbackPassages = retrieveRelevantChunks(fallbackIndex, req.body?.topic || 'Topic', 6, 2);
      res.json({
        ok: true,
        expansion: buildGroundedDeepDive(
          req.body?.topic || 'Topic',
          req.body?.title || 'Video',
          fallbackPassages
        ),
        providerUsed: 'local-extractive',
        modelUsed: 'extractive-fallback',
      });
    }
  });

  // 3. POST /api/chat - Interactive questions about the video transcript
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const {
        question,
        transcript,
        segments,
        title,
        videoId,
        provider = 'gemini',
        openRouterKey,
        model = 'meta-llama/llama-3.3-70b-instruct:free',
      } = req.body;

      if (!question || !transcript) {
        res.status(400).json({ error: 'Question and transcript are required.' });
        return;
      }

      let chatWarning = '';

      // Advanced RAG Retrieval: Multi-Query RRF + Grounded Facts
      const transcriptIndex = createTranscriptIndex(transcript, segments);
      const retrievedPassages = retrieveWithMultiQueryRRF(transcriptIndex, question, 7, 2);
      const groundedContextBlock = formatRetrievedContextForPrompt(retrievedPassages);
      const keyFacts = extractGroundedFacts(transcriptIndex, question, 3);
      const factsBlock = keyFacts.length > 0
        ? `\nVERIFIED AUDIO FACTS & METRICS:\n${keyFacts.map((f) => `- [${f.timestamp}] ${f.fact}`).join('\n')}\n`
        : '';

      const prompt = `You are a friendly, helpful person who just watched the YouTube video "${title || 'Video'}" and knows it inside out.
Answer the user's question clearly, warmly, and naturally in plain everyday English based on the video transcript and the exact grounded passages below.
Avoid stiff clichés or robotic jargon. Always cite the exact verified [MM:SS] timestamps where these points are discussed.

${groundedContextBlock}
${factsBlock}
USER QUESTION:
${question}

VIDEO FULL TRANSCRIPT CONTEXT:
${transcript.slice(0, 120000)}
`;

      if (provider === 'openrouter') {
        const { key: apiKey, isUserKey } = getOpenRouterRequestKey(req);
        if (apiKey) {
          const targetModel = resolveOpenRouterModel(model, isUserKey);
          try {
            const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.APP_URL || 'https://aistudio.google.com',
                'X-Title': 'OpenTranscript AI',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: targetModel,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
              }),
              signal: AbortSignal.timeout(45000),
            });

            if (orRes.ok) {
              const data = (await orRes.json()) as any;
              const ans = data.choices?.[0]?.message?.content || '';
              if (ans.trim()) {
                res.json({
                  answer: ans,
                  providerUsed: 'openrouter',
                  modelUsed: targetModel,
                  citations: retrievedPassages.map((p) => ({
                    range: p.formattedRange,
                    start: p.expandedStartSec,
                    text: p.chunk.text.slice(0, 160),
                  })),
                  groundedFacts: keyFacts,
                });
                return;
              }
            } else {
              const errBody = await orRes.text().catch(() => '');
              chatWarning = `OpenRouter HTTP ${orRes.status}: ${errBody.slice(0, 140) || orRes.statusText}`;
            }
          } catch (err: any) {
            chatWarning = `OpenRouter error: ${err?.message || 'timeout'}`;
          }
        } else {
          chatWarning = 'No OpenRouter API key provided.';
        }
      }

      try {
        const result = await runGeminiWithFallback(prompt, 2048, segments);
        if (result.text && result.providerUsed !== 'local-extractive') {
          res.json({
            answer: result.text,
            providerUsed: result.providerUsed,
            modelUsed: result.modelUsed,
            warning: [chatWarning, result.warning].filter(Boolean).join(' ') || undefined,
            citations: retrievedPassages.map((p) => ({
              range: p.formattedRange,
              start: p.expandedStartSec,
              text: p.chunk.text.slice(0, 160),
            })),
            groundedFacts: keyFacts,
          });
          return;
        }
      } catch {}

      res.json({
        answer: buildGroundedExtractiveAnswer(question, title || 'Video', retrievedPassages),
        providerUsed: 'local-extractive',
        modelUsed: 'extractive-fallback',
        warning: chatWarning || undefined,
        citations: retrievedPassages.map((p) => ({
          range: p.formattedRange,
          start: p.expandedStartSec,
          text: p.chunk.text.slice(0, 160),
        })),
        groundedFacts: keyFacts,
      });
    } catch (e: any) {
      res.status(500).json({
        error: e?.message || 'Chat request failed.',
      });
    }
  });

  // Dedicated Enterprise RAG Pipeline Endpoint: /api/rag/process
  app.post('/api/rag/process', async (req: Request, res: Response) => {
    try {
      const {
        transcript,
        segments,
        query = '',
        title = 'Video',
        mode = 'all', // 'all' | 'search' | 'facts' | 'timeline' | 'verify'
        claims = [],
        topK = 6,
      } = req.body;

      if (!transcript && (!segments || segments.length === 0)) {
        res.status(400).json({ error: 'Transcript or segments are required for RAG processing.' });
        return;
      }

      const rawText = String(transcript || '');
      const index = createTranscriptIndex(rawText, segments);

      const responsePayload: any = {
        ok: true,
        totalChunks: index.totalChunks,
        avgChunkLength: Math.round(index.avgChunkLength),
      };

      if (mode === 'all' || mode === 'search') {
        const cleanQuery = String(query || title || '').trim();
        const retrieved = retrieveWithMultiQueryRRF(index, cleanQuery, topK, 2);
        responsePayload.retrievedPassages = retrieved.map((r) => ({
          chunkId: r.chunk.id,
          score: Math.round(r.score * 1000) / 1000,
          range: r.formattedRange,
          startSec: r.expandedStartSec,
          endSec: r.expandedEndSec,
          text: r.expandedText,
        }));
        responsePayload.groundedContext = formatRetrievedContextForPrompt(retrieved);
      }

      if (mode === 'all' || mode === 'facts') {
        responsePayload.groundedFacts = extractGroundedFacts(index, query, 8);
      }

      if (mode === 'all' || mode === 'timeline') {
        responsePayload.timeline = extractChronologicalTimeline(index, query);
      }

      if (mode === 'all' || mode === 'verify') {
        const claimsToVerify = Array.isArray(claims) && claims.length > 0 ? claims : [query];
        responsePayload.verifications = claimsToVerify
          .filter((c: any) => typeof c === 'string' && c.trim().length > 3)
          .map((c: string) => verifyClaimAgainstTranscript(index, c));
      }

      if (mode === 'all' || mode === 'entities' || mode === 'concepts') {
        responsePayload.entities = extractKeyEntitiesAndConcepts(index, 12);
      }

      if (mode === 'all' || mode === 'chapters' || mode === 'hierarchical') {
        responsePayload.chapters = generateHierarchicalGroundedSummary(index, 5);
      }

      if (mode === 'all' || mode === 'caveats' || mode === 'warnings') {
        responsePayload.caveats = detectContradictionsAndCaveats(index, 8);
      }

      if (mode === 'all' || mode === 'answer' || mode === 'qa') {
        if (query && query.trim().length > 2) {
          responsePayload.groundedAnswer = synthesizeGroundedAnswer(index, query);
        }
      }

      res.json(responsePayload);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'RAG processing failed.' });
    }
  });

  // Dedicated RAG Q&A endpoint for instant timestamp-anchored answers
  app.post('/api/rag-qa', async (req: Request, res: Response) => {
    try {
      const { transcript, segments, question, title } = req.body;
      if (!question || !question.trim()) {
        res.status(400).json({ error: 'Question is required for RAG Q&A.' });
        return;
      }
      if (!transcript && (!segments || segments.length === 0)) {
        res.status(400).json({ error: 'Transcript or segments are required for RAG Q&A.' });
        return;
      }

      const index = createTranscriptIndex(String(transcript || ''), segments);
      const answerResult = synthesizeGroundedAnswer(index, question);
      const retrieved = retrieveWithMultiQueryRRF(index, question, 5, 2);

      res.json({
        ok: true,
        title: title || 'Video Transcript',
        ...answerResult,
        retrievedContext: formatRetrievedContextForPrompt(retrieved),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'RAG Q&A synthesis failed.' });
    }
  });

  // 4. GET /api/youtube-search - Search YouTube videos via YouTube Data API v3 with infinite pagination
  app.get('/api/youtube-search', async (req: Request, res: Response) => {
    try {
      const q = ((req.query.q as string) || '').trim().slice(0, 300);
      const pageToken = ((req.query.pageToken as string) || '').trim().slice(0, 100);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));

      if (!q) {
        res.status(400).json({ error: 'Search query parameter (q) is required.' });
        return;
      }

      const videos: Array<{
        videoId: string;
        title: string;
        channelTitle: string;
        publishedAt?: string;
        description?: string;
        thumbnailUrl: string;
        url: string;
      }> = [];
      let nextPageToken: string | null = null;

      // 1. Primary: Google YouTube Data API v3 (25 results per page + nextPageToken)
      if (GOOGLE_API_KEY) {
        try {
          let ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&q=${encodeURIComponent(q)}&key=${GOOGLE_API_KEY}`;
          if (pageToken) {
            ytUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
          }
          const ytRes = await fetch(ytUrl, { signal: AbortSignal.timeout(6000) });
          if (ytRes.ok) {
            const ytData = await ytRes.json() as any;
            nextPageToken = ytData.nextPageToken || null;
            const items = ytData.items || [];
            for (const item of items) {
              const vid = item.id?.videoId;
              const snip = item.snippet;
              if (!vid || !snip) continue;
              const thumb =
                snip.thumbnails?.high?.url ||
                snip.thumbnails?.medium?.url ||
                snip.thumbnails?.default?.url ||
                `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

              const cleanTitle = String(snip.title || '')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&');

              videos.push({
                videoId: vid,
                title: cleanTitle,
                channelTitle: snip.channelTitle || 'YouTube Channel',
                publishedAt: snip.publishedAt,
                description: snip.description || '',
                thumbnailUrl: thumb,
                url: `https://www.youtube.com/watch?v=${vid}`,
              });
            }
          }
        } catch (err) {
          console.warn('YouTube Data API v3 search fallback triggered:', err);
        }
      }

      // 2. Fallback if YouTube Data API v3 returned empty (BUG-022, BUG-023)
      if (videos.length === 0 && page === 0) {
        const pipedMirrors = [
          'https://api.piped.private.coffee',
          'https://pipedapi.kavin.rocks',
          'https://pipedapi.leptons.xyz',
        ];
        for (const mirror of pipedMirrors) {
          try {
            const pRes = await fetch(`${mirror}/search?q=${encodeURIComponent(q)}&filter=videos`, {
              signal: AbortSignal.timeout(4000),
            });
            if (pRes.ok) {
              const pData = await pRes.json() as any;
              const items = pData.items || [];
              nextPageToken = pData.nextpage ? String(pData.nextpage) : null;
              for (const item of items) {
                const vidMatch = String(item.url || '').match(/v=([a-zA-Z0-9_-]{11})/);
                const vid = vidMatch ? vidMatch[1] : null;
                if (!vid) continue;
                videos.push({
                  videoId: vid,
                  title: item.title || 'YouTube Video',
                  channelTitle: item.uploaderName || 'YouTube Channel',
                  publishedAt: item.uploadedDate || undefined,
                  description: item.shortDescription || '',
                  thumbnailUrl: item.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                  url: `https://www.youtube.com/watch?v=${vid}`,
                });
              }
              if (videos.length > 0) break;
            }
          } catch {
            continue;
          }
        }
      }

      res.json({
        ok: true,
        query: q,
        page,
        nextPageToken,
        hasMore: Boolean(nextPageToken),
        videos,
      });
    } catch (err: any) {
      console.error('YouTube search error:', err);
      res.status(500).json({ error: err.message || 'YouTube search failed' });
    }
  });

  // 5. GET /api/books-search - Google Books API v1 + OpenLibrary infinite pagination
  app.get('/api/books-search', async (req: Request, res: Response) => {
    try {
      const q = ((req.query.q as string) || '').trim().slice(0, 300);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));
      const maxResults = 20;
      const startIndex = page * maxResults;

      if (!q) {
        res.status(400).json({ error: 'Search query parameter (q) is required.' });
        return;
      }

      const books: Array<{
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
      }> = [];

      const urlsToTry = [
        ...(GOOGLE_API_KEY
          ? [`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&startIndex=${startIndex}&maxResults=${maxResults}&printType=books&langRestrict=en&key=${GOOGLE_API_KEY}`]
          : []),
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&startIndex=${startIndex}&maxResults=${maxResults}&printType=books&langRestrict=en`,
      ];

      for (const booksUrl of urlsToTry) {
        try {
          const bRes = await fetch(booksUrl, { signal: AbortSignal.timeout(5000) });
          if (bRes.ok) {
            const bData = await bRes.json() as any;
            const items = bData.items || [];
            for (const item of items) {
              const info = item.volumeInfo || {};
              if (!info.title) continue;
              const rawThumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
              const secureThumb = rawThumb ? rawThumb.replace(/^http:\/\//i, 'https://') : undefined;

              books.push({
                id: item.id || `book-${ page }-${Math.random().toString(36).slice(2, 8)}`,
                title: info.title + (info.subtitle ? `: ${info.subtitle}` : ''),
                authors: Array.isArray(info.authors) ? info.authors : ['Unknown Author'],
                publishedDate: info.publishedDate,
                publisher: info.publisher,
                description: info.description
                  ? String(info.description).replace(/<[^>]+>/g, '').slice(0, 360)
                  : undefined,
                pageCount: info.pageCount,
                categories: info.categories,
                thumbnailUrl: secureThumb,
                infoLink: info.infoLink || info.previewLink || `https://books.google.com/books?id=${item.id}`,
              });
            }
            if (books.length > 0) break;
          }
        } catch {
          continue;
        }
      }

      // Supplement with OpenLibrary if Google Books reaches its offset limit or returns fewer items
      if (books.length < 8) {
        try {
          const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15&page=${page + 1}`;
          const olRes = await fetch(olUrl, { signal: AbortSignal.timeout(4500) });
          if (olRes.ok) {
            const olData = await olRes.json() as any;
            const docs = olData.docs || [];
            for (const doc of docs) {
              if (!doc.title) continue;
              const coverId = doc.cover_i;
              const thumb = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;
              books.push({
                id: `ol-${doc.key || Math.random().toString(36).slice(2, 8)}`,
                title: doc.title,
                authors: Array.isArray(doc.author_name) ? doc.author_name.slice(0, 3) : ['Unknown Author'],
                publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
                publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : 'OpenLibrary',
                description: Array.isArray(doc.subject)
                  ? `Subjects: ${doc.subject.slice(0, 6).join(', ')}`
                  : undefined,
                pageCount: doc.number_of_pages_median,
                thumbnailUrl: thumb,
                infoLink: doc.key ? `https://openlibrary.org${doc.key}` : `https://openlibrary.org/search?q=${encodeURIComponent(q)}`,
              });
            }
          }
        } catch {
          // ignore openlibrary error
        }
      }

      // 3. Project Gutenberg Full-Text Books via Gutendex API
      try {
        const gutUrl = `https://gutendex.com/books/?search=${encodeURIComponent(q)}`;
        const gutRes = await fetch(gutUrl, {
          signal: AbortSignal.timeout(4000),
          headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
        });
        if (gutRes.ok) {
          const gutData = (await gutRes.json()) as any;
          for (const b of (gutData.results || []).slice(0, 6)) {
            if (!b.title) continue;
            const authors = Array.isArray(b.authors)
              ? b.authors.map((a: any) => a.name).filter(Boolean)
              : ['Project Gutenberg Author'];
            const cover = b.formats?.['image/jpeg'] || undefined;
            const readLink =
              b.formats?.['text/html'] ||
              b.formats?.['application/epub+zip'] ||
              `https://www.gutenberg.org/ebooks/${b.id}`;
            books.push({
              id: `gutenberg-${b.id}`,
              title: b.title,
              authors: authors.length > 0 ? authors : ['Classic Author'],
              publisher: 'Project Gutenberg (Full Text)',
              description:
                Array.isArray(b.summaries) && b.summaries[0]
                  ? String(b.summaries[0]).slice(0, 260)
                  : `Free full-text edition on Project Gutenberg (${(b.download_count || 0).toLocaleString()} downloads).`,
              categories: Array.isArray(b.subjects) ? b.subjects.slice(0, 3) : ['Full-Text Classic'],
              thumbnailUrl: cover,
              infoLink: readLink,
            });
          }
        }
      } catch {}

      // 4. Internet Archive Digital Library Books & Texts (sorted by downloads desc to ensure high-quality editions)
      try {
        const iaPage = page + 1;
        const iaQuery = `title:(${q}) AND mediatype:(texts)`;
        const iaUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
          iaQuery
        )}&sort[]=downloads+desc&fl[]=identifier,title,creator,description,year,publisher&rows=6&page=${iaPage}&output=json`;
        const iaRes = await fetch(iaUrl, {
          signal: AbortSignal.timeout(4500),
          headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
        });
        if (iaRes.ok) {
          const iaData = (await iaRes.json()) as any;
          for (const doc of iaData.response?.docs || []) {
            if (!doc.identifier || !doc.title) continue;
            const rawDesc = Array.isArray(doc.description) ? doc.description[0] : doc.description;
            books.push({
              id: `ia-book-${doc.identifier}`,
              title: String(doc.title),
              authors: doc.creator
                ? Array.isArray(doc.creator)
                  ? doc.creator.slice(0, 3)
                  : [String(doc.creator)]
                : ['Internet Archive Texts'],
              publishedDate: doc.year ? String(doc.year) : undefined,
              publisher: 'Internet Archive Digital Library',
              description: rawDesc
                ? String(rawDesc).replace(/<[^>]+>/g, '').slice(0, 240)
                : 'Digitized archival book available for reading and download on Internet Archive.',
              thumbnailUrl: `https://archive.org/services/img/${doc.identifier}`,
              infoLink: `https://archive.org/details/${doc.identifier}`,
            });
          }
        }
      } catch {}

      res.json({
        ok: true,
        query: q,
        page,
        hasMore: books.length > 0,
        books,
      });
    } catch (err: any) {
      console.error('Books search error:', err);
      res.status(500).json({ error: err.message || 'Books search failed' });
    }
  });

  // 6. GET /api/web-search - Google Custom Search API + Wikipedia + DuckDuckGo with infinite pagination
  app.get('/api/web-search', async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || '').trim().slice(0, 300);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));

      if (!q) {
        res.status(400).json({ error: 'Search query parameter (q) is required.' });
        return;
      }

      const results: Array<{ id: string; title: string; snippet: string; url: string; source: string; pageId?: number }> = [];

      // 0a. Tavily Search API (if TAVILY_API_KEY is configured)
      if (process.env.TAVILY_API_KEY && page === 0) {
        try {
          const tavRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query: q,
              max_results: 8,
            }),
            signal: AbortSignal.timeout(4500),
          });
          if (tavRes.ok) {
            const tavData = await tavRes.json() as any;
            for (const item of tavData.results || []) {
              results.push({
                id: `tavily-${Math.random().toString(36).slice(2, 9)}`,
                title: item.title || q,
                snippet: item.content || '',
                url: item.url,
                source: 'Tavily Web Index',
              });
            }
          }
        } catch {}
      }

      // 0b. Serper.dev Google SERP API (if SERPER_API_KEY is configured)
      if (process.env.SERPER_API_KEY) {
        try {
          const serpRes = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q, page: page + 1, num: 10 }),
            signal: AbortSignal.timeout(4500),
          });
          if (serpRes.ok) {
            const serpData = await serpRes.json() as any;
            for (const item of serpData.organic || []) {
              results.push({
                id: `serper-${page}-${Math.random().toString(36).slice(2, 9)}`,
                title: item.title || q,
                snippet: item.snippet || '',
                url: item.link,
                source: 'Google Search (Serper)',
              });
            }
          }
        } catch {}
      }

      // 0c. Brave Search API (if BRAVE_API_KEY is configured)
      if (process.env.BRAVE_API_KEY && page < 10) {
        try {
          const braveRes = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10&offset=${page}`,
            {
              headers: {
                Accept: 'application/json',
                'X-Subscription-Token': process.env.BRAVE_API_KEY,
              },
              signal: AbortSignal.timeout(4500),
            }
          );
          if (braveRes.ok) {
            const braveData = await braveRes.json() as any;
            for (const item of braveData.web?.results || []) {
              results.push({
                id: `brave-${page}-${Math.random().toString(36).slice(2, 9)}`,
                title: item.title || q,
                snippet: item.description || '',
                url: item.url,
                source: 'Brave Search',
              });
            }
          }
        } catch {}
      }

      // 0d. Exa.ai Neural Web Search API (if EXA_API_KEY is configured)
      if (process.env.EXA_API_KEY && page === 0) {
        try {
          const exaRes = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
              'x-api-key': process.env.EXA_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: q,
              numResults: 8,
              useAutoprompt: true,
            }),
            signal: AbortSignal.timeout(4500),
          });
          if (exaRes.ok) {
            const exaData = (await exaRes.json()) as any;
            for (const item of exaData.results || []) {
              results.push({
                id: `exa-${item.id || Math.random().toString(36).slice(2, 9)}`,
                title: item.title || q,
                snippet: item.text ? String(item.text).slice(0, 280) : `Neural search match from Exa.ai (${item.author || 'Web'})`,
                url: item.url,
                source: 'Exa Neural Search',
              });
            }
          }
        } catch {}
      }

      // 0. Fetch from Google Custom Search JSON API (supports start offset)
      if (GOOGLE_API_KEY && GOOGLE_CSE_ID && page < 10) {
        try {
          const start = page * 10 + 1;
          const cseUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(q)}&key=${GOOGLE_API_KEY}&cx=${encodeURIComponent(GOOGLE_CSE_ID)}&num=10&start=${start}`;
          const cseRes = await fetch(cseUrl, { signal: AbortSignal.timeout(4500) });
          if (cseRes.ok) {
            const cseData = await cseRes.json() as any;
            const items = cseData.items || [];
            for (const item of items) {
              results.push({
                id: `gcse-${page}-${Math.random().toString(36).substring(2, 9)}`,
                title: item.title || q,
                snippet: item.snippet || '',
                url: item.link,
                source: item.displayLink || 'Google Custom Search',
              });
            }
          }
        } catch {
          // fallback to Wikipedia & DuckDuckGo below
        }
      }

      // 1. Fetch from Wikipedia Search API (20 results per page with sroffset)
      try {
        const srlimit = 20;
        const sroffset = page * srlimit;
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=&format=json&srlimit=${srlimit}&sroffset=${sroffset}`;
        const wikiRes = await fetch(wikiUrl, {
          signal: AbortSignal.timeout(4500),
          headers: { 'User-Agent': 'OpenTranscriptAI/1.0 (https://aistudio.google.com)' }
        });
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json() as any;
          const searchItems = wikiData.query?.search || [];
          for (const item of searchItems) {
            const cleanSnippet = (item.snippet || '')
              .replace(/<span class="searchmatch">/g, '**')
              .replace(/<\/span>/g, '**')
              .replace(/<[^>]+>/g, '')
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&');
            results.push({
              id: `wiki-${item.pageid}`,
              title: item.title,
              snippet: cleanSnippet,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
              source: 'Wikipedia',
              pageId: item.pageid,
            });
          }
        }
      } catch (err) {
        // wiki search timeout or error
      }

      // 2. Fetch from DuckDuckGo Instant Answer API (on first page)
      if (page === 0) {
        try {
          const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
          const ddgRes = await fetch(ddgUrl, {
            signal: AbortSignal.timeout(4000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (ddgRes.ok) {
            const ddgData = await ddgRes.json() as any;
            if (ddgData.AbstractText && ddgData.AbstractURL) {
              results.unshift({
                id: `ddg-abstract-${Date.now()}`,
                title: ddgData.Heading || q,
                snippet: ddgData.AbstractText,
                url: ddgData.AbstractURL,
                source: ddgData.AbstractSource || 'DuckDuckGo Knowledge',
              });
            }
            if (Array.isArray(ddgData.RelatedTopics)) {
              for (const rt of ddgData.RelatedTopics.slice(0, 8)) {
                if (rt.Text && rt.FirstURL) {
                  results.push({
                    id: `ddg-related-${Math.random().toString(36).substring(2, 8)}`,
                    title: rt.Text.split(' - ')[0] || q,
                    snippet: rt.Text,
                    url: rt.FirstURL,
                    source: 'DuckDuckGo',
                  });
                }
              }
            }
          }
        } catch (err) {
          // ddg error
        }
      }

      res.json({ ok: true, query: q, page, hasMore: results.length > 0, results });
    } catch (err: any) {
      console.error('Web search error:', err);
      res.status(500).json({ error: err.message || 'Web search failed' });
    }
  });

  // 7. GET /api/image-search - Google Custom Search Images + Wikimedia Commons + Wikipedia with infinite pagination
  app.get('/api/image-search', async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || '').trim().slice(0, 300);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));

      if (!q) {
        res.status(400).json({ error: 'Search query parameter (q) is required.' });
        return;
      }

      const images: Array<{
        id: string;
        title: string;
        url: string;
        thumbnailUrl: string;
        sourceUrl: string;
        sourceName: string;
        width?: number;
        height?: number;
        description?: string;
      }> = [];

      // 0. Google Custom Search Image API
      if (GOOGLE_API_KEY && GOOGLE_CSE_ID && page < 10) {
        try {
          const start = page * 10 + 1;
          const cseImgUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(q)}&searchType=image&num=10&start=${start}&key=${GOOGLE_API_KEY}&cx=${encodeURIComponent(GOOGLE_CSE_ID)}`;
          const cseRes = await fetch(cseImgUrl, { signal: AbortSignal.timeout(4000) });
          if (cseRes.ok) {
            const cseData = await cseRes.json() as any;
            for (const item of cseData.items || []) {
              images.push({
                id: `gcse-img-${page}-${Math.random().toString(36).slice(2, 8)}`,
                title: item.title || q,
                url: item.link,
                thumbnailUrl: item.image?.thumbnailLink || item.link,
                sourceUrl: item.image?.contextLink || item.link,
                sourceName: item.displayLink || 'Google Images',
                width: item.image?.width,
                height: item.image?.height,
                description: item.snippet || item.title,
              });
            }
          }
        } catch {
          // fallback below
        }
      }

      // 0a. Unsplash High-Res Photos API (if UNSPLASH_ACCESS_KEY is configured)
      if (process.env.UNSPLASH_ACCESS_KEY) {
        try {
          const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&page=${page + 1}&per_page=10`;
          const unRes = await fetch(unsplashUrl, {
            headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
            signal: AbortSignal.timeout(4000),
          });
          if (unRes.ok) {
            const unData = (await unRes.json()) as any;
            for (const item of unData.results || []) {
              images.push({
                id: `unsplash-${item.id}`,
                title: item.description || item.alt_description || q,
                url: item.urls?.regular || item.urls?.full,
                thumbnailUrl: item.urls?.small || item.urls?.thumb,
                sourceUrl: item.links?.html || 'https://unsplash.com',
                sourceName: `Unsplash (${item.user?.name || 'Photographer'})`,
                width: item.width,
                height: item.height,
                description: item.alt_description || item.description || q,
              });
            }
          }
        } catch {}
      }

      // 0b. Pexels Stock Photos API (if PEXELS_API_KEY is configured)
      if (process.env.PEXELS_API_KEY) {
        try {
          const pexUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&page=${page + 1}&per_page=10`;
          const pexRes = await fetch(pexUrl, {
            headers: { Authorization: process.env.PEXELS_API_KEY },
            signal: AbortSignal.timeout(4000),
          });
          if (pexRes.ok) {
            const pexData = (await pexRes.json()) as any;
            for (const photo of pexData.photos || []) {
              images.push({
                id: `pexels-${photo.id}`,
                title: photo.alt || `Photo by ${photo.photographer || 'Pexels'}`,
                url: photo.src?.large || photo.src?.original,
                thumbnailUrl: photo.src?.medium || photo.src?.small,
                sourceUrl: photo.url || 'https://www.pexels.com',
                sourceName: `Pexels (${photo.photographer || 'Photo'})`,
                width: photo.width,
                height: photo.height,
                description: photo.alt || q,
              });
            }
          }
        } catch {}
      }

      // 0c. Pixabay Images API (if PIXABAY_API_KEY is configured)
      if (process.env.PIXABAY_API_KEY) {
        try {
          const pixUrl = `https://pixabay.com/api/?key=${encodeURIComponent(process.env.PIXABAY_API_KEY)}&q=${encodeURIComponent(q)}&page=${page + 1}&per_page=10&image_type=photo`;
          const pixRes = await fetch(pixUrl, { signal: AbortSignal.timeout(4000) });
          if (pixRes.ok) {
            const pixData = (await pixRes.json()) as any;
            for (const hit of pixData.hits || []) {
              images.push({
                id: `pixabay-${hit.id}`,
                title: hit.tags || q,
                url: hit.largeImageURL || hit.webformatURL,
                thumbnailUrl: hit.webformatURL || hit.previewURL,
                sourceUrl: hit.pageURL || 'https://pixabay.com',
                sourceName: `Pixabay (${hit.user || 'Creator'})`,
                width: hit.imageWidth,
                height: hit.imageHeight,
                description: hit.tags ? `Tags: ${hit.tags}` : q,
              });
            }
          }
        } catch {}
      }

      // 0d. Serper.dev Images API (if SERPER_API_KEY is configured)
      if (process.env.SERPER_API_KEY) {
        try {
          const sImgRes = await fetch('https://google.serper.dev/images', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q, page: page + 1, num: 10 }),
            signal: AbortSignal.timeout(4000),
          });
          if (sImgRes.ok) {
            const sImgData = (await sImgRes.json()) as any;
            for (const item of sImgData.images || []) {
              images.push({
                id: `serper-img-${page}-${Math.random().toString(36).slice(2, 8)}`,
                title: item.title || q,
                url: item.imageUrl,
                thumbnailUrl: item.thumbnailUrl || item.imageUrl,
                sourceUrl: item.link || item.imageUrl,
                sourceName: item.source || 'Google Images (Serper)',
                width: item.imageWidth,
                height: item.imageHeight,
                description: item.title || q,
              });
            }
          }
        } catch {}
      }

      // 1. Wikipedia PageImages API (12 high-relevance encyclopedia images per page)
      try {
        const wikiLimit = 12;
        const wikiOffset = page * wikiLimit;
        const wikiImgUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=${wikiLimit}&gsroffset=${wikiOffset}&prop=pageimages|extracts&pithumbsize=640&exintro=1&explaintext=1&exsentences=1&format=json`;
        const wikiRes = await fetch(wikiImgUrl, {
          signal: AbortSignal.timeout(4500),
          headers: { 'User-Agent': 'OpenTranscriptAI/1.0 (https://aistudio.google.com)' }
        });
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json() as any;
          const pages = wikiData.query?.pages || {};
          for (const pId of Object.keys(pages)) {
            const pageObj = pages[pId];
            if (pageObj.thumbnail?.source) {
              const thumbSrc = String(pageObj.thumbnail.source).replace(/^http:\/\//i, 'https://');
              const isDup = images.some((img) => img.title.toLowerCase() === pageObj.title.toLowerCase());
              if (!isDup) {
                images.push({
                  id: `wiki-page-${pId}`,
                  title: pageObj.title,
                  url: thumbSrc,
                  thumbnailUrl: thumbSrc,
                  sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageObj.title.replace(/\s+/g, '_'))}`,
                  sourceName: 'Wikipedia Encyclopedia',
                  width: pageObj.thumbnail.width,
                  height: pageObj.thumbnail.height,
                  description: pageObj.extract || pageObj.title,
                });
              }
            }
          }
        }
      } catch (err) {
        // wiki error
      }

      // 2. Wikimedia Commons API (20 verified web-compatible images per page)
      try {
        const gsrlimit = 20;
        const gsroffset = page * gsrlimit;
        const wmUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          `${q} filetype:bitmap`
        )}&gsrnamespace=6&gsrlimit=${gsrlimit}&gsroffset=${gsroffset}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=600&format=json`;
        const wmRes = await fetch(wmUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'OpenTranscriptAI/1.0 (https://aistudio.google.com)' }
        });
        if (wmRes.ok) {
          const wmData = await wmRes.json() as any;
          const pages = wmData.query?.pages || {};
          for (const pageId of Object.keys(pages)) {
            const pageObj = pages[pageId];
            const info = pageObj.imageinfo?.[0];
            if (!info || !info.thumburl) continue;

            const filename = (pageObj.title || '').replace(/^File:/, '');
            const ext = filename.split('.').pop()?.toLowerCase();
            if (
              [
                'ogg',
                'ogv',
                'oga',
                'pdf',
                'djvu',
                'tif',
                'tiff',
                'xcf',
                'stl',
                'mid',
                'midi',
                'wav',
                'mp3',
                'webm',
                'flac',
              ].includes(ext || '')
            ) {
              continue;
            }

            const cleanTitle = filename
              .replace(/\.[^/.]+$/, '')
              .replace(/_/g, ' ')
              .replace(/\s*\(cropped\)/i, '')
              .trim();

            const desc = info.extmetadata?.ObjectName?.value || info.extmetadata?.ImageDescription?.value || cleanTitle;
            const plainDesc = String(desc).replace(/<[^>]+>/g, '').slice(0, 160);
            const secureThumb = String(info.thumburl).replace(/^http:\/\//i, 'https://');
            const secureFull = String(info.url || info.thumburl).replace(/^http:\/\//i, 'https://');

            images.push({
              id: `wm-${pageId}`,
              title: cleanTitle,
              url: secureFull,
              thumbnailUrl: secureThumb,
              sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(pageObj.title)}`,
              sourceName: 'Wikimedia Commons',
              width: info.thumbwidth || info.width,
              height: info.thumbheight || info.height,
              description: plainDesc,
            });
          }
        }
      } catch (err) {
        // wm error
      }

      // 3. Openverse Creative Commons Image API (12 images per page)
      try {
        const ovPage = page + 1;
        const ovUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=12&page=${ovPage}`;
        const ovRes = await fetch(ovUrl, {
          signal: AbortSignal.timeout(4500),
          headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
        });
        if (ovRes.ok) {
          const ovData = (await ovRes.json()) as any;
          for (const item of ovData.results || []) {
            if (!item.url) continue;
            const fullUrl = String(item.url).replace(/^http:\/\//i, 'https://');
            const thumbUrl = String(item.thumbnail || item.url).replace(/^http:\/\//i, 'https://');
            images.push({
              id: `ov-${item.id || Math.random().toString(36).slice(2, 8)}`,
              title: item.title || q,
              url: fullUrl,
              thumbnailUrl: thumbUrl,
              sourceUrl: item.foreign_landing_url || fullUrl,
              sourceName: `Openverse (${item.source || 'CC'})`,
              width: item.width,
              height: item.height,
              description: item.creator ? `By ${item.creator} (${item.license?.toUpperCase() || 'CC'})` : item.title,
            });
          }
        }
      } catch {}

      res.json({ ok: true, query: q, page, hasMore: images.length > 0, images });
    } catch (err: any) {
      console.error('Image search error:', err);
      res.status(500).json({ error: err.message || 'Image search failed' });
    }
  });

  // 7b. GET /api/image-proxy - Server-side Image Proxy with SSRF protection, size cap, and raster-only MIME validation (C-07)
  const ALLOWED_IMAGE_MIMES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ]);
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB cap

  app.get('/api/image-proxy', async (req: Request, res: Response) => {
    try {
      const rawUrl = ((req.query.url as string) || '').trim();
      if (!rawUrl || !(await isSafePublicUrl(rawUrl))) {
        res.status(400).end();
        return;
      }
      const upstream = await fetch(rawUrl, {
        redirect: 'error',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/png,image/jpeg,image/gif;q=0.8',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!upstream.ok) {
        res.status(404).end();
        return;
      }
      const rawContentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_IMAGE_MIMES.has(rawContentType)) {
        res.status(415).end();
        return;
      }
      const contentLengthHeader = Number(upstream.headers.get('content-length') || 0);
      if (contentLengthHeader > MAX_IMAGE_BYTES) {
        res.status(413).end();
        return;
      }
      const arrayBuf = await upstream.arrayBuffer();
      if (arrayBuf.byteLength > MAX_IMAGE_BYTES || arrayBuf.byteLength < 160) {
        res.status(404).end();
        return;
      }
      const buf = Buffer.from(arrayBuf);
      res.setHeader('Content-Type', rawContentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'none'; script-src 'none'");
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    } catch {
      res.status(404).end();
    }
  });

  // 8. GET /api/news-search - News, media coverage, and community discussions with infinite pagination
  app.get('/api/news-search', async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || '').trim().slice(0, 300);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));

      if (!q) {
        res.status(400).json({ error: 'Search query parameter (q) is required.' });
        return;
      }

      const newsItems: Array<{
        id: string;
        title: string;
        snippet: string;
        url: string;
        source: string;
        publishedAt?: string;
        score?: number;
        commentsCount?: number;
        mediaType: 'news' | 'discussion' | 'editorial' | 'media';
      }> = [];

      // 0a. NewsAPI.org Everything Search (if NEWSAPI_KEY is configured)
      if (process.env.NEWSAPI_KEY) {
        try {
          const naUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&pageSize=10&page=${page + 1}&language=en&sortBy=relevancy&apiKey=${encodeURIComponent(process.env.NEWSAPI_KEY)}`;
          const naRes = await fetch(naUrl, { signal: AbortSignal.timeout(4500) });
          if (naRes.ok) {
            const naData = (await naRes.json()) as any;
            for (const art of naData.articles || []) {
              if (!art.title || art.title === '[Removed]') continue;
              newsItems.push({
                id: `newsapi-${page}-${Math.random().toString(36).slice(2, 9)}`,
                title: art.title,
                snippet: art.description || art.content || `News article from ${art.source?.name || 'NewsAPI'}`,
                url: art.url,
                source: art.source?.name || 'NewsAPI',
                publishedAt: art.publishedAt,
                mediaType: 'news',
              });
            }
          }
        } catch {}
      }

      // 0b. GNews.io API (if GNEWS_API_KEY is configured)
      if (process.env.GNEWS_API_KEY && page === 0) {
        try {
          const gnUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=10&apikey=${encodeURIComponent(process.env.GNEWS_API_KEY)}`;
          const gnRes = await fetch(gnUrl, { signal: AbortSignal.timeout(4500) });
          if (gnRes.ok) {
            const gnData = (await gnRes.json()) as any;
            for (const art of gnData.articles || []) {
              newsItems.push({
                id: `gnewsio-${Math.random().toString(36).slice(2, 9)}`,
                title: art.title,
                snippet: art.description || '',
                url: art.url,
                source: art.source?.name || 'GNews',
                publishedAt: art.publishedAt,
                mediaType: 'news',
              });
            }
          }
        } catch {}
      }

      // 0c. The Guardian Open Platform API (if GUARDIAN_API_KEY is configured)
      if (process.env.GUARDIAN_API_KEY) {
        try {
          const gdUrl = `https://content.guardianapis.com/search?q=${encodeURIComponent(q)}&page=${page + 1}&page-size=10&show-fields=trailText&api-key=${encodeURIComponent(process.env.GUARDIAN_API_KEY)}`;
          const gdRes = await fetch(gdUrl, { signal: AbortSignal.timeout(4500) });
          if (gdRes.ok) {
            const gdData = (await gdRes.json()) as any;
            for (const item of gdData.response?.results || []) {
              newsItems.push({
                id: `guardian-${item.id || Math.random().toString(36).slice(2, 9)}`,
                title: item.webTitle,
                snippet: item.fields?.trailText ? String(item.fields.trailText).replace(/<[^>]+>/g, '') : `Editorial article in ${item.sectionName || 'The Guardian'}.`,
                url: item.webUrl,
                source: 'The Guardian',
                publishedAt: item.webPublicationDate,
                mediaType: 'editorial',
              });
            }
          }
        } catch {}
      }

      // 0d. New York Times Article Search API (if NYTIMES_API_KEY is configured)
      if (process.env.NYTIMES_API_KEY) {
        try {
          const nytUrl = `https://api.nytimes.com/svc/search/v2/articlesearch.json?q=${encodeURIComponent(q)}&page=${page}&api-key=${encodeURIComponent(process.env.NYTIMES_API_KEY)}`;
          const nytRes = await fetch(nytUrl, { signal: AbortSignal.timeout(4500) });
          if (nytRes.ok) {
            const nytData = (await nytRes.json()) as any;
            for (const doc of nytData.response?.docs || []) {
              if (!doc.headline?.main) continue;
              newsItems.push({
                id: `nyt-${doc._id || Math.random().toString(36).slice(2, 9)}`,
                title: doc.headline.main,
                snippet: doc.abstract || doc.lead_paragraph || 'New York Times article.',
                url: doc.web_url,
                source: 'The New York Times',
                publishedAt: doc.pub_date,
                mediaType: 'editorial',
              });
            }
          }
        } catch {}
      }

      // 0e. Serper.dev News API (if SERPER_API_KEY is configured)
      if (process.env.SERPER_API_KEY) {
        try {
          const sNewsRes = await fetch('https://google.serper.dev/news', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q, page: page + 1, num: 10 }),
            signal: AbortSignal.timeout(4000),
          });
          if (sNewsRes.ok) {
            const sNewsData = (await sNewsRes.json()) as any;
            for (const item of sNewsData.news || []) {
              newsItems.push({
                id: `serper-news-${page}-${Math.random().toString(36).slice(2, 9)}`,
                title: item.title,
                snippet: item.snippet || '',
                url: item.link,
                source: item.source || 'Google News (Serper)',
                publishedAt: item.date,
                mediaType: 'news',
              });
            }
          }
        } catch {}
      }

      // 1. Google News RSS (returns ~100 items, paginate by slicing 15 per page)
      if (page < 7) {
        try {
          const newsRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
          const newsRes = await fetch(newsRssUrl, {
            signal: AbortSignal.timeout(4500),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (newsRes.ok) {
            const xmlText = await newsRes.text();
            const parser = new XMLParser({ ignoreAttributes: false });
            const parsed = parser.parse(xmlText);
            const channel = parsed.rss?.channel;
            const items = Array.isArray(channel?.item) ? channel.item : channel?.item ? [channel.item] : [];

            const sliceStart = page * 15;
            const sliceEnd = sliceStart + 15;
            for (const item of items.slice(sliceStart, sliceEnd)) {
              const rawTitle: string = item.title || '';
              const link: string = item.link || '';
              const pubDate: string = item.pubDate || '';
              const sourceName = typeof item.source === 'object' ? item.source['#text'] || 'Google News' : item.source || 'News';

              let cleanSnippet = (item.description || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\s+/g, ' ')
                .trim();

              if (!cleanSnippet || cleanSnippet === rawTitle) {
                cleanSnippet = `News report on "${q}" via ${sourceName}.`;
              }

              newsItems.push({
                id: `gnews-${page}-${Math.random().toString(36).substring(2, 9)}`,
                title: rawTitle,
                snippet: cleanSnippet,
                url: link,
                source: sourceName,
                publishedAt: pubDate,
                mediaType: 'news',
              });
            }
          }
        } catch (err) {
          // google news error or timeout
        }
      }

      // 2. Hacker News Algolia API (supports infinite page parameter)
      try {
        const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=15&page=${page}`;
        const hnRes = await fetch(hnUrl, {
          signal: AbortSignal.timeout(4000),
          headers: { 'User-Agent': 'OpenTranscriptAI/1.0' }
        });
        if (hnRes.ok) {
          const hnData = await hnRes.json() as any;
          const hits = hnData.hits || [];
          for (const hit of hits) {
            if (hit.title) {
              newsItems.push({
                id: `hn-${hit.objectID}`,
                title: hit.title,
                snippet: `Discussion on Hacker News by ${hit.author || 'contributor'}. ${hit.points || 0} points, ${hit.num_comments || 0} comments.`,
                url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
                source: 'Hacker News',
                publishedAt: hit.created_at,
                score: hit.points,
                commentsCount: hit.num_comments,
                mediaType: 'discussion',
              });
            }
          }
        }
      } catch (err) {
        // hn error
      }

      res.json({ ok: true, query: q, page, hasMore: newsItems.length > 0, news: newsItems });
    } catch (err: any) {
      console.error('News search error:', err);
      res.status(500).json({ error: err.message || 'News search failed' });
    }
  });

  // 9. GET /api/academic-search - Peer-Reviewed Research Papers (OpenAlex + Semantic Scholar + arXiv + Crossref + PubMed) with infinite pagination
  app.get('/api/academic-search', async (req: Request, res: Response) => {
    try {
      const q = ((req.query.q as string) || '').trim().slice(0, 300);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));

      if (!q) {
        res.status(400).json({ error: 'Search query parameter (q) is required.' });
        return;
      }

      const papers: Array<{
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
      }> = [];

      // Helper to reconstruct OpenAlex inverted index abstract
      const reconstructAbstract = (inverted: Record<string, number[]> | null | undefined): string | undefined => {
        if (!inverted || typeof inverted !== 'object') return undefined;
        const words: string[] = [];
        for (const [word, positions] of Object.entries(inverted)) {
          if (Array.isArray(positions)) {
            for (const pos of positions) {
              words[pos] = word;
            }
          }
        }
        const text = words.filter(Boolean).join(' ').trim();
        return text ? text.slice(0, 420) : undefined;
      };

      await Promise.allSettled([
        // 1. OpenAlex API (12 papers per page)
        (async () => {
          const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=12&page=${page + 1}`;
          const oaRes = await fetch(oaUrl, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0 (mailto:research@aistudio.google.com)' },
          });
          if (oaRes.ok) {
            const oaData = (await oaRes.json()) as any;
            for (const w of oaData.results || []) {
              if (!w.title) continue;
              const authors = Array.isArray(w.authorships)
                ? w.authorships
                    .map((a: any) => a.author?.display_name)
                    .filter(Boolean)
                    .slice(0, 4)
                : ['Research Author'];
              const venue =
                w.primary_location?.source?.display_name ||
                w.host_venue?.display_name ||
                'Peer-Reviewed Venue';
              const pdfUrl = w.open_access?.oa_url || w.primary_location?.pdf_url || undefined;
              const url = w.doi || w.primary_location?.landing_page_url || w.id;

              papers.push({
                id: `oa-${w.id?.split('/').pop() || Math.random().toString(36).slice(2, 8)}`,
                title: String(w.title).replace(/<[^>]+>/g, ''),
                authors: authors.length > 0 ? authors : ['Research Author'],
                year: w.publication_year,
                venue,
                citationCount: typeof w.cited_by_count === 'number' ? w.cited_by_count : undefined,
                abstract: reconstructAbstract(w.abstract_inverted_index),
                url,
                pdfUrl,
                doi: w.doi,
                source: 'OpenAlex',
              });
            }
          }
        })(),

        // 2. Semantic Scholar Graph API (8 papers per page, uses SEMANTIC_SCHOLAR_API_KEY if configured)
        (async () => {
          const s2Offset = page * 8;
          const s2Url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&offset=${s2Offset}&limit=8&fields=title,authors,year,abstract,url,citationCount,venue,openAccessPdf`;
          const s2Headers: Record<string, string> = { 'User-Agent': 'OpenTranscriptAI/1.0' };
          if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
            s2Headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
          }
          const s2Res = await fetch(s2Url, {
            signal: AbortSignal.timeout(4500),
            headers: s2Headers,
          });
          if (s2Res.ok) {
            const s2Data = (await s2Res.json()) as any;
            for (const p of s2Data.data || []) {
              if (!p.title) continue;
              const authors = Array.isArray(p.authors)
                ? p.authors.map((a: any) => a.name).filter(Boolean).slice(0, 4)
                : ['Research Author'];
              papers.push({
                id: `s2-${p.paperId || Math.random().toString(36).slice(2, 8)}`,
                title: p.title,
                authors: authors.length > 0 ? authors : ['Research Author'],
                year: p.year,
                venue: p.venue || 'Semantic Scholar',
                citationCount: typeof p.citationCount === 'number' ? p.citationCount : undefined,
                abstract: p.abstract ? String(p.abstract).slice(0, 400) : undefined,
                url: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
                pdfUrl: p.openAccessPdf?.url || undefined,
                source: 'Semantic Scholar',
              });
            }
          }
        })(),

        // 3. arXiv API (8 preprints per page)
        (async () => {
          const arxivStart = page * 8;
          const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=${arxivStart}&max_results=8`;
          const axRes = await fetch(arxivUrl, { signal: AbortSignal.timeout(5000) });
          if (axRes.ok) {
            const xml = await axRes.text();
            const parser = new XMLParser({ ignoreAttributes: false });
            const parsed = parser.parse(xml);
            const entriesRaw = parsed.feed?.entry;
            const entries = Array.isArray(entriesRaw) ? entriesRaw : entriesRaw ? [entriesRaw] : [];
            for (const entry of entries) {
              const title = String(entry.title || '').replace(/\s+/g, ' ').trim();
              if (!title) continue;
              const summary = String(entry.summary || '').replace(/\s+/g, ' ').trim().slice(0, 400);
              const rawAuthors = Array.isArray(entry.author) ? entry.author : entry.author ? [entry.author] : [];
              const authors = rawAuthors.map((a: any) => a.name).filter(Boolean).slice(0, 4);
              const year = entry.published ? String(entry.published).slice(0, 4) : undefined;
              const idUrl = String(entry.id || '');
              const pdfUrl = idUrl ? idUrl.replace('/abs/', '/pdf/') : undefined;

              papers.push({
                id: `arxiv-${idUrl.split('/').pop() || Math.random().toString(36).slice(2, 8)}`,
                title,
                authors: authors.length > 0 ? authors : ['arXiv Author'],
                year,
                venue: 'arXiv Preprint',
                abstract: summary,
                url: idUrl || `https://arxiv.org/search/?query=${encodeURIComponent(q)}&searchtype=all`,
                pdfUrl,
                source: 'arXiv',
              });
            }
          }
        })(),

        // 4. Crossref API (8 DOI publications per page)
        (async () => {
          const crOffset = page * 8;
          const crUrl = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=8&offset=${crOffset}`;
          const crRes = await fetch(crUrl, {
            signal: AbortSignal.timeout(4500),
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0 (mailto:research@aistudio.google.com)' },
          });
          if (crRes.ok) {
            const crData = (await crRes.json()) as any;
            const items = crData.message?.items || [];
            for (const item of items) {
              const title = Array.isArray(item.title) ? item.title[0] : item.title;
              if (!title) continue;
              const authors = Array.isArray(item.author)
                ? item.author
                    .map((a: any) => [a.given, a.family].filter(Boolean).join(' '))
                    .filter(Boolean)
                    .slice(0, 4)
                : ['Published Author'];
              const year =
                item.published?.['date-parts']?.[0]?.[0] ||
                item['published-print']?.['date-parts']?.[0]?.[0] ||
                item.created?.['date-parts']?.[0]?.[0];
              const venue = Array.isArray(item['container-title'])
                ? item['container-title'][0]
                : item.publisher || 'Crossref DOI';
              const abstract = item.abstract
                ? String(item.abstract).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 380)
                : undefined;

              papers.push({
                id: `cr-${item.DOI || Math.random().toString(36).slice(2, 8)}`,
                title: String(title).replace(/<[^>]+>/g, ''),
                authors: authors.length > 0 ? authors : ['Published Author'],
                year,
                venue,
                citationCount: typeof item['is-referenced-by-count'] === 'number' ? item['is-referenced-by-count'] : undefined,
                abstract,
                url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ''),
                doi: item.DOI,
                source: 'Crossref',
              });
            }
          }
        })(),

        // 5. PubMed NCBI E-utilities API (6 biomedical/science papers per page, uses NCBI_API_KEY if configured)
        (async () => {
          const retstart = page * 6;
          const ncbiKeyParam = process.env.NCBI_API_KEY ? `&api_key=${encodeURIComponent(process.env.NCBI_API_KEY)}` : '';
          const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retstart=${retstart}&retmax=6&retmode=json${ncbiKeyParam}`;
          const esRes = await fetch(esearchUrl, { signal: AbortSignal.timeout(4000) });
          if (esRes.ok) {
            const esData = (await esRes.json()) as any;
            const idList: string[] = esData.esearchresult?.idlist || [];
            if (idList.length > 0) {
              const esumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json${ncbiKeyParam}`;
              const sumRes = await fetch(esumUrl, { signal: AbortSignal.timeout(4000) });
              if (sumRes.ok) {
                const sumData = (await sumRes.json()) as any;
                const resultObj = sumData.result || {};
                for (const pmid of idList) {
                  const doc = resultObj[pmid];
                  if (!doc || !doc.title) continue;
                  const authors = Array.isArray(doc.authors)
                    ? doc.authors.map((a: any) => a.name).filter(Boolean).slice(0, 4)
                    : ['PubMed Author'];
                  const year = doc.pubdate ? String(doc.pubdate).slice(0, 4) : undefined;
                  papers.push({
                    id: `pubmed-${pmid}`,
                    title: String(doc.title).replace(/<[^>]+>/g, ''),
                    authors: authors.length > 0 ? authors : ['PubMed Author'],
                    year,
                    venue: doc.fulljournalname || doc.source || 'PubMed / NCBI',
                    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
                    source: 'PubMed',
                  });
                }
              }
            }
          }
        })(),

        // 6. Europe PMC REST API (6 peer-reviewed life/computer science papers per page)
        (async () => {
          const epmcPage = page + 1;
          const epmcUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&pageSize=6&page=${epmcPage}`;
          const epRes = await fetch(epmcUrl, { signal: AbortSignal.timeout(4500) });
          if (epRes.ok) {
            const epData = (await epRes.json()) as any;
            const list = epData.resultList?.result || [];
            for (const item of list) {
              if (!item.title) continue;
              const authors = item.authorString
                ? String(item.authorString)
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                : ['Europe PMC Author'];
              papers.push({
                id: `epmc-${item.id || Math.random().toString(36).slice(2, 8)}`,
                title: String(item.title).replace(/<[^>]+>/g, ''),
                authors,
                year: item.pubYear,
                venue: item.journalTitle || 'Europe PMC',
                citationCount: typeof item.citedByCount === 'number' ? item.citedByCount : undefined,
                url: item.doi
                  ? `https://doi.org/${item.doi}`
                  : `https://europepmc.org/article/${item.source || 'MED'}/${item.id}`,
                doi: item.doi,
                source: 'Europe PMC',
              });
            }
          }
        })(),

        // 7. DOAJ (Directory of Open Access Journals) API (6 open-access articles per page)
        (async () => {
          const doajPage = page + 1;
          const doajUrl = `https://doaj.org/api/search/articles/${encodeURIComponent(q)}?page=${doajPage}&pageSize=6`;
          const djRes = await fetch(doajUrl, { signal: AbortSignal.timeout(4500) });
          if (djRes.ok) {
            const djData = (await djRes.json()) as any;
            for (const item of djData.results || []) {
              const bib = item.bibjson || {};
              if (!bib.title) continue;
              const authors = Array.isArray(bib.author)
                ? bib.author.map((a: any) => a.name).filter(Boolean).slice(0, 4)
                : ['DOAJ Author'];
              const linkObj = Array.isArray(bib.link) ? bib.link.find((l: any) => l.url) : null;
              papers.push({
                id: `doaj-${item.id || Math.random().toString(36).slice(2, 8)}`,
                title: String(bib.title).replace(/<[^>]+>/g, ''),
                authors: authors.length > 0 ? authors : ['Open Access Author'],
                year: bib.year,
                venue: bib.journal?.title || 'DOAJ Open Access',
                abstract: bib.abstract ? String(bib.abstract).replace(/<[^>]+>/g, '').slice(0, 380) : undefined,
                url: linkObj?.url || `https://doaj.org/article/${item.id}`,
                source: 'DOAJ',
              });
            }
          }
        })(),

        // 8. CORE.ac.uk Open Access Research Papers API (if CORE_API_KEY is configured)
        (async () => {
          if (!process.env.CORE_API_KEY) return;
          const coreOffset = page * 6;
          const coreUrl = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(q)}&limit=6&offset=${coreOffset}`;
          const coreRes = await fetch(coreUrl, {
            headers: { Authorization: `Bearer ${process.env.CORE_API_KEY}` },
            signal: AbortSignal.timeout(4500),
          });
          if (coreRes.ok) {
            const coreData = (await coreRes.json()) as any;
            for (const w of coreData.results || []) {
              if (!w.title) continue;
              const authors = Array.isArray(w.authors)
                ? w.authors.map((a: any) => a.name).filter(Boolean).slice(0, 4)
                : ['CORE Author'];
              papers.push({
                id: `core-${w.id || Math.random().toString(36).slice(2, 8)}`,
                title: String(w.title).replace(/<[^>]+>/g, ''),
                authors: authors.length > 0 ? authors : ['CORE Author'],
                year: w.yearPublished,
                venue: w.publisher || 'CORE Open Access',
                abstract: w.abstract ? String(w.abstract).slice(0, 380) : undefined,
                url: w.downloadUrl || (w.doi ? `https://doi.org/${w.doi}` : `https://core.ac.uk/works/${w.id}`),
                pdfUrl: w.downloadUrl || undefined,
                doi: w.doi,
                source: 'CORE',
              });
            }
          }
        })(),

        // 9. DBLP Computer Science Bibliography API (6 CS/AI papers per page)
        (async () => {
          const dblpFirst = page * 6;
          const dblpUrl = `https://dblp.org/search/publ/api?q=${encodeURIComponent(q)}&h=6&f=${dblpFirst}&format=json`;
          const dbRes = await fetch(dblpUrl, {
            signal: AbortSignal.timeout(4500),
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
          });
          if (dbRes.ok) {
            const dbData = (await dbRes.json()) as any;
            const hits = dbData.result?.hits?.hit || [];
            for (const h of hits) {
              const info = h.info || {};
              if (!info.title) continue;
              const rawAuth = info.authors?.author;
              const authList = Array.isArray(rawAuth) ? rawAuth : rawAuth ? [rawAuth] : [];
              const authors = authList
                .map((a: any) => (typeof a === 'string' ? a : a.text))
                .filter(Boolean)
                .slice(0, 4);
              papers.push({
                id: `dblp-${h['@id'] || Math.random().toString(36).slice(2, 8)}`,
                title: String(info.title).replace(/\.$/, ''),
                authors: authors.length > 0 ? authors : ['DBLP CS Researcher'],
                year: info.year,
                venue: info.venue || 'DBLP Computer Science',
                url: info.ee || info.url || `https://dblp.org/search?q=${encodeURIComponent(info.title)}`,
                doi: info.doi,
                source: 'DBLP',
              });
            }
          }
        })(),

        // 10. HAL Open Science Archive API (6 open-access scientific papers per page)
        (async () => {
          const halStart = page * 6;
          const halUrl = `https://api.archives-ouvertes.fr/search/?q=${encodeURIComponent(
            q
          )}&wt=json&rows=6&start=${halStart}&fl=docid,title_s,authFullName_s,producedDateY_i,journalTitle_s,abstract_s,uri_s,fileMain_s`;
          const halRes = await fetch(halUrl, { signal: AbortSignal.timeout(4500) });
          if (halRes.ok) {
            const halData = (await halRes.json()) as any;
            for (const doc of halData.response?.docs || []) {
              const title = Array.isArray(doc.title_s) ? doc.title_s[0] : doc.title_s;
              if (!title) continue;
              const authors = Array.isArray(doc.authFullName_s)
                ? doc.authFullName_s.slice(0, 4)
                : ['HAL Researcher'];
              const abstract = Array.isArray(doc.abstract_s) ? doc.abstract_s[0] : doc.abstract_s;
              papers.push({
                id: `hal-${doc.docid || Math.random().toString(36).slice(2, 8)}`,
                title: String(title),
                authors,
                year: doc.producedDateY_i,
                venue: doc.journalTitle_s || 'HAL Open Science',
                abstract: abstract ? String(abstract).slice(0, 360) : undefined,
                url: doc.uri_s || `https://hal.science/${doc.docid}`,
                pdfUrl: doc.fileMain_s || undefined,
                source: 'HAL Science',
              });
            }
          }
        })(),
      ]);

      // Deduplicate papers by normalized title
      const seenTitles = new Set<string>();
      const uniquePapers = papers.filter((p) => {
        const norm = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!norm || seenTitles.has(norm)) return false;
        seenTitles.add(norm);
        return true;
      });

      res.json({
        ok: true,
        query: q,
        page,
        hasMore: uniquePapers.length > 0,
        papers: uniquePapers,
      });
    } catch (err: any) {
      console.error('Academic search error:', err);
      res.status(500).json({ error: err.message || 'Academic search failed' });
    }
  });

  // 10. GET /api/youtube-details - Live YouTube Data API v3 Statistics, Tags & Audience Comments
  app.get('/api/youtube-details', async (req: Request, res: Response) => {
    try {
      const videoId = ((req.query.videoId as string) || '').trim();
      if (!videoId || !GOOGLE_API_KEY) {
        res.json({ ok: true, statistics: null, comments: [] });
        return;
      }

      let statistics: any = null;
      let tags: string[] = [];
      const comments: Array<{
        id: string;
        author: string;
        text: string;
        likeCount: number;
        publishedAt: string;
      }> = [];

      await Promise.allSettled([
        (async () => {
          const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}&key=${GOOGLE_API_KEY}`;
          const vRes = await fetch(vUrl, { signal: AbortSignal.timeout(4500) });
          if (vRes.ok) {
            const vData = (await vRes.json()) as any;
            const item = vData.items?.[0];
            if (item) {
              statistics = item.statistics || null;
              tags = item.snippet?.tags || [];
            }
          }
        })(),
        (async () => {
          const cUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=25&order=relevance&textFormat=plainText&key=${GOOGLE_API_KEY}`;
          const cRes = await fetch(cUrl, { signal: AbortSignal.timeout(4500) });
          if (cRes.ok) {
            const cData = (await cRes.json()) as any;
            for (const item of cData.items || []) {
              const top = item.snippet?.topLevelComment?.snippet;
              if (!top) continue;
              comments.push({
                id: item.id,
                author: top.authorDisplayName || 'Viewer',
                text: top.textDisplay || '',
                likeCount: top.likeCount || 0,
                publishedAt: top.publishedAt || '',
              });
            }
          }
        })(),
      ]);

      res.json({
        ok: true,
        videoId,
        statistics,
        tags,
        comments,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch YouTube details' });
    }
  });

  // Helper to wrap raw 24kHz 16-bit mono PCM into a playable WAV buffer
  function pcmToWavBuffer(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
    header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
  }

  // Helper to split text into <=190 char chunks at sentence/word boundaries for stream synthesis
  function splitTextForTtsChunks(text: string, maxLen: number = 190): string[] {
    const sentences = text
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?।])\s+/);
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if ((current + ' ' + sentence).trim().length <= maxLen) {
        current = (current + ' ' + sentence).trim();
      } else {
        if (current) chunks.push(current);
        if (sentence.length <= maxLen) {
          current = sentence;
        } else {
          const words = sentence.split(' ');
          current = '';
          for (const w of words) {
            if ((current + ' ' + w).trim().length <= maxLen) {
              current = (current + ' ' + w).trim();
            } else {
              if (current) chunks.push(current);
              current = w.slice(0, maxLen);
            }
          }
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.slice(0, 18);
  }

  const ttsAudioCache = new Map<
    string,
    {
      audioBase64: string;
      mimeType: string;
      provider: string;
      wordBoundaries?: Array<{ text: string; startSec: number; endSec: number }>;
      chunkItems?: Array<{ text: string; audioBase64: string }>;
    }
  >();

  const STUDIO_TO_EDGE_VOICE: Record<string, string> = {
    'studio:gemini:Kore': 'en-US-AriaNeural',
    'studio:gemini:Charon': 'en-GB-RyanNeural',
    'studio:gemini:Puck': 'en-US-AndrewMultilingualNeural',
    'studio:gemini:Aoede': 'en-US-AvaMultilingualNeural',
    'studio:gemini:Fenrir': 'en-IE-ConnorNeural',
    'studio:gemini:Zephyr': 'en-US-JennyNeural',
    'studio:gcloud:en-US-Journey-D': 'en-US-BrianMultilingualNeural',
    'studio:gcloud:en-US-Steffan': 'en-US-SteffanNeural',
    'studio:gcloud:en-US-Emma': 'en-US-EmmaMultilingualNeural',
    'studio:gcloud:en-GB-Neural2-B': 'en-GB-RyanNeural',
    'studio:gcloud:en-GB-Neural2-A': 'en-GB-SoniaNeural',
    'studio:gcloud:en-GB-Libby': 'en-GB-LibbyNeural',
    'studio:gcloud:en-AU-Neural2-B': 'en-AU-WilliamNeural',
    'studio:gcloud:en-AU-Natasha': 'en-AU-NatashaNeural',
    'studio:gcloud:en-CA-Clara': 'en-CA-ClaraNeural',
    'studio:gcloud:en-IE-Emily': 'en-IE-EmilyNeural',
    'studio:gcloud:en-IN-Neural2-D': 'en-IN-PrabhatNeural',
    'studio:gcloud:en-IN-Neural2-A': 'en-IN-NeerjaNeural',
  };

  const LANG_TO_EDGE_VOICE: Record<string, string> = {
    es: 'es-ES-ElviraNeural',
    fr: 'fr-FR-DeniseNeural',
    de: 'de-DE-KatjaNeural',
    ja: 'ja-JP-NanamiNeural',
    ko: 'ko-KR-SunHiNeural',
    zh: 'zh-CN-XiaoxiaoNeural',
    hi: 'hi-IN-SwaraNeural',
    ar: 'ar-SA-ZariyahNeural',
    pt: 'pt-BR-FranciscaNeural',
    it: 'it-IT-ElsaNeural',
    ru: 'ru-RU-SvetlanaNeural',
    tr: 'tr-TR-EmelNeural',
    nl: 'nl-NL-ColetteNeural',
  };

  // 11. POST /api/tts - Multi-Engine Studio Neural Text-to-Speech API with Exact Word Boundaries
  app.post('/api/tts', async (req: Request, res: Response) => {
    try {
      const {
        text,
        voiceName = 'studio:gemini:Kore',
        speakingRate = 1.0,
        pitch = 1.0,
        lang = 'en-US',
      } = req.body;
      const rawText = String(text || '').trim();
      const cleanText = rawText.slice(0, 3500);
      const isTruncated = rawText.length > cleanText.length;

      if (!cleanText) {
        res.status(400).json({ error: 'Text is required for TTS synthesis.' });
        return;
      }

      // Hash entire synthesis input, voice, rate, and pitch (BUG-017, BUG-031)
      const cacheKey = sha256Digest({
        text: cleanText,
        voiceName,
        lang,
        speakingRate: Number(speakingRate).toFixed(2),
        pitch: Number(pitch).toFixed(2),
      });

      const cached = ttsAudioCache.get(cacheKey);
      if (cached) {
        res.json({
          ok: true,
          ...cached,
          isTruncated,
          processedCharacters: cleanText.length,
          originalCharacters: rawText.length,
        });
        return;
      }

      // 0. Primary Studio Neural Engine with Hardware WordBoundary Timestamps (EdgeTTS)
      try {
        const shortLang = String(lang || 'en').split('-')[0].toLowerCase();
        const edgeVoice =
          shortLang !== 'en' && LANG_TO_EDGE_VOICE[shortLang]
            ? LANG_TO_EDGE_VOICE[shortLang]
            : STUDIO_TO_EDGE_VOICE[voiceName] ||
              (lang.startsWith('en-GB')
                ? 'en-GB-SoniaNeural'
                : lang.startsWith('en-AU')
                ? 'en-AU-WilliamNeural'
                : lang.startsWith('en-IN')
                ? 'en-IN-NeerjaNeural'
                : 'en-US-AriaNeural');

        const ratePercent = Math.round((Number(speakingRate) - 1.0) * 100);
        const pitchPercent = Math.round((Number(pitch) - 1.0) * 100);
        const rateStr = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;
        const pitchStr = `${pitchPercent >= 0 ? '+' : ''}${pitchPercent}%`;

        const tts = new EdgeTTS(cleanText, edgeVoice, { rate: rateStr, pitch: pitchStr });
        const synthRes = await tts.synthesize();
        const arrayBuf = await synthRes.audio.arrayBuffer();
        const mp3Buf = Buffer.from(arrayBuf);

        if (mp3Buf.length > 0) {
          const wordBoundaries = (synthRes.subtitle || []).map((s: any) => ({
            text: String(s.text || ''),
            startSec: Number(s.offset || 0) / 1e7,
            endSec: (Number(s.offset || 0) + Number(s.duration || 0)) / 1e7,
          }));

          const resultPayload = {
            provider: `edge-neural-${edgeVoice}`,
            engineUsed: 'edge-neural',
            audioBase64: mp3Buf.toString('base64'),
            mimeType: 'audio/mp3',
            wordBoundaries,
            isTruncated,
            processedCharacters: cleanText.length,
            originalCharacters: rawText.length,
          };
          if (ttsAudioCache.size > 120) {
            const oldest = ttsAudioCache.keys().next().value;
            if (oldest) ttsAudioCache.delete(oldest);
          }
          ttsAudioCache.set(cacheKey, resultPayload);
          res.json({ ok: true, ...resultPayload });
          return;
        }
      } catch (edgeErr) {
        console.warn('EdgeTTS fallback triggered:', edgeErr);
      }

      // 1. If Gemini Studio Voice requested (e.g., studio:gemini:Kore, Puck, Charon, Fenrir, Aoede, Zephyr)
      if (voiceName.startsWith('studio:gemini:') && process.env.GEMINI_API_KEY) {
        const geminiVoice = voiceName.replace('studio:gemini:', '') || 'Kore';
        const ttsModel = 'gemini-3.8-flash-lite-tts';
        const cooldownExpiry = modelCooldownUntil.get(ttsModel) || 0;
        if (Date.now() >= cooldownExpiry) {
          try {
            const ai = new GoogleGenAI({
              apiKey: process.env.GEMINI_API_KEY,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                },
              },
            });
            const response = await ai.models.generateContent({
              model: ttsModel,
              contents: [{ parts: [{ text: cleanText }] }],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: geminiVoice },
                  },
                },
              },
            });

            const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            if (inlineData?.data) {
              const rawBuffer = Buffer.from(inlineData.data, 'base64');
              const mime = (inlineData.mimeType || '').toLowerCase();
              const wavBuffer =
                mime.includes('pcm') || mime.includes('l16') || !mime.includes('wav')
                  ? pcmToWavBuffer(rawBuffer, 24000)
                  : rawBuffer;
              const resultPayload = {
                provider: `gemini-tts-${geminiVoice.toLowerCase()}`,
                audioBase64: wavBuffer.toString('base64'),
                mimeType: 'audio/wav',
              };
              if (ttsAudioCache.size > 120) {
                const oldest = ttsAudioCache.keys().next().value;
                if (oldest) ttsAudioCache.delete(oldest);
              }
              ttsAudioCache.set(cacheKey, resultPayload);
              res.json({ ok: true, ...resultPayload });
              return;
            }
          } catch (geminiTtsErr: any) {
            const msg = String(geminiTtsErr?.message || '');
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
              modelCooldownUntil.set(ttsModel, Date.now() + 10 * 60 * 1000);
            }
          }
        }
      }

      // 2. Try Google Cloud Text-to-Speech API with GOOGLE_API_KEY
      if (GOOGLE_API_KEY) {
        try {
          const gcloudVoice = voiceName.startsWith('studio:gcloud:')
            ? voiceName.replace('studio:gcloud:', '')
            : voiceName.startsWith('studio:gemini:')
            ? 'en-US-Journey-D'
            : voiceName;
          const gcloudLang = gcloudVoice.split('-').slice(0, 2).join('-') || lang || 'en-US';

          const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`;
          const ttsRes = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text: cleanText },
              voice: {
                languageCode: gcloudLang,
                name: gcloudVoice,
              },
              audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: Math.max(0.5, Math.min(2.0, Number(speakingRate) || 1.0)),
              },
            }),
            signal: AbortSignal.timeout(6000),
          });
          if (ttsRes.ok) {
            const ttsData = (await ttsRes.json()) as any;
            if (ttsData.audioContent) {
              const resultPayload = {
                provider: 'google-cloud-tts',
                audioBase64: ttsData.audioContent,
                mimeType: 'audio/mp3',
              };
              setBoundedCache(ttsAudioCache, cacheKey, resultPayload, 120);
              res.json({ ok: true, ...resultPayload });
              return;
            }
          }
        } catch {}
      }

      // 3. Try ElevenLabs TTS API if configured
      if (process.env.ELEVENLABS_API_KEY) {
        try {
          const elRes = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
            method: 'POST',
            headers: {
              'xi-api-key': process.env.ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: cleanText,
              model_id: 'eleven_monolingual_v1',
            }),
            signal: AbortSignal.timeout(7000),
          });
          if (elRes.ok) {
            const arrayBuf = await elRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuf).toString('base64');
            const resultPayload = {
              provider: 'elevenlabs',
              audioBase64: base64,
              mimeType: 'audio/mp3',
            };
            setBoundedCache(ttsAudioCache, cacheKey, resultPayload, 120);
            res.json({ ok: true, ...resultPayload });
            return;
          }
        } catch {}
      }

      // 4. Always-On Google Cloud Neural Stream TTS (multi-accent en-US, en-GB, en-AU, en-IN, en-CA)
      try {
        let targetTl = lang || 'en-US';
        if (voiceName.includes('en-GB') || voiceName.includes('Charon') || voiceName.includes('Arthur') || voiceName.includes('Eleanor')) {
          targetTl = 'en-GB';
        } else if (voiceName.includes('en-AU') || voiceName.includes('Puck') || voiceName.includes('Liam')) {
          targetTl = 'en-AU';
        } else if (voiceName.includes('en-IN') || voiceName.includes('Aarav') || voiceName.includes('Ananya')) {
          targetTl = 'en-IN';
        } else if (voiceName.includes('en-CA') || voiceName.includes('Aoede') || voiceName.includes('Clara')) {
          targetTl = 'en-CA';
        } else if (voiceName.includes('Fenrir')) {
          targetTl = 'en-IE';
        }

        const chunks = splitTextForTtsChunks(cleanText, 185);
        const buffers: Buffer[] = [];
        const chunkItems: Array<{ text: string; audioBase64: string }> = [];

        for (const chunk of chunks) {
          const streamUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
            targetTl
          )}&q=${encodeURIComponent(chunk)}`;
          const r = await fetch(streamUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(5000),
          });
          if (r.ok) {
            const arr = await r.arrayBuffer();
            const buf = Buffer.from(arr);
            buffers.push(buf);
            chunkItems.push({
              text: chunk,
              audioBase64: buf.toString('base64'),
            });
          }
        }

        if (buffers.length > 0) {
          const combinedMp3 = Buffer.concat(buffers);
          const resultPayload = {
            provider: `google-neural-stream-${targetTl}`,
            audioBase64: combinedMp3.toString('base64'),
            mimeType: 'audio/mp3',
            chunkItems,
          };
          if (ttsAudioCache.size > 120) {
            const oldest = ttsAudioCache.keys().next().value;
            if (oldest) ttsAudioCache.delete(oldest);
          }
          ttsAudioCache.set(cacheKey, resultPayload);
          res.json({ ok: true, ...resultPayload });
          return;
        }
      } catch {}

      res.status(400).json({
        ok: false,
        error: 'Cloud TTS unavailable; falling back to browser speech synthesis.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'TTS error' });
    }
  });

  // 12. GET /api/github-search - Open-Source Code, AI Models, Datasets & Packages (GitHub + HuggingFace + npm)
  app.get('/api/github-search', async (req: Request, res: Response) => {
    try {
      const q = ((req.query.q as string) || '').trim().slice(0, 300);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));
      if (!q) {
        res.status(400).json({ error: 'Query parameter (q) is required.' });
        return;
      }

      const repos: Array<{
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
      }> = [];

      await Promise.allSettled([
        // 1. GitHub REST Search API
        (async () => {
          const ghUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10&page=${page + 1}`;
          const headers: Record<string, string> = {
            'User-Agent': 'OpenTranscriptAI/1.0',
            Accept: 'application/vnd.github+json',
          };
          if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
          }
          const ghRes = await fetch(ghUrl, { headers, signal: AbortSignal.timeout(4500) });
          if (ghRes.ok) {
            const ghData = (await ghRes.json()) as any;
            for (const item of ghData.items || []) {
              repos.push({
                id: `gh-${item.id}`,
                name: item.name,
                fullName: item.full_name,
                description: item.description || `Open-source GitHub repository for ${item.full_name}`,
                url: item.html_url,
                stars: item.stargazers_count || 0,
                forks: item.forks_count || 0,
                language: item.language || 'Code',
                topics: Array.isArray(item.topics) ? item.topics.slice(0, 5) : [],
                updatedAt: item.updated_at,
                ownerAvatar: item.owner?.avatar_url,
                source: 'GitHub',
              });
            }
          }
        })(),

        // 2. HuggingFace Hub Models API (uses HUGGINGFACE_API_KEY if configured)
        (async () => {
          if (page > 2) return;
          const hfUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=6&sort=downloads&direction=-1`;
          const hfHeaders: Record<string, string> = {};
          if (process.env.HUGGINGFACE_API_KEY) {
            hfHeaders.Authorization = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;
          }
          const hfRes = await fetch(hfUrl, { headers: hfHeaders, signal: AbortSignal.timeout(4500) });
          if (hfRes.ok) {
            const hfData = (await hfRes.json()) as any[];
            if (Array.isArray(hfData)) {
              for (const m of hfData) {
                if (!m.id) continue;
                repos.push({
                  id: `hf-model-${m.id}`,
                  name: m.id.split('/').pop() || m.id,
                  fullName: m.id,
                  description: `HuggingFace AI Model (${m.pipeline_tag || 'Transformer'}) · ${(m.downloads || 0).toLocaleString()} downloads`,
                  url: `https://huggingface.co/${m.id}`,
                  stars: m.likes || 0,
                  forks: m.downloads || 0,
                  language: m.pipeline_tag || 'AI Model',
                  topics: Array.isArray(m.tags) ? m.tags.slice(0, 5) : [],
                  updatedAt: m.lastModified,
                  source: 'HuggingFace Model',
                });
              }
            }
          }
        })(),

        // 3. HuggingFace Hub Datasets API (uses HUGGINGFACE_API_KEY if configured)
        (async () => {
          if (page > 1) return;
          const hfdUrl = `https://huggingface.co/api/datasets?search=${encodeURIComponent(q)}&limit=4&sort=downloads&direction=-1`;
          const hfdHeaders: Record<string, string> = {};
          if (process.env.HUGGINGFACE_API_KEY) {
            hfdHeaders.Authorization = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;
          }
          const hfdRes = await fetch(hfdUrl, { headers: hfdHeaders, signal: AbortSignal.timeout(4000) });
          if (hfdRes.ok) {
            const hfdData = (await hfdRes.json()) as any[];
            if (Array.isArray(hfdData)) {
              for (const d of hfdData) {
                if (!d.id) continue;
                repos.push({
                  id: `hf-ds-${d.id}`,
                  name: d.id.split('/').pop() || d.id,
                  fullName: d.id,
                  description: `HuggingFace Open Dataset · ${(d.downloads || 0).toLocaleString()} downloads`,
                  url: `https://huggingface.co/datasets/${d.id}`,
                  stars: d.likes || 0,
                  forks: d.downloads || 0,
                  language: 'Dataset',
                  topics: Array.isArray(d.tags) ? d.tags.slice(0, 4) : [],
                  updatedAt: d.lastModified,
                  source: 'HuggingFace Dataset',
                });
              }
            }
          }
        })(),

        // 4. npm Registry Package Search API
        (async () => {
          const from = page * 6;
          const npmUrl = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=6&from=${from}`;
          const npmRes = await fetch(npmUrl, { signal: AbortSignal.timeout(4000) });
          if (npmRes.ok) {
            const npmData = (await npmRes.json()) as any;
            for (const obj of npmData.objects || []) {
              const pkg = obj.package;
              if (!pkg || !pkg.name) continue;
              repos.push({
                id: `npm-${pkg.name}-${page}`,
                name: pkg.name,
                fullName: `${pkg.name}@${pkg.version || 'latest'}`,
                description: pkg.description || `JavaScript/TypeScript package on npm`,
                url: pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`,
                stars: Math.round((obj.score?.final || 0.5) * 1000),
                language: 'TypeScript / JS',
                topics: Array.isArray(pkg.keywords) ? pkg.keywords.slice(0, 5) : [],
                updatedAt: pkg.date,
                source: 'npm Registry',
              });
            }
          }
        })(),

        // 5. HuggingFace Interactive AI Spaces API
        (async () => {
          const hfHeaders: Record<string, string> = {};
          if (process.env.HUGGINGFACE_API_KEY) {
            hfHeaders.Authorization = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;
          }
          const spUrl = `https://huggingface.co/api/spaces?search=${encodeURIComponent(
            q
          )}&limit=5&sort=likes&direction=-1`;
          const spRes = await fetch(spUrl, { headers: hfHeaders, signal: AbortSignal.timeout(4000) });
          if (spRes.ok) {
            const spData = (await spRes.json()) as any[];
            for (const sp of (spData || []).slice(0, 5)) {
              const id = sp.id || sp.modelId;
              if (!id) continue;
              repos.push({
                id: `hf-space-${id}`,
                name: id.split('/').pop() || id,
                fullName: id,
                description: `Interactive AI demo & live web application hosted on HuggingFace Spaces (${sp.sdk || 'Gradio/Streamlit'}).`,
                url: `https://huggingface.co/spaces/${id}`,
                stars: sp.likes || 0,
                language: sp.sdk ? `HF Space (${sp.sdk})` : 'HuggingFace Space',
                updatedAt: sp.lastModified,
                source: 'HuggingFace Space',
              });
            }
          }
        })(),

        // 6. PyPI Python Package Index
        (async () => {
          const slug = q
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-_]+/g, '-')
            .replace(/^-+|-+$/g, '');
          if (!slug || slug.length < 2) return;
          const pypiUrl = `https://pypi.org/pypi/${encodeURIComponent(slug)}/json`;
          const pyRes = await fetch(pypiUrl, { signal: AbortSignal.timeout(3500) });
          if (pyRes.ok) {
            const pyData = (await pyRes.json()) as any;
            const info = pyData.info;
            if (info && info.name) {
              repos.push({
                id: `pypi-${info.name}`,
                name: info.name,
                fullName: `pypi/${info.name}@${info.version || 'latest'}`,
                description: info.summary || `Official Python package on PyPI (${info.name}).`,
                url: info.package_url || info.project_url || `https://pypi.org/project/${info.name}/`,
                stars: 500,
                language: 'Python (PyPI)',
                topics: info.keywords ? String(info.keywords).split(/[\s,]+/).filter(Boolean).slice(0, 5) : [],
                source: 'PyPI Package',
              });
            }
          }
        })(),
      ]);

      res.json({ ok: true, query: q, page, hasMore: repos.length > 0, repos });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'GitHub & Code search failed' });
    }
  });

  // 13. GET /api/community-search - Technical Q&A & Developer/Research Discussions (StackOverflow + Reddit + DEV.to + HN)
  app.get('/api/community-search', async (req: Request, res: Response) => {
    try {
      const q = ((req.query.q as string) || '').trim().slice(0, 300);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));
      if (!q) {
        res.status(400).json({ error: 'Query parameter (q) is required.' });
        return;
      }

      const discussions: Array<{
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
      }> = [];

      await Promise.allSettled([
        // 1. StackExchange / StackOverflow API v2.3 (uses STACKEXCHANGE_KEY if configured)
        (async () => {
          const seKeyParam = process.env.STACKEXCHANGE_KEY ? `&key=${encodeURIComponent(process.env.STACKEXCHANGE_KEY)}` : '';
          const soUrl = `https://api.stackexchange.com/2.3/search/advanced?page=${page + 1}&pagesize=8&order=desc&sort=relevance&q=${encodeURIComponent(q)}&site=stackoverflow${seKeyParam}`;
          const soRes = await fetch(soUrl, { signal: AbortSignal.timeout(4500) });
          if (soRes.ok) {
            const soData = (await soRes.json()) as any;
            for (const item of soData.items || []) {
              const cleanTitle = String(item.title || '')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&');
              discussions.push({
                id: `so-${item.question_id}`,
                title: cleanTitle,
                snippet: `${item.is_answered ? '✓ Verified Answer · ' : ''}${item.answer_count || 0} answers · ${(item.view_count || 0).toLocaleString()} views on StackOverflow.`,
                url: item.link,
                author: item.owner?.display_name || 'Developer',
                community: 'StackOverflow',
                score: item.score || 0,
                commentsCount: item.answer_count || 0,
                isAnswered: !!item.is_answered,
                publishedAt: item.creation_date ? new Date(item.creation_date * 1000).toISOString() : undefined,
                tags: Array.isArray(item.tags) ? item.tags.slice(0, 5) : [],
                source: 'StackOverflow',
              });
            }
          }
        })(),

        // 2. Reddit Public Search JSON API
        (async () => {
          if (page > 2) return;
          const rdUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=relevance&limit=8`;
          const rdRes = await fetch(rdUrl, {
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0 (Research Client)' },
            signal: AbortSignal.timeout(4500),
          });
          if (rdRes.ok) {
            const rdData = (await rdRes.json()) as any;
            for (const child of rdData.data?.children || []) {
              const post = child.data;
              if (!post || !post.title) continue;
              discussions.push({
                id: `rd-${post.id}`,
                title: post.title,
                snippet: post.selftext
                  ? String(post.selftext).replace(/\s+/g, ' ').trim().slice(0, 280)
                  : `Community thread in r/${post.subreddit} by u/${post.author}`,
                url: `https://www.reddit.com${post.permalink}`,
                author: `u/${post.author || 'redditor'}`,
                community: `r/${post.subreddit || 'technology'}`,
                score: post.score || post.ups || 0,
                commentsCount: post.num_comments || 0,
                publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : undefined,
                source: 'Reddit',
              });
            }
          }
        })(),

        // 3. DEV.to Engineering & Research Articles API
        (async () => {
          const tagSlug = q.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
          const devUrl = `https://dev.to/api/articles?per_page=6&page=${page + 1}${tagSlug ? `&tag=${encodeURIComponent(tagSlug)}` : ''}`;
          const devRes = await fetch(devUrl, {
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
            signal: AbortSignal.timeout(4000),
          });
          if (devRes.ok) {
            const devData = (await devRes.json()) as any[];
            if (Array.isArray(devData)) {
              for (const art of devData) {
                if (!art.title) continue;
                discussions.push({
                  id: `devto-${art.id}`,
                  title: art.title,
                  snippet: art.description || `Technical article by ${art.user?.name || 'Engineer'} (${art.reading_time_minutes || 4} min read)`,
                  url: art.url,
                  author: art.user?.name || 'DEV Author',
                  community: 'DEV.to Engineering',
                  score: art.public_reactions_count || 0,
                  commentsCount: art.comments_count || 0,
                  publishedAt: art.published_at,
                  tags: Array.isArray(art.tag_list) ? art.tag_list.slice(0, 5) : [],
                  source: 'DEV.to',
                });
              }
            }
          }
        })(),

        // 4. Hacker News Algolia Deep Threads
        (async () => {
          const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=6&page=${page}`;
          const hnRes = await fetch(hnUrl, { signal: AbortSignal.timeout(4000) });
          if (hnRes.ok) {
            const hnData = (await hnRes.json()) as any;
            for (const hit of hnData.hits || []) {
              if (!hit.title) continue;
              discussions.push({
                id: `hnd-${hit.objectID}`,
                title: hit.title,
                snippet: `Hacker News thread · ${hit.points || 0} upvotes · ${hit.num_comments || 0} comments`,
                url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
                author: hit.author || 'HN User',
                community: 'Hacker News',
                score: hit.points || 0,
                commentsCount: hit.num_comments || 0,
                publishedAt: hit.created_at,
                source: 'Hacker News',
              });
            }
          }
        })(),

        // 5. StackExchange Data Science / CrossValidated Q&A API
        (async () => {
          const sePage = page + 1;
          const seKeyParam = process.env.STACKEXCHANGE_KEY
            ? `&key=${encodeURIComponent(process.env.STACKEXCHANGE_KEY)}`
            : '';
          const seUrl = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(
            q
          )}&site=stats&pagesize=5&page=${sePage}${seKeyParam}`;
          const seRes = await fetch(seUrl, { signal: AbortSignal.timeout(4000) });
          if (seRes.ok) {
            const seData = (await seRes.json()) as any;
            for (const item of seData.items || []) {
              if (!item.title) continue;
              discussions.push({
                id: `se-stats-${item.question_id}`,
                title: String(item.title)
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&amp;/g, '&'),
                snippet: `CrossValidated / StackExchange Q&A (${item.answer_count || 0} answers, ${(
                  item.view_count || 0
                ).toLocaleString()} views).`,
                url: item.link,
                author: item.owner?.display_name || 'Researcher',
                community: 'CrossValidated SE',
                score: item.score || 0,
                commentsCount: item.answer_count || 0,
                isAnswered: item.is_answered,
                tags: Array.isArray(item.tags) ? item.tags.slice(0, 4) : [],
                source: 'StackExchange',
              });
            }
          }
        })(),

        // 6. GitHub Engineering Issues & Technical Discussions API
        (async () => {
          const ghHeaders: Record<string, string> = {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'OpenTranscriptAI/1.0',
          };
          if (process.env.GITHUB_TOKEN) {
            ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
          }
          const ghUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(
            q
          )}&sort=comments&order=desc&per_page=5&page=${page + 1}`;
          const ghRes = await fetch(ghUrl, { headers: ghHeaders, signal: AbortSignal.timeout(4000) });
          if (ghRes.ok) {
            const ghData = (await ghRes.json()) as any;
            for (const issue of ghData.items || []) {
              if (!issue.title) continue;
              const repoSlug = issue.repository_url
                ? String(issue.repository_url).split('/').slice(-2).join('/')
                : 'GitHub';
              discussions.push({
                id: `gh-issue-${issue.id}`,
                title: issue.title,
                snippet: issue.body
                  ? String(issue.body).replace(/[#*`>\r\n]+/g, ' ').trim().slice(0, 200)
                  : `Technical discussion in ${repoSlug}.`,
                url: issue.html_url,
                author: issue.user?.login || 'maintainer',
                community: repoSlug,
                score: issue.reactions?.total_count || 1,
                commentsCount: issue.comments || 0,
                isAnswered: issue.state === 'closed',
                publishedAt: issue.created_at,
                source: 'GitHub Discussions',
              });
            }
          }
        })(),
      ]);

      res.json({ ok: true, query: q, page, hasMore: discussions.length > 0, discussions });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Community search failed' });
    }
  });

  // 14. GET /api/podcasts-datasets - Audio Podcasts, Open Science Datasets & Archival Media (Apple Podcasts + Zenodo + Internet Archive)
  app.get('/api/podcasts-datasets', async (req: Request, res: Response) => {
    try {
      const q = ((req.query.q as string) || '').trim().slice(0, 300);
      const page = Math.min(50, Math.max(0, parseInt((req.query.page as string) || '0', 10) || 0));
      if (!q) {
        res.status(400).json({ error: 'Query parameter (q) is required.' });
        return;
      }

      const items: Array<{
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
      }> = [];

      await Promise.allSettled([
        // 0. Listen Notes Podcast Search API (if LISTENNOTES_API_KEY is configured)
        (async () => {
          if (!process.env.LISTENNOTES_API_KEY) return;
          const lnOffset = page * 10;
          const lnUrl = `https://listen-api.listennotes.com/api/v2/search?q=${encodeURIComponent(q)}&type=episode&offset=${lnOffset}&len_min=2`;
          const lnRes = await fetch(lnUrl, {
            headers: { 'X-ListenAPI-Key': process.env.LISTENNOTES_API_KEY },
            signal: AbortSignal.timeout(4500),
          });
          if (lnRes.ok) {
            const lnData = (await lnRes.json()) as any;
            for (const ep of lnData.results || []) {
              if (!ep.title_original) continue;
              const mins = ep.audio_length_sec ? `${Math.round(ep.audio_length_sec / 60)} min` : undefined;
              items.push({
                id: `ln-${ep.id}`,
                title: ep.title_original,
                creator: ep.podcast?.title_original || ep.podcast?.publisher_original || 'Listen Notes Podcast',
                description: ep.description_original
                  ? String(ep.description_original).replace(/<[^>]+>/g, '').slice(0, 280)
                  : 'Podcast episode via Listen Notes.',
                url: ep.listennotes_url || ep.link || 'https://www.listennotes.com',
                audioOrDownloadUrl: ep.audio,
                thumbnailUrl: ep.thumbnail || ep.image,
                publishedAt: ep.pub_date_ms ? new Date(ep.pub_date_ms).toISOString() : undefined,
                durationOrSize: mins,
                category: 'Podcast Episode',
              });
            }
          }
        })(),

        // 1. Apple iTunes Podcast Episode Search API
        (async () => {
          if (page > 1) return;
          const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&entity=podcastEpisode&limit=8`;
          const itRes = await fetch(itunesUrl, { signal: AbortSignal.timeout(4500) });
          if (itRes.ok) {
            const itData = (await itRes.json()) as any;
            for (const ep of itData.results || []) {
              if (!ep.trackName) continue;
              const mins = ep.trackTimeMillis ? `${Math.round(ep.trackTimeMillis / 60000)} min` : undefined;
              items.push({
                id: `pod-${ep.trackId || Math.random().toString(36).slice(2, 8)}`,
                title: ep.trackName,
                creator: ep.collectionName || ep.artistName || 'Podcast Series',
                description: ep.description
                  ? String(ep.description).replace(/<[^>]+>/g, '').slice(0, 280)
                  : ep.shortDescription || `Podcast episode from ${ep.collectionName || 'Apple Podcasts'}`,
                url: ep.trackViewUrl || ep.collectionViewUrl || 'https://podcasts.apple.com',
                audioOrDownloadUrl: ep.episodeUrl || ep.previewUrl,
                thumbnailUrl: ep.artworkUrl160 || ep.artworkUrl60,
                publishedAt: ep.releaseDate,
                durationOrSize: mins,
                category: 'Podcast Episode',
              });
            }
          }
        })(),

        // 2. Zenodo Open Science Research Datasets & Software API (CERN)
        (async () => {
          const zenUrl = `https://zenodo.org/api/records?q=${encodeURIComponent(q)}&size=6&page=${page + 1}`;
          const zenRes = await fetch(zenUrl, { signal: AbortSignal.timeout(4500) });
          if (zenRes.ok) {
            const zenData = (await zenRes.json()) as any;
            for (const rec of zenData.hits?.hits || []) {
              const meta = rec.metadata || {};
              if (!meta.title) continue;
              const creators = Array.isArray(meta.creators)
                ? meta.creators.map((c: any) => c.name).filter(Boolean).slice(0, 3).join(', ')
                : 'Zenodo Researcher';
              items.push({
                id: `zenodo-${rec.id}`,
                title: String(meta.title).replace(/<[^>]+>/g, ''),
                creator: creators || 'CERN / Zenodo Open Science',
                description: meta.description
                  ? String(meta.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)
                  : 'Open-access scientific dataset & research artifact hosted on CERN Zenodo.',
                url: rec.links?.self_html || `https://zenodo.org/records/${rec.id}`,
                publishedAt: meta.publication_date,
                durationOrSize: meta.resource_type?.title || 'Dataset / Artifact',
                category: 'Zenodo Dataset',
              });
            }
          }
        })(),

        // 3. Internet Archive Open Lectures, Audio & Texts API (sorted by downloads desc)
        (async () => {
          const iaQuery = `title:(${q})`;
          const iaUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
            iaQuery
          )}&sort[]=downloads+desc&fl[]=identifier,title,creator,description,mediatype,publicdate&rows=6&page=${
            page + 1
          }&output=json`;
          const iaRes = await fetch(iaUrl, { signal: AbortSignal.timeout(4500) });
          if (iaRes.ok) {
            const iaData = (await iaRes.json()) as any;
            for (const doc of iaData.response?.docs || []) {
              if (!doc.identifier || !doc.title) continue;
              items.push({
                id: `ia-${doc.identifier}`,
                title: Array.isArray(doc.title) ? doc.title[0] : doc.title,
                creator: Array.isArray(doc.creator) ? doc.creator[0] : doc.creator || 'Internet Archive',
                description: doc.description
                  ? String(Array.isArray(doc.description) ? doc.description[0] : doc.description)
                      .replace(/<[^>]+>/g, ' ')
                      .slice(0, 260)
                  : `Archival ${doc.mediatype || 'media'} preserved in the Internet Archive.`,
                url: `https://archive.org/details/${doc.identifier}`,
                thumbnailUrl: `https://archive.org/services/img/${doc.identifier}`,
                publishedAt: doc.publicdate,
                durationOrSize: String(doc.mediatype || 'archive').toUpperCase(),
                category: 'Internet Archive',
              });
            }
          }
        })(),

        // 4. Library of Congress (LOC.gov) Public Archival Collections API
        (async () => {
          const locUrl = `https://www.loc.gov/search/?q=${encodeURIComponent(q)}&fo=json&c=5&sp=${page + 1}`;
          const locRes = await fetch(locUrl, {
            signal: AbortSignal.timeout(4500),
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
          });
          if (locRes.ok) {
            const locData = (await locRes.json()) as any;
            for (const r of (locData.results || []).slice(0, 5)) {
              if (!r.title) continue;
              const desc = Array.isArray(r.description) ? r.description[0] : r.description;
              const creator = Array.isArray(r.contributor) ? r.contributor[0] : 'Library of Congress';
              const thumb = Array.isArray(r.image_url) ? r.image_url[0] : undefined;
              items.push({
                id: `loc-${r.id || Math.random().toString(36).slice(2, 8)}`,
                title: String(r.title),
                creator: String(creator),
                description: desc
                  ? String(desc).slice(0, 240)
                  : 'Primary historical record in the U.S. Library of Congress digital archive.',
                url: r.url || r.id || `https://www.loc.gov/search/?q=${encodeURIComponent(q)}`,
                thumbnailUrl: thumb,
                publishedAt: r.date,
                durationOrSize: r.original_format ? String(r.original_format[0] || 'Archive') : 'LOC Record',
                category: 'Library of Congress',
              });
            }
          }
        })(),
      ]);

      res.json({ ok: true, query: q, page, hasMore: items.length > 0, items });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Podcasts & datasets search failed' });
    }
  });

  // 15. GET /api/dictionary-knowledge - 12-Source Knowledge Graph, Lexical Dictionary, Wiktionary, StackOverflow Tech Wiki, Datamuse Semantic Graph, Wikidata, Wikipedia, OpenAlex, arXiv, OpenLibrary & Plain-English Synthesizer
  app.get('/api/dictionary-knowledge', async (req: Request, res: Response) => {
    try {
      const q = ((req.query.q as string) || '').trim();
      const videoContext = ((req.query.context as string) || '').trim();
      if (!q) {
        res.status(400).json({ error: 'Query parameter (q) is required.' });
        return;
      }

      let phonetic: string | undefined;
      let audioUrl: string | undefined;
      const definitions: Array<{ partOfSpeech: string; definition: string; example?: string; source?: string }> = [];
      const wiktionaryDefinitions: Array<{ partOfSpeech: string; definition: string }> = [];
      let technicalWiki: { tag: string; excerpt: string; url: string; source: string } | undefined;
      let duckDuckGoAbstract: { heading: string; abstract: string; url: string; source: string } | undefined;
      const academicPapers: Array<{
        title: string;
        authors: string;
        year?: string | number;
        citationCount?: number;
        url: string;
        source: string;
      }> = [];
      const books: Array<{
        title: string;
        author: string;
        year?: string | number;
        url: string;
      }> = [];
      const sourcesUsed = new Set<string>();
      const synonymsSet = new Set<string>();
      const relatedTerms: Array<{ word: string; score?: number; def?: string }> = [];
      let wikidata: { id: string; label: string; description: string; url: string; aliases?: string[] } | undefined;
      let wikipedia: { title: string; extract: string; url: string; thumbnailUrl?: string } | undefined;

      const isSingleWord = !/\s/.test(q.trim());

      await Promise.allSettled([
        // 1. Free Dictionary API (only match full query or hyphenated phrase, never split multi-word concepts into first word)
        (async () => {
          const candidates = isSingleWord
            ? [q.trim().toLowerCase(), q.replace(/[^a-zA-Z-]/g, '').toLowerCase()].filter(Boolean)
            : [q.trim().toLowerCase()];

          for (const candidate of Array.from(new Set(candidates))) {
            const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(candidate)}`;
            const dRes = await fetch(dictUrl, { signal: AbortSignal.timeout(3500) });
            if (dRes.ok) {
              const dData = (await dRes.json()) as any[];
              const entry = dData?.[0];
              if (entry) {
                sourcesUsed.add('Free Dictionary API');
                phonetic = phonetic || entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text;
                audioUrl = audioUrl || entry.phonetics?.find((p: any) => p.audio)?.audio;
                for (const meaning of entry.meanings || []) {
                  for (const s of meaning.synonyms || []) synonymsSet.add(s);
                  for (const def of (meaning.definitions || []).slice(0, 3)) {
                    definitions.push({
                      partOfSpeech: meaning.partOfSpeech || 'term',
                      definition: def.definition,
                      example: def.example,
                      source: 'Lexical Dictionary',
                    });
                  }
                }
                break;
              }
            }
          }
        })(),

        // 2. Wiktionary Open-Source Dictionary API
        (async () => {
          const candidates = [q.trim(), q.trim().toLowerCase()].filter(Boolean);
          for (const termCandidate of Array.from(new Set(candidates))) {
            const wtUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(termCandidate)}`;
            const wtRes = await fetch(wtUrl, {
              headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
              signal: AbortSignal.timeout(3500),
            });
            if (wtRes.ok) {
              const wtData = (await wtRes.json()) as any;
              const enEntries = wtData?.en || [];
              for (const section of enEntries) {
                const pos = section.partOfSpeech || 'term';
                for (const d of (section.definitions || []).slice(0, 3)) {
                  const cleanDef = String(d.definition || '')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&amp;/g, '&')
                    .replace(/\s+/g, ' ')
                    .trim();
                  if (cleanDef && cleanDef.length > 8) {
                    wiktionaryDefinitions.push({
                      partOfSpeech: pos,
                      definition: cleanDef,
                    });
                  }
                }
              }
              if (wiktionaryDefinitions.length > 0) {
                sourcesUsed.add('Wiktionary');
                break;
              }
            }
          }
        })(),

        // 3. StackOverflow / StackExchange Engineering Tag Wiki API
        (async () => {
          const tagSlug = q
            .toLowerCase()
            .replace(/\(.*?\)/g, '')
            .trim()
            .replace(/[^a-z0-9+#.-]+/g, '-')
            .replace(/^-+|-+$/g, '');
          if (!tagSlug) return;
          const seKeyParam = process.env.STACKEXCHANGE_KEY
            ? `&key=${encodeURIComponent(process.env.STACKEXCHANGE_KEY)}`
            : '';
          const soWikiUrl = `https://api.stackexchange.com/2.3/tags/${encodeURIComponent(tagSlug)}/wikis?site=stackoverflow${seKeyParam}`;
          const soRes = await fetch(soWikiUrl, { signal: AbortSignal.timeout(3500) });
          if (soRes.ok) {
            const soData = (await soRes.json()) as any;
            const wikiItem = soData?.items?.[0];
            if (wikiItem && wikiItem.excerpt) {
              const cleanExcerpt = String(wikiItem.excerpt)
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&')
                .replace(/<[^>]+>/g, '')
                .trim();
              if (cleanExcerpt.length > 15) {
                sourcesUsed.add('StackOverflow Tech Wiki');
                technicalWiki = {
                  tag: wikiItem.tag_name || tagSlug,
                  excerpt: cleanExcerpt,
                  url: `https://stackoverflow.com/tags/${encodeURIComponent(wikiItem.tag_name || tagSlug)}/info`,
                  source: 'StackOverflow Technical Tag Wiki',
                };
              }
            }
          }
        })(),

        // 4. Datamuse Lexical & Semantic Concept Graph API
        (async () => {
          const dmUrl = `https://api.datamuse.com/words?ml=${encodeURIComponent(q)}&md=dp&max=12`;
          const dmRes = await fetch(dmUrl, { signal: AbortSignal.timeout(3500) });
          if (dmRes.ok) {
            const dmData = (await dmRes.json()) as any[];
            for (const item of dmData || []) {
              if (!item.word) continue;
              const rawDef = Array.isArray(item.defs) && item.defs[0] ? String(item.defs[0]).split('\t')[1] : undefined;
              relatedTerms.push({
                word: item.word,
                score: item.score,
                def: rawDef,
              });
            }
            if (relatedTerms.length > 0) sourcesUsed.add('Datamuse Concept Graph');
          }
        })(),

        // 5. Wikidata Knowledge Graph Entity API
        (async () => {
          const wdUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&limit=1&format=json`;
          const wdRes = await fetch(wdUrl, {
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
            signal: AbortSignal.timeout(3500),
          });
          if (wdRes.ok) {
            const wdData = (await wdRes.json()) as any;
            const top = wdData.search?.[0];
            if (top && top.description) {
              sourcesUsed.add('Wikidata Knowledge Graph');
              wikidata = {
                id: top.id,
                label: top.label || q,
                description: top.description,
                url: top.concepturi || `https://www.wikidata.org/wiki/${top.id}`,
                aliases: Array.isArray(top.aliases) ? top.aliases.slice(0, 6) : undefined,
              };
            }
          }
        })(),

        // 6. Wikipedia REST v1 Summary API + Search Fallback
        (async () => {
          const wikiSlug = encodeURIComponent(q.trim().replace(/\s+/g, '_'));
          const wpUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`;
          const wpRes = await fetch(wpUrl, {
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
            signal: AbortSignal.timeout(3500),
          });
          if (wpRes.ok) {
            const wpData = (await wpRes.json()) as any;
            if (wpData.extract && wpData.type !== 'disambiguation') {
              sourcesUsed.add('Wikipedia Encyclopedia');
              wikipedia = {
                title: wpData.title || q,
                extract: wpData.extract,
                url: wpData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${wikiSlug}`,
                thumbnailUrl: wpData.thumbnail?.source,
              };
              return;
            }
          }
          const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=&format=json&srlimit=1`;
          const sRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
            signal: AbortSignal.timeout(3500),
          });
          if (sRes.ok) {
            const sData = (await sRes.json()) as any;
            const bestTitle = sData?.query?.search?.[0]?.title;
            if (bestTitle) {
              const bestSlug = encodeURIComponent(String(bestTitle).replace(/\s+/g, '_'));
              const wpRes2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${bestSlug}`, {
                headers: { 'User-Agent': 'OpenTranscriptAI/1.0' },
                signal: AbortSignal.timeout(3500),
              });
              if (wpRes2.ok) {
                const wpData2 = (await wpRes2.json()) as any;
                if (wpData2.extract) {
                  sourcesUsed.add('Wikipedia Encyclopedia');
                  wikipedia = {
                    title: wpData2.title || bestTitle,
                    extract: wpData2.extract,
                    url: wpData2.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${bestSlug}`,
                    thumbnailUrl: wpData2.thumbnail?.source,
                  };
                }
              }
            }
          }
        })(),

        // 7. DuckDuckGo Instant Answer Encyclopedia API
        (async () => {
          const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
          const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(3500) });
          if (ddgRes.ok) {
            const ddgData = (await ddgRes.json()) as any;
            if (ddgData.AbstractText && String(ddgData.AbstractText).trim().length > 20) {
              sourcesUsed.add('DuckDuckGo Encyclopedia');
              duckDuckGoAbstract = {
                heading: ddgData.Heading || q,
                abstract: String(ddgData.AbstractText).trim(),
                url: ddgData.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
                source: ddgData.AbstractSource || 'DuckDuckGo Instant Answer',
              };
            }
          }
        })(),

        // 8. OpenAlex Peer-Reviewed Academic Papers & Concepts API
        (async () => {
          const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=3&sort=cited_by_count:desc`;
          const oaRes = await fetch(oaUrl, {
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0 (mailto:research@opentranscript.org)' },
            signal: AbortSignal.timeout(4000),
          });
          if (oaRes.ok) {
            const oaData = (await oaRes.json()) as any;
            for (const work of (oaData.results || []).slice(0, 3)) {
              if (!work.title) continue;
              const authors = (work.authorships || [])
                .slice(0, 3)
                .map((a: any) => a.author?.display_name)
                .filter(Boolean)
                .join(', ');
              academicPapers.push({
                title: String(work.title),
                authors: authors || 'Academic Research Team',
                year: work.publication_year,
                citationCount: work.cited_by_count,
                url: work.doi || work.primary_location?.landing_page_url || `https://openalex.org/${work.id}`,
                source: 'OpenAlex Peer-Reviewed',
              });
            }
            if (academicPapers.length > 0) sourcesUsed.add('OpenAlex Academic Index');
          }
        })(),

        // 9. Crossref Scholarly DOI Registry API
        (async () => {
          const crUrl = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=2&sort=is-referenced-by-count&order=desc`;
          const crRes = await fetch(crUrl, {
            headers: { 'User-Agent': 'OpenTranscriptAI/1.0 (mailto:research@opentranscript.org)' },
            signal: AbortSignal.timeout(4000),
          });
          if (crRes.ok) {
            const crData = (await crRes.json()) as any;
            for (const item of (crData.message?.items || []).slice(0, 2)) {
              const title = Array.isArray(item.title) ? item.title[0] : item.title;
              if (!title) continue;
              const authors = Array.isArray(item.author)
                ? item.author
                    .slice(0, 3)
                    .map((a: any) => [a.given, a.family].filter(Boolean).join(' '))
                    .filter(Boolean)
                    .join(', ')
                : 'Peer-Reviewed Journal Author';
              const year =
                item.published?.['date-parts']?.[0]?.[0] ||
                item['published-print']?.['date-parts']?.[0]?.[0] ||
                item.created?.['date-parts']?.[0]?.[0];
              academicPapers.push({
                title: String(title).replace(/<[^>]+>/g, ''),
                authors: authors || 'Published Researcher',
                year,
                citationCount: item['is-referenced-by-count'],
                url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : `https://search.crossref.org/?q=${encodeURIComponent(q)}`),
                source: 'Crossref DOI Registry',
              });
            }
            if ((crData.message?.items || []).length > 0) sourcesUsed.add('Crossref DOI Registry');
          }
        })(),

        // 10. arXiv Scientific Preprints API (STEM, CS, AI, Physics & Math)
        (async () => {
          const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=2`;
          const axRes = await fetch(arxivUrl, { signal: AbortSignal.timeout(4000) });
          if (axRes.ok) {
            const xml = await axRes.text();
            const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
            for (const entryXml of entries.slice(0, 2)) {
              const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
              const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/);
              const pubMatch = entryXml.match(/<published>(\d{4})/);
              const authorMatches = Array.from(entryXml.matchAll(/<name>([\s\S]*?)<\/name>/g)).map((m) => m[1].trim());
              if (titleMatch && idMatch) {
                const cleanTitle = titleMatch[1].replace(/\s+/g, ' ').trim();
                if (cleanTitle && cleanTitle.toLowerCase() !== 'error') {
                  academicPapers.push({
                    title: cleanTitle,
                    authors: authorMatches.slice(0, 3).join(', ') || 'arXiv Researcher',
                    year: pubMatch ? pubMatch[1] : undefined,
                    url: idMatch[1].trim(),
                    source: 'arXiv Preprint Archive',
                  });
                  sourcesUsed.add('arXiv Preprint Archive');
                }
              }
            }
          }
        })(),

        // 11. OpenLibrary Published Books & Literature API
        (async () => {
          const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=3`;
          const olRes = await fetch(olUrl, { signal: AbortSignal.timeout(4000) });
          if (olRes.ok) {
            const olData = (await olRes.json()) as any;
            for (const docItem of (olData.docs || []).slice(0, 3)) {
              if (!docItem.title) continue;
              books.push({
                title: String(docItem.title),
                author: Array.isArray(docItem.author_name) ? docItem.author_name.slice(0, 2).join(', ') : 'Published Author',
                year: docItem.first_publish_year,
                url: docItem.key ? `https://openlibrary.org${docItem.key}` : `https://openlibrary.org/search?q=${encodeURIComponent(q)}`,
              });
            }
            if (books.length > 0) sourcesUsed.add('OpenLibrary Books');
          }
        })(),
      ]);

      // Merge Wiktionary definitions into main definitions if primary dictionary had none
      if (definitions.length === 0 && wiktionaryDefinitions.length > 0) {
        for (const wd of wiktionaryDefinitions.slice(0, 4)) {
          definitions.push({
            partOfSpeech: wd.partOfSpeech,
            definition: wd.definition,
            source: 'Wiktionary Open Dictionary',
          });
        }
      }

      // If technicalWiki or duckDuckGoAbstract has a strong definition and definitions is empty, include it
      if (definitions.length === 0 && technicalWiki) {
        definitions.push({
          partOfSpeech: 'technical concept',
          definition: technicalWiki.excerpt,
          source: technicalWiki.source,
        });
      }

      // 12. Build an accurate, human-friendly plainEnglish & technical breakdown from verified sources (with Gemini enrichment)
      let plainEnglish:
        | {
            summary: string;
            whyItMatters: string;
            realWorldExample?: string;
            technicalArchitecture?: string;
            fullForm?: string;
            domain?: string;
          }
        | undefined;
      const primarySourceText =
        wikipedia?.extract ||
        duckDuckGoAbstract?.abstract ||
        technicalWiki?.excerpt ||
        definitions[0]?.definition ||
        wikidata?.description ||
        '';

      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });
          const resp = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: `Explain the concept, person, term, acronym, or phrase "${q}" in clear, accurate, everyday English${
              videoContext ? ` (mentioned in the context of: "${videoContext.slice(0, 300)}")` : ''
            }.
${primarySourceText ? `Reference Facts: ${primarySourceText.slice(0, 650)}\n` : ''}
Respond strictly as JSON with these keys:
{
  "fullForm": "Expanded full name or 3-6 word subtitle explaining what it stands for",
  "domain": "Best-fit category (e.g. AI & Machine Learning, CSE & Algorithms, Systems & Cloud, Science & Medicine, History & Culture, Business & Strategy)",
  "summary": "2 clear, accurate sentences explaining what it means in plain, user-friendly English without jargon.",
  "whyItMatters": "1-2 sentences explaining why this concept or term matters in practice.",
  "technicalArchitecture": "1-2 sentences explaining how it works under the hood or its deeper mechanism/background.",
  "realWorldExample": "1 concrete, relatable real-world example."
}`,
            config: { temperature: 0.2, maxOutputTokens: 450 },
          });
          const rawJson = (resp.text || '')
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();
          const parsedPlain = JSON.parse(rawJson);
          if (parsedPlain?.summary) {
            plainEnglish = {
              summary: String(parsedPlain.summary),
              whyItMatters: String(parsedPlain.whyItMatters || ''),
              realWorldExample: parsedPlain.realWorldExample ? String(parsedPlain.realWorldExample) : undefined,
              technicalArchitecture: parsedPlain.technicalArchitecture
                ? String(parsedPlain.technicalArchitecture)
                : undefined,
              fullForm: parsedPlain.fullForm ? String(parsedPlain.fullForm) : undefined,
              domain: parsedPlain.domain ? String(parsedPlain.domain) : undefined,
            };
            sourcesUsed.add('AI Knowledge Synthesis');
          }
        } catch {
          // Fallback to deterministic synthesis below
        }
      }

      if (!plainEnglish && primarySourceText) {
        const sents = primarySourceText.split(/(?<=[.!?])\s+/).filter(Boolean);
        plainEnglish = {
          fullForm: wikidata?.description || wikipedia?.title || undefined,
          summary: sents.slice(0, 2).join(' ') || primarySourceText,
          whyItMatters:
            wikidata?.description ||
            sents[2] ||
            (technicalWiki?.excerpt ? technicalWiki.excerpt.split(/(?<=[.!?])\s+/)[0] : '') ||
            sents[0] ||
            '',
          technicalArchitecture:
            technicalWiki?.excerpt ||
            (wikipedia?.extract ? wikipedia.extract.split(/(?<=[.!?])\s+/).slice(1, 3).join(' ') : undefined),
          realWorldExample: definitions.find((d) => d.example)?.example,
        };
      }

      res.json({
        ok: true,
        result: {
          query: q,
          phonetic,
          audioUrl,
          plainEnglish,
          definitions,
          wiktionaryDefinitions: wiktionaryDefinitions.slice(0, 6),
          technicalWiki,
          duckDuckGoAbstract,
          academicPapers: academicPapers.slice(0, 5),
          books: books.slice(0, 4),
          sourcesUsed: Array.from(sourcesUsed),
          synonyms: Array.from(synonymsSet).slice(0, 12),
          relatedTerms,
          wikidata,
          wikipedia,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Dictionary knowledge lookup failed' });
    }
  });

  // 15b. POST /api/extract-key-ideas - Deep AI + Multi-Source Key Ideas & Crucial Words Extractor (BUG-029 BoundedCache)
  const keyIdeasCache = new BoundedCache<string, { terms: any[]; takeaways: any[] }>(120);
  app.post('/api/extract-key-ideas', async (req: Request, res: Response) => {
    try {
      const { videoTitle = '', summaryMarkdown = '', transcriptSample = '' } = req.body || {};
      const combinedInput = `${videoTitle}\n${summaryMarkdown.slice(0, 6000)}\n${transcriptSample.slice(0, 4000)}`.trim();
      if (!combinedInput || combinedInput.length < 30) {
        res.json({ ok: true, terms: [], takeaways: [] });
        return;
      }

      // Cryptographic digest for cache key (BUG-032)
      const cacheKey = sha256Digest({ videoTitle, combinedInput });
      if (keyIdeasCache.has(cacheKey)) {
        res.json({ ok: true, ...keyIdeasCache.get(cacheKey)! });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.json({ ok: true, terms: [], takeaways: [] });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const prompt = `You are an expert educator and knowledge curator. Analyze the following video title, summary, and transcript excerpt, and extract the most accurate, user-friendly Key Ideas (big lessons/principles) and Key Words (important terms, concepts, acronyms, people, or institutions).

RULES:
- Write in warm, crystal-clear, everyday human English. Never use robotic filler or generic placeholders.
- Every term and key idea MUST be 100% grounded in the actual video content.
- Include exact timestamps (like "02:15" or "11:40") if mentioned in the text.

Video Title: ${videoTitle}
Content:
${combinedInput.slice(0, 8500)}

Return strictly valid JSON matching this structure:
{
  "takeaways": [
    {
      "principle": "Clear, memorable 4-9 word title of the core idea",
      "description": "2 clear, accurate sentences explaining the insight in plain English.",
      "quote": "Exact or near-exact memorable quote from the speaker (or empty string if none)",
      "actionableLesson": "1 concrete, practical way the viewer can apply this idea in real life.",
      "formattedTime": "MM:SS if known, else empty string",
      "category": "mindset" | "decision_making" | "execution" | "craft"
    }
  ],
  "terms": [
    {
      "term": "Exact term, concept, acronym, or entity name",
      "fullForm": "Full expanded name or clear 3-6 word subtitle",
      "category": "acronym" | "core_concept" | "entity" | "rule_of_thumb",
      "definition": "Clear, accurate 1-2 sentence explanation in plain English.",
      "whyItMatters": "1 sentence on why this term matters in the video and in the real world.",
      "realWorldExample": "1 concrete real-world example illustrating this term.",
      "contextInVideo": "How the speaker specifically used or discussed this in the video.",
      "formattedTime": "MM:SS if known, else empty string",
      "importance": "critical" | "high" | "recommended",
      "tag": "Short human-friendly badge (e.g. Core Concept, Abbreviation, Person / Organization, Mental Model)"
    }
  ]
}
Provide 4 to 6 takeaways and 8 to 14 terms.`;

      let parsed: { takeaways?: any[]; terms?: any[] } | null = null;
      for (const modelName of ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']) {
        try {
          const resp = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: { temperature: 0.2, maxOutputTokens: 2800 },
          });
          const rawText = (resp.text || '')
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();
          const jsonStart = rawText.indexOf('{');
          const jsonEnd = rawText.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            parsed = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
            if (parsed && (Array.isArray(parsed.terms) || Array.isArray(parsed.takeaways))) {
              break;
            }
          }
        } catch {
          // Try next model in fallback chain
        }
      }

      // Explicitly label research portal links (BUG-046)
      const buildSourcesForQuery = (qStr: string) => {
        const clean = encodeURIComponent(qStr.replace(/\(.*?\)/g, '').trim());
        return [
          { label: 'Wikipedia (Research Portal)', url: `https://en.wikipedia.org/wiki/Special:Search?search=${clean}` },
          { label: 'Wiktionary (Dictionary)', url: `https://en.wiktionary.org/wiki/Special:Search?search=${clean}` },
          { label: 'OpenAlex Research (Academic)', url: `https://openalex.org/works?search=${clean}` },
          { label: 'Google Scholar (Literature)', url: `https://scholar.google.com/scholar?q=${clean}` },
          { label: 'Wikidata Graph (Ontology)', url: `https://www.wikidata.org/w/index.php?search=${clean}` },
        ];
      };

      const cleanTerms = (parsed?.terms || [])
        .filter((t: any) => t && t.term && t.definition)
        .map((t: any) => ({
          term: String(t.term).trim(),
          fullForm: t.fullForm ? String(t.fullForm).trim() : undefined,
          category: ['acronym', 'core_concept', 'entity', 'rule_of_thumb'].includes(t.category)
            ? t.category
            : 'core_concept',
          definition: String(t.definition).trim(),
          whyItMatters: t.whyItMatters ? String(t.whyItMatters).trim() : undefined,
          realWorldExample: t.realWorldExample ? String(t.realWorldExample).trim() : undefined,
          contextInVideo: t.contextInVideo ? String(t.contextInVideo).trim() : undefined,
          formattedTime: t.formattedTime ? String(t.formattedTime).replace(/[\[\]]/g, '').trim() : undefined,
          importance: ['critical', 'high', 'recommended'].includes(t.importance) ? t.importance : 'high',
          tag: t.tag ? String(t.tag).trim() : 'Key Concept',
          sources: buildSourcesForQuery(t.fullForm || t.term),
        }));

      const cleanTakeaways = (parsed?.takeaways || [])
        .filter((tk: any) => tk && tk.principle && tk.description)
        .map((tk: any, idx: number) => ({
          id: `ai-takeaway-${idx + 1}`,
          principle: String(tk.principle).trim(),
          description: String(tk.description).trim(),
          quote: tk.quote ? String(tk.quote).trim() : undefined,
          actionableLesson: tk.actionableLesson ? String(tk.actionableLesson).trim() : '',
          formattedTime: tk.formattedTime ? String(tk.formattedTime).replace(/[\[\]]/g, '').trim() : undefined,
          category: ['mindset', 'decision_making', 'execution', 'craft'].includes(tk.category)
            ? tk.category
            : 'mindset',
          sources: buildSourcesForQuery(tk.principle),
        }));

      const payload = { terms: cleanTerms, takeaways: cleanTakeaways };
      if (cleanTerms.length > 0 || cleanTakeaways.length > 0) {
        keyIdeasCache.set(cacheKey, payload);
      }
      res.json({ ok: true, ...payload });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Key ideas extraction failed' });
    }
  });

  // 16. POST /api/translate - Multi-Engine Neural Translation API with complete batching (BUG-015, BUG-030)
  const translationCache = new BoundedCache<string, string>(120);
  app.post('/api/translate', async (req: Request, res: Response) => {
    try {
      const { text, targetLang = 'es' } = req.body;
      const rawText = String(text || '').trim();
      if (!rawText) {
        res.status(400).json({ error: 'Text is required for translation.' });
        return;
      }

      // Deterministic cryptographic hash (BUG-030)
      const cacheKey = sha256Digest({ targetLang, rawText });
      const cached = translationCache.get(cacheKey);
      if (cached) {
        res.json({
          ok: true,
          translatedText: cached,
          targetLang,
          provider: 'neural-cache',
          isTruncated: false,
          processedCharacters: rawText.length,
          originalCharacters: rawText.length,
        });
        return;
      }

      // 0. DeepL Neural Translation API (if DEEPL_API_KEY is configured)
      if (process.env.DEEPL_API_KEY) {
        try {
          const isFreeKey = process.env.DEEPL_API_KEY.endsWith(':fx');
          const deeplEndpoint = isFreeKey
            ? 'https://api-free.deepl.com/v2/translate'
            : 'https://api.deepl.com/v2/translate';
          const deeplLang = targetLang.toUpperCase().split('-')[0];
          const sliceLen = 25000;
          const dlRes = await fetch(deeplEndpoint, {
            method: 'POST',
            headers: {
              Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: [rawText.slice(0, sliceLen)],
              target_lang: deeplLang,
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (dlRes.ok) {
            const dlData = (await dlRes.json()) as any;
            const dlText = dlData.translations?.[0]?.text;
            if (dlText) {
              const isTruncated = rawText.length > sliceLen;
              translationCache.set(cacheKey, dlText);
              res.json({
                ok: true,
                translatedText: dlText,
                targetLang,
                provider: 'deepl-neural',
                isTruncated,
                processedCharacters: Math.min(rawText.length, sliceLen),
                originalCharacters: rawText.length,
              });
              return;
            }
          }
        } catch {}
      }

      // Split into paragraphs/chunks of <= 1600 chars so markdown structure is preserved
      const paragraphs = rawText.split(/\n\n+/);
      const batches: string[] = [];
      let currentBatch = '';

      for (const p of paragraphs) {
        if ((currentBatch + '\n\n' + p).length <= 1600) {
          currentBatch = currentBatch ? `${currentBatch}\n\n${p}` : p;
        } else {
          if (currentBatch) batches.push(currentBatch);
          currentBatch = p.slice(0, 1600);
        }
      }
      if (currentBatch) batches.push(currentBatch);

      // Process all batches up to reasonable safe budget (e.g. 45 batches / ~72k characters) - BUG-015
      const MAX_BATCHES = 45;
      const batchesToTranslate = batches.slice(0, MAX_BATCHES);
      const isTruncated = batches.length > MAX_BATCHES;

      const translatedBatches: string[] = [];
      for (const batch of batchesToTranslate) {
        const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
          targetLang
        )}&dt=t&q=${encodeURIComponent(batch)}`;
        const gRes = await fetch(gtxUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(6000),
        });
        if (gRes.ok) {
          const gData = (await gRes.json()) as any;
          const sentences = Array.isArray(gData?.[0])
            ? gData[0].map((seg: any) => seg?.[0] || '').join('')
            : batch;
          translatedBatches.push(sentences);
        } else {
          translatedBatches.push(batch);
        }
      }

      const finalTranslated = translatedBatches.join('\n\n');
      translationCache.set(cacheKey, finalTranslated);

      const processedChars = batchesToTranslate.reduce((acc, b) => acc + b.length, 0);
      res.json({
        ok: true,
        translatedText: finalTranslated,
        targetLang,
        provider: 'google-neural-gtx',
        isTruncated,
        processedCharacters: processedChars,
        originalCharacters: rawText.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Translation failed' });
    }
  });

  // 17. GET /api/status - Live Multi-Engine API Ecosystem Directory & Key Status (booleans only, never exposes secrets)
  app.get('/api/status', (_req: Request, res: Response) => {
    const configuredKeys = {
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
      GOOGLE_API_KEY: Boolean(GOOGLE_API_KEY),
      GOOGLE_CSE_ID: Boolean(GOOGLE_CSE_ID),
      TAVILY_API_KEY: Boolean(process.env.TAVILY_API_KEY),
      SERPER_API_KEY: Boolean(process.env.SERPER_API_KEY),
      BRAVE_API_KEY: Boolean(process.env.BRAVE_API_KEY),
      EXA_API_KEY: Boolean(process.env.EXA_API_KEY),
      NEWSAPI_KEY: Boolean(process.env.NEWSAPI_KEY),
      GNEWS_API_KEY: Boolean(process.env.GNEWS_API_KEY),
      GUARDIAN_API_KEY: Boolean(process.env.GUARDIAN_API_KEY),
      NYTIMES_API_KEY: Boolean(process.env.NYTIMES_API_KEY),
      UNSPLASH_ACCESS_KEY: Boolean(process.env.UNSPLASH_ACCESS_KEY),
      PEXELS_API_KEY: Boolean(process.env.PEXELS_API_KEY),
      PIXABAY_API_KEY: Boolean(process.env.PIXABAY_API_KEY),
      SEMANTIC_SCHOLAR_API_KEY: Boolean(process.env.SEMANTIC_SCHOLAR_API_KEY),
      CORE_API_KEY: Boolean(process.env.CORE_API_KEY),
      NCBI_API_KEY: Boolean(process.env.NCBI_API_KEY),
      GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN),
      HUGGINGFACE_API_KEY: Boolean(process.env.HUGGINGFACE_API_KEY),
      STACKEXCHANGE_KEY: Boolean(process.env.STACKEXCHANGE_KEY),
      LISTENNOTES_API_KEY: Boolean(process.env.LISTENNOTES_API_KEY),
      ELEVENLABS_API_KEY: Boolean(process.env.ELEVENLABS_API_KEY),
      DEEPL_API_KEY: Boolean(process.env.DEEPL_API_KEY),
    };

    res.json({
      ok: true,
      totalEngines: 55,
      configuredKeys,
      categories: {
        aiModels: ['Google Gemini', 'OpenRouter', 'OpenAI GPT-4o', 'Anthropic Claude 3.5', 'Groq LPU'],
        academic: ['OpenAlex', 'Semantic Scholar', 'arXiv', 'Crossref DOI', 'PubMed NCBI', 'Europe PMC', 'DOAJ', 'CORE.ac.uk', 'DBLP CS', 'HAL Open Science'],
        codeAndAi: ['GitHub REST API', 'HuggingFace Models', 'HuggingFace Datasets', 'HuggingFace Spaces', 'npm Registry', 'PyPI Python Index'],
        community: ['StackOverflow v2.3', 'CrossValidated SE', 'Reddit JSON API', 'DEV.to Articles', 'Hacker News Algolia', 'GitHub Discussions'],
        mediaAndData: ['YouTube Data API v3', 'Apple iTunes Podcasts', 'Listen Notes Podcasts', 'CERN Zenodo Datasets', 'Internet Archive', 'Library of Congress'],
        booksAndWeb: ['Google Books', 'OpenLibrary', 'Project Gutenberg (Gutendex)', 'Internet Archive Texts', 'Google Custom Search', 'Tavily AI Search', 'Serper.dev', 'Brave Search', 'Exa Neural Search', 'Wikipedia', 'Wikidata', 'DuckDuckGo', 'Free Dictionary', 'Datamuse'],
        newsAndVisuals: ['Google News', 'NewsAPI.org', 'GNews.io', 'The Guardian', 'New York Times', 'Unsplash', 'Pexels', 'Pixabay', 'Openverse CC', 'Wikimedia Commons'],
        speechAndTranslation: ['Microsoft Edge Neural TTS (WordBoundary)', 'Gemini 2.5 Flash TTS', 'ElevenLabs TTS', 'DeepL Neural Translate', 'Google Neural Translate GTX'],
      },
    });
  });

  // Setup Vite middlewares in development or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
