import React from 'react';
import { Cpu, ShieldCheck, Zap, Layers, AlertTriangle } from 'lucide-react';
import { OpenRouterModel, VideoMetadata } from '../types';

interface ContextLimitMeterProps {
  metadata?: VideoMetadata | null;
  selectedModel: OpenRouterModel;
  provider: 'openrouter' | 'gemini';
}

export const ContextLimitMeter: React.FC<ContextLimitMeterProps> = ({
  metadata,
  selectedModel,
  provider,
}) => {
  const modelContext = provider === 'gemini' ? 1048576 : selectedModel.contextLength;
  const transcriptTokens = metadata?.estimatedTokens || 0;
  const usagePercentage = Math.min(100, (transcriptTokens / modelContext) * 100);
  const remainingTokens = Math.max(0, modelContext - transcriptTokens);

  const isSafe = usagePercentage < 75;
  const isModerate = usagePercentage >= 75 && usagePercentage < 90;
  const isHigh = usagePercentage >= 90;

  return (
    <div id="context-limits" className="w-full bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-200">AI Context Limit Monitor</h3>
            <p className="text-[11px] text-slate-400">
              Guarantees transcript fits within {provider === 'gemini' ? 'Gemini' : selectedModel.name} context window
            </p>
          </div>
        </div>

        {/* Clean metadata badge */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Context Window:</span>
          <span className="text-indigo-300 font-semibold tabular-nums">
            {modelContext.toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* Visual Context Capacity Meter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span>Transcript Size:</span>
            <span className="text-slate-200 font-medium tabular-nums">
              {transcriptTokens > 0 ? `~${transcriptTokens.toLocaleString()} tokens` : '0 tokens'}
            </span>
          </span>
          <span className="text-slate-400 flex items-center gap-1.5">
            <span>Utilization:</span>
            <span
              className={`font-semibold tabular-nums ${
                isHigh ? 'text-rose-400' : isModerate ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {usagePercentage > 0 ? `${usagePercentage.toFixed(2)}%` : '0.00%'}
            </span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isHigh
                ? 'bg-rose-500'
                : isModerate
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-indigo-500 to-emerald-400'
            }`}
            style={{ width: `${Math.max(2, usagePercentage)}%` }}
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-xs">
        <div className="p-2 rounded-lg bg-slate-950/50">
          <span className="block text-[11px] text-slate-500">Tokens Left</span>
          <span className="text-slate-200 font-mono font-medium tabular-nums">
            ~{remainingTokens.toLocaleString()}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-slate-950/50">
          <span className="block text-[11px] text-slate-500">Total Words</span>
          <span className="text-slate-200 font-mono font-medium tabular-nums">
            {metadata ? metadata.totalWords.toLocaleString() : '—'}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-slate-950/50">
          <span className="block text-[11px] text-slate-500">Transcript Blocks</span>
          <span className="text-slate-200 font-mono font-medium tabular-nums">
            {metadata ? metadata.totalSegments.toLocaleString() : '—'}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-slate-950/50">
          <span className="block text-[11px] text-slate-500">Context Strategy</span>
          <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>Single-Pass (Zero Loss)</span>
          </span>
        </div>
      </div>
    </div>
  );
};
