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
  const [ytTopics, setYtTopics] = useState<string[]>([]);
  const [ytComments, setYtComments] = useState<YouTubeCommentItem[]>([]);
  const [ytTimestampHighlights, setYtTimestampHighlights] = useState<Array<{ seconds: number; timeStr: string; context: string; author: string }>>([]);
  const [ytChannel, setYtChannel] = useState<any>(null);
  const [ytContentDetails, setYtContentDetails] = useState<any>(null);
  const [ytCaptionsList, setYtCaptionsList] = useState<any[]>([]);

  useEffect(() => {
    if (!videoId) return;
    const storedKey = typeof window !== 'undefined' ? localStorage.getItem('youtube_api_key') : null;
    const headers: Record<string, string> = {};
    if (storedKey) headers['x-youtube-api-key'] = storedKey;

    fetch(`/api/youtube-details?videoId=${encodeURIComponent(videoId)}`, { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setYtStats(data.statistics || null);
          setYtTags(data.tags || []);
          setYtTopics(data.topicCategories || []);
          setYtComments(data.comments || []);
          setYtTimestampHighlights(data.timestampHighlights || []);
          setYtChannel(data.channel || null);
          setYtContentDetails(data.contentDetails || null);
          setYtCaptionsList(data.captionsList || []);
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

              {ytContentDetails && (
                <>
                  <div className="space-y-0.5">
                    <span className={themeConfig.textMuted}>Quality &amp; Subtitles</span>
                    <p className={`font-semibold uppercase ${themeConfig.textPrimary}`}>
                      {ytContentDetails.definition || 'HD'} · {ytContentDetails.hasCaptions ? 'Captions Enabled' : 'No Official Captions'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {ytChannel && (
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${themeConfig.borderLight} bg-slate-500/5`}>
                {ytChannel.thumbnailUrl && (
                  <img src={ytChannel.thumbnailUrl} alt={ytChannel.title} className="w-10 h-10 rounded-full border border-slate-700/50" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-xs ${themeConfig.textPrimary}`}>{ytChannel.title}</span>
                    {ytChannel.customUrl && <span className={`text-[10px] ${themeConfig.textMuted}`}>{ytChannel.customUrl}</span>}
                  </div>
                  <div className={`flex items-center gap-3 text-[11px] ${themeConfig.textMuted}`}>
                    {typeof ytChannel.subscriberCount === 'number' && (
                      <span>{ytChannel.subscriberCount.toLocaleString()} subscribers</span>
                    )}
                    {typeof ytChannel.videoCount === 'number' && (
                      <span>· {ytChannel.videoCount.toLocaleString()} uploads</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Topics & Tags */}
          {(ytTopics.length > 0 || ytTags.length > 0) && (
            <section className="space-y-2.5">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Topics &amp; Keywords (YouTube Data API v3)
              </h3>
              {ytTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className={`text-[11px] font-medium ${themeConfig.textMuted}`}>Topics:</span>
                  {ytTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              {ytTags.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className={`text-[11px] font-medium ${themeConfig.textMuted}`}>Tags:</span>
                  {ytTags.slice(0, 20).map((tag, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 text-[10.5px] rounded bg-slate-500/10 text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Audience Timestamp Highlights */}
          {ytTimestampHighlights.length > 0 && (
            <section className="space-y-3">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Audience Timestamp Highlights ({ytTimestampHighlights.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {ytTimestampHighlights.slice(0, 8).map((ts, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border ${themeConfig.borderLight} bg-slate-500/5 space-y-1`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                        [{ts.timeStr}]
                      </span>
                      <span className={`text-[10px] ${themeConfig.textMuted}`}>{ts.author}</span>
                    </div>
                    <p className={`text-[11px] line-clamp-2 ${themeConfig.textSecondary}`}>{ts.context}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Official Caption Tracks Catalog */}
          {ytCaptionsList.length > 0 && (
            <section className="space-y-2">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Registered Caption Tracks ({ytCaptionsList.length})
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {ytCaptionsList.map((tr) => (
                  <div
                    key={tr.id}
                    className={`px-2.5 py-1 rounded border ${themeConfig.borderLight} bg-slate-500/5 flex items-center gap-1.5 text-[11px]`}
                  >
                    <span className="font-medium text-slate-200">{tr.name}</span>
                    <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-1 rounded">
                      {tr.trackKind === 'ASR' ? 'Auto ASR' : 'Human Standard'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

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
