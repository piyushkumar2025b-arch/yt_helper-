import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Check, Link2, Loader2, Music, Radio } from 'lucide-react';
import { parseAnyTranscriptFormat, formatTime } from '../utils/subtitleParser';
import { TranscriptSegment, VideoMetadata } from '../types';

interface ManualTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitManual: (
    text: string,
    title: string,
    customSegments?: TranscriptSegment[],
    customMeta?: Partial<VideoMetadata>
  ) => void;
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
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fileReaderRef = useRef<FileReader | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      fileReaderRef.current?.abort();
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleClose = () => {
    fileReaderRef.current?.abort();
    abortControllerRef.current?.abort();
    onClose();
  };

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModalError(null);

    // Early file-size validation (BUG-051)
    const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_BYTES) {
      setModalError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 25 MB.`
      );
      return;
    }

    const baseTitle = file.name.replace(/\.[^/.]+$/, '');
    if (!titleInput) {
      setTitleInput(baseTitle);
    }

    const isAudioOrVideo =
      file.type.startsWith('audio/') ||
      file.type.startsWith('video/') ||
      /\.(mp3|wav|m4a|ogg|aac|flac|opus|mp4|webm)$/i.test(file.name);

    if (isAudioOrVideo) {
      setIsTranscribingAudio(true);
      const reader = new FileReader();
      fileReaderRef.current = reader;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      reader.onload = async (event) => {
        try {
          const dataUrl = event.target?.result as string;
          const base64Data = dataUrl.split(',')[1];
          const mimeType = file.type || (file.name.endsWith('.mp3') ? 'audio/mp3' : 'audio/wav');
          const localMediaUrl = URL.createObjectURL(file);

          const res = await fetch('/api/transcribe-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType,
              filename: file.name,
            }),
            signal: controller.signal,
          });
          const data = await res.json();
          if (!res.ok || !data.segments?.length) {
            throw new Error(data.error || 'Audio transcription returned no text.');
          }

          onSubmitManual(
            data.fullText || data.segments.map((s: TranscriptSegment) => s.text).join(' '),
            titleInput.trim() || baseTitle,
            data.segments,
            {
              sourceType: file.type.startsWith('video') ? 'direct_video' : 'direct_audio',
              mediaUrl: localMediaUrl,
              title: titleInput.trim() || baseTitle,
              durationSeconds: data.metadata?.durationSeconds,
            }
          );
          handleClose();
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          setModalError(err.message || 'Audio transcription failed. You can paste the text transcript below.');
        } finally {
          setIsTranscribingAudio(false);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    // Text / Subtitle files
    const reader = new FileReader();
    fileReaderRef.current = reader;
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

    if (onSubmitUrl) {
      onSubmitUrl(trimmedUrl);
      onClose();
      return;
    }

    setIsFetchingUrl(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const storedKey = typeof window !== 'undefined' ? localStorage.getItem('youtube_api_key') : null;
      if (storedKey) headers['x-youtube-api-key'] = storedKey;
      const storedCookies = typeof window !== 'undefined' ? localStorage.getItem('youtube_cookies') : null;
      if (storedCookies) headers['x-youtube-cookies'] = storedCookies;

      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: trimmedUrl, title: titleInput.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.segments?.length) {
        throw new Error(data.error || 'Could not load transcript from that URL.');
      }
      onSubmitManual(
        data.fullText || data.segments.map((s: TranscriptSegment) => s.text).join(' '),
        titleInput.trim() || data.metadata?.title || 'Imported Media',
        data.segments,
        data.metadata
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
      titleInput.trim() || 'Custom Document / Uploaded Transcript',
      segments.length > 0 ? segments : undefined
    );
    handleClose();
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
              <h2 className="text-sm font-semibold text-slate-100">Universal Media &amp; Transcript Importer</h2>
              <p className="text-xs text-slate-400">
                YouTube, Vimeo, TED, Podcasts, Audio/Video files, Subtitles &amp; Text
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
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

          {isTranscribingAudio && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-2.5 text-xs text-indigo-300 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
              <span>Transcribing spoken audio with timestamps using Gemini...</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Title / Presentation Name
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g., Tech Talk, Podcast Episode or Lecture Title"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Direct URL Import */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Import Any Media Link (YouTube, Vimeo, TED, Podcast RSS, Audio/Video stream, Web Article)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://... (YouTube, Vimeo, TED Talk, Podcast RSS, direct MP3/MP4)"
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
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-semibold text-slate-300">
                Transcript Content or Direct File Upload
              </label>
              <label className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>Upload Audio, Video or Subtitle File</span>
                <input
                  type="file"
                  accept=".txt,.srt,.vtt,.json,.json3,.xml,.ttml,.md,.csv,.mp3,.wav,.m4a,.ogg,.aac,.flac,.mp4,.webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              rows={7}
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              placeholder="Paste raw transcript, YouTube copied transcript (with 0:00 timestamps), [MM:SS] lines, SRT/VTT subtitles, JSON, XML, or notes here..."
              className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 font-mono leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!contentInput.trim() || isTranscribingAudio}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Process &amp; Summarize</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
