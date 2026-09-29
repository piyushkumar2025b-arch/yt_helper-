import React, { useState, useEffect } from 'react';
import { BookOpen, Headphones, Play, Image as ImageIcon } from 'lucide-react';

interface SmartImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  variant?: 'book' | 'podcast' | 'video' | 'figure' | 'wiki' | 'general';
  badgeText?: string;
  onFatalError?: () => void;
}

function sanitizeImageUrl(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return trimmed.replace(/^http:\/\//i, 'https://');
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  fallbackSrc,
  alt,
  className = '',
  variant = 'general',
  badgeText,
  onFatalError,
}) => {
  const cleanPrimary = sanitizeImageUrl(src);
  const cleanFallback = sanitizeImageUrl(fallbackSrc);

  const [stage, setStage] = useState<'primary' | 'fallback' | 'proxy' | 'failed'>(() => {
    if (cleanPrimary) return 'primary';
    if (cleanFallback) return 'fallback';
    return 'failed';
  });

  useEffect(() => {
    if (cleanPrimary) {
      setStage('primary');
    } else if (cleanFallback) {
      setStage('fallback');
    } else {
      setStage('failed');
    }
  }, [cleanPrimary, cleanFallback]);

  const advanceStage = () => {
    if (stage === 'primary') {
      if (cleanFallback && cleanFallback !== cleanPrimary) {
        setStage('fallback');
        return;
      }
      if (cleanPrimary.startsWith('https://')) {
        setStage('proxy');
        return;
      }
      setStage('failed');
      onFatalError?.();
      return;
    }

    if (stage === 'fallback') {
      const targetForProxy = cleanFallback || cleanPrimary;
      if (targetForProxy.startsWith('https://')) {
        setStage('proxy');
        return;
      }
      setStage('failed');
      onFatalError?.();
      return;
    }

    setStage('failed');
    onFatalError?.();
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // OpenLibrary and Archive.org sometimes return a 1x1 blank GIF when a cover does not exist
    if (img.naturalWidth <= 2 || img.naturalHeight <= 2) {
      advanceStage();
    }
  };

  if (stage === 'failed') {
    if (variant === 'wiki') {
      return null;
    }

    if (variant === 'book') {
      return (
        <div
          className={`w-14 sm:w-16 h-20 sm:h-22 rounded bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 border border-indigo-500/25 flex flex-col items-center justify-center p-1.5 text-center shrink-0 select-none overflow-hidden ${className}`}
          title={alt}
        >
          <BookOpen className="w-4 h-4 text-indigo-400/80 mb-1 shrink-0" />
          <span className="text-[9px] leading-tight font-medium text-slate-300 line-clamp-3 break-words">
            {alt}
          </span>
        </div>
      );
    }

    if (variant === 'podcast') {
      return (
        <div
          className={`w-14 h-14 rounded-lg bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/25 flex flex-col items-center justify-center p-1.5 text-center shrink-0 select-none overflow-hidden ${className}`}
          title={alt}
        >
          <Headphones className="w-4 h-4 text-emerald-400/80 mb-0.5 shrink-0" />
          <span className="text-[8px] uppercase tracking-wider font-semibold text-emerald-300/80 truncate max-w-full">
            {badgeText || 'Audio'}
          </span>
        </div>
      );
    }

    if (variant === 'video') {
      return (
        <div
          className={`w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-950 flex flex-col items-center justify-center p-3 text-center select-none overflow-hidden ${className}`}
          title={alt}
        >
          <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-1.5">
            <Play className="w-4 h-4 text-indigo-400 fill-indigo-400/30" />
          </div>
          <span className="text-[11px] font-medium text-slate-300 line-clamp-2 max-w-[90%]">
            {alt}
          </span>
        </div>
      );
    }

    return (
      <div
        className={`bg-gradient-to-br from-slate-900 via-slate-800/80 to-slate-950 border border-slate-700/40 flex flex-col items-center justify-center p-3 text-center select-none overflow-hidden ${className}`}
        title={alt}
      >
        <ImageIcon className="w-5 h-5 text-indigo-400/70 mb-1 shrink-0" />
        <span className="text-[10px] font-medium text-slate-300 line-clamp-2 max-w-[90%]">
          {alt}
        </span>
      </div>
    );
  }

  const activeUrl =
    stage === 'primary'
      ? cleanPrimary
      : stage === 'fallback'
      ? cleanFallback
      : `/api/image-proxy?url=${encodeURIComponent(cleanFallback || cleanPrimary)}`;

  return (
    <img
      src={activeUrl}
      alt=""
      aria-label={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onLoad={handleLoad}
      onError={advanceStage}
      className={className}
    />
  );
};
