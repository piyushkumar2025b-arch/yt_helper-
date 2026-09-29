import React, { useState, useEffect, useRef } from 'react';
import {
  Move,
  X,
  Maximize2,
  Minimize2,
  PanelLeft,
  LayoutTemplate,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  Tv,
  ExternalLink,
} from 'lucide-react';
import { VideoMetadata, ThemeId } from '../types';
import { APP_THEMES } from '../constants';

export type VideoPlayerSize = 'sm' | 'md' | 'lg' | 'xl';
export type VideoPlacementMode =
  | 'floating'
  | 'docked-top'
  | 'sidebar';
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
  currentTheme = 'midnight',
  size = 'md',
  onChangeSize,
  placement = 'floating',
  onChangePlacement,
  onClose,
  embeddedInSidebar = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  // Custom width when user drags the resize handle or picks a size preset
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

  // Sync preset width when `size` prop changes
  useEffect(() => {
    const presetW = VIDEO_SIZE_PRESETS[size]?.widthPx || 420;
    setCustomWidth(presetW);
    if (corner !== 'custom') {
      snapToCorner(corner, presetW);
    }
  }, [size]);

  // Seek YouTube iframe when activeTimestamp changes
  useEffect(() => {
    if (activeTimestamp !== null && iframeRef.current && metadata?.videoId) {
      const sec = Math.floor(activeTimestamp);
      iframeRef.current.src = `https://www.youtube.com/embed/${metadata.videoId}?autoplay=1&start=${sec}&rel=0`;
    }
  }, [activeTimestamp, metadata?.videoId]);

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

  // Handle Free Dragging across the screen
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nextX = Math.min(Math.max(8, e.clientX - dragOffsetRef.current.offsetX), Math.max(8, vw - 160));
      const nextY = Math.min(Math.max(8, e.clientY - dragOffsetRef.current.offsetY), Math.max(8, vh - 90));
      setCorner('custom');
      setPosition({ x: nextX, y: nextY });
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
  }, [isDragging]);

  // Handle Smooth Corner Drag Resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.startX;
      const nextW = Math.min(Math.max(240, resizeStartRef.current.startWidth + deltaX), 1100);
      setCustomWidth(nextW);
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

  if (!metadata || !metadata.videoId) {
    return null;
  }

  const startTimeParam = activeTimestamp !== null ? `&start=${Math.floor(activeTimestamp)}&autoplay=1` : '';
  const embedSrc = `https://www.youtube.com/embed/${metadata.videoId}?rel=0${startTimeParam}`;

  // 1. Embedded inside Sidebar Mode
  if (embeddedInSidebar) {
    return (
      <div className={`rounded-lg overflow-hidden border ${themeConfig.borderLight} bg-black/90 space-y-1.5 p-1.5`}>
        <div className="flex items-center justify-between px-1 text-[11px]">
          <span className={`font-medium truncate ${themeConfig.textSecondary}`}>Sidebar Player</span>
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
        <div className="w-full overflow-hidden rounded bg-black aspect-video">
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={metadata.title || 'Video Player'}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // 2. Docked Top of Main Workspace Mode (with 4 size presets)
  if (placement === 'docked-top') {
    return (
      <div
        style={{ maxWidth: size === 'xl' ? '100%' : `${customWidth}px` }}
        className={`rounded-xl overflow-hidden border ${themeConfig.borderLight} ${themeConfig.cardBg} shadow-lg transition-all`}
      >
        {/* Top Control Bar */}
        <div className={`px-3 py-2 border-b ${themeConfig.borderLight} flex items-center justify-between gap-2 flex-wrap text-xs`}>
          <div className="flex items-center gap-2 min-w-0">
            <Tv className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className={`font-semibold truncate ${themeConfig.textPrimary}`}>
              {metadata.title}
            </span>
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
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={metadata.title || 'Video Player'}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // 3. Floating Draggable & Multi-Size Player (Place anywhere on screen!)
  return (
    <div
      ref={containerRef}
      style={{
        width: `${customWidth}px`,
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth: 'calc(100vw - 16px)',
      }}
      className={`fixed z-50 rounded-xl overflow-hidden border ${themeConfig.border} ${themeConfig.cardBg} shadow-2xl select-none`}
    >
      {/* Draggable Header Bar */}
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
            {metadata.title || 'Video Player'}
          </span>
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

          {/* Dock to Top or Sidebar */}
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

      {/* Video Player Area */}
      <div className="w-full bg-black aspect-video relative">
        {/* Transparent overlay while actively dragging/resizing so mouse events don't get swallowed by the YouTube iframe */}
        {(isDragging || isResizing) && (
          <div className="absolute inset-0 z-20 bg-transparent cursor-move" />
        )}
        <iframe
          ref={iframeRef}
          src={embedSrc}
          title={metadata.title || 'Video Player'}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

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
