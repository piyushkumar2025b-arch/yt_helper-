import { XMLParser } from 'fast-xml-parser';
import { GoogleGenAI } from '@google/genai';
import { YoutubeTranscript } from 'youtube-transcript';
import { fetchSubtitlesViaYtDlp } from './ytDlpService.ts';
import {
  ParsedSegment,
  extractVideoId,
  formatTime,
  parseVttOrSrt,
  parseJsonTranscript,
  parseTimestampedLines,
  segmentPlainText,
  unescapeHtml,
} from '../utils/subtitleParser.ts';

export {
  type ParsedSegment,
  extractVideoId,
  formatTime,
  parseVttOrSrt,
  parseJsonTranscript,
  parseTimestampedLines,
  segmentPlainText,
  unescapeHtml,
};

export interface VideoTranscriptContext {
  title?: string;
  authorName?: string;
  description?: string;
  youtubeApiKey?: string;
  cookies?: string;
}

/**
 * Extracts structured timestamped chapters from video descriptions if present.
 */
export function extractChaptersFromDescription(description: string): ParsedSegment[] | null {
  if (!description || typeof description !== 'string') return null;
  const lines = description.split('\n');
  const segments: ParsedSegment[] = [];

  const chapterRegex = /^(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))?\s*[-–—:]?\s*(.+)$/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(chapterRegex);
    if (match) {
      const timeStr = match[1];
      const title = match[2].trim();
      const seconds = parseTtmlTimeToSeconds(timeStr);
      if (title.length > 1) {
        segments.push({
          start: seconds,
          duration: 30,
          text: title,
          formattedTime: formatTime(seconds),
        });
      }
    }
  }

  if (segments.length >= 3) {
    segments.sort((a, b) => a.start - b.start);
    for (let i = 0; i < segments.length; i++) {
      if (i < segments.length - 1) {
        segments[i].duration = Math.max(5, segments[i + 1].start - segments[i].start);
      } else {
        segments[i].duration = 60;
      }
    }
    return segments;
  }
  return null;
}

const transcriptCache = new Map<string, ParsedSegment[]>();

function cacheTranscript(videoId: string, segments: ParsedSegment[]) {
  if (!videoId || segments.length === 0) return;
  if (transcriptCache.size >= 200 && !transcriptCache.has(videoId)) {
    const oldest = transcriptCache.keys().next().value;
    if (oldest) transcriptCache.delete(oldest);
  }
  transcriptCache.set(videoId, segments);
}

export function parseTtmlTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const s = String(timeStr).trim();
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length === 3) {
      return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
    } else if (parts.length === 2) {
      return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
    }
  }
  if (s.endsWith('ms')) {
    return (parseFloat(s.slice(0, -2)) || 0) / 1000;
  }
  return parseFloat(s.replace(/s$/i, '')) || 0;
}

export function isSafePublicHttpsUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '::1' ||
      host === '[::1]' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^0\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isBlockedOrErrorPayload(text: string): boolean {
  const lower = text.slice(0, 600).toLowerCase();
  return (
    lower.includes('youtube is currently blocking') ||
    lower.includes('signinconfirmnotbotexception') ||
    lower.includes('missing app check token') ||
    lower.includes('piped has shutdown') ||
    lower.includes('just a moment...') ||
    (lower.includes('<!doctype html') && !lower.includes('<transcript') && !lower.includes('<tt'))
  );
}

function extractTtmlNodeText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTtmlNodeText).filter(Boolean).join(' ');
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const chunks: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('@_')) continue;
      if (k === 'br') {
        chunks.push(' ');
        continue;
      }
      const part = extractTtmlNodeText(v);
      if (part) chunks.push(part);
    }
    return chunks.join(' ');
  }
  return '';
}

