import React, { useState, useEffect } from 'react';
import { X, Youtube, Key, Cookie, ShieldCheck, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { ThemeId } from '../types';
import { APP_THEMES } from '../constants';

interface YouTubeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeId;
  onSaved?: (key: string, cookies: string) => void;
}

export const YouTubeSettingsModal: React.FC<YouTubeSettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSaved,
}) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [cookies, setCookies] = useState<string>('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setApiKey(localStorage.getItem('youtube_api_key') || '');
      setCookies(localStorage.getItem('youtube_cookies') || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.sepia;

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      const cleanKey = apiKey.trim();
      const cleanCookies = cookies.trim();
      if (cleanKey) {
        localStorage.setItem('youtube_api_key', cleanKey);
      } else {
        localStorage.removeItem('youtube_api_key');
      }
      if (cleanCookies) {
        localStorage.setItem('youtube_cookies', cleanCookies);
      } else {
        localStorage.removeItem('youtube_cookies');
      }
      onSaved?.(cleanKey, cleanCookies);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    }
  };

  const handleTestKey = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest) {
      setTestStatus('error');
      setTestMessage('Please enter an API key to test.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Validating key with YouTube Data API v3...');
    try {
      let verified = false;
      let videoTitle = '';

      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=jNQXAC9IVRw&key=${encodeURIComponent(
            keyToTest
          )}`
        );
        const data = await res.json();
        if (res.ok && data?.items?.length) {
          verified = true;
          videoTitle = data.items[0]?.snippet?.title || 'YouTube Video';
        } else if (data?.error?.message) {
          throw new Error(data.error.message);
        }
      } catch (directErr: any) {
        // Fallback to testing via server route to bypass browser CORS or adblock
        const proxyRes = await fetch(`/api/youtube-details?videoId=jNQXAC9IVRw`, {
          headers: { 'x-youtube-api-key': keyToTest },
        });
        const proxyData = await proxyRes.json();
        if (proxyRes.ok && proxyData?.ok) {
          verified = true;
          videoTitle = proxyData?.title || 'YouTube Video';
        } else {
          throw new Error(proxyData?.error || directErr?.message || 'Invalid API key or YouTube Data API v3 is not enabled.');
        }
      }

      if (verified) {
        setTestStatus('success');
        setTestMessage(`Key verified! Connected to YouTube Data API (${videoTitle}).`);
        handleSave();
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err?.message || 'Network error testing API key.');
    }
  };

  const handleClear = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('youtube_api_key');
      localStorage.removeItem('youtube_cookies');
      setApiKey('');
      setCookies('');
      onSaved?.('', '');
      setTestStatus('idle');
      setTestMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-xl border ${themeConfig.border} ${themeConfig.cardBg} shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${themeConfig.border}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${themeConfig.textPrimary}`}>
                YouTube API &amp; yt-dlp Settings
              </h3>
              <p className={`text-xs ${themeConfig.textMuted}`}>
                Bypass bot verification and unlock live video data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg ${themeConfig.textMuted} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Option 1: YouTube API Key */}
          <div className={`p-4 rounded-lg border ${themeConfig.border} bg-slate-500/5 space-y-2.5`}>
            <div className="flex items-center justify-between">
              <label className={`font-semibold flex items-center gap-1.5 ${themeConfig.textPrimary}`}>
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Google / YouTube Data API v3 Key
              </label>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                Get API Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <p className={`text-[11px] ${themeConfig.textMuted}`}>
              Unlocks full YouTube Data API v3 power: live views/likes/comments stats, video tags &amp; topic taxonomy, audience discussions &amp; timestamp highlights, official caption tracks catalog, related presentations search, and playlist ingestion.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className={`flex-1 px-3 py-2 text-xs rounded-lg border ${themeConfig.border} bg-black/20 ${themeConfig.textPrimary} focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono`}
              />
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testStatus === 'testing' || !apiKey.trim()}
                className="px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0"
              >
                {testStatus === 'testing' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3 h-3" />
                )}
                Test
              </button>
            </div>
            {testMessage && (
              <p
                className={`text-[11px] ${
                  testStatus === 'success'
                    ? 'text-emerald-400'
                    : testStatus === 'error'
                    ? 'text-rose-400'
                    : themeConfig.textMuted
                }`}
              >
                {testMessage}
              </p>
            )}
          </div>

          {/* Option 2: yt-dlp Cookies */}
          <div className={`p-4 rounded-lg border ${themeConfig.border} bg-slate-500/5 space-y-2.5`}>
            <div className="flex items-center justify-between">
              <label className={`font-semibold flex items-center gap-1.5 ${themeConfig.textPrimary}`}>
                <Cookie className="w-3.5 h-3.5 text-orange-400" />
                YouTube Session Cookies (for yt-dlp)
              </label>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Bypasses Bot Block
              </span>
            </div>
            <p className={`text-[11px] ${themeConfig.textMuted}`}>
              Paste Netscape-formatted cookies (e.g. from the Chrome/Firefox extension &quot;Get cookies.txt LOCALLY&quot;) to allow yt-dlp to download subtitles for any bot-protected or age-restricted video.
            </p>
            <textarea
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1799999999&#9;SOCS&#9;..."
              rows={4}
              className={`w-full px-3 py-2 text-[11px] rounded-lg border ${themeConfig.border} bg-black/20 ${themeConfig.textPrimary} focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono`}
            />
          </div>

          {/* Fallback Info */}
          <div className="text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">💡 Built-in Automatic Fallbacks Active:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
              <li><strong>yt-dlp Engine:</strong> Uses official standalone binary with multi-language subtitle extraction</li>
              <li><strong>youtube-transcript:</strong> Android InnerTube player client with zero datacenter blocks</li>
              <li><strong>Description Chapters:</strong> Parses timestamped creator outlines directly into interactive segments</li>
              <li><strong>Google Gemini AI:</strong> Multimodal video speech transcription &amp; search grounding</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-t ${themeConfig.border} bg-slate-500/5`}>
          <button
            type="button"
            onClick={handleClear}
            className={`px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors cursor-pointer`}
          >
            Clear Credentials
          </button>
          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1.5 rounded text-xs ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
