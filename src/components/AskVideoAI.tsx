import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Loader2,
  Bookmark,
  Plus,
  Copy,
  Check,
  Volume2,
  Trash2,
} from 'lucide-react';
import { ChatMessage, ThemeId } from '../types';
import { APP_THEMES } from '../constants';
import { speechService } from '../services/speechService';

interface AskVideoAIProps {
  transcript: string;
  videoTitle: string;
  openRouterKey: string;
  selectedModelId: string;
  currentTheme?: ThemeId;
  onSeekToTimestamp?: (seconds: number) => void;
  onAppendToSummary?: (markdownText: string) => void;
  onSaveToList?: (item: {
    itemType: 'video' | 'summary' | 'book' | 'article' | 'note';
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }) => void;
}

const SUGGESTED_QUESTIONS = [
  'What is the main message of this video in plain English?',
  'What are the best stories or real-life examples shared here?',
  'What practical advice from this video can I actually use today?',
  'Did the speaker share any memorable quotes or surprising facts?',
  'Walk me through the video step by step with timestamps.',
  'What are the 5 biggest lessons worth remembering from this talk?',
];

function parseTimeToSeconds(timeStr: string): number | null {
  const parts = timeStr.replace(/[\[\]]/g, '').split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export const AskVideoAI: React.FC<AskVideoAIProps> = ({
  transcript,
  videoTitle,
  openRouterKey,
  selectedModelId,
  currentTheme = 'midnight',
  onSeekToTimestamp,
  onAppendToSummary,
  onSaveToList,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const handleSend = async (qText: string) => {
    const trimmed = qText.trim();
    if (!trimmed || isAsking || !transcript) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setIsAsking(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          transcript,
          title: videoTitle,
          openRouterKey,
          model: selectedModelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not get an answer right now.');
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong: ${e.message}` },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleCopyAnswer = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleListenAnswer = (text: string, idx: number) => {
    if (speakingIdx === idx) {
      speechService.stop();
      setSpeakingIdx(null);
    } else {
      speechService.stop();
      setSpeakingIdx(idx);
      speechService.speakSingle(text, `qa-${idx}`);
    }
  };

  // Extract timestamps like [04:12] from an AI answer so the user can click them directly
  const extractTimestamps = (text: string): string[] => {
    const matches = text.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g);
    if (!matches) return [];
    return Array.from(new Set(matches)).slice(0, 10);
  };

  if (!transcript) return null;

  return (
    <div className="w-full space-y-3">
      <div className={`pb-2 border-b ${themeConfig.borderLight} flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex items-center gap-2">
          <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
            Ask Anything About This Video
          </h2>
          <span className={`hidden md:inline text-[11px] ${themeConfig.textMuted}`}>
            · Plain-English answers with clickable timestamps
          </span>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              speechService.stop();
              setMessages([]);
            }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textMuted} hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors`}
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Question Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(question);
        }}
        className="flex items-center gap-2 max-w-2xl"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about what was said in the video..."
          className={`flex-1 px-3 py-1.5 text-xs rounded bg-slate-500/10 ${themeConfig.textPrimary} placeholder:opacity-40 focus:outline-none`}
          disabled={isAsking}
        />
        <button
          type="submit"
          disabled={!question.trim() || isAsking}
          className={`px-3 py-1.5 rounded ${themeConfig.primaryButton} disabled:opacity-40 transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap`}
        >
          {isAsking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
          <span>Ask</span>
        </button>
      </form>

      {/* Starter Questions */}
      <div className="space-y-1.5">
        <span className={`text-[11px] font-medium ${themeConfig.textMuted} block`}>
          {messages.length === 0 ? 'Quick questions:' : 'Ask another question:'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(q)}
              disabled={isAsking}
              className={`text-[11px] px-2.5 py-1 rounded bg-slate-500/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/15 transition-colors cursor-pointer text-left disabled:opacity-40`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Q&A Conversation Thread */}
      {messages.length > 0 && (
        <div className={`divide-y ${themeConfig.borderLight}`}>
          {messages.map((m, idx) => {
            const prevUserQuestion =
              m.role === 'assistant' && idx > 0 && messages[idx - 1]?.role === 'user'
                ? messages[idx - 1].content
                : 'Video Q&A Note';
            const foundTimestamps = m.role === 'assistant' ? extractTimestamps(m.content) : [];

            return (
              <div key={idx} className="py-4 first:pt-2 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[11px] font-semibold text-indigo-400">
                    {m.role === 'user' ? 'Question' : 'Answer'}
                  </div>

                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleListenAnswer(m.content, idx)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                          speakingIdx === idx
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`
                        }`}
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>{speakingIdx === idx ? 'Stop' : 'Listen'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyAnswer(m.content, idx)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                      >
                        {copiedIdx === idx ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                      </button>

                      {onAppendToSummary && (
                        <button
                          type="button"
                          onClick={() =>
                            onAppendToSummary(
                              `\n\n### Q&A: ${prevUserQuestion}\n\n${m.content}\n`
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                        >
                          <Plus className="w-3 h-3 text-indigo-400" />
                          <span>Add</span>
                        </button>
                      )}

                      {onSaveToList && (
                        <button
                          type="button"
                          onClick={() =>
                            onSaveToList({
                              itemType: 'note',
                              title: `Q: ${prevUserQuestion}`,
                              subtitle: videoTitle,
                              content: m.content,
                              notes: `Saved from Ask Anything on "${videoTitle}"`,
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                        >
                          <Bookmark className="w-3 h-3 text-indigo-400" />
                          <span>Save</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {m.role === 'user' ? (
                  <p className={`text-sm sm:text-base font-semibold ${themeConfig.textPrimary}`}>
                    {m.content}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className={`prose ${themeConfig.proseClass} max-w-none text-sm sm:text-base leading-relaxed`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>

                    {/* Clickable Timestamp Jump Buttons extracted from the answer */}
                    {foundTimestamps.length > 0 && onSeekToTimestamp && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className={`text-[11px] ${themeConfig.textMuted}`}>
                          Jump to moment in video:
                        </span>
                        {foundTimestamps.map((ts, tIdx) => {
                          const sec = parseTimeToSeconds(ts);
                          if (sec === null) return null;
                          return (
                            <button
                              key={tIdx}
                              type="button"
                              onClick={() => onSeekToTimestamp(sec)}
                              className="px-2 py-0.5 rounded font-mono text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 cursor-pointer transition-colors tabular-nums"
                            >
                              {ts}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isAsking && (
            <div className="py-6 flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Looking through the video for your answer...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
