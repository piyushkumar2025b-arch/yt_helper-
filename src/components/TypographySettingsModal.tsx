import React from 'react';
import {
  Type,
  X,
  Check,
  RotateCcw,
  Sparkles,
  AlignLeft,
  BookOpen,
} from 'lucide-react';
import { TypographyConfig, FontFamilyOption, FontSizeOption, LineHeightOption, ContentWidthOption, ThemeId } from '../types';
import { APP_THEMES } from '../constants';

interface TypographySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  typography: TypographyConfig;
  onChangeTypography: (config: TypographyConfig) => void;
  currentTheme?: ThemeId;
}

export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
  fontFamily: 'sans',
  fontSize: 'standard',
  lineHeight: 'normal',
  contentWidth: 'full',
};

const FONT_OPTIONS: Array<{
  id: FontFamilyOption;
  name: string;
  category: string;
  cssFamily: string;
  description: string;
}> = [
  {
    id: 'sans',
    name: 'Inter Sans',
    category: 'Modern Neo-Grotesque',
    cssFamily: "'Inter', system-ui, sans-serif",
    description: 'Crisp, highly legible modern sans-serif ideal for clean readability.',
  },
  {
    id: 'geometric',
    name: 'Space Grotesk',
    category: 'Contemporary Tech',
    cssFamily: "'Space Grotesk', sans-serif",
    description: 'Distinctive, futuristic tech feel with characterful geometry.',
  },
  {
    id: 'serif',
    name: 'Merriweather',
    category: 'Editorial Book Serif',
    cssFamily: "'Merriweather', Georgia, serif",
    description: 'Generous x-height, sturdy serifs, comfortable for long-form reading.',
  },
  {
    id: 'humanist',
    name: 'Lora',
    category: 'Literary Calligraphic Serif',
    cssFamily: "'Lora', Times New Roman, serif",
    description: 'Balanced contemporary serif with brushed curves and elegant warmth.',
  },
  {
    id: 'mono',
    name: 'JetBrains Mono',
    category: 'Technical Monospace',
    cssFamily: "'JetBrains Mono', monospace",
    description: 'High-precision developer typography with distinct glyphs.',
  },
];

const FONT_SIZES: Array<{ id: FontSizeOption; label: string; px: string }> = [
  { id: 'compact', label: 'Compact', px: '14px' },
  { id: 'standard', label: 'Standard', px: '16px' },
  { id: 'relaxed', label: 'Relaxed', px: '18px' },
  { id: 'spacious', label: 'Spacious', px: '20px' },
];

const LINE_HEIGHTS: Array<{ id: LineHeightOption; label: string; desc: string }> = [
  { id: 'tight', label: 'Compact', desc: '1.5x' },
  { id: 'normal', label: 'Balanced', desc: '1.75x' },
  { id: 'relaxed', label: 'Airy', desc: '2.0x' },
];

const WIDTHS: Array<{ id: ContentWidthOption; label: string; desc: string }> = [
  { id: 'focus', label: 'Focus Book', desc: 'Narrow' },
  { id: 'balanced', label: 'Balanced Editorial', desc: 'Standard' },
  { id: 'full', label: 'Full Span', desc: 'Wide' },
];

