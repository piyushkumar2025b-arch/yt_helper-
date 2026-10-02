import React, { useState, useEffect, useRef } from 'react';
import {
  Move,
  X,
  PanelLeft,
  LayoutTemplate,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  Tv,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Radio,
  Music,
  Headphones,
  Film,
} from 'lucide-react';
import { VideoMetadata, ThemeId } from '../types';
import { APP_THEMES } from '../constants';

export type VideoPlayerSize = 'sm' | 'md' | 'lg' | 'xl';
export type VideoPlacementMode = 'floating' | 'docked-top' | 'sidebar';
export type FloatingCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'custom';

export const VIDEO_SIZE_PRESETS: Record<
  VideoPlayerSize,
  { label: string; shortLabel: string; widthPx: number; desc: string }
> = {
  sm: { label: 'Mini (280px)', shortLabel: 'S', widthPx: 280, desc: 'Compact mini player' },
  md: { label: 'Medium (420px)', shortLabel: 'M', widthPx: 420, desc: 'Balanced everyday player' },
  lg: { label: 'Large (640px)', shortLabel: 'L', widthPx: 640, desc: 'Large HD view for slides & code' },
  xl: { label: 'Cinema (880px)', shortLabel: 'XL', widthPx: 880, desc: 'Wide theater size' },
};

interface VideoPlayerPanelProps {
  metadata: VideoMetadata | null;
  activeTimestamp: number | null;
  seekTrigger?: number;
  onTimeUpdate?: (seconds: number) => void;
  currentTheme?: ThemeId;
  size?: VideoPlayerSize;
  onChangeSize?: (size: VideoPlayerSize) => void;
  placement?: VideoPlacementMode;
  onChangePlacement?: (mode: VideoPlacementMode) => void;
  onClose?: () => void;
  embeddedInSidebar?: boolean;
}

