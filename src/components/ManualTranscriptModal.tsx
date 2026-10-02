import React, { useState } from 'react';
import { X, Upload, FileText, Check, Link2 } from 'lucide-react';
import { parseAnyTranscriptFormat, formatTime } from '../utils/subtitleParser';
import { TranscriptSegment } from '../types';

interface ManualTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitManual: (text: string, title: string, customSegments?: TranscriptSegment[]) => void;
  onSubmitUrl?: (url: string) => void;
}

function parseXmlCaptionInBrowser(xmlText: string): TranscriptSegment[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const nodes = Array.from(doc.querySelectorAll('text, p'));
    const segments: TranscriptSegment[] = [];

    for (const el of nodes) {
      const text = (el.textContent || '')
        .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, '')
        .replace(/<\/?c(?:\.[^>]*)?>/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;

      const startAttr = el.getAttribute('start') ?? el.getAttribute('begin') ?? el.getAttribute('t') ?? '0';
      const durAttr = el.getAttribute('dur') ?? el.getAttribute('d') ?? '3';
      const isMs = el.hasAttribute('t') || el.hasAttribute('d');
      const startSec = isMs ? (parseFloat(startAttr) || 0) / 1000 : parseFloat(startAttr) || 0;
      const durSec = isMs ? (parseFloat(durAttr) || 3000) / 1000 : parseFloat(durAttr) || 3;

      segments.push({
        start: Math.round(startSec * 100) / 100,
        duration: Math.round(Math.max(0.5, durSec) * 100) / 100,
        text,
        formattedTime: formatTime(startSec),
      });
    }
    return segments;
  } catch {
    return [];
  }
}

export const ManualTranscriptModal: React.FC<ManualTranscriptModalProps> = ({
  isOpen,
  onClose,
  onSubmitManual,
  onSubmitUrl,
}) => {
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModalError(null);

    if (!titleInput) {
      setTitleInput(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setContentInput(text);
      }
    };
    reader.readAsText(file);
  };

  const handleFetchDirectUrl = async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;
    setModalError(null);

    if (onSubmitUrl && (trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be'))) {
      onSubmitUrl(trimmedUrl);
      onClose();
      return;
    }

    setIsFetchingUrl(true);
    try {
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl, title: titleInput.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.segments?.length) {
        throw new Error(data.error || 'Could not load transcript from that URL.');
      }
      onSubmitManual(
        data.fullText || data.segments.map((s: TranscriptSegment) => s.text).join(' '),
        titleInput.trim() || data.metadata?.title || 'Imported Transcript',
        data.segments
      );
      onClose();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to fetch URL.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentInput.trim()) return;
    setModalError(null);

    const trimmed = contentInput.trim();
    let segments: TranscriptSegment[] = [];

    if (trimmed.includes('<?xml') || trimmed.includes('<transcript') || trimmed.includes('<tt')) {
      segments = parseXmlCaptionInBrowser(trimmed);
    }

    if (segments.length === 0) {
      segments = parseAnyTranscriptFormat(trimmed, true);
    }

    const cleanTextToSummarize =
      segments.length > 0 ? segments.map((s) => s.text).join(' ') : trimmed;

    onSubmitManual(
      cleanTextToSummarize,
      titleInput.trim() || 'Custom Video / Uploaded Transcript',
      segments.length > 0 ? segments : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Universal Transcript Importer</h2>
              <p className="text-xs text-slate-400">
                Paste text, YouTube copy-paste timestamps, or upload .srt, .vtt, .json, .xml, .txt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {modalError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {modalError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Video / Presentation Title
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g., Tech Talk or Lecture Title"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Direct Subtitle / Video URL Import */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Import from YouTube or Direct Subtitle File URL (.srt, .vtt, .xml, .json, .txt)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://... (YouTube link or direct .vtt / .srt URL)"
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleFetchDirectUrl}
                disabled={!urlInput.trim() || isFetchingUrl}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 transition-colors cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{isFetchingUrl ? 'Fetching...' : 'Fetch URL'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Transcript Content (Any Format)
              </label>
              <label className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>Upload File (.srt, .vtt, .json, .xml, .txt, .md)</span>
                <input
                  type="file"
                  accept=".txt,.srt,.vtt,.json,.json3,.xml,.ttml,.md,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              rows={8}
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              placeholder="Paste raw transcript, YouTube copied transcript (with 0:00 timestamps), [MM:SS] lines, SRT/VTT subtitles, JSON3, XML, or lecture notes here..."
              className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 font-mono leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!contentInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Process & Summarize</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
