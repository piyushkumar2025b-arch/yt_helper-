import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { VideoMetadata, ParsedSegment, WebSearchResult, ImageSearchResult, NewsSearchResult, YouTubeCommentItem, ThemeId } from '../types';
import { APP_THEMES } from '../constants';

interface ScrapedDataViewerProps {
  videoId: string;
  videoUrl: string;
  metadata: VideoMetadata | null;
  segments: ParsedSegment[];
  webResults?: WebSearchResult[];
  imageResults?: ImageSearchResult[];
  newsResults?: NewsSearchResult[];
  currentTheme?: ThemeId;
}

export const ScrapedDataViewer: React.FC<ScrapedDataViewerProps> = ({
  videoId,
  videoUrl,
  metadata,
  segments,
  webResults = [],
  imageResults = [],
  newsResults = [],
  currentTheme = 'midnight',
}) => {
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const [activeFormat, setActiveFormat] = useState<'overview' | 'json' | 'vtt' | 'srt' | 'text'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [ytStats, setYtStats] = useState<any>(null);
  const [ytTags, setYtTags] = useState<string[]>([]);
  const [ytComments, setYtComments] = useState<YouTubeCommentItem[]>([]);

  useEffect(() => {
    if (!videoId) return;
    fetch(`/api/youtube-details?videoId=${encodeURIComponent(videoId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setYtStats(data.statistics || null);
          setYtTags(data.tags || []);
          setYtComments(data.comments || []);
        }
      })
      .catch(() => {});
  }, [videoId]);

  const plainText = useMemo(() => {
    return segments.map((s) => s.text).join(' ');
  }, [segments]);

  const vttText = useMemo(() => {
    const pad = (n: number, z = 2) => ('00' + n).slice(-z);
    const formatVttTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
    };

    let out = 'WEBVTT\n\n';
    segments.forEach((seg, idx) => {
      const start = formatVttTime(seg.start);
      const end = formatVttTime(seg.start + seg.duration);
      out += `${idx + 1}\n${start} --> ${end}\n${seg.text}\n\n`;
    });
    return out;
  }, [segments]);

  const srtText = useMemo(() => {
    const pad = (n: number, z = 2) => ('00' + n).slice(-z);
    const formatSrtTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
    };

    let out = '';
    segments.forEach((seg, idx) => {
      const start = formatSrtTime(seg.start);
      const end = formatSrtTime(seg.start + seg.duration);
      out += `${idx + 1}\r\n${start} --> ${end}\r\n${seg.text}\r\n\r\n`;
    });
    return out;
  }, [segments]);

  const masterJson = useMemo(() => {
    return {
      scrapedAt: new Date().toISOString(),
      videoTarget: {
        id: videoId,
        url: videoUrl || `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        metadata: metadata || null,
        youtubeStatistics: ytStats,
        tags: ytTags,
      },
      captionsSummary: {
        totalSegments: segments.length,
        totalWords: plainText.split(/\s+/).filter(Boolean).length,
        durationSeconds:
          segments.length > 0 ? segments[segments.length - 1].start + segments[segments.length - 1].duration : 0,
        formattedTotalDuration: segments.length > 0 ? segments[segments.length - 1].formattedTime : '00:00',
      },
      transcriptSegments: segments,
      audienceComments: ytComments,
      supplementaryScrape: {
        webSearchCount: webResults.length,
        webResults,
        newsMediaCount: newsResults.length,
        newsResults,
        imagesCount: imageResults.length,
        imageResults,
      },
    };
  }, [videoId, videoUrl, metadata, ytStats, ytTags, ytComments, segments, plainText, webResults, newsResults, imageResults]);

  const jsonString = useMemo(() => {
    return JSON.stringify(masterJson, null, 2);
  }, [masterJson]);

  const handleCopy = (key: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownload = (filename: string, text: string, mimeType: string) => {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const durationLabel = segments.length > 0 ? segments[segments.length - 1].formattedTime : '00:00';

  return (
    <div className="w-full space-y-6">
      {/* Unboxed Header & Export Bar */}
      <div className={`pb-3 border-b ${themeConfig.borderLight} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
              Downloads, Subtitles &amp; Video Details
            </h2>
            <div className={`flex items-center gap-2 text-[11px] ${themeConfig.textMuted} tabular-nums flex-wrap`}>
              <span>{segments.length.toLocaleString()} caption lines</span>
              <span aria-hidden="true">·</span>
              <span>{wordCount.toLocaleString()} words</span>
              <span aria-hidden="true">·</span>
              <span>{durationLabel} length</span>
              <span aria-hidden="true">·</span>
              <span>{((jsonString.length) / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleCopy('master-json', jsonString)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap`}
            >
              {copiedKey === 'master-json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'master-json' ? 'Copied' : 'Copy Data'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload(`video-data-${videoId}.json`, jsonString, 'application/json')}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
            >
              <Download className="w-3 h-3" />
              <span>Save .json</span>
            </button>
          </div>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: 'overview', label: 'Video Overview' },
              { id: 'json', label: 'JSON Data' },
              { id: 'vtt', label: 'WebVTT (.vtt)' },
              { id: 'srt', label: 'Subtitles (.srt)' },
              { id: 'text', label: 'Plain Text (.txt)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFormat(tab.id as any)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  activeFormat === tab.id
                    ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                    : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {activeFormat === 'vtt' && (
              <button
                type="button"
                onClick={() => handleDownload(`subtitles-${videoId}.vtt`, vttText, 'text/vtt')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 cursor-pointer transition-colors inline-flex items-center gap-1`}
              >
                <Download className="w-3 h-3" />
                <span>Save .vtt</span>
              </button>
            )}
            {activeFormat === 'srt' && (
              <button
                type="button"
                onClick={() => handleDownload(`subtitles-${videoId}.srt`, srtText, 'application/x-subrip')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 cursor-pointer transition-colors inline-flex items-center gap-1`}
              >
                <Download className="w-3 h-3" />
                <span>Save .srt</span>
              </button>
            )}
            {activeFormat === 'text' && (
              <button
                type="button"
                onClick={() => handleDownload(`transcript-${videoId}.txt`, plainText, 'text/plain')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 cursor-pointer transition-colors inline-flex items-center gap-1`}
              >
                <Download className="w-3 h-3" />
                <span>Save .txt</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. Format: STRUCTURED OVERVIEW (Unboxed) */}
      {activeFormat === 'overview' && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
              Video Details
            </h3>
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-3 border-y ${themeConfig.borderLight} text-xs`}>
              <div className="space-y-0.5">
                <span className={themeConfig.textMuted}>Video Title</span>
                <p className={`font-semibold ${themeConfig.textPrimary}`}>{metadata?.title || 'Unknown Video'}</p>
              </div>

              <div className="space-y-0.5">
                <span className={themeConfig.textMuted}>Channel</span>
                <p className={`font-semibold ${themeConfig.textPrimary}`}>
                  {metadata?.authorName ? (
                    <a
                      href={metadata.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{metadata.authorName}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    'YouTube Channel'
                  )}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className={themeConfig.textMuted}>Video ID</span>
                <p className="font-mono tabular-nums text-slate-300">{videoId}</p>
              </div>

              <div className="space-y-0.5">
                <span className={themeConfig.textMuted}>YouTube Link</span>
                <p className="font-mono truncate">
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-400">
                    {videoUrl}
                  </a>
                </p>
              </div>

              {ytStats && (
                <>
                  <div className="space-y-0.5">
                    <span className={themeConfig.textMuted}>Views</span>
                    <p className={`font-semibold tabular-nums ${themeConfig.textPrimary}`}>
                      {Number(ytStats.viewCount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className={themeConfig.textMuted}>Likes</span>
                    <p className={`font-semibold tabular-nums ${themeConfig.textPrimary}`}>
                      {Number(ytStats.likeCount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className={themeConfig.textMuted}>Comments</span>
                    <p className={`font-semibold tabular-nums ${themeConfig.textPrimary}`}>
                      {Number(ytStats.commentCount || 0).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {ytComments.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                  Viewer Comments ({ytComments.length})
                </h3>
              </div>
              <div className={`divide-y ${themeConfig.borderLight}`}>
                {ytComments.slice(0, 10).map((c) => (
                  <div key={c.id} className="py-2.5 space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-indigo-400">{c.author}</span>
                      <span aria-hidden="true" className={themeConfig.textMuted}>·</span>
                      <span className={`${themeConfig.textMuted} tabular-nums`}>{c.likeCount} likes</span>
                    </div>
                    <p className={`leading-relaxed ${themeConfig.textSecondary}`}>{c.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Caption Preview (First 15 of {segments.length} lines)
              </h3>
              <button
                type="button"
                onClick={() => setActiveFormat('json')}
                className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
              >
                View full JSON →
              </button>
            </div>

            <div className={`divide-y ${themeConfig.borderLight}`}>
              {segments.slice(0, 15).map((seg, idx) => (
                <div
                  key={idx}
                  className="py-3 flex items-baseline gap-4 text-xs sm:text-sm"
                >
                  <span className="font-mono text-xs text-teal-400 shrink-0 tabular-nums w-14">
                    {seg.formattedTime}
                  </span>
                  <span className="font-mono text-xs text-slate-500 shrink-0 tabular-nums w-28 hidden sm:inline">
                    {seg.start.toFixed(2)}s – {(seg.start + seg.duration).toFixed(2)}s
                  </span>
                  <p className={`flex-1 leading-relaxed ${themeConfig.textPrimary}`}>{seg.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 2. Format: RAW JSON */}
      {activeFormat === 'json' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-teal-400" />
              <span className={`text-xs font-mono ${themeConfig.textMuted}`}>master_scrape_output.json</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('json-raw', jsonString)}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'json-raw' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'json-raw' ? 'Copied' : 'Copy Full Raw JSON'}</span>
            </button>
          </div>

          <pre className="p-5 rounded-xl bg-slate-950/60 font-mono text-xs leading-relaxed overflow-x-auto text-teal-300 selection:bg-teal-500/30">
            {jsonString}
          </pre>
        </div>
      )}

      {/* 3. Format: WEBVTT */}
      {activeFormat === 'vtt' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono ${themeConfig.textMuted}`}>subtitles.vtt</span>
            <button
              type="button"
              onClick={() => handleCopy('vtt-raw', vttText)}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'vtt-raw' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'vtt-raw' ? 'Copied' : 'Copy WebVTT'}</span>
            </button>
          </div>

          <pre className="p-5 rounded-xl bg-slate-950/60 font-mono text-xs leading-relaxed overflow-x-auto text-indigo-300 selection:bg-indigo-500/30">
            {vttText}
          </pre>
        </div>
      )}

      {/* 4. Format: SRT */}
      {activeFormat === 'srt' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono ${themeConfig.textMuted}`}>subtitles.srt</span>
            <button
              type="button"
              onClick={() => handleCopy('srt-raw', srtText)}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'srt-raw' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'srt-raw' ? 'Copied' : 'Copy SubRip (SRT)'}</span>
            </button>
          </div>

          <pre className="p-5 rounded-xl bg-slate-950/60 font-mono text-xs leading-relaxed overflow-x-auto text-amber-300 selection:bg-amber-500/30">
            {srtText}
          </pre>
        </div>
      )}

      {/* 5. Format: CLEAN TEXT */}
      {activeFormat === 'text' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono ${themeConfig.textMuted}`}>transcript_plain.txt</span>
            <button
              type="button"
              onClick={() => handleCopy('plain-raw', plainText)}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'plain-raw' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'plain-raw' ? 'Copied' : 'Copy Plain Text'}</span>
            </button>
          </div>

          <div className={`py-4 font-sans text-sm sm:text-base leading-relaxed ${themeConfig.textPrimary}`}>
            {plainText}
          </div>
        </div>
      )}
    </div>
  );
};