export const TypographySettingsModal: React.FC<TypographySettingsModalProps> = ({
  isOpen,
  onClose,
  typography,
  onChangeTypography,
  currentTheme = 'midnight',
}) => {
  if (!isOpen) return null;

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const activeFont = FONT_OPTIONS.find((f) => f.id === typography.fontFamily) || FONT_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl rounded-2xl border ${themeConfig.border} ${themeConfig.cardBg} shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 border-b ${themeConfig.borderLight} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${themeConfig.textPrimary} flex items-center gap-2`}>
                <span>Typography & Reading Customization</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                  Personalized
                </span>
              </h3>
              <p className={`text-xs ${themeConfig.textMuted} mt-0.5`}>
                Select reading fonts, sizing, and line height to match your reading style.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg ${themeConfig.cardBg} hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* 1. Font Family Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-bold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Font Family
              </label>
              <span className={`text-xs font-medium text-indigo-400`}>{activeFont.name}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FONT_OPTIONS.map((f) => {
                const isSelected = typography.fontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChangeTypography({ ...typography, fontFamily: f.id })}
                    style={{ fontFamily: f.cssFamily }}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? `${themeConfig.accentBg} ${themeConfig.accent} ring-2 ring-indigo-500 shadow-md`
                        : `${themeConfig.cardBg} ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} border ${themeConfig.border}`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{f.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <div className="text-[11px] opacity-75 font-sans mt-0.5">{f.category}</div>
                    <div className="text-[11px] opacity-60 font-sans mt-1 line-clamp-1">{f.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Font Sizing & Line Height Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-800/40">
            {/* Font Size */}
            <div className="space-y-2.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Text Size
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FONT_SIZES.map((size) => {
                  const isSelected = typography.fontSize === size.id;
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => onChangeTypography({ ...typography, fontSize: size.id })}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                        isSelected
                          ? `${themeConfig.accentBg} ${themeConfig.accent} border-indigo-500`
                          : `${themeConfig.cardBg} ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} border ${themeConfig.border}`
                      }`}
                    >
                      <div>{size.label}</div>
                      <div className={`text-[10px] font-mono opacity-60`}>{size.px}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Line Height */}
            <div className="space-y-2.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${themeConfig.textMuted}`}>
                Line Height
              </label>
              <div className="grid grid-cols-3 gap-2">
                {LINE_HEIGHTS.map((lh) => {
                  const isSelected = typography.lineHeight === lh.id;
                  return (
                    <button
                      key={lh.id}
                      type="button"
                      onClick={() => onChangeTypography({ ...typography, lineHeight: lh.id })}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all text-center ${
                        isSelected
                          ? `${themeConfig.accentBg} ${themeConfig.accent} border-indigo-500`
                          : `${themeConfig.cardBg} ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} border ${themeConfig.border}`
                      }`}
                    >
                      <div>{lh.label}</div>
                      <div className={`text-[10px] font-mono opacity-60`}>{lh.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Reading Column Width */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/40">
            <label className={`text-xs font-bold uppercase tracking-wider ${themeConfig.textMuted}`}>
              Reading Column Width
            </label>
            <div className="grid grid-cols-3 gap-2">
              {WIDTHS.map((w) => {
                const isSelected = typography.contentWidth === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onChangeTypography({ ...typography, contentWidth: w.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all text-center ${
                      isSelected
                        ? `${themeConfig.accentBg} ${themeConfig.accent} border-indigo-500`
                        : `${themeConfig.cardBg} ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} border ${themeConfig.border}`
                    }`}
                  >
                    <div>{w.label}</div>
                    <div className={`text-[10px] opacity-60`}>{w.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Typography Preview Box */}
          <div className={`p-4 rounded-xl border ${themeConfig.borderLight} bg-slate-900/60 space-y-2`}>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center justify-between">
              <span>Live Reading Preview ({activeFont.name})</span>
              <span>100% Responsive</span>
            </div>

            <div
              style={{
                fontFamily: activeFont.cssFamily,
                fontSize:
                  typography.fontSize === 'compact'
                    ? '14px'
                    : typography.fontSize === 'relaxed'
                    ? '18px'
                    : typography.fontSize === 'spacious'
                    ? '20px'
                    : '16px',
                lineHeight:
                  typography.lineHeight === 'tight'
                    ? '1.5'
                    : typography.lineHeight === 'relaxed'
                    ? '2.0'
                    : '1.75',
              }}
              className="space-y-2 pt-1 text-slate-200"
            >
              <h4 className="font-bold text-lg text-white">
                Connecting the Dots: The Art of Typography
              </h4>
              <p>
                "You cannot connect the dots looking forward; you can only connect them looking backwards. You have to trust that the dots will somehow connect in your future."
              </p>
              <div className="text-xs text-indigo-400 font-mono">
                [04:20] Calligraphy, variable typography, and proportional spacing.
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t ${themeConfig.borderLight} bg-slate-900/40 flex items-center justify-between`}>
          <button
            type="button"
            onClick={() => onChangeTypography(DEFAULT_TYPOGRAPHY)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer transition-colors`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Helper to get CSS inline styles based on typography configuration
 */
export function getTypographyStyles(config: TypographyConfig): React.CSSProperties {
  const fontMap: Record<FontFamilyOption, string> = {
    sans: "'Inter', system-ui, -apple-system, sans-serif",
    geometric: "'Space Grotesk', -apple-system, sans-serif",
    serif: "'Merriweather', Georgia, serif",
    humanist: "'Lora', Times New Roman, serif",
    mono: "'JetBrains Mono', Consolas, monospace",
  };

  const sizeMap: Record<FontSizeOption, string> = {
    compact: '14px',
    standard: '16px',
    relaxed: '18px',
    spacious: '20px',
  };

  const lineHeightMap: Record<LineHeightOption, string> = {
    tight: '1.5',
    normal: '1.75',
    relaxed: '2.0',
  };

  return {
    fontFamily: fontMap[config.fontFamily] || fontMap.sans,
    fontSize: sizeMap[config.fontSize] || sizeMap.standard,
    lineHeight: lineHeightMap[config.lineHeight] || lineHeightMap.normal,
  };
}

/**
 * Helper to get max-width class based on column setting
 */
export function getContentWidthClass(width: ContentWidthOption): string {
  switch (width) {
    case 'focus':
      return 'max-w-2xl mx-auto';
    case 'balanced':
      return 'max-w-4xl mx-auto';
    case 'full':
      return 'max-w-none';
    default:
      return 'max-w-4xl mx-auto';
  }
}
