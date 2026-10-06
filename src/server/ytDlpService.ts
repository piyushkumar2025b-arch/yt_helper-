import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ParsedSegment } from '../utils/subtitleParser.ts';
import { parseSubtitlePayload } from './transcriptHelper.ts';

export interface YtDlpOptions {
  cookies?: string;
  timeoutMs?: number;
  subLangs?: string;
}

/**
 * Downloads subtitles for a given YouTube video using the standalone yt-dlp binary.
 * Supports auto-generated captions, multi-language subtitle tracks, and custom cookies.
 */
export async function fetchSubtitlesViaYtDlp(
  videoId: string,
  options?: YtDlpOptions
): Promise<ParsedSegment[] | null> {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return null;
  }

  // Determine yt-dlp binary path
  const localBinary = path.resolve(process.cwd(), 'bin', 'yt-dlp');
  let binaryPath = 'yt-dlp';
  try {
    await fs.access(localBinary);
    binaryPath = localBinary;
  } catch {
    binaryPath = 'yt-dlp';
  }
  try { await fs.chmod(localBinary, 0o755); } catch {}

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `ytdlp-${videoId}-`));
  const outPattern = path.join(tempDir, `${videoId}.%(ext)s`);

  let tempCookiePath: string | null = null;
  try {
    const rawCookies = (options?.cookies || process.env.YOUTUBE_COOKIES || '').trim();
    if (rawCookies) {
      tempCookiePath = path.join(tempDir, 'cookies.txt');
      await fs.writeFile(tempCookiePath, rawCookies, 'utf-8');
    } else {
      // Check if a root cookies.txt exists
      const rootCookie = path.resolve(process.cwd(), 'cookies.txt');
      try {
        await fs.access(rootCookie);
        tempCookiePath = rootCookie;
      } catch {
        // no cookies file
      }
    }

    const args: string[] = [
      '--skip-download',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      options?.subLangs || 'en.*,en,es.*,fr.*,de.*,ja.*,zh.*,all',
      '--sub-format',
      'vtt/srv3/ttml/srt/best',
      '--output',
      outPattern,
      '--no-playlist',
      '--no-check-certificates',
    ];

    // Enable node as JavaScript runtime for challenge solving if available
    const nodePath = process.execPath;
    if (nodePath) {
      args.unshift('--js-runtimes', `node:${nodePath}`);
    }

    if (tempCookiePath) {
      args.push('--cookies', tempCookiePath);
    }

    args.push(`https://www.youtube.com/watch?v=${videoId}`);

    const timeout = Math.min(Math.max(options?.timeoutMs || 15000, 5000), 30000);

    await new Promise<void>((resolve) => {
      execFile(
        binaryPath,
        args,
        {
          timeout,
          maxBuffer: 5 * 1024 * 1024,
        },
        (err, _stdout, stderr) => {
          if (err) console.warn('[yt-dlp]', videoId, err.message, String(stderr).slice(0, 500));
          resolve();
        }
      );
    });

    const downloadedFiles = await fs.readdir(tempDir);
    const subFiles = downloadedFiles.filter((f) =>
      /\.(vtt|srt|srv3|ttml|json3)$/i.test(f)
    );

    if (subFiles.length === 0) {
      return null;
    }

    // Sort to prioritize English standard, then English auto, then other languages
    const prioritizedFiles = subFiles.sort((a, b) => {
      const getScore = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('.en.') || lower.includes('.en-orig.')) return 10;
        if (lower.includes('.en-')) return 8;
        if (lower.includes('.vtt')) return 6;
        if (lower.includes('.srt')) return 4;
        return 1;
      };
      return getScore(b) - getScore(a);
    });

    for (const subFile of prioritizedFiles) {
      try {
        const filePath = path.join(tempDir, subFile);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseSubtitlePayload(content, false);
        if (parsed && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Try next file
      }
    }

    return null;
  } catch (err: any) {
    console.warn(`[yt-dlp] Extraction failed for video ${videoId}:`, err?.message || err);
    return null;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}
