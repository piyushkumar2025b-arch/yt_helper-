import React from 'react';
import { CheckCircle2, CircleDashed, AlertCircle, Sparkles, FileText, Cpu, Video, Check } from 'lucide-react';
import { WorkflowStep } from '../types';

interface ProgressWorkflowProps {
  steps: WorkflowStep[];
  currentStepId?: string;
}

export const ProgressWorkflow: React.FC<ProgressWorkflowProps> = ({ steps }) => {
  return (
    <div className="w-full bg-slate-900/60 rounded-xl border border-slate-800 p-3.5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {steps.map((step, idx) => {
          const isSuccess = step.status === 'success';
          const isRunning = step.status === 'running';
          const isError = step.status === 'error';
          const isIdle = step.status === 'idle';

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2.5 shrink-0 min-w-max">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono transition-all ${
                    isSuccess
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : isRunning
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 animate-pulse'
                      : isError
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {isSuccess ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : isRunning ? (
                    <CircleDashed className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  ) : isError ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="flex flex-col">
                  <span
                    className={`text-xs font-medium ${
                      isSuccess
                        ? 'text-slate-200'
                        : isRunning
                        ? 'text-indigo-300 font-semibold'
                        : isError
                        ? 'text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {step.detail}
                  </span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 w-6 sm:w-10 rounded shrink-0 transition-colors ${
                    isSuccess ? 'bg-emerald-500/40' : isRunning ? 'bg-indigo-500/30' : 'bg-slate-800'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