export function parseSubtitlePayload(subText: string, allowPlainTextFallback = false): ParsedSegment[] | null {
  if (!subText || !subText.trim()) return null;
  if (isBlockedOrErrorPayload(subText)) return null;

  const trimmed = subText.trim();

  // 1. Parse TTML / XML timedtext (<tt> or <transcript><text>)
  if (trimmed.includes('<?xml') || trimmed.includes('<tt') || trimmed.includes('<transcript')) {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: false,
      });
      const parsed = parser.parse(trimmed);
      const cueNodes: Array<Record<string, unknown>> = [];

      function traverse(node: unknown) {
        if (!node) return;
        if (Array.isArray(node)) {
          for (const item of node) traverse(item);
        } else if (typeof node === 'object') {
          const obj = node as Record<string, unknown>;
          for (const tag of ['p', 'text']) {
            if (obj[tag]) {
              if (Array.isArray(obj[tag])) {
                cueNodes.push(...(obj[tag] as Array<Record<string, unknown>>));
              } else if (typeof obj[tag] === 'object') {
                cueNodes.push(obj[tag] as Record<string, unknown>);
              }
            }
          }
          for (const key of Object.keys(obj)) {
            if (key !== 'p' && key !== 'text') traverse(obj[key]);
          }
        }
      }

      traverse(parsed);

      if (cueNodes.length > 0) {
        const segments: ParsedSegment[] = [];
        for (const p of cueNodes) {
          const rawText = extractTtmlNodeText(p);
          const cleanText = unescapeHtml(rawText)
            .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, '')
            .replace(/<\/?c(?:\.[^>]*)?>/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (!cleanText || isBlockedOrErrorPayload(cleanText)) continue;

          const beginAttr = String(p['@_begin'] ?? p['@_start'] ?? p['@_t'] ?? '0');
          const endAttr = String(p['@_end'] ?? '0');
          const durAttr = String(p['@_dur'] ?? p['@_d'] ?? '2');

          const isMs = p['@_t'] !== undefined || p['@_d'] !== undefined;
          const startSec = isMs ? (parseFloat(beginAttr) || 0) / 1000 : parseTtmlTimeToSeconds(beginAttr);
          const endSec = parseTtmlTimeToSeconds(endAttr);
          const dur =
            endSec > startSec
              ? endSec - startSec
              : isMs
              ? (parseFloat(durAttr) || 2000) / 1000
              : parseTtmlTimeToSeconds(durAttr) || 2;

          segments.push({
            start: Math.round(startSec * 100) / 100,
            duration: Math.round(Math.max(0.5, dur) * 100) / 100,
            text: cleanText,
            formattedTime: formatTime(startSec),
          });
        }

        if (segments.length > 0) {
          return segments;
        }
      }
    } catch {
      // Continue to other parsers
    }
  }

  // 2. Parse WebVTT or SRT
  if (trimmed.includes('WEBVTT') || trimmed.includes('-->')) {
    const parsed = parseVttOrSrt(trimmed);
    if (parsed.length > 0) return parsed;
  }

  // 3. Parse JSON3 or JSON array/object
  const jsonParsed = parseJsonTranscript(trimmed);
  if (jsonParsed.length > 0) return jsonParsed;

  // 4. Parse [MM:SS] or alternating YouTube timestamp lines
  const tsParsed = parseTimestampedLines(trimmed);
  if (tsParsed.length > 0) return tsParsed;

  // 5. Optional plain text segmentation
  if (allowPlainTextFallback) {
    const plainParsed = segmentPlainText(trimmed);
    if (plainParsed.length > 0) return plainParsed;
  }

  return null;
}

function extractBalancedJsonArray(source: string, marker: string): string | null {
  const idx = source.indexOf(marker);
  if (idx === -1) return null;
  const startBracket = source.indexOf('[', idx + marker.length);
  if (startBracket === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startBracket; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          return source.slice(startBracket, i + 1);
        }
      }
    }
  }
  return null;
}

async function fetchCaptionTrackUrl(baseUrl: string): Promise<ParsedSegment[] | null> {
  if (!baseUrl || !isSafePublicHttpsUrl(baseUrl)) return null;

  const urlVariants = [
    baseUrl,
    baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}&fmt=json3`,
    baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}&fmt=vtt`,
  ];

  for (const targetUrl of urlVariants) {
    try {
      const subRes = await fetch(targetUrl, {
        signal: AbortSignal.timeout(4000),
        redirect: 'error',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!subRes.ok) continue;
      const subText = await subRes.text();
      const parsed = parseSubtitlePayload(subText);
      if (parsed && parsed.length > 0) return parsed;
    } catch {
      // Try next variant
    }
  }
  return null;
}

