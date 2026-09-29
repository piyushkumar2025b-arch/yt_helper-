import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Copy,
  Check,
  Download,
  Volume2,
  Pause,
  ChevronDown,
  AlignLeft,
  List,
  Sliders,
  ArrowDownCircle,
  Bookmark,
  Plus,
} from 'lucide-react';
import { TranscriptSegment, VideoMetadata, ThemeId } from '../types';
import { speechService, SpeechItem, tokenizeSpeechWords } from '../services/speechService';
import { APP_THEMES } from '../constants';

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  metadata: VideoMetadata | null;
  onSeekToTimestamp: (seconds: number) => void;
  activeTimestamp: number | null;
  currentTheme?: ThemeId;
  onOpenVoiceSettings?: () => void;
  onAppendToSummary?: (markdownText: string) => void;
  onSaveToList?: (item: {
    itemType: 'video' | 'summary' | 'book' | 'article' | 'note';
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }) => void;
  onSyncTimestamp?: (seconds: number) => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  segments,
  metadata,
  onSeekToTimestamp,
  activeTimestamp,
  currentTheme = 'midnight',
  onOpenVoiceSettings,
  onAppendToSummary,
  onSaveToList,
  onSyncTimestamp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'segments' | 'article'>('segments');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number>(-1);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [autoScroll, setAutoScroll] = useState<boolean>(speechService.getAutoScroll());

  const exportRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Record<number, HTMLElement | null>>({});
  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const lastWordTopRef = useRef<number>(0);

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const unsubState = speechService.subscribeStateChange((playing, paused, curIdx) => {
      setIsSpeaking(playing);
      setIsPaused(paused);
      setSpeakingIdx(curIdx);
      if (!playing) {
        setActiveWordIndex(-1);
      }
    });

    const unsubStart = speechService.subscribeItemStart((idx) => {
      setSpeakingIdx(idx);
      setActiveWordIndex(0);
      if (speechService.getAutoScroll()) {
        const el = segmentRefs.current[idx];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    const unsubWord = speechService.subscribeWordBoundary((progress) => {
      setSpeakingIdx(progress.itemIndex);
      setActiveWordIndex(progress.wordIndex);
      if (speechService.getAutoScroll()) {
        requestAnimationFrame(() => {
          const wordEl = activeWordRef.current;
          if (wordEl) {
            const rect = wordEl.getBoundingClientRect();
            const vh = window.innerHeight;
            const movedLine = Math.abs(rect.top - lastWordTopRef.current) > 12;
            const outOfCenterBand = rect.top < vh * 0.24 || rect.bottom > vh * 0.72;
            if (movedLine || outOfCenterBand) {
              lastWordTopRef.current = rect.top;
              wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        });
      }
    });

    const unsubScroll = speechService.subscribeAutoScroll((enabled) => {
      setAutoScroll(enabled);
    });

    return () => {
      unsubState();
      unsubStart();
      unsubWord();
      unsubScroll();
    };
  }, [onSeekToTimestamp]);

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter(
      (s) => s.text.toLowerCase().includes(q) || s.formattedTime.includes(q)
    );
  }, [segments, searchQuery]);

  // Exact interval matching so every second of video playback maps to its active transcript segment
  const activeVideoSegIdx = useMemo(() => {
    if (activeTimestamp === null || filteredSegments.length === 0) return -1;
    for (let i = 0; i < filteredSegments.length; i++) {
      const cur = filteredSegments[i];
      const nextStart =
        i + 1 < filteredSegments.length
          ? filteredSegments[i + 1].start
          : cur.start + Math.max(cur.duration || 8, 10);
      if (activeTimestamp >= cur.start && activeTimestamp < nextStart) {
        return i;
      }
    }
    // Fallback to closest segment within 5 seconds
    let bestIdx = -1;
    let bestDiff = 5;
    filteredSegments.forEach((seg, idx) => {
      const diff = Math.abs(seg.start - activeTimestamp);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, [filteredSegments, activeTimestamp]);

  // Auto-scroll transcript to follow live video playback when Auto-Scroll is enabled and TTS is not overriding
  useEffect(() => {
    if (activeVideoSegIdx >= 0 && autoScroll && !isSpeaking) {
      const el = segmentRefs.current[activeVideoSegIdx];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeVideoSegIdx, autoScroll, isSpeaking]);

  // Sync activeTimestamp when audio narration steps through transcript segments
  useEffect(() => {
    if ((isSpeaking || isPaused) && speakingIdx >= 0 && onSyncTimestamp) {
      if (viewMode === 'segments' && filteredSegments[speakingIdx]) {
        onSyncTimestamp(filteredSegments[speakingIdx].start);
      }
    }
  }, [speakingIdx, isSpeaking, isPaused, viewMode, filteredSegments, onSyncTimestamp]);

  const fullPlainText = useMemo(() => {
    return segments.map((s) => `[${s.formattedTime}] ${s.text}`).join('\n');
  }, [segments]);

  const articleParagraphs = useMemo(() => {
    const chunks: { startTime: string; startSeconds: number; text: string }[] = [];
    let currentChunk: string[] = [];
    let chunkStart = '';
    let chunkSec = 0;

    segments.forEach((seg, idx) => {
      if (currentChunk.length === 0) {
        chunkStart = seg.formattedTime;
        chunkSec = seg.start;
      }
      currentChunk.push(seg.text);

      if (currentChunk.length >= 6 || idx === segments.length - 1) {
        chunks.push({
          startTime: chunkStart,
          startSeconds: chunkSec,
          text: currentChunk.join(' '),
        });
        currentChunk = [];
      }
    });

    return chunks;
  }, [segments]);

  const handlePlayFromIndex = (indexInFiltered: number) => {
    if (viewMode === 'article') {
      const speechItems: SpeechItem[] = articleParagraphs.map((para, i) => ({
        id: `para-${i}`,
        text: para.text,
        start: para.startSeconds,
        label: `[${para.startTime}] Paragraph ${i + 1}`,
      }));
      speechService.playItems(speechItems, indexInFiltered);
      return;
    }

    const speechItems: SpeechItem[] = filteredSegments.map((seg, i) => ({
      id: i,
      text: seg.text,
      start: seg.start,
      label: `${seg.formattedTime} — ${seg.text.slice(0, 32)}...`,
    }));
    speechService.playItems(speechItems, indexInFiltered);
  };

  const handleToggleTopReadAloud = () => {
    if (isSpeaking && !isPaused) {
      speechService.pause();
      return;
    }
    if (isSpeaking && isPaused) {
      speechService.resume();
      return;
    }
    handlePlayFromIndex(0);
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(fullPlainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([fullPlainText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(metadata?.title || 'transcript').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = () => {
    const formatSrtTime = (sec: number) => {
      const hrs = Math.floor(sec / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    const srtContent = segments
      .map((s, idx) => {
        const start = formatSrtTime(s.start);
        const end = formatSrtTime(s.start + (s.duration || 3));
        return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
      })
      .join('\n');

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(metadata?.title || 'transcript').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderSynchronizedWords = (text: string, isCurrentItem: boolean) => {
    if (!isCurrentItem) {
      return text;
    }
    const words = tokenizeSpeechWords(text);
    return words.map((word, wIdx) => {
      const isCurrentWord = wIdx === activeWordIndex;
      const isPastWord = wIdx < activeWordIndex;
      return (
        <React.Fragment key={wIdx}>
          <span
            ref={isCurrentWord ? activeWordRef : undefined}
            className={`inline-block rounded transition-all duration-100 ${
              isCurrentWord
                ? 'bg-indigo-500 text-white font-semibold px-1.5 py-0.5 shadow-sm scale-[1.02]'
                : isPastWord
                ? `${themeConfig.textPrimary} font-medium`
                : `${themeConfig.textSecondary}`
            }`}
          >
            {word}
          </span>{' '}
        </React.Fragment>
      );
    });
  };

  if (segments.length === 0) return null;

  return (
    <div className="w-full space-y-2.5">
      {/* Compact Unboxed Header & Controls */}
      <div className={`space-y-1.5 pb-2 border-b ${themeConfig.borderLight}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3 h-3 opacity-40 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${segments.length.toLocaleString()} transcript lines or timestamps...`}
            className="w-full pl-7 pr-2.5 py-1 text-[11px] rounded bg-slate-500/10 placeholder:opacity-40 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleToggleTopReadAloud}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              isSpeaking
                ? 'bg-indigo-600 text-white'
                : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15`
            }`}
          >
            {isSpeaking && !isPaused ? <Pause className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            <span>{isSpeaking && !isPaused ? 'Pause' : 'Read Aloud'}</span>
          </button>

          <button
            type="button"
            onClick={() => speechService.setAutoScroll(!autoScroll)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              autoScroll
                ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} bg-slate-500/10`
            }`}
            title="Automatically scroll to active spoken word"
          >
            <ArrowDownCircle className="w-3 h-3" />
            <span>Auto-Scroll: {autoScroll ? 'On' : 'Off'}</span>
          </button>

          {onOpenVoiceSettings && (
            <button
              type="button"
              onClick={onOpenVoiceSettings}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 transition-colors cursor-pointer`}
              title="Select Voice & Speed"
            >
              <Sliders className="w-3 h-3" />
              <span>Voice</span>
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-slate-500/10 p-0.5 rounded">
            <button
              type="button"
              onClick={() => setViewMode('segments')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                viewMode === 'segments'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <List className="w-3 h-3" />
              <span>Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('article')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                viewMode === 'article'
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
              }`}
            >
              <AlignLeft className="w-3 h-3" />
              <span>Paragraphs</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 transition-colors cursor-pointer`}
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/15 transition-colors cursor-pointer`}
            >
              <Download className="w-3 h-3" />
              <span>Save</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {isExportOpen && (
              <div
                className={`absolute right-0 mt-1.5 w-44 rounded-lg ${themeConfig.cardBg} shadow-xl p-1 z-50 text-xs space-y-0.5`}
              >
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadTxt();
                    setIsExportOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md ${themeConfig.textSecondary} hover:bg-slate-500/10 cursor-pointer`}
                >
                  Plain Text (.txt)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadSrt();
                    setIsExportOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md ${themeConfig.textSecondary} hover:bg-slate-500/10 cursor-pointer`}
                >
                  Subtitles (.srt)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Jump Scrubber & Search Count Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className={`flex items-center gap-2 ${themeConfig.textMuted} tabular-nums`}>
          <span>
            Showing {filteredSegments.length.toLocaleString()} of {segments.length.toLocaleString()} lines
          </span>
          {metadata?.totalWords ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{metadata.totalWords.toLocaleString()} words total</span>
            </>
          ) : null}
        </div>

        {segments.length > 8 && !searchQuery && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] ${themeConfig.textMuted}`}>Quick jump:</span>
            {[
              { label: 'Start', idx: 0 },
              { label: '25%', idx: Math.floor(segments.length * 0.25) },
              { label: '50%', idx: Math.floor(segments.length * 0.5) },
              { label: '75%', idx: Math.floor(segments.length * 0.75) },
              { label: 'End', idx: segments.length - 1 },
            ].map((pt) => {
              const targetSeg = segments[pt.idx];
              if (!targetSeg) return null;
              return (
                <button
                  key={pt.label}
                  type="button"
                  onClick={() => {
                    const el = segmentRefs.current[pt.idx];
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    onSeekToTimestamp(targetSeg.start);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/20 cursor-pointer tabular-nums`}
                >
                  {pt.label} ({targetSeg.formattedTime})
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Transcript Content — Unboxed Full Width with Word-by-Word Highlighting */}
      {viewMode === 'segments' ? (
        <div className={`divide-y ${themeConfig.borderLight}`}>
          {filteredSegments.length === 0 ? (
            <p className={`py-12 text-center text-xs ${themeConfig.textMuted}`}>
              No segments matching &ldquo;{searchQuery}&rdquo;
            </p>
          ) : (
            filteredSegments.map((seg, idx) => {
              const isCurrentSpeech = (isSpeaking || isPaused) && speakingIdx === idx;
              const isCurrentVideo = activeVideoSegIdx === idx;

              return (
                <div
                  key={idx}
                  ref={(el) => {
                    segmentRefs.current[idx] = el;
                  }}
                  className={`group flex items-baseline gap-6 py-3 px-3 rounded-lg transition-colors ${
                    isCurrentSpeech
                      ? `${themeConfig.accentBg} border-l-2 border-indigo-500`
                      : isCurrentVideo
                      ? `${themeConfig.accentBg} border-l-2 border-emerald-500`
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSeekToTimestamp(seg.start)}
                    className={`shrink-0 font-mono text-xs font-medium cursor-pointer tabular-nums w-14 text-left ${
                      isCurrentSpeech
                        ? 'text-indigo-400 font-bold'
                        : isCurrentVideo
                        ? 'text-emerald-400 font-bold'
                        : `${themeConfig.textMuted} hover:text-indigo-400`
                    }`}
                    title="Jump video to this timestamp"
                  >
                    {seg.formattedTime}
                  </button>

                  <p
                    onClick={() => handlePlayFromIndex(idx)}
                    className={`text-sm sm:text-base leading-relaxed flex-1 cursor-pointer ${
                      isCurrentSpeech
                        ? `${themeConfig.textPrimary}`
                        : `${themeConfig.textSecondary} group-hover:${themeConfig.textPrimary}`
                    }`}
                  >
                    {renderSynchronizedWords(seg.text, isCurrentSpeech)}
                  </p>

                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePlayFromIndex(idx)}
                      className={`p-1 rounded cursor-pointer ${
                        isCurrentSpeech ? 'opacity-100 text-indigo-400' : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                      }`}
                      title="Read from this line"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`[${seg.formattedTime}] "${seg.text}"`);
                        setCopiedLineIdx(idx);
                        setTimeout(() => setCopiedLineIdx(null), 1800);
                      }}
                      className={`p-1 rounded cursor-pointer ${themeConfig.textMuted} hover:${themeConfig.textPrimary}`}
                      title="Copy quote with timestamp"
                    >
                      {copiedLineIdx === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {onAppendToSummary && (
                      <button
                        type="button"
                        onClick={() =>
                          onAppendToSummary(`\n\n> **[${seg.formattedTime}]** "${seg.text}"\n`)
                        }
                        className={`p-1 rounded cursor-pointer ${themeConfig.textMuted} hover:text-indigo-400`}
                        title="Add quote to Summary"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onSaveToList && (
                      <button
                        type="button"
                        onClick={() =>
                          onSaveToList({
                            itemType: 'note',
                            title: `Quote at [${seg.formattedTime}] — ${metadata?.title || 'Video'}`,
                            url: metadata?.url || '',
                            subtitle: metadata?.authorName || 'Transcript Quote',
                            content: `> **[${seg.formattedTime}]** "${seg.text}"`,
                            notes: '',
                          })
                        }
                        className={`p-1 rounded cursor-pointer ${themeConfig.textMuted} hover:text-indigo-400`}
                        title="Save quote to My List"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="leading-relaxed text-sm sm:text-base space-y-6">
          {articleParagraphs.map((para, i) => {
            const isCurrentPara = (isSpeaking || isPaused) && speakingIdx === i;
            return (
              <p
                key={i}
                ref={(el) => {
                  segmentRefs.current[i] = el;
                }}
                onClick={() => handlePlayFromIndex(i)}
                className={`p-3 rounded-lg transition-colors cursor-pointer ${
                  isCurrentPara
                    ? `${themeConfig.accentBg} border-l-2 border-indigo-500 ${themeConfig.textPrimary}`
                    : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeekToTimestamp(para.startSeconds);
                  }}
                  className="inline-block font-mono text-xs text-indigo-400 hover:underline mr-2.5 cursor-pointer tabular-nums"
                >
                  [{para.startTime}]
                </button>
                {renderSynchronizedWords(para.text, isCurrentPara)}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};
