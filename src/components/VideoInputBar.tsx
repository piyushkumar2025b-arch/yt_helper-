import React, { useState, useRef, useEffect } from 'react';
import {
  Link2,
  X,
  Sparkles,
  Loader2,
  MoreHorizontal,
  FileText,
  Play,
  Check,
} from 'lucide-react';
import { SAMPLE_VIDEOS, SUMMARY_PRESETS, APP_THEMES } from '../constants';
import { SampleVideo, SummaryType, ThemeId } from '../types';

interface VideoInputBarProps {
  onSubmitUrl: (url: string) => void;
  isLoading: boolean;
  onOpenManualModal: () => void;
  currentUrl?: string;
  summaryType?: SummaryType;
  onChangeSummaryType?: (type: SummaryType) => void;
  currentTheme?: ThemeId;
}

export const VideoInputBar: React.FC<VideoInputBarProps> = ({
  onSubmitUrl,
  isLoading,
  onOpenManualModal,
  currentUrl = '',
  summaryType = 'massive',
  onChangeSummaryType,
  currentTheme = 'midnight',
}) => {
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  useEffect(() => {
    if (currentUrl) {
      setUrlInput(currentUrl);
    }
  }, [currentUrl]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim() && !isLoading) {
      onSubmitUrl(urlInput.trim());
    }
  };

  const handleSelectSample = (sample: SampleVideo) => {
    setUrlInput(sample.url);
    setIsMenuOpen(false);
    onSubmitUrl(sample.url);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none opacity-40">
            <Link2 className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste any YouTube video link..."
            className={`w-full pl-10 pr-10 py-3 text-sm rounded-xl ${themeConfig.inputBg} border ${themeConfig.inputBorder} ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-sans`}
            disabled={isLoading}
          />

          {urlInput && (
            <button
              type="button"
              onClick={() => setUrlInput('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={!urlInput.trim() || isLoading}
          className={`flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl ${themeConfig.primaryButton} transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Working...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Summarize</span>
            </>
          )}
        </button>

        {/* Quiet More Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-3 rounded-xl border ${themeConfig.border} ${themeConfig.secondaryButton} transition-colors cursor-pointer text-xs`}
            title="Samples & Custom Transcript"
          >
            <MoreHorizontal className="w-4 h-4 opacity-75" />
          </button>

          {isMenuOpen && (
            <div
              className={`absolute right-0 mt-2 w-64 rounded-xl border ${themeConfig.border} ${themeConfig.cardBg} shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 space-y-2`}
            >
              {/* Custom Transcript Upload */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenManualModal();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${themeConfig.textSecondary} hover:bg-slate-500/10 transition-colors cursor-pointer text-left`}
              >
                <FileText className="w-4 h-4 opacity-70" />
                <span>Paste Transcript Manually</span>
              </button>

              <div className={`border-t ${themeConfig.borderLight}`} />

              {/* Sample Videos */}
              <div>
                <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${themeConfig.textMuted}`}>
                  Try a Video
                </div>
                <div className="space-y-0.5 mt-1">
                  {SAMPLE_VIDEOS.slice(0, 3).map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${themeConfig.textSecondary} hover:bg-slate-500/10 transition-colors cursor-pointer text-left truncate`}
                    >
                      <span className="truncate pr-2">{sample.title.split('|')[0]}</span>
                      <Play className="w-3 h-3 opacity-50 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
