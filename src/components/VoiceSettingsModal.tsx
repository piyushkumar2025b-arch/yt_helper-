import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  Sparkles,
  Play,
  Check,
  Search,
  Download,
  ArrowDownCircle,
} from 'lucide-react';
import { speechService, VoiceOption } from '../services/speechService';
import { APP_THEMES } from '../constants';
import { ThemeId } from '../types';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme?: ThemeId;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme = 'midnight',
}) => {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedURI, setSelectedURI] = useState<string>('');
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'voices' | 'import'>('voices');
  const [filterType, setFilterType] = useState<'studio' | 'natural' | 'english' | 'all'>('studio');
  const [previewingURI, setPreviewingURI] = useState<string | null>(null);

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  useEffect(() => {
    setVoices(speechService.getVoices());
    setSelectedURI(speechService.getSelectedVoiceURI());
    setRate(speechService.getRate());
    setPitch(speechService.getPitch());
    setAutoScroll(speechService.getAutoScroll());

    const unsubVoices = speechService.subscribeVoicesLoaded((loaded) => {
      setVoices(loaded);
      setSelectedURI(speechService.getSelectedVoiceURI());
    });

    const unsubScroll = speechService.subscribeAutoScroll((enabled) => {
      setAutoScroll(enabled);
    });

    return () => {
      unsubVoices();
      unsubScroll();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectVoice = (uri: string) => {
    setSelectedURI(uri);
    speechService.setSelectedVoiceURI(uri);
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    speechService.setRate(newRate);
  };

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch);
    speechService.setPitch(newPitch);
  };

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    speechService.setAutoScroll(next);
  };

  const handlePreviewVoice = (v: VoiceOption, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewingURI(v.voiceURI);
    speechService.previewVoice(v);
    setTimeout(() => {
      setPreviewingURI(null);
    }, 3200);
  };

  const studioCount = voices.filter((v) => v.isStudioCloud).length;

  const filteredVoices = voices.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.lang.toLowerCase().includes(q) ||
      (v.description && v.description.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterType === 'studio') {
      return Boolean(v.isStudioCloud);
    }
    if (filterType === 'natural') {
      return v.isStudioCloud || v.isNatural || v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural');
    }
    if (filterType === 'english') {
      return v.lang.toLowerCase().startsWith('en');
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-2xl border ${themeConfig.border} ${themeConfig.cardBg} shadow-2xl overflow-hidden flex flex-col max-h-[85vh]`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${themeConfig.borderLight}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${themeConfig.textPrimary}`}>Studio Neural Voices &amp; Synchronized Narration</h2>
              <p className={`text-xs ${themeConfig.textMuted}`}>
                Select high-definition neural voices with live word tracking and auto-scroll
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 transition-colors cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={`flex border-b ${themeConfig.borderLight} px-5 text-xs font-medium`}>
          <button
            onClick={() => setActiveTab('voices')}
            className={`py-2.5 border-b-2 transition-colors cursor-pointer mr-6 ${
              activeTab === 'voices'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : `border-transparent ${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
            }`}
          >
            Select Voice ({voices.length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : `border-transparent ${themeConfig.textMuted} hover:${themeConfig.textPrimary}`
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>System Voice Setup Guide</span>
          </button>
        </div>

        {activeTab === 'voices' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Speed, Pitch & Auto-Scroll Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={themeConfig.textPrimary}>Reading Speed ({rate}x)</span>
                <div className="flex items-center gap-3">
                  <span className={themeConfig.textMuted}>Pitch ({pitch}x)</span>
                  <button
                    type="button"
                    onClick={handleToggleAutoScroll}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      autoScroll
                        ? 'bg-indigo-600 text-white'
                        : `${themeConfig.textMuted} bg-slate-500/10`
                    }`}
                  >
                    <ArrowDownCircle className="w-3 h-3" />
                    <span>Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Speed buttons */}
                <div className="flex items-center gap-1.5">
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRateChange(r)}
                      className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                        rate === r
                          ? `${themeConfig.accentBg} ${themeConfig.accent} font-bold`
                          : `${themeConfig.textMuted} hover:bg-slate-500/10`
                      }`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>

                {/* Pitch buttons */}
                <div className="flex items-center gap-1.5">
                  {[0.8, 1.0, 1.2].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePitchChange(p)}
                      className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                        pitch === p
                          ? `${themeConfig.accentBg} ${themeConfig.accent} font-bold`
                          : `${themeConfig.textMuted} hover:bg-slate-500/10`
                      }`}
                    >
                      {p === 1.0 ? 'Normal' : p < 1.0 ? 'Deep' : 'High'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="space-y-2.5 pt-2 border-t border-slate-700/20">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Studio Neural or system voices..."
                    className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl ${themeConfig.inputBg} border ${themeConfig.inputBorder} ${themeConfig.textPrimary} placeholder:opacity-40 outline-none`}
                  />
                </div>

                <div className="flex items-center gap-1 text-[11px] shrink-0">
                  <button
                    onClick={() => setFilterType('studio')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      filterType === 'studio'
                        ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                        : `${themeConfig.textMuted} hover:bg-slate-500/10`
                    }`}
                  >
                    Studio Neural ({studioCount})
                  </button>
                  <button
                    onClick={() => setFilterType('natural')}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      filterType === 'natural'
                        ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                        : `${themeConfig.textMuted} hover:bg-slate-500/10`
                    }`}
                  >
                    Natural HD
                  </button>
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      filterType === 'all'
                        ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                        : `${themeConfig.textMuted} hover:bg-slate-500/10`
                    }`}
                  >
                    All ({voices.length})
                  </button>
                </div>
              </div>

              {/* Voice List */}
              <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                {filteredVoices.length === 0 ? (
                  <div className={`py-8 text-center text-xs ${themeConfig.textMuted}`}>
                    No matching voices found. Switch filter to &ldquo;All&rdquo; or &ldquo;Studio Neural&rdquo;.
                  </div>
                ) : (
                  filteredVoices.map((v) => {
                    const isSelected = v.voiceURI === selectedURI;
                    const isPreviewing = previewingURI === v.voiceURI;

                    return (
                      <div
                        key={v.voiceURI}
                        onClick={() => handleSelectVoice(v.voiceURI)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? `${themeConfig.accentBg} border-indigo-500/50 ${themeConfig.textPrimary}`
                            : `border-transparent hover:bg-slate-500/5 ${themeConfig.textSecondary}`
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                          </div>

                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold truncate">{v.name}</span>
                              {v.isStudioCloud ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 shrink-0">
                                  Studio Neural
                                </span>
                              ) : v.isNatural ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 shrink-0">
                                  Natural HD
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 truncate">
                              <span className={`text-[10px] font-mono ${themeConfig.textMuted}`}>{v.lang}</span>
                              {v.description && (
                                <span className={`text-[10px] truncate ${themeConfig.textMuted}`}>
                                  &bull; {v.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Preview Audio Button */}
                        <button
                          type="button"
                          onClick={(e) => handlePreviewVoice(v, e)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                            isPreviewing
                              ? 'bg-indigo-600 text-white animate-pulse'
                              : `${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                          }`}
                          title="Preview Voice"
                        >
                          <Play className="w-3 h-3" />
                          <span>{isPreviewing ? 'Playing...' : 'Preview'}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: System Voice Setup Guide */}
        {activeTab === 'import' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs leading-relaxed">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-indigo-200">
                  12 Studio Neural Cloud Voices are already built-in and active:
                </p>
                <p className="text-[11px] text-indigo-300/80 mt-0.5">
                  Kore, Charon, Puck, Aoede, Fenrir, Zephyr, Marcus, Arthur, Eleanor, Liam, Aarav, and Ananya stream directly from the neural audio engine with synchronized word tracking. You can also install additional local OS voices below.
                </p>
              </div>
            </div>

            <div className={`divide-y ${themeConfig.borderLight}`}>
              <div className="py-3 first:pt-0 space-y-1.5">
                <h4 className={`font-semibold text-xs ${themeConfig.textPrimary}`}>
                  Windows (Microsoft Natural &amp; Neural Voices)
                </h4>
                <ol className={`list-decimal pl-4 space-y-1 text-[11px] ${themeConfig.textSecondary}`}>
                  <li>Open <strong>Settings</strong> &gt; <strong>Time &amp; Language</strong> &gt; <strong>Speech</strong>.</li>
                  <li>Under <strong>Manage voices</strong>, click <strong>Add voices</strong>.</li>
                  <li>Search for English and install <strong>Natural / Neural</strong> voices.</li>
                </ol>
              </div>

              <div className="py-3 space-y-1.5">
                <h4 className={`font-semibold text-xs ${themeConfig.textPrimary}`}>
                  macOS &amp; iOS (Siri &amp; Enhanced Voices)
                </h4>
                <ol className={`list-decimal pl-4 space-y-1 text-[11px] ${themeConfig.textSecondary}`}>
                  <li>Open <strong>System Settings</strong> &gt; <strong>Accessibility</strong> &gt; <strong>Spoken Content</strong>.</li>
                  <li>Click <strong>System Voice</strong> &gt; <strong>Manage Voices...</strong></li>
                  <li>Download <strong>Siri</strong>, <strong>Samantha (Enhanced)</strong>, or <strong>Daniel (Enhanced)</strong>.</li>
                </ol>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('voices')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer`}
              >
                Back to Voices
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`flex items-center justify-between px-5 py-3 border-t ${themeConfig.borderLight} text-xs`}>
          <span className={themeConfig.textMuted}>
            Active:{' '}
            <strong className={themeConfig.textPrimary}>
              {voices.find((v) => v.voiceURI === selectedURI)?.name || 'Studio Neural Voice'}
            </strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
