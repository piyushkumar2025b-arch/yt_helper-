import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  ArrowDownCircle,
} from 'lucide-react';
import { speechService, WordProgress } from '../services/speechService';
import { APP_THEMES } from '../constants';
import { ThemeId } from '../types';

interface AudioNarrationBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  currentIndex: number;
  totalItems: number;
  currentLabel?: string;
  onOpenVoiceSettings: () => void;
  currentTheme?: ThemeId;
}

export const AudioNarrationBar: React.FC<AudioNarrationBarProps> = ({
  isPlaying,
  isPaused,
  currentIndex,
  totalItems,
  currentLabel,
  onOpenVoiceSettings,
  currentTheme = 'midnight',
}) => {
  const [wordProgress, setWordProgress] = useState<WordProgress | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(speechService.getAutoScroll());

  useEffect(() => {
    const unsubWord = speechService.subscribeWordBoundary((progress) => {
      setWordProgress(progress);
    });
    const unsubScroll = speechService.subscribeAutoScroll((enabled) => {
      setAutoScroll(enabled);
    });
    return () => {
      unsubWord();
      unsubScroll();
    };
  }, []);

  if (!isPlaying && !isPaused) return null;

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;
  const voices = speechService.getVoices();
  const selectedVoiceURI = speechService.getSelectedVoiceURI();
  const activeVoice = voices.find((v) => v.voiceURI === selectedVoiceURI);
  const rate = speechService.getRate();

  // Build a 7-word sliding teleprompter window around the current spoken word
  const words = wordProgress?.words || [];
  const activeWIdx = wordProgress?.wordIndex ?? -1;
  const windowStart = Math.max(0, activeWIdx - 3);
  const windowEnd = Math.min(words.length, windowStart + 8);
  const visibleWords = words.slice(windowStart, windowEnd);

  return (
    <div className="fixed bottom-5 inset-x-0 z-40 flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom-5 duration-300">
      <div
        className={`pointer-events-auto flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 px-4 py-2.5 rounded-2xl border ${themeConfig.border} ${themeConfig.cardBg} shadow-2xl backdrop-blur-md text-xs max-w-3xl w-full sm:w-auto`}
      >
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          {/* Animated Sound Wave */}
          <div className="flex items-center gap-1 shrink-0 text-indigo-400">
            <span
              className={`w-1 h-3 rounded-full bg-indigo-500 ${
                isPlaying && !isPaused ? 'animate-pulse' : 'opacity-40'
              }`}
            />
            <span
              className={`w-1 h-5 rounded-full bg-indigo-500 ${
                isPlaying && !isPaused ? 'animate-pulse delay-75' : 'opacity-40'
              }`}
            />
            <span
              className={`w-1 h-2 rounded-full bg-indigo-500 ${
                isPlaying && !isPaused ? 'animate-pulse delay-150' : 'opacity-40'
              }`}
            />
          </div>

          {/* Live Teleprompter & Section Progress */}
          <div className="flex flex-col min-w-[160px] max-w-[280px] truncate">
            {visibleWords.length > 0 ? (
              <div className="flex items-center gap-1 truncate py-0.5">
                {visibleWords.map((w, idx) => {
                  const globalIdx = windowStart + idx;
                  const isCurrentWord = globalIdx === activeWIdx;
                  return (
                    <span
                      key={globalIdx}
                      className={`transition-colors text-xs ${
                        isCurrentWord
                          ? 'bg-indigo-500 text-white font-bold px-1.5 py-0.2 rounded shadow-xs'
                          : globalIdx < activeWIdx
                          ? `${themeConfig.textPrimary} opacity-80`
                          : `${themeConfig.textMuted}`
                      }`}
                    >
                      {w}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className={`font-semibold truncate ${themeConfig.textPrimary}`}>
                {currentLabel || `Reading section ${currentIndex + 1}`}
              </span>
            )}
            <span className={`text-[10px] ${themeConfig.textMuted} truncate`}>
              Section {currentIndex + 1} of {totalItems}
              {wordProgress && wordProgress.totalWords > 0
                ? ` • Word ${wordProgress.wordIndex + 1}/${wordProgress.totalWords}`
                : ''}
            </span>
          </div>

          <div className={`hidden sm:block h-5 w-[1px] ${themeConfig.borderLight}`} />

          {/* Playback Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => speechService.previous()}
              disabled={currentIndex <= 0}
              className={`p-1.5 rounded-lg ${themeConfig.textMuted} hover:${themeConfig.textPrimary} disabled:opacity-30 cursor-pointer`}
              title="Previous section"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => speechService.togglePlayPause()}
              className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-md"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 ml-0.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => speechService.next()}
              disabled={currentIndex >= totalItems - 1}
              className={`p-1.5 rounded-lg ${themeConfig.textMuted} hover:${themeConfig.textPrimary} disabled:opacity-30 cursor-pointer`}
              title="Next section"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => speechService.stop()}
              className={`p-1.5 rounded-lg ${themeConfig.textMuted} hover:text-rose-400 cursor-pointer`}
              title="Stop reading"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        </div>

        <div className={`hidden sm:block h-5 w-[1px] ${themeConfig.borderLight}`} />

        {/* Auto-Scroll & Voice Selector Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => speechService.setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors cursor-pointer text-[11px] font-medium ${
              autoScroll
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-400'
                : `${themeConfig.borderLight} ${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
            }`}
            title="Toggle Automatic Word & Section Scrolling"
          >
            <ArrowDownCircle className="w-3 h-3 shrink-0" />
            <span>Auto-Scroll</span>
          </button>

          <button
            type="button"
            onClick={onOpenVoiceSettings}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${themeConfig.borderLight} hover:bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} transition-colors cursor-pointer text-[11px] truncate max-w-[165px]`}
            title="Change Neural Voice & Speed"
          >
            <Volume2 className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="truncate">
              {activeVoice?.name.split('—')[0].trim() || 'Kore'} ({rate}x)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