// Method 1: Direct YouTube Watch Page captionTracks extraction (with balanced JSON array parser)
async function fetchDirectYouTubeCaptions(videoId: string): Promise<ParsedSegment[] | null> {
  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=YES+cb.20210328-17-p0.en+FX+417',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!watchRes.ok) return null;
    const html = await watchRes.text();
    const rawArray = extractBalancedJsonArray(html, '"captionTracks":');
    if (!rawArray) return null;

    const tracks = JSON.parse(rawArray) as Array<{ baseUrl?: string; languageCode?: string; kind?: string }>;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    const sortedTracks = [...tracks].sort((a, b) => {
      const aEn = a.languageCode === 'en' ? 2 : a.languageCode?.startsWith('en') ? 1 : 0;
      const bEn = b.languageCode === 'en' ? 2 : b.languageCode?.startsWith('en') ? 1 : 0;
      if (aEn !== bEn) return bEn - aEn;
      const aManual = a.kind !== 'asr' ? 1 : 0;
      const bManual = b.kind !== 'asr' ? 1 : 0;
      return bManual - aManual;
    });

    for (const track of sortedTracks.slice(0, 3)) {
      if (!track?.baseUrl) continue;
      const segments = await fetchCaptionTrackUrl(track.baseUrl);
      if (segments && segments.length > 0) return segments;
    }
    return null;
  } catch {
    return null;
  }
}

// Method 2: YouTube Innertube Player API across multiple client contexts
async function fetchInnertubeCaptions(videoId: string): Promise<ParsedSegment[] | null> {
  const clients = [
    {
      clientName: 'WEB',
      clientVersion: '2.20250101.00.00',
      hl: 'en',
      gl: 'US',
    },
    {
      clientName: 'ANDROID_VR',
      clientVersion: '1.60.19',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      osName: 'Android',
      osVersion: '12L',
      androidSdkVersion: 32,
      hl: 'en',
      gl: 'US',
    },
    {
      clientName: 'IOS',
      clientVersion: '19.45.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.1.0.22B83',
      hl: 'en',
      gl: 'US',
    },
  ];

  for (const client of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        body: JSON.stringify({
          context: { client },
          videoId,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as any;
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) continue;

      const preferred =
        tracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr') ||
        tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
        tracks[0];

      if (preferred?.baseUrl) {
        const segments = await fetchCaptionTrackUrl(preferred.baseUrl);
        if (segments && segments.length > 0) return segments;
      }
    } catch {
      // Try next client
    }
  }
  return null;
}

const PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.lunar.icu',
  'https://pipedapi.ducks.party',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.jing.rocks',
  'https://invidious.privacyredirect.com',
];