export const VideoPlayerPanel: React.FC<VideoPlayerPanelProps> = ({
  metadata,
  activeTimestamp,
  seekTrigger = 0,
  onTimeUpdate,
  currentTheme = 'sepia',
  size = 'md',
  onChangeSize,
  placement = 'floating',
  onChangePlacement,
  onClose,
  embeddedInSidebar = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPlayerReadyRef = useRef<boolean>(false);
  const lastReportedSecRef = useRef<number>(-1);
  const lastHandledSeekTriggerRef = useRef<number>(seekTrigger);
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.sepia;

  // Custom width and corner snap state
  const [customWidth, setCustomWidth] = useState<number>(VIDEO_SIZE_PRESETS[size].widthPx);
  const [corner, setCorner] = useState<FloatingCorner>('bottom-right');
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(20, window.innerWidth - VIDEO_SIZE_PRESETS[size].widthPx - 32),
        y: Math.max(64, window.innerHeight - Math.round((VIDEO_SIZE_PRESETS[size].widthPx * 9) / 16) - 96),
      };
    }
    return { x: 400, y: 200 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });
  const resizeStartRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 420 });

  // Native Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);

  // Sync preset width when `size` prop changes
  useEffect(() => {
    const presetW = VIDEO_SIZE_PRESETS[size]?.widthPx || 420;
    setCustomWidth(presetW);
    if (corner !== 'custom') {
      snapToCorner(corner, presetW);
    }
  }, [size]);

  // Reset player ready state when media changes
  useEffect(() => {
    isPlayerReadyRef.current = false;
    lastReportedSecRef.current = -1;
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
  }, [metadata?.videoId, metadata?.mediaUrl, metadata?.url]);

  // Listen to YouTube IFrame postMessage events
  useEffect(() => {
    const ALLOWED_YT_HOSTS = new Set([
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
    ]);

    const handleMessage = (event: MessageEvent) => {
      try {
        const originHost = new URL(event.origin).hostname.toLowerCase();
        if (!ALLOWED_YT_HOSTS.has(originHost)) return;
      } catch {
        return;
      }
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) {
        return;
      }

      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (payload?.event === 'onReady') {
          isPlayerReadyRef.current = true;
        } else if (payload?.event === 'infoDelivery' && payload.info?.currentTime !== undefined) {
          const sec = Math.floor(payload.info.currentTime);
          if (sec !== lastReportedSecRef.current) {
            lastReportedSecRef.current = sec;
            onTimeUpdate?.(sec);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTimeUpdate]);

  const registerYouTubeListener = () => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: 'opentranscript-yt' }),
        '*'
      );
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
        '*'
      );
    } catch {
      // ignore
    }
  };

  // Seek media element or iframe when seekTrigger explicitly increments
  useEffect(() => {
    if (seekTrigger === lastHandledSeekTriggerRef.current) return;
    lastHandledSeekTriggerRef.current = seekTrigger;

    if (seekTrigger > 0 && activeTimestamp !== null) {
      const sec = Math.max(0, Math.floor(activeTimestamp));
      lastReportedSecRef.current = sec;

      // 1. Native HTML5 Audio
      if (audioRef.current) {
        audioRef.current.currentTime = sec;
        audioRef.current.play().catch(() => {});
        setIsPlayingAudio(true);
        return;
      }

      // 2. Native HTML5 Video
      if (videoRef.current) {
        videoRef.current.currentTime = sec;
        videoRef.current.play().catch(() => {});
        return;
      }

      // 3. YouTube / Vimeo / Embed iframe
      if (isPlayerReadyRef.current && iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [sec, true] }),
            '*'
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
          return;
        } catch {
          // fallback
        }
      }

      if (iframeRef.current && metadata?.videoId) {
        const sourceType = metadata.sourceType || 'youtube';
        if (sourceType === 'youtube') {
          iframeRef.current.src = `https://www.youtube.com/embed/${metadata.videoId}?enablejsapi=1&autoplay=1&start=${sec}&rel=0`;
        }
      }
    }
  }, [seekTrigger, activeTimestamp, metadata]);

  const snapToCorner = (targetCorner: FloatingCorner, widthToUse = customWidth) => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const playerH = Math.round((widthToUse * 9) / 16) + 42;
    const pad = 24;

    let nextX = position.x;
    let nextY = position.y;

    if (targetCorner === 'bottom-right') {
      nextX = Math.max(pad, vw - widthToUse - pad);
      nextY = Math.max(64, vh - playerH - pad - 32);
    } else if (targetCorner === 'bottom-left') {
      nextX = pad;
      nextY = Math.max(64, vh - playerH - pad - 32);
    } else if (targetCorner === 'top-right') {
      nextX = Math.max(pad, vw - widthToUse - pad);
      nextY = 68;
    } else if (targetCorner === 'top-left') {
      nextX = pad;
      nextY = 68;
    }

    setCorner(targetCorner);
    setPosition({ x: nextX, y: nextY });
  };

  // Dragging handler
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const playerH = Math.round((customWidth * 9) / 16) + 42;

      const newX = Math.min(Math.max(8, e.clientX - dragOffsetRef.current.offsetX), vw - customWidth - 8);
      const newY = Math.min(Math.max(50, e.clientY - dragOffsetRef.current.offsetY), vh - playerH - 8);

      setPosition({ x: newX, y: newY });
      setCorner('custom');
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, customWidth]);

  // Resizing handler
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.startX;
      const newWidth = Math.min(Math.max(260, resizeStartRef.current.startWidth + deltaX), 980);
      setCustomWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!metadata || (!metadata.videoId && !metadata.mediaUrl && !metadata.embedUrl)) {
    return null;
  }

  const formatSec = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sourceType = metadata.sourceType || 'youtube';
  const isAudio =
    sourceType === 'direct_audio' ||
    sourceType === 'podcast_rss' ||
    (Boolean(metadata.mediaUrl) && /\.(mp3|wav|m4a|ogg|aac|flac)(\?.*)?$/i.test(metadata.mediaUrl || ''));
  const isDirectVideo =
    sourceType === 'direct_video' ||
    (Boolean(metadata.mediaUrl) && /\.(mp4|webm|mov)(\?.*)?$/i.test(metadata.mediaUrl || ''));

  function resolveEmbedSrc(): string {
    if (metadata?.embedUrl) return metadata.embedUrl;
    if (sourceType === 'vimeo') {
      return `https://player.vimeo.com/video/${metadata?.videoId}?autoplay=1`;
    }
    if (sourceType === 'dailymotion') {
      return `https://www.dailymotion.com/embed/video/${metadata?.videoId}`;
    }
    if (sourceType === 'ted') {
      return `https://embed.ted.com/talks/${metadata?.videoId}`;
    }
    if (sourceType === 'loom') {
      return `https://www.loom.com/embed/${metadata?.videoId}`;
    }
    return `https://www.youtube.com/embed/${metadata?.videoId}?enablejsapi=1&rel=0`;
  }

  // Render Inner Player Media Content
  const renderMediaContent = () => {
    // 1. Audio Media (Podcast RSS, MP3/WAV/M4A, Uploaded Audio)
    if (isAudio && metadata.mediaUrl) {
      return (
        <div className="w-full h-full flex flex-col justify-between p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/60 text-slate-100 select-none">
          <audio
            ref={audioRef}
            src={metadata.mediaUrl}
            onTimeUpdate={(e) => {
              const cur = Math.floor(e.currentTarget.currentTime);
              setAudioCurrentTime(cur);
              if (cur !== lastReportedSecRef.current) {
                lastReportedSecRef.current = cur;
                onTimeUpdate?.(cur);
              }
            }}
            onLoadedMetadata={(e) => {
              setAudioDuration(Math.floor(e.currentTarget.duration) || metadata.durationSeconds || 0);
            }}
            onPlay={() => setIsPlayingAudio(true)}
            onPause={() => setIsPlayingAudio(false)}
            onEnded={() => setIsPlayingAudio(false)}
          />

          {/* Top Info Banner */}
          <div className="flex items-center gap-3 min-w-0">
            {metadata.thumbnailUrl ? (
              <img
                src={metadata.thumbnailUrl}
                alt={metadata.title}
                className="w-14 h-14 rounded-lg object-cover shadow-md shrink-0 border border-slate-700/60"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400">
                <Radio className="w-7 h-7" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                <Headphones className="w-3 h-3" />
                <span>{sourceType === 'podcast_rss' ? 'Podcast Audio' : 'Audio Stream'}</span>
              </div>
              <h4 className="text-xs sm:text-sm font-semibold text-slate-100 truncate mt-0.5">
                {metadata.title}
              </h4>
              <p className="text-[11px] text-slate-400 truncate">
                {metadata.authorName || 'Audio Recording'}
              </p>
            </div>
          </div>

          {/* Scrubber Bar */}
          <div className="space-y-1 my-2">
            <input
              type="range"
              min={0}
              max={audioDuration || metadata.durationSeconds || 100}
              value={audioCurrentTime}
              onChange={(e) => {
                const targetSec = Number(e.target.value);
                setAudioCurrentTime(targetSec);
                if (audioRef.current) {
                  audioRef.current.currentTime = targetSec;
                }
              }}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono tabular-nums">
              <span>{formatSec(audioCurrentTime)}</span>
              <span>{formatSec(audioDuration || metadata.durationSeconds || 0)}</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!audioRef.current) return;
                  if (isPlayingAudio) {
                    audioRef.current.pause();
                  } else {
                    audioRef.current.play().catch(() => {});
                  }
                }}
                className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                title={isPlayingAudio ? 'Pause Audio' : 'Play Audio'}
              >
                {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Speed Buttons */}
              <div className="flex items-center bg-slate-800/80 rounded p-0.5 text-[10px] font-bold text-slate-300">
                {[1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      setAudioPlaybackRate(rate);
                      if (audioRef.current) audioRef.current.playbackRate = rate;
                    }}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      audioPlaybackRate === rate ? 'bg-indigo-600 text-white' : 'hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Mute button */}
            <button
              type="button"
              onClick={() => {
                if (!audioRef.current) return;
                const nextMuted = !isMuted;
                audioRef.current.muted = nextMuted;
                setIsMuted(nextMuted);
              }}
              className="p-1.5 rounded text-slate-400 hover:text-white cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      );
    }

    // 2. Direct Video File (.mp4, .webm)
    if (isDirectVideo && metadata.mediaUrl) {
      return (
        <video
          ref={videoRef}
          src={metadata.mediaUrl}
          controls
          onTimeUpdate={(e) => {
            const sec = Math.floor(e.currentTarget.currentTime);
            if (sec !== lastReportedSecRef.current) {
              lastReportedSecRef.current = sec;
              onTimeUpdate?.(sec);
            }
          }}
          className="w-full h-full object-contain bg-black"
        />
      );
    }

    // 3. IFrame Video Embed (YouTube, Vimeo, Dailymotion, TED, Loom)
    return (
      <iframe
        ref={iframeRef}
        src={resolveEmbedSrc()}
        onLoad={registerYouTubeListener}
        title={metadata.title || 'Video Player'}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  };

  // 1. Embedded inside Sidebar Mode
  if (embeddedInSidebar) {
    return (
      <div className={`rounded-lg overflow-hidden border ${themeConfig.borderLight} bg-black/90 space-y-1.5 p-1.5`}>
        <div className="flex items-center justify-between px-1 text-[11px]">
          <div className="flex items-center gap-1.5 truncate">
            <span className={`font-medium truncate ${themeConfig.textSecondary}`}>
              {isAudio ? 'Audio Player' : 'Sidebar Player'}
            </span>
            {activeTimestamp !== null && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 tabular-nums shrink-0">
                {formatSec(activeTimestamp)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onChangePlacement && (
              <>
                <button
                  type="button"
                  onClick={() => onChangePlacement('floating')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/20 cursor-pointer`}
                  title="Pop out as movable floating player"
                >
                  Pop Out
                </button>
                <button
                  type="button"
                  onClick={() => onChangePlacement('docked-top')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/20 cursor-pointer`}
                  title="Dock player at top of page"
                >
                  Dock Top
                </button>
              </>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className={`p-0.5 rounded ${themeConfig.textMuted} hover:text-rose-400 cursor-pointer`}
                title="Hide Video"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="w-full overflow-hidden rounded bg-black aspect-video relative">
          {renderMediaContent()}
        </div>
      </div>
    );
  }

  // 2. Docked Top of Main Workspace Mode
  if (placement === 'docked-top') {
    return (
      <div
        style={{ maxWidth: size === 'xl' ? '100%' : `${customWidth}px` }}
        className={`rounded-xl overflow-hidden border ${themeConfig.borderLight} ${themeConfig.cardBg} shadow-lg transition-all`}
      >
        {/* Top Control Bar */}
        <div className={`px-3 py-1.5 border-b ${themeConfig.borderLight} flex items-center justify-between gap-2 flex-wrap text-xs`}>
          <div className="flex items-center gap-2 min-w-0">
            <Tv className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className={`font-semibold truncate ${themeConfig.textPrimary}`}>
              {metadata.title}
            </span>
            {activeTimestamp !== null && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 tabular-nums shrink-0">
                Synced: {formatSec(activeTimestamp)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 4 Size Presets: S, M, L, XL */}
            <div className="flex items-center gap-0.5 bg-slate-500/10 p-0.5 rounded-md">
              {(['sm', 'md', 'lg', 'xl'] as VideoPlayerSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    onChangeSize?.(sz);
                    setCustomWidth(VIDEO_SIZE_PRESETS[sz].widthPx);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                    size === sz
                      ? 'bg-indigo-600 text-white'
                      : `${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
                  }`}
                  title={VIDEO_SIZE_PRESETS[sz].label}
                >
                  {VIDEO_SIZE_PRESETS[sz].shortLabel}
                </button>
              ))}
            </div>

            {/* Switch Placement: Float Anywhere or Move to Sidebar */}
            {onChangePlacement && (
              <>
                <button
                  type="button"
                  onClick={() => onChangePlacement('floating')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer flex items-center gap-1`}
                  title="Float and drag anywhere on screen"
                >
                  <Move className="w-3 h-3" />
                  <span>Float &amp; Move</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangePlacement('sidebar')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer flex items-center gap-1`}
                  title="Pin inside left sidebar"
                >
                  <PanelLeft className="w-3 h-3" />
                  <span>Sidebar</span>
                </button>
              </>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className={`p-1 rounded ${themeConfig.textMuted} hover:text-rose-400 cursor-pointer`}
                title="Hide Video"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Video Frame */}
        <div className="w-full bg-black aspect-video relative">
          {renderMediaContent()}
        </div>
      </div>
    );
  }

  // 3. Floating Draggable / Resizable Window Mode (Default)
  return (
    <div
      ref={containerRef}
      style={{
        width: `${customWidth}px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        position: 'fixed',
        top: 0,
        left: 0,
      }}
      className={`z-50 rounded-xl overflow-hidden shadow-2xl border ${themeConfig.borderLight} ${themeConfig.cardBg} transition-shadow`}
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          setIsDragging(true);
          dragOffsetRef.current = {
            offsetX: e.clientX - position.x,
            offsetY: e.clientY - position.y,
          };
        }}
        className={`px-2.5 py-1.5 border-b ${themeConfig.borderLight} flex items-center justify-between gap-2 cursor-move bg-slate-950/90 text-slate-200`}
        title="Drag to move video player anywhere on screen"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Move className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-[11px] font-semibold truncate">
            {metadata.title || 'Media Player'}
          </span>
          {activeTimestamp !== null && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 tabular-nums shrink-0">
              {formatSec(activeTimestamp)}
            </span>
          )}
        </div>

        {/* Controls: 4 Sizes (S / M / L / XL), 4 Quick Corner Snaps, Dock Options, Close */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 4 Size Presets */}
          <div className="flex items-center gap-0.5 bg-slate-800/90 p-0.5 rounded">
            {(['sm', 'md', 'lg', 'xl'] as VideoPlayerSize[]).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => {
                  onChangeSize?.(sz);
                  const w = VIDEO_SIZE_PRESETS[sz].widthPx;
                  setCustomWidth(w);
                  if (corner !== 'custom') {
                    snapToCorner(corner, w);
                  }
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  size === sz && Math.abs(customWidth - VIDEO_SIZE_PRESETS[sz].widthPx) < 20
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={VIDEO_SIZE_PRESETS[sz].label}
              >
                {VIDEO_SIZE_PRESETS[sz].shortLabel}
              </button>
            ))}
          </div>

          {/* Quick Screen Corner Snaps */}
          <div className="hidden sm:flex items-center gap-0.5 bg-slate-800/90 p-0.5 rounded">
            <button
              type="button"
              onClick={() => snapToCorner('top-left')}
              className={`p-1 rounded cursor-pointer ${corner === 'top-left' ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              title="Snap to Top-Left corner"
            >
              <CornerUpLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => snapToCorner('top-right')}
              className={`p-1 rounded cursor-pointer ${corner === 'top-right' ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              title="Snap to Top-Right corner"
            >
              <CornerUpRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => snapToCorner('bottom-left')}
              className={`p-1 rounded cursor-pointer ${corner === 'bottom-left' ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              title="Snap to Bottom-Left corner"
            >
              <CornerDownLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => snapToCorner('bottom-right')}
              className={`p-1 rounded cursor-pointer ${corner === 'bottom-right' ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              title="Snap to Bottom-Right corner"
            >
              <CornerDownRight className="w-3 h-3" />
            </button>
          </div>

          {/* Placement Switchers */}
          {onChangePlacement && (
            <>
              <button
                type="button"
                onClick={() => onChangePlacement('docked-top')}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                title="Dock video at top of page"
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChangePlacement('sidebar')}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                title="Pin video inside left sidebar"
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
              title="Hide Video"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Media Player Area */}
      <div className="w-full bg-black aspect-video relative">
        {(isDragging || isResizing) && (
          <div className="absolute inset-0 z-20 bg-transparent cursor-move" />
        )}
        {renderMediaContent()}

        {/* Bottom-Right Drag-to-Resize Handle */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsResizing(true);
            resizeStartRef.current = {
              startX: e.clientX,
              startWidth: customWidth,
            };
          }}
          className="absolute bottom-0 right-0 z-30 w-5 h-5 cursor-nwse-resize flex items-end justify-end p-1 bg-slate-950/70 rounded-tl text-slate-300 hover:text-indigo-400"
          title="Drag corner to resize video player to any custom size"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
};
