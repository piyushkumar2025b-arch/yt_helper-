export interface ParsedSegment {
  start: number;
  duration: number;
  text: string;
  formattedTime: string;
}

const VALID_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Strictly extracts a valid 11-character YouTube video ID from a YouTube URL or direct video ID.
 * Supports watch?v=, youtu.be/, /embed/, /v/, /shorts/, /live/, and youtube-nocookie.com.
 * Rejects non-YouTube domains (e.g. example.com/?next=youtube.com/watch?v=...) and plain dictionary words.
 */
export function extractVideoId(urlOrId: string, allowBareId = true): string | null {
  if (typeof urlOrId !== 'string' || !urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  // If input contains spaces (e.g. mobile share text "Watch this video https://youtu.be/UF8uR6Z6KLc"), check each whitespace token
  if (/\s/.test(trimmed)) {
    const tokens = trimmed.split(/\s+/);
    for (const token of tokens) {
      if (token.includes('youtu') || token.includes('watch?v=')) {
        const cleanedToken = token.replace(/^[("'<>[\]]+|[)"'>.,;!?[\]]+$/g, '');
        const extracted = extractVideoId(cleanedToken, false);
        if (extracted) return extracted;
      }
    }
    return null;
  }

  // Check if input looks like a URL or domain path
  if (trimmed.includes('/') || trimmed.includes('.') || trimmed.includes('?')) {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      const host = parsed.hostname.toLowerCase();
      if (!VALID_YOUTUBE_HOSTS.has(host)) {
        return null;
      }

      if (host === 'youtu.be' || host === 'www.youtu.be') {
        const seg = parsed.pathname.split('/').filter(Boolean)[0] || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(seg) ? seg : null;
      }

      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }

      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (
        pathParts.length >= 2 &&
        ['embed', 'v', 'shorts', 'live', 'watch'].includes(pathParts[0]) &&
        /^[a-zA-Z0-9_-]{11}$/.test(pathParts[1])
      ) {
        return pathParts[1];
      }

      return null;
    } catch {
      return null;
    }
  }

  // Bare 11-character YouTube ID check: require standard 11-char base64url characters
  // and reject all-lowercase plain words unless explicitly a valid ID pattern
  if (allowBareId && /^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    if (/^[a-z]{11}$/.test(trimmed) || /^[a-z]{10}[0-9]$/.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  return null;
}

export function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, Number(seconds) || 0));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function unescapeHtml(str: string): string {
  return String(str || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function stripInlineSubtitleTags(line: string): string {
  return line
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, '')
    .replace(/<\/?c(?:\.[^>]*)?>/gi, '')
    .replace(/<\/?(?:b|i|u|font|ruby|rt|v)(?:\s[^>]*)?>/gi, '')
    .replace(/\{\\an\d+\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses WebVTT or SRT subtitle content without dropping numeric dialogue lines (e.g. "1999")
 * and strips inline VTT timestamp/class tags (<c>, <00:00:01.000>).
 */
export function parseVttOrSrt(content: string): ParsedSegment[] {
  const lines = content.split(/\r?\n/);
  const segments: ParsedSegment[] = [];
  let currentStart = 0;
  let currentDur = 2;
  let currentText = '';
  let insideCue = false;

  const timeRegex = /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/;

  const flushSegment = () => {
    const cleaned = stripInlineSubtitleTags(unescapeHtml(currentText));
    if (cleaned) {
      segments.push({
        start: Math.round(currentStart * 100) / 100,
        duration: Math.round(currentDur * 100) / 100,
        text: cleaned,
        formattedTime: formatTime(currentStart),
      });
    }
    currentText = '';
    insideCue = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (currentText.trim()) {
        flushSegment();
      }
      continue;
    }

    const match = line.match(timeRegex);
    if (match) {
      if (currentText.trim()) {
        flushSegment();
      }

      const startH = match[1] ? parseInt(match[1].replace(':', ''), 10) : 0;
      const startM = parseInt(match[2], 10);
      const startS = parseInt(match[3], 10);
      const startMs = parseInt(match[4], 10);
      currentStart = startH * 3600 + startM * 60 + startS + startMs / 1000;

      const endH = match[5] ? parseInt(match[5].replace(':', ''), 10) : 0;
      const endM = parseInt(match[6], 10);
      const endS = parseInt(match[7], 10);
      const endMs = parseInt(match[8], 10);
      const endSec = endH * 3600 + endM * 60 + endS + endMs / 1000;

      currentDur = Math.max(0.5, endSec - currentStart);
      insideCue = true;
      continue;
    }

    if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
      continue;
    }

    // Only skip a purely numeric line if it is an SRT sequence number immediately preceding a timestamp line
    if (/^\d+$/.test(line)) {
      const nextLine = (lines[i + 1] || '').trim();
      if (!insideCue || timeRegex.test(nextLine)) {
        continue;
      }
    }

    if (insideCue) {
      const cleanLine = stripInlineSubtitleTags(line);
      if (cleanLine) {
        currentText += (currentText ? ' ' : '') + cleanLine;
      }
    }
  }

  if (currentText.trim()) {
    flushSegment();
  }

  return segments;
}

export function isSafeHttpUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function parseClockToSeconds(clock: string): number | null {
  const clean = clock.trim().replace(/^[[(]+|[\])]+$/g, '');
  const m = clean.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const hrs = m[1] ? parseInt(m[1], 10) : 0;
  const mins = parseInt(m[2], 10);
  const secs = parseInt(m[3], 10);
  const ms = m[4] ? parseInt(m[4].padEnd(3, '0'), 10) : 0;
  return hrs * 3600 + mins * 60 + secs + ms / 1000;
}

/**
 * Parses YouTube JSON3 format (`{ events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }] }`),
 * standard segment arrays (`[{ start, duration, text }]` or `[{ offset, text }]`),
 * or wrapped objects (`{ segments: [...] }`, `{ transcript: [...] }`, `{ subtitles: [...] }`).
 */
export function parseJsonTranscript(rawJson: string): ParsedSegment[] {
  try {
    const trimmed = rawJson.trim();
    const jsonCandidate = trimmed.startsWith('```')
      ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      : trimmed;
    if (!jsonCandidate.startsWith('{') && !jsonCandidate.startsWith('[')) return [];

    const parsed = JSON.parse(jsonCandidate);

    // 1. YouTube JSON3 format
    if (parsed && Array.isArray(parsed.events)) {
      const segments: ParsedSegment[] = [];
      for (const ev of parsed.events) {
        if (!ev || !Array.isArray(ev.segs)) continue;
        const text = stripInlineSubtitleTags(
          unescapeHtml(ev.segs.map((s: any) => String(s?.utf8 || '')).join(''))
        );
        if (!text) continue;
        const startSec = (Number(ev.tStartMs) || 0) / 1000;
        const durSec = Math.max(0.5, (Number(ev.dDurationMs) || 2500) / 1000);
        segments.push({
          start: Math.round(startSec * 100) / 100,
          duration: Math.round(durSec * 100) / 100,
          text,
          formattedTime: formatTime(startSec),
        });
      }
      if (segments.length > 0) return segments;
    }

    // 2. Array of segment objects
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.segments)
      ? parsed.segments
      : Array.isArray(parsed?.transcript)
      ? parsed.transcript
      : Array.isArray(parsed?.subtitles)
      ? parsed.subtitles
      : Array.isArray(parsed?.data)
      ? parsed.data
      : null;

    if (Array.isArray(arr) && arr.length > 0) {
      const segments: ParsedSegment[] = [];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (!item || typeof item !== 'object') continue;
        const rawText = String(item.text ?? item.content ?? item.line ?? item.utf8 ?? '').trim();
        const text = stripInlineSubtitleTags(unescapeHtml(rawText));
        if (!text) continue;

        let startSec = 0;
        if (typeof item.start === 'number') startSec = item.start;
        else if (typeof item.start === 'string') startSec = parseClockToSeconds(item.start) ?? (parseFloat(item.start) || 0);
        else if (typeof item.offset === 'number') startSec = item.offset > 10000 ? item.offset / 1000 : item.offset;
        else if (typeof item.tStartMs === 'number') startSec = item.tStartMs / 1000;
        else if (typeof item.timestamp === 'string') startSec = parseClockToSeconds(item.timestamp) ?? i * 5;
        else startSec = i * 5;

        let durSec = Number(item.duration ?? item.dur ?? 0);
        if (durSec > 1000) durSec = durSec / 1000;
        if (!durSec || durSec <= 0) durSec = 3.5;

        segments.push({
          start: Math.round(startSec * 100) / 100,
          duration: Math.round(Math.max(0.5, durSec) * 100) / 100,
          text,
          formattedTime: formatTime(startSec),
        });
      }
      if (segments.length > 0) return segments;
    }
  } catch {
    // Not valid JSON
  }
  return [];
}

/**
 * Parses inline timestamped lines (e.g. `[01:23] Hello`, `(01:23) Hello`, `01:23 - Hello`)
 * AND YouTube's native "Show transcript" copy-paste format where timestamps sit on their own line:
 * 0:00
 * Spoken text here
 */
export function parseTimestampedLines(content: string): ParsedSegment[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const segments: ParsedSegment[] = [];
  const inlineRegex = /^(?:[-*•]\s*)?(?:\*\*|\()?\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]?(?:\*\*|\))?(?:\s*[-–—:]\s*|\s+)(.+)$/;
  const standaloneClockRegex = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Case A: Standalone clock line followed by text line(s) (YouTube native copy-paste)
    const clockMatch = line.match(standaloneClockRegex);
    if (clockMatch) {
      const startSec = parseClockToSeconds(clockMatch[1]);
      if (startSec !== null && i + 1 < lines.length && !standaloneClockRegex.test(lines[i + 1])) {
        const textChunks: string[] = [];
        while (i + 1 < lines.length && !standaloneClockRegex.test(lines[i + 1]) && !inlineRegex.test(lines[i + 1])) {
          i++;
          const cleaned = stripInlineSubtitleTags(unescapeHtml(lines[i]));
          if (cleaned) textChunks.push(cleaned);
        }
        const combined = textChunks.join(' ').trim();
        if (combined) {
          segments.push({
            start: Math.round(startSec * 100) / 100,
            duration: 4,
            text: combined,
            formattedTime: formatTime(startSec),
          });
        }
        continue;
      }
    }

    // Case B: Inline `[MM:SS] Text` or `MM:SS - Text`
    const inlineMatch = line.match(inlineRegex);
    if (inlineMatch) {
      const startSec = parseClockToSeconds(inlineMatch[1]);
      const cleaned = stripInlineSubtitleTags(unescapeHtml(inlineMatch[2].replace(/^\*\*|\*\*$/g, '').trim()));
      if (startSec !== null && cleaned) {
        segments.push({
          start: Math.round(startSec * 100) / 100,
          duration: 4,
          text: cleaned,
          formattedTime: formatTime(startSec),
        });
      }
    }
  }

  // Compute accurate durations from adjacent start times
  for (let i = 0; i < segments.length - 1; i++) {
    const gap = segments[i + 1].start - segments[i].start;
    if (gap > 0.5 && gap < 60) {
      segments[i].duration = Math.round(gap * 100) / 100;
    }
  }

  return segments;
}