// Method 3A: Piped API instance fetcher
async function fetchFromSinglePipedInstance(instance: string, videoId: string): Promise<ParsedSegment[]> {
  const res = await fetch(`${instance}/streams/${encodeURIComponent(videoId)}`, {
    signal: AbortSignal.timeout(4500),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Status ${res.status}`);

  const data = (await res.json()) as { subtitles?: Array<{ code?: string; lang?: string; url?: string }> };
  if (!data.subtitles || !Array.isArray(data.subtitles) || data.subtitles.length === 0) {
    throw new Error('No subtitles');
  }

  const candidates = [
    ...data.subtitles.filter((s) => s.code?.startsWith('en') || s.lang?.toLowerCase().startsWith('en')),
    ...data.subtitles,
  ].slice(0, 3);

  for (const subTrack of candidates) {
    if (!subTrack?.url || !isSafePublicHttpsUrl(subTrack.url)) continue;
    const subRes = await fetch(subTrack.url, {
      signal: AbortSignal.timeout(4000),
      redirect: 'error',
    });
    if (!subRes.ok) continue;
    const subText = await subRes.text();
    const segments = parseSubtitlePayload(subText);
    if (segments && segments.length > 0) {
      return segments;
    }
  }
  throw new Error('Empty parsed segments');
}

// Method 3B: Invidious API instance fetcher
async function fetchFromSingleInvidiousInstance(instance: string, videoId: string): Promise<ParsedSegment[]> {
  const res = await fetch(`${instance}/api/v1/captions/${encodeURIComponent(videoId)}`, {
    signal: AbortSignal.timeout(4500),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Status ${res.status}`);

  const data = (await res.json()) as { captions?: Array<{ label?: string; languageCode?: string; url?: string }> };
  if (!data.captions || !Array.isArray(data.captions) || data.captions.length === 0) {
    throw new Error('No Invidious captions');
  }

  const sorted = [...data.captions].sort((a, b) => {
    const aManualEn = a.languageCode === 'en' && !a.label?.toLowerCase().includes('auto') ? 3 : 0;
    const bManualEn = b.languageCode === 'en' && !b.label?.toLowerCase().includes('auto') ? 3 : 0;
    if (aManualEn !== bManualEn) return bManualEn - aManualEn;
    const aEn = a.languageCode?.startsWith('en') ? 2 : 0;
    const bEn = b.languageCode?.startsWith('en') ? 2 : 0;
    return bEn - aEn;
  });

  for (const track of sorted.slice(0, 3)) {
    if (!track?.url) continue;
    const fullUrl = track.url.startsWith('http') ? track.url : `${instance}${track.url}`;
    if (!isSafePublicHttpsUrl(fullUrl)) continue;
    const subRes = await fetch(fullUrl, {
      signal: AbortSignal.timeout(4000),
      redirect: 'error',
    });
    if (!subRes.ok) continue;
    const subText = await subRes.text();
    const segments = parseSubtitlePayload(subText);
    if (segments && segments.length > 0) {
      return segments;
    }
  }
  throw new Error('Empty Invidious segments');
}

// Helper to fetch using the youtube-transcript npm package (fastest, Android InnerTube client)
async function fetchViaYoutubeTranscriptPackage(videoId: string): Promise<ParsedSegment[] | null> {
  try {
    const rawList = await Promise.race([
      YoutubeTranscript.fetchTranscript(videoId),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
    ]);
    if (Array.isArray(rawList) && rawList.length > 0) {
      const mapped: ParsedSegment[] = rawList.map((item: any) => {
        const startSec = (item.offset || 0) / 1000;
        const durSec = Math.max(0.5, (item.duration || 1000) / 1000);
        return {
          start: Math.round(startSec * 100) / 100,
          duration: Math.round(durSec * 100) / 100,
          text: String(item.text || '').replace(/\s+/g, ' ').trim(),
          formattedTime: formatTime(startSec),
        };
      }).filter((s) => s.text.length > 0);
      if (mapped.length > 0) return mapped;
    }
  } catch {
    // Continue to next method
  }
  return null;
}

// Method 4: Gemini Multimodal Native YouTube Video Transcription (Google server-to-YouTube integration)
async function fetchGeminiYoutubeTranscript(
  videoId: string,
  context?: VideoTranscriptContext
): Promise<ParsedSegment[] | null> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

  // Pass 1: Direct YouTube video URI via fileData with strict timeout
  for (const modelName of modelsToTry) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: [
            {
              fileData: {
                fileUri: youtubeUrl,
                mimeType: 'video/mp4',
              },
            },
            `Extract a detailed chronological transcript of this YouTube video${
              context?.title ? ` ("${context.title}")` : ''
            }.
Format EVERY line strictly with its timestamp in [MM:SS] format followed by the spoken words, like this:
[00:00] First spoken sentence or phrase here.
[00:06] Next spoken sentence or phrase here.
Do not include any intro or outro commentary—output ONLY the [MM:SS] transcript lines covering the video from start to finish.`,
          ],
          config: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini fileData timeout')), 14000)
        ),
      ]);

      const rawText = response.text || '';
      const parsed = parseSubtitlePayload(rawText, true);
      if (parsed && parsed.length >= 3) {
        return parsed;
      }
    } catch {
      // Try next model in fallback chain
    }
  }

  // Pass 2: Search-grounded transcript recovery if video has restricted embed/fileData access
  if (context?.title) {
    const searchModels = ['gemini-3.8-flash', 'gemini-flash-latest'];
    for (const modelName of searchModels) {
      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: `Find the spoken transcript or detailed chronological speech breakdown for the YouTube video titled "${context.title}"${
              context.authorName ? ` by ${context.authorName}` : ''
            } (${youtubeUrl}).
${context.description ? `Video Description / Notes:\n${context.description.slice(0, 2500)}\n` : ''}
Format EVERY line strictly as:
[MM:SS] Spoken transcript content or verbatim point from the video.
Output at least 25 chronological [MM:SS] lines covering the full video from beginning to end. Output ONLY the [MM:SS] lines.`,
            config: {
              tools: [{ googleSearch: {} }],
              temperature: 0.2,
              maxOutputTokens: 4096,
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini search grounding timeout')), 12000)
          ),
        ]);

        const rawText = response.text || '';
        const parsed = parseSubtitlePayload(rawText, false);
        if (parsed && parsed.length >= 5) {
          return parsed;
        }
      } catch {
        // Try next model
      }
    }
  }

  return null;
}

