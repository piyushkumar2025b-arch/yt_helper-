import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Check, Sparkles, Cpu, KeyRound, Eye, EyeOff, Trash2 } from 'lucide-react';
import { OPENROUTER_MODELS } from '../constants';
import { OpenRouterModel, DetailLevel } from '../types';

interface OpenRouterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  openRouterKey: string;
  onSaveKey: (key: string) => void;
  selectedModel: OpenRouterModel;
  onSelectModel: (model: OpenRouterModel) => void;
  detailLevel: DetailLevel;
  onSelectDetailLevel: (level: DetailLevel) => void;
  provider: 'openrouter' | 'gemini';
  onSelectProvider: (provider: 'openrouter' | 'gemini') => void;
}

export const OpenRouterSettingsModal: React.FC<OpenRouterSettingsModalProps> = ({
  isOpen,
  onClose,
  openRouterKey,
  onSaveKey,
  selectedModel,
  onSelectModel,
  detailLevel,
  onSelectDetailLevel,
  provider,
  onSelectProvider,
}) => {
  const [draftKey, setDraftKey] = useState(openRouterKey || '');
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [configuredKeys, setConfiguredKeys] = useState<Record<string, boolean>>({});
  const [modelTab, setModelTab] = useState<'free' | 'all'>('free');

  useEffect(() => {
    setDraftKey(openRouterKey || '');
  }, [openRouterKey, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => {
        if (d?.configuredKeys) {
          setConfiguredKeys(d.configuredKeys);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKey(draftKey.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const activeKeyCount = Object.values(configuredKeys).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">AI Model &amp; Connected Sources</h2>
              <p className="text-xs text-slate-400">
                Choose how your summaries are written and configure OpenRouter or server APIs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Provider Toggle */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Writing Engine
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSelectProvider('gemini')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  provider === 'gemini'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-200">Gemini + Auto-Fallback</span>
                  {provider === 'gemini' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  Built-in Gemini, Groq, OpenAI, and Claude server fallback with zero setup.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onSelectProvider('openrouter')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  provider === 'openrouter'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-200">OpenRouter Models</span>
                  {provider === 'openrouter' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  Llama 3.3, DeepSeek V3/R1, Claude 3.5, and Qwen via OpenRouter API.
                </p>
              </button>
            </div>
          </div>

          {/* OpenRouter API Key Input & Model Selection */}
          {provider === 'openrouter' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="openrouter-api-key-input" className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    <span>OpenRouter API Key</span>
                  </label>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Get key at openrouter.ai
                  </a>
                </div>
                <div className="relative flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      id="openrouter-api-key-input"
                      type={showKey ? 'text' : 'password'}
                      value={draftKey}
                      onChange={(e) => setDraftKey(e.target.value)}
                      placeholder="sk-or-v1-... (stored in session only)"
                      autoComplete="off"
                      className="w-full px-3 py-2 pr-9 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {draftKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftKey('');
                        onSaveKey('');
                      }}
                      className="px-2.5 py-2 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer text-xs flex items-center gap-1"
                      title="Clear saved OpenRouter key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Saved in your browser&apos;s <code className="text-slate-300">sessionStorage</code> and sent securely to the server proxy. Free-tier models also work with the server&apos;s configured OpenRouter key if set.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Preferred Model
                  </label>
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setModelTab('free')}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        modelTab === 'free'
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Free Tier ({OPENROUTER_MODELS.filter((m) => m.isFree).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelTab('all')}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        modelTab === 'all'
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({OPENROUTER_MODELS.length})
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                  {(modelTab === 'free' ? OPENROUTER_MODELS.filter((m) => m.isFree) : OPENROUTER_MODELS).map((m) => {
                    const isSelected = selectedModel.id === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectModel(m)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-200">{m.name}</span>
                            {m.isFree ? (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                Free Tier
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                Paid (Requires Key)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {(m.contextLength / 1000).toFixed(0)}k context
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                          {m.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Detail Level */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              How much detail do you want?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'massive', title: 'Everything', desc: 'Complete walkthrough with every story, quote, and lesson' },
                { id: 'extensive', title: 'Detailed', desc: 'Clear chapters, examples, and practical takeaways' },
                { id: 'balanced', title: 'Normal', desc: 'Easy-to-read overview of the main points' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onSelectDetailLevel(lvl.id as DetailLevel)}
                  className={`p-2 rounded-xl border text-left cursor-pointer transition-colors ${
                    detailLevel === lvl.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                      : 'border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs font-semibold text-slate-200">{lvl.title}</span>
                  <span className="block text-[10px] text-slate-400 line-clamp-2 mt-0.5">{lvl.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Server Environment Keys Status */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Server Environment Keys ({activeKeyCount} active)</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Configured via Secrets / .env
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
              {Object.entries(configuredKeys).map(([keyName, isSet]) => (
                <div
                  key={keyName}
                  className={`px-2 py-1 rounded border flex items-center justify-between gap-1.5 truncate ${
                    isSet
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/40 text-slate-500'
                  }`}
                  title={keyName}
                >
                  <span className="font-mono truncate">{keyName.replace(/_API_KEY|_KEY|_TOKEN/g, '')}</span>
                  <span className="text-[10px] shrink-0">{isSet ? 'Active' : 'Optional'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-white" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{savedSuccess ? 'Done!' : 'Apply'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