/**
 * Converts plain un-timestamped paragraphs or sentences into natural timed segments
 * so TranscriptViewer, search, TTS, and AI tools work seamlessly on any pasted text.
 */
export function segmentPlainText(rawText: string): ParsedSegment[] {
  const cleaned = stripInlineSubtitleTags(unescapeHtml(rawText));
  if (!cleaned) return [];

  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return [];

  const segments: ParsedSegment[] = [];
  let currentStart = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    const estDuration = Math.max(2, Math.min(18, Math.round((wordCount / 2.6) * 10) / 10));
    segments.push({
      start: Math.round(currentStart * 100) / 100,
      duration: estDuration,
      text: sentence,
      formattedTime: formatTime(currentStart),
    });
    currentStart += estDuration;
  }

  return segments;
}

/**
 * Universal client/server parser for SRT, WebVTT, JSON3, JSON arrays,
 * YouTube copy-pasted timestamps, `[MM:SS]` lines, or plain text.
 */
export function parseAnyTranscriptFormat(content: string, allowPlainTextFallback = true): ParsedSegment[] {
  if (!content || !content.trim()) return [];
  const trimmed = content.trim();

  // 1. WebVTT or SRT
  if (trimmed.includes('WEBVTT') || trimmed.includes('-->')) {
    const vtt = parseVttOrSrt(trimmed);
    if (vtt.length > 0) return vtt;
  }

  // 2. JSON3 or JSON array/object
  const jsonSegs = parseJsonTranscript(trimmed);
  if (jsonSegs.length > 0) return jsonSegs;

  // 3. Inline `[MM:SS] text` or YouTube alternating timestamp copy-paste
  const tsSegs = parseTimestampedLines(trimmed);
  if (tsSegs.length > 0) return tsSegs;

  // 4. Plain text fallback (for manual paste / .txt uploads)
  if (allowPlainTextFallback) {
    return segmentPlainText(trimmed);
  }

  return [];
}