/**
 * Multi-method transcript extraction pipeline:
 * 1. In-memory cache & curated sample transcripts
 * 2. youtube-transcript npm package (fastest, InnerTube Android API)
 * 3. yt-dlp binary with auto-subs & multi-language extraction (uses standalone binary)
 * 4. Direct YouTube watch page captionTracks + Innertube Player API + Piped/Invidious mirrors (raced in parallel)
 * 5. Structured chapters/outline extracted from video description
 * 6. Gemini native multimodal YouTube video transcription (`fileData` -> `googleSearch` grounding)
 */
export async function fetchPipedTranscript(
  videoId: string,
  context?: VideoTranscriptContext
): Promise<ParsedSegment[] | null> {
  if (!videoId) return null;

  const cached = transcriptCache.get(videoId);
  if (cached && cached.length > 0) {
    return cached;
  }

  if (SAMPLE_FALLBACK_TRANSCRIPTS[videoId]?.length) {
    return SAMPLE_FALLBACK_TRANSCRIPTS[videoId];
  }

  // 1. Try youtube-transcript npm package (fastest, uses InnerTube Android API)
  const ytPackageSegs = await fetchViaYoutubeTranscriptPackage(videoId);
  if (ytPackageSegs && ytPackageSegs.length > 0) {
    cacheTranscript(videoId, ytPackageSegs);
    return ytPackageSegs;
  }

  // 2. Try yt-dlp binary (handles auto-subs, multi-language, cookies if provided)
  const ytDlpSegs = await fetchSubtitlesViaYtDlp(videoId, {
    cookies: context?.cookies,
    timeoutMs: 12000,
  });
  if (ytDlpSegs && ytDlpSegs.length > 0) {
    cacheTranscript(videoId, ytDlpSegs);
    return ytDlpSegs;
  }

  // 3. Race fast caption track extractors in parallel (direct watch page, innertube, mirrors)
  try {
    const fastTasks: Array<Promise<ParsedSegment[]>> = [
      fetchDirectYouTubeCaptions(videoId).then((r) => {
        if (!r || r.length === 0) throw new Error('No direct captions');
        return r;
      }),
      fetchInnertubeCaptions(videoId).then((r) => {
        if (!r || r.length === 0) throw new Error('No innertube captions');
        return r;
      }),
      ...PIPED_INSTANCES.map((inst) => fetchFromSinglePipedInstance(inst, videoId)),
      ...INVIDIOUS_INSTANCES.map((inst) => fetchFromSingleInvidiousInstance(inst, videoId)),
    ];

    const fastSegments = await Promise.any(fastTasks);
    if (fastSegments && fastSegments.length > 0) {
      cacheTranscript(videoId, fastSegments);
      return fastSegments;
    }
  } catch {
    // Proceed to next fallback
  }

  // 4. Check video description for structured chapters / timestamped outline
  if (context?.description) {
    const chapterSegments = extractChaptersFromDescription(context.description);
    if (chapterSegments && chapterSegments.length >= 3) {
      cacheTranscript(videoId, chapterSegments);
      return chapterSegments;
    }
  }

  // 5. Native Google Gemini Multimodal / Search Grounding YouTube Transcription
  const geminiSegments = await fetchGeminiYoutubeTranscript(videoId, context);
  if (geminiSegments && geminiSegments.length > 0) {
    cacheTranscript(videoId, geminiSegments);
    return geminiSegments;
  }

  return null;
}

export const SAMPLE_FALLBACK_TRANSCRIPTS: Record<string, ParsedSegment[]> = {};
