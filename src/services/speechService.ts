// Studio Neural Cloud TTS + Web Speech API service with Exact Hardware WordBoundary Alignment,
// Acoustic Waveform Fallback, 60fps hardware-locked word synchronization, and smooth auto-scroll.

export interface SpeechItem {
  id: number | string;
  text: string;
  label?: string;
  timestamp?: number;
  start?: number;
}

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isNatural: boolean;
  isDefault: boolean;
  isStudioCloud?: boolean;
  description?: string;
  nativeVoice?: SpeechSynthesisVoice | null;
}

export interface WordTiming {
  word: string;
  wordIndex: number;
  startSec: number;
  endSec: number;
}

export interface WordProgress {
  itemIndex: number;
  wordIndex: number;
  word: string;
  totalWords: number;
  words: string[];
}

interface PreparedCloudAudio {
  audioBlobUrl: string;
  durationSec: number;
  wordTimings: WordTiming[];
  words: string[];
}

type ItemStartListener = (index: number, item: SpeechItem) => void;
type StateChangeListener = (isPlaying: boolean, isPaused: boolean, currentIndex: number) => void;
type VoicesLoadedListener = (voices: VoiceOption[]) => void;
type WordBoundaryListener = (progress: WordProgress) => void;
type AutoScrollListener = (autoScroll: boolean) => void;

export const STUDIO_CLOUD_VOICES: VoiceOption[] = [
  {
    voiceURI: 'studio:gemini:Kore',
    name: 'Kore — Studio Executive (US Female)',
    lang: 'en-US',
    isNatural: true,
    isDefault: true,
    isStudioCloud: true,
    description: 'Clear, authoritative American executive narration',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gemini:Charon',
    name: 'Charon — Documentary Anchor (UK/Intl Male)',
    lang: 'en-GB',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Deep, composed documentary and research narration',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gemini:Puck',
    name: 'Puck — Dynamic Presenter (US/Intl Male)',
    lang: 'en-US',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Engaging, articulate technical keynote delivery',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gemini:Aoede',
    name: 'Aoede — Warm Analytical (US Female)',
    lang: 'en-US',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Smooth, conversational briefing and literature review',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gemini:Fenrir',
    name: 'Fenrir — Broadcast Narrator (IE/UK Male)',
    lang: 'en-IE',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Resonant, formal broadcast reading voice',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gemini:Zephyr',
    name: 'Zephyr — Crisp Editorial (US Female)',
    lang: 'en-US',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Fast-paced, high-clarity editorial voice',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-US-Journey-D',
    name: 'Marcus — Cloud Journey (US Male)',
    lang: 'en-US',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Deep long-form narration voice',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-US-Steffan',
    name: 'Steffan — Technical Keynote (US Male)',
    lang: 'en-US',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Crisp, fast-paced engineering & research lecturer',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-US-Emma',
    name: 'Emma — Conversational Host (US Female)',
    lang: 'en-US',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Warm, ultra-natural multilingual podcast narrator',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-GB-Neural2-B',
    name: 'Arthur — British Broadcast (UK Male)',
    lang: 'en-GB',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Formal British English neural voice',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-GB-Neural2-A',
    name: 'Eleanor — British Editorial (UK Female)',
    lang: 'en-GB',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Crisp British English academic voice',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-GB-Libby',
    name: 'Libby — London Documentary (UK Female)',
    lang: 'en-GB',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Expressive British storytelling and synthesis voice',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-AU-Neural2-B',
    name: 'Liam — Australian Briefing (AU Male)',
    lang: 'en-AU',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Natural Australian English neural narrator',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-AU-Natasha',
    name: 'Natasha — Sydney Academic (AU Female)',
    lang: 'en-AU',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Bright, articulate Australian English narrator',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-CA-Clara',
    name: 'Clara — Canadian Broadcast (CA Female)',
    lang: 'en-CA',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Balanced North American broadcast narration',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-IE-Emily',
    name: 'Emily — Dublin Editorial (IE Female)',
    lang: 'en-IE',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Warm, melodic Irish English research narrator',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-IN-Neural2-D',
    name: 'Aarav — Indian Executive (IN Male)',
    lang: 'en-IN',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Clear Indian English professional voice',
    nativeVoice: null,
  },
  {
    voiceURI: 'studio:gcloud:en-IN-Neural2-A',
    name: 'Ananya — Indian Editorial (IN Female)',
    lang: 'en-IN',
    isNatural: true,
    isDefault: false,
    isStudioCloud: true,
    description: 'Articulate Indian English neural voice',
    nativeVoice: null,
  },
];

export function tokenizeSpeechWords(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function getWordPhoneticProfile(rawWord: string): {
  spokenWeight: number;
  pauseWeight: number;
  pauseType: 'none' | 'minor' | 'medium' | 'strong';
} {
  const trimmed = rawWord.trim();
  let pauseType: 'none' | 'minor' | 'medium' | 'strong' = 'none';
  let pauseWeight = 0;

  if (/[.!?]+['"”’)\]]*$/.test(trimmed)) {
    pauseType = 'strong';
    pauseWeight = 3.4;
  } else if (/[:;—–]+['"”’)\]]*$/.test(trimmed)) {
    pauseType = 'strong';
    pauseWeight = 2.6;
  } else if (/[,)\]]+['"”’]*$/.test(trimmed)) {
    pauseType = 'medium';
    pauseWeight = 1.6;
  }

  const core = trimmed.replace(/^[^a-zA-Z0-9$%]+|[^a-zA-Z0-9%]+$/g, '');
  if (!core) {
    return { spokenWeight: 0.5, pauseWeight, pauseType };
  }

  let syllables = 0;

  const digitMatches = core.match(/\d+/g);
  if (digitMatches) {
    for (const d of digitMatches) {
      if (d.length === 4 && (d.startsWith('19') || d.startsWith('20'))) {
        syllables += 4.2;
      } else {
        syllables += Math.max(1.5, d.length * 1.45);
      }
    }
  }

  if (core.includes('%')) syllables += 2.0;
  if (core.includes('$')) syllables += 1.8;

  const alpha = core.replace(/[^a-zA-Z]/g, '');
  if (alpha.length > 0) {
    if (alpha.length >= 2 && alpha.length <= 5 && alpha === alpha.toUpperCase() && !/^[AEIOU]+$/.test(alpha)) {
      syllables += alpha.length * 1.15;
    } else {
      const lower = alpha.toLowerCase();
      const withoutSilentE = lower.length > 3 ? lower.replace(/e$/, '') : lower;
      const vowelGroups = withoutSilentE.match(/[aeiouy]+/g);
      const count = vowelGroups ? vowelGroups.length : 1;
      syllables += Math.max(1, count);
    }
  }

  const lowerCore = core.toLowerCase();
  const isFastFunctionWord = /^(a|an|the|to|of|in|on|at|by|for|is|be|as|or|if|it)$/.test(lowerCore);
  const baseWeight = isFastFunctionWord
    ? 0.65
    : Math.max(0.85, syllables * 0.72 + Math.min(8, core.length) * 0.09);

  return {
    spokenWeight: baseWeight,
    pauseWeight,
    pauseType,
  };
}

function normTokenForSync(s: string): string {
  return s.replace(/[^a-zA-Z0-9&%$]/g, '').toLowerCase();
}

/**
 * Aligns UI whitespace-separated words (`uiWords`) with hardware `WordBoundary` events emitted by the neural TTS engine.
 * Handles multi-word subtitle phrases (e.g. "in 2005"), compound slash/hyphen tokens (e.g. "AI/ML"), and standalone punctuation ("—").
 */
function alignUiWordsToNeuralBoundaries(
  uiWords: string[],
  rawBoundaries: Array<{ text: string; startSec: number; endSec: number }>
): WordTiming[] {
  if (uiWords.length === 0) return [];

  // 1. Expand any multi-word boundary item (e.g. "in 2005") into per-word items weighted by phonetic length
  const expandedSubs: Array<{ startSec: number; endSec: number; text: string; norm: string }> = [];
  for (const b of rawBoundaries) {
    const startSec = Math.max(0, Number(b.startSec) || 0);
    const endSec = Math.max(startSec + 0.01, Number(b.endSec) || startSec + 0.08);
    const parts = String(b.text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length <= 1) {
      const n = normTokenForSync(b.text || '');
      if (n) {
        expandedSubs.push({ startSec, endSec, text: b.text, norm: n });
      }
    } else {
      const weights = parts.map((p) => getWordPhoneticProfile(p).spokenWeight);
      const totalW = weights.reduce((acc, w) => acc + w, 0) || 1;
      let cur = startSec;
      for (let i = 0; i < parts.length; i++) {
        const dur = (endSec - startSec) * (weights[i] / totalW);
        const n = normTokenForSync(parts[i]);
        if (n) {
          expandedSubs.push({ startSec: cur, endSec: cur + dur, text: parts[i], norm: n });
        }
        cur += dur;
      }
    }
  }

  if (expandedSubs.length === 0) return [];

  // 2. Map every UI word token to its exact neural boundary interval
  let subPtr = 0;
  const aligned: WordTiming[] = [];

  for (let i = 0; i < uiWords.length; i++) {
    const w = uiWords[i];
    const uNorm = normTokenForSync(w);

    // Standalone punctuation token (e.g. "—", "-", "•")
    if (!uNorm) {
      const prevEnd = aligned.length > 0 ? aligned[aligned.length - 1].endSec : 0;
      const nextStart = subPtr < expandedSubs.length ? expandedSubs[subPtr].startSec : prevEnd + 0.08;
      aligned.push({
        word: w,
        wordIndex: i,
        startSec: prevEnd,
        endSec: Math.max(prevEnd, nextStart),
      });
      continue;
    }

    // Direct 1-to-1 match
    if (subPtr < expandedSubs.length && expandedSubs[subPtr].norm === uNorm) {
      aligned.push({
        word: w,
        wordIndex: i,
        startSec: expandedSubs[subPtr].startSec,
        endSec: expandedSubs[subPtr].endSec,
      });
      subPtr++;
      continue;
    }

    // Compound UI token split across multiple neural boundaries (e.g. "AI/ML" -> "ai" + "ml")
    if (subPtr < expandedSubs.length && uNorm.startsWith(expandedSubs[subPtr].norm)) {
      let concat = '';
      const startS = expandedSubs[subPtr].startSec;
      let endS = expandedSubs[subPtr].endSec;
      let k = subPtr;
      while (k < expandedSubs.length && (concat + expandedSubs[k].norm).length <= uNorm.length + 2) {
        concat += expandedSubs[k].norm;
        endS = expandedSubs[k].endSec;
        k++;
        if (concat === uNorm) break;
      }
      subPtr = k;
      aligned.push({
        word: w,
        wordIndex: i,
        startSec: startS,
        endSec: endS,
      });
      continue;
    }

    // Lookahead up to 5 tokens in expandedSubs to re-anchor if any symbol was skipped/expanded
    let foundIdx = -1;
    for (let look = 1; look <= 5 && subPtr + look < expandedSubs.length; look++) {
      if (expandedSubs[subPtr + look].norm === uNorm) {
        foundIdx = subPtr + look;
        break;
      }
    }
    if (foundIdx !== -1) {
      aligned.push({
        word: w,
        wordIndex: i,
        startSec: expandedSubs[foundIdx].startSec,
        endSec: expandedSubs[foundIdx].endSec,
      });
      subPtr = foundIdx + 1;
      continue;
    }

    // Lookahead in uiWords (in case a UI token was silent and next UI word matches current subPtr)
    if (
      i + 1 < uiWords.length &&
      subPtr < expandedSubs.length &&
      normTokenForSync(uiWords[i + 1]) === expandedSubs[subPtr].norm
    ) {
      const prevEnd = aligned.length > 0 ? aligned[aligned.length - 1].endSec : 0;
      const nextStart = expandedSubs[subPtr].startSec;
      aligned.push({
        word: w,
        wordIndex: i,
        startSec: prevEnd,
        endSec: Math.max(prevEnd, nextStart),
      });
      continue;
    }

    // Fallback 1-to-1 step
    if (subPtr < expandedSubs.length) {
      aligned.push({
        word: w,
        wordIndex: i,
        startSec: expandedSubs[subPtr].startSec,
        endSec: expandedSubs[subPtr].endSec,
      });
      subPtr++;
    } else {
      const prevEnd = aligned.length > 0 ? aligned[aligned.length - 1].endSec : 0;
      aligned.push({
        word: w,
        wordIndex: i,
        startSec: prevEnd,
        endSec: prevEnd + 0.12,
      });
    }
  }

  return aligned;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeMonoSamplesToWavBlobUrl(samples: Float32Array, sampleRate: number): string {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function alignWordsToSamples(
  words: string[],
  samples: Float32Array,
  sampleRate: number,
  wordIndexOffset: number,
  timeOffsetSec: number
): WordTiming[] {
  const totalDuration = samples.length / sampleRate;
  if (words.length === 0) return [];
  if (words.length === 1) {
    return [
      {
        word: words[0],
        wordIndex: wordIndexOffset,
        startSec: timeOffsetSec,
        endSec: timeOffsetSec + totalDuration,
      },
    ];
  }

  const frameSec = 0.005;
  const frameSamples = Math.max(1, Math.floor(sampleRate * frameSec));
  const numFrames = Math.max(1, Math.floor(samples.length / frameSamples));
  const rms = new Float32Array(numFrames);

  let peakRms = 0;
  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSamples;
    const end = Math.min(samples.length, start + frameSamples);
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      const v = samples[i];
      sumSq += v * v;
    }
    const val = Math.sqrt(sumSq / Math.max(1, end - start));
    rms[f] = val;
    if (val > peakRms) peakRms = val;
  }

  const silenceThreshold = Math.max(0.006, peakRms * 0.06);

  let firstActiveFrame = 0;
  for (let f = 0; f < numFrames - 2; f++) {
    if (rms[f] > silenceThreshold && rms[f + 1] > silenceThreshold) {
      firstActiveFrame = Math.max(0, f - 1);
      break;
    }
  }

  let lastActiveFrame = numFrames - 1;
  for (let f = numFrames - 1; f >= 2; f--) {
    if (rms[f] > silenceThreshold && rms[f - 1] > silenceThreshold) {
      lastActiveFrame = Math.min(numFrames - 1, f + 1);
      break;
    }
  }

  if (lastActiveFrame <= firstActiveFrame + 4) {
    firstActiveFrame = 0;
    lastActiveFrame = numFrames - 1;
  }

  const profiles = words.map(getWordPhoneticProfile);
  const spanLen = Math.max(1, lastActiveFrame - firstActiveFrame + 1);
  const cumEnergy = new Float32Array(spanLen);
  let energySum = 0;
  for (let i = 0; i < spanLen; i++) {
    const f = firstActiveFrame + i;
    const e = rms[f] > silenceThreshold ? Math.pow(rms[f], 0.4) + 0.22 : 0.08;
    energySum += e;
    cumEnergy[i] = energySum;
  }
  if (energySum <= 0) energySum = 1;

  let totalWeight = 0;
  const weights: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = profiles[i].spokenWeight + (i < words.length - 1 ? profiles[i].pauseWeight * 0.45 : 0);
    weights.push(w);
    totalWeight += w;
  }
  if (totalWeight <= 0) totalWeight = 1;

  const timings: WordTiming[] = [];
  let runningW = 0;
  let prevEndSec = timeOffsetSec + firstActiveFrame * frameSec;

  for (let i = 0; i < words.length; i++) {
    runningW += weights[i];
    const ratio = i === words.length - 1 ? 1.0 : runningW / totalWeight;
    const targetE = ratio * energySum;
    let lo = 0;
    let hi = spanLen - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumEnergy[mid] < targetE) lo = mid + 1;
      else hi = mid;
    }
    const endSec = Math.max(prevEndSec + 0.015, timeOffsetSec + (firstActiveFrame + lo) * frameSec);
    timings.push({
      word: words[i],
      wordIndex: wordIndexOffset + i,
      startSec: prevEndSec,
      endSec,
    });
    prevEndSec = endSec;
  }

  return timings;
}

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private voices: VoiceOption[] = [...STUDIO_CLOUD_VOICES];
  private selectedVoiceURI: string = STUDIO_CLOUD_VOICES[0].voiceURI;
  private rate: number = 1.0;
  private pitch: number = 1.0;
  private autoScroll: boolean = true;

  // Queue state
  private items: SpeechItem[] = [];
  private currentIndex: number = -1;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;

  // Word tracking state
  private currentWordIndex: number = -1;
  private currentWords: string[] = [];
  private currentWordTimings: WordTiming[] = [];
  private rafId: number | null = null;
  private boundaryEventFired: boolean = false;

  // Cloud audio element & pre-fetch cache
  private currentAudio: HTMLAudioElement | null = null;
  private preparedAudioCache: Map<string, Promise<PreparedCloudAudio | null>> = new Map();
  private playbackSessionId: number = 0;

  // Anti-garbage collection timer for Chrome Web Speech
  private keepAliveTimer: number | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  // Listeners
  private itemStartListeners: Set<ItemStartListener> = new Set();
  private stateChangeListeners: Set<StateChangeListener> = new Set();
  private voicesLoadedListeners: Set<VoicesLoadedListener> = new Set();
  private wordBoundaryListeners: Set<WordBoundaryListener> = new Set();
  private autoScrollListeners: Set<AutoScrollListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.initVoices();
      }

      const savedVoice = localStorage.getItem('open_transcript_voice');
      if (savedVoice) {
        this.selectedVoiceURI = savedVoice;
      }

      const savedRate = localStorage.getItem('open_transcript_rate');
      if (savedRate) this.rate = parseFloat(savedRate) || 1.0;

      const savedPitch = localStorage.getItem('open_transcript_pitch');
      if (savedPitch) this.pitch = parseFloat(savedPitch) || 1.0;

      const savedAutoScroll = localStorage.getItem('open_transcript_autoscroll');
      if (savedAutoScroll !== null) {
        this.autoScroll = savedAutoScroll === 'true';
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        this.audioCtx = new Ctx();
      }
    }
    return this.audioCtx;
  }

  private initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      const raw = this.synth?.getVoices() || [];

      const systemVoices: VoiceOption[] = raw.map((v) => {
        const lower = (v.name + ' ' + v.voiceURI).toLowerCase();
        const isNatural =
          lower.includes('natural') ||
          lower.includes('neural') ||
          lower.includes('google') ||
          lower.includes('samantha') ||
          lower.includes('daniel') ||
          lower.includes('karen') ||
          lower.includes('siri') ||
          lower.includes('premium') ||
          lower.includes('enhanced') ||
          lower.includes('online');

        return {
          voiceURI: v.voiceURI,
          name: v.name,
          lang: v.lang,
          isNatural,
          isDefault: v.default,
          isStudioCloud: false,
          nativeVoice: v,
        };
      });

      systemVoices.sort((a, b) => {
        if (a.isNatural && !b.isNatural) return -1;
        if (!a.isNatural && b.isNatural) return 1;
        if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
        if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
        return a.name.localeCompare(b.name);
      });

      this.voices = [...STUDIO_CLOUD_VOICES, ...systemVoices];

      if (!this.selectedVoiceURI || !this.voices.some((v) => v.voiceURI === this.selectedVoiceURI)) {
        this.selectedVoiceURI = STUDIO_CLOUD_VOICES[0].voiceURI;
      }

      this.voicesLoadedListeners.forEach((listener) => listener(this.voices));
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  public getVoices(): VoiceOption[] {
    return this.voices;
  }

  public getSelectedVoiceURI(): string {
    return this.selectedVoiceURI;
  }

  public setSelectedVoiceURI(uri: string) {
    this.selectedVoiceURI = uri;
    if (typeof window !== 'undefined') {
      localStorage.setItem('open_transcript_voice', uri);
    }
    if (this.isPlaying && !this.isPaused && this.currentIndex >= 0) {
      this.playCurrent();
    }
  }

  public getRate(): number {
    return this.rate;
  }

  public setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2.5, rate));
    if (typeof window !== 'undefined') {
      localStorage.setItem('open_transcript_rate', this.rate.toString());
    }
    if (this.currentAudio) {
      this.currentAudio.playbackRate = this.rate;
    } else if (this.isPlaying && !this.isPaused && this.currentIndex >= 0) {
      this.playCurrent();
    }
  }

  public getPitch(): number {
    return this.pitch;
  }

  public setPitch(pitch: number) {
    this.pitch = Math.max(0.5, Math.min(1.5, pitch));
    if (typeof window !== 'undefined') {
      localStorage.setItem('open_transcript_pitch', this.pitch.toString());
    }
  }

  public getAutoScroll(): boolean {
    return this.autoScroll;
  }

  public setAutoScroll(enabled: boolean) {
    this.autoScroll = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('open_transcript_autoscroll', String(enabled));
    }
    this.autoScrollListeners.forEach((l) => l(this.autoScroll));
  }

  public subscribeAutoScroll(listener: AutoScrollListener) {
    this.autoScrollListeners.add(listener);
    listener(this.autoScroll);
    return () => this.autoScrollListeners.delete(listener);
  }

  public subscribeItemStart(listener: ItemStartListener) {
    this.itemStartListeners.add(listener);
    return () => this.itemStartListeners.delete(listener);
  }

  public subscribeStateChange(listener: StateChangeListener) {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  public subscribeVoicesLoaded(listener: VoicesLoadedListener) {
    this.voicesLoadedListeners.add(listener);
    if (this.voices.length > 0) {
      listener(this.voices);
    }
    return () => this.voicesLoadedListeners.delete(listener);
  }

  public subscribeWordBoundary(listener: WordBoundaryListener) {
    this.wordBoundaryListeners.add(listener);
    if (this.isPlaying && this.currentWords.length > 0 && this.currentWordIndex >= 0) {
      listener({
        itemIndex: this.currentIndex,
        wordIndex: this.currentWordIndex,
        word: this.currentWords[this.currentWordIndex] || '',
        totalWords: this.currentWords.length,
        words: this.currentWords,
      });
    }
    return () => this.wordBoundaryListeners.delete(listener);
  }

  private notifyState() {
    this.stateChangeListeners.forEach((l) => l(this.isPlaying, this.isPaused, this.currentIndex));
  }

  private notifyWord(wordIdx: number) {
    if (wordIdx < 0 || wordIdx >= this.currentWords.length) return;
    this.currentWordIndex = wordIdx;
    const payload: WordProgress = {
      itemIndex: this.currentIndex,
      wordIndex: wordIdx,
      word: this.currentWords[wordIdx] || '',
      totalWords: this.currentWords.length,
      words: this.currentWords,
    };
    this.wordBoundaryListeners.forEach((l) => l(payload));
  }

  private cancelSyncLoop() {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = window.setInterval(() => {
      if (this.synth && this.isPlaying && !this.isPaused && !this.currentAudio) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 10000);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer != null) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.onplay = null;
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
  }

  /**
   * Fetches neural audio + hardware WordBoundary timestamps from /api/tts,
   * aligns every UI word token to its exact millisecond interval, and prepares a playable Blob URL.
   */
  private prepareCloudAudio(text: string, voiceURI: string, lang: string): Promise<PreparedCloudAudio | null> {
    const cacheKey = `${voiceURI}:${text.slice(0, 350)}:${text.length}`;
    if (this.preparedAudioCache.has(cacheKey)) {
      return this.preparedAudioCache.get(cacheKey)!;
    }

    const promise = (async (): Promise<PreparedCloudAudio | null> => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceName: voiceURI,
            lang,
            speakingRate: 1.0,
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.ok || !data?.audioBase64) return null;

        const words = tokenizeSpeechWords(text);
        const rawArrBuf = base64ToArrayBuffer(data.audioBase64);
        const ctx = this.getAudioContext();

        // Priority 1: Exact Hardware WordBoundary Timestamps from Neural Synthesizer (EdgeTTS)
        if (Array.isArray(data.wordBoundaries) && data.wordBoundaries.length > 0) {
          const exactTimings = alignUiWordsToNeuralBoundaries(words, data.wordBoundaries);
          if (exactTimings.length > 0) {
            // Convert to uncompressed WAV if AudioContext is available for zero-latency sample clock,
            // otherwise use direct MP3 Blob URL (both share the exact same 0.000s timeline).
            let audioBlobUrl = '';
            let durationSec = exactTimings[exactTimings.length - 1].endSec;
            if (ctx) {
              try {
                const audioBuf = await ctx.decodeAudioData(rawArrBuf.slice(0));
                audioBlobUrl = encodeMonoSamplesToWavBlobUrl(audioBuf.getChannelData(0), audioBuf.sampleRate);
                durationSec = audioBuf.duration;
              } catch {
                // fallback to direct MP3 blob below
              }
            }
            if (!audioBlobUrl) {
              const mp3Blob = new Blob([rawArrBuf], { type: data.mimeType || 'audio/mp3' });
              audioBlobUrl = URL.createObjectURL(mp3Blob);
            }
            return {
              audioBlobUrl,
              durationSec,
              wordTimings: exactTimings,
              words,
            };
          }
        }

        // Priority 2: Multi-chunk stream response with Acoustic Waveform Alignment per chunk
        if (ctx && Array.isArray(data.chunkItems) && data.chunkItems.length > 0) {
          const decodedBuffers: AudioBuffer[] = [];
          const allTimings: WordTiming[] = [];
          let runningWordOffset = 0;
          let runningTimeSec = 0;

          for (const chunkItem of data.chunkItems) {
            const chunkWords = tokenizeSpeechWords(chunkItem.text);
            if (chunkWords.length === 0) continue;
            const arrBuf = base64ToArrayBuffer(chunkItem.audioBase64);
            const audioBuf = await ctx.decodeAudioData(arrBuf.slice(0));
            const channelData = audioBuf.getChannelData(0);

            const chunkTimings = alignWordsToSamples(
              chunkWords,
              channelData,
              audioBuf.sampleRate,
              runningWordOffset,
              runningTimeSec
            );
            allTimings.push(...chunkTimings);
            decodedBuffers.push(audioBuf);
            runningWordOffset += chunkWords.length;
            runningTimeSec += audioBuf.duration;
          }

          if (decodedBuffers.length > 0) {
            const sampleRate = decodedBuffers[0].sampleRate;
            const totalSamples = decodedBuffers.reduce((acc, b) => acc + b.length, 0);
            const combinedSamples = new Float32Array(totalSamples);
            let offset = 0;
            for (const b of decodedBuffers) {
              combinedSamples.set(b.getChannelData(0), offset);
              offset += b.length;
            }
            const audioBlobUrl = encodeMonoSamplesToWavBlobUrl(combinedSamples, sampleRate);
            return {
              audioBlobUrl,
              durationSec: runningTimeSec,
              wordTimings: allTimings,
              words,
            };
          }
        }

        // Priority 3: Single WAV/MP3 buffer with Acoustic Waveform Alignment
        if (ctx) {
          const audioBuf = await ctx.decodeAudioData(rawArrBuf.slice(0));
          const channelData = audioBuf.getChannelData(0);
          const wordTimings = alignWordsToSamples(words, channelData, audioBuf.sampleRate, 0, 0);
          const audioBlobUrl = encodeMonoSamplesToWavBlobUrl(channelData, audioBuf.sampleRate);
          return {
            audioBlobUrl,
            durationSec: audioBuf.duration,
            wordTimings,
            words,
          };
        }
      } catch {
        // fallback handled by caller
      }
      return null;
    })();

    if (this.preparedAudioCache.size > 45) {
      const oldestKey = this.preparedAudioCache.keys().next().value;
      if (oldestKey) this.preparedAudioCache.delete(oldestKey);
    }
    this.preparedAudioCache.set(cacheKey, promise);
    return promise;
  }

  private prefetchNextItems(startIndex: number) {
    const selectedVoice = this.voices.find((v) => v.voiceURI === this.selectedVoiceURI);
    if (!selectedVoice?.isStudioCloud) return;
    for (let offset = 1; offset <= 2; offset++) {
      const idx = startIndex + offset;
      if (idx >= 0 && idx < this.items.length) {
        const nextText = this.items[idx]?.text?.trim();
        if (nextText) {
          this.prepareCloudAudio(nextText, selectedVoice.voiceURI, selectedVoice.lang).catch(() => {});
        }
      }
    }
  }

  public playItems(items: SpeechItem[], startIndex: number = 0) {
    if (items.length === 0) return;

    this.stop();
    this.items = items;
    this.currentIndex = Math.max(0, Math.min(items.length - 1, startIndex));
    this.isPlaying = true;
    this.isPaused = false;
    this.startKeepAlive();
    this.playCurrent();
  }

  public speakSingle(text: string, label: string = 'Narration') {
    this.playItems([{ id: 'single-' + Date.now(), text, label }]);
  }

  private async playCurrent() {
    if (!this.isPlaying || this.currentIndex < 0 || this.currentIndex >= this.items.length) {
      this.stop();
      return;
    }

    const sessionId = ++this.playbackSessionId;
    this.cancelSyncLoop();
    this.stopCurrentAudio();
    if (this.synth) {
      this.synth.cancel();
    }

    const currentItem = this.items[this.currentIndex];
    const textToSpeak = currentItem.text.trim();

    if (!textToSpeak) {
      this.currentIndex++;
      this.playCurrent();
      return;
    }

    this.currentWords = tokenizeSpeechWords(textToSpeak);
    this.currentWordIndex = 0;

    // Pre-fetch upcoming items immediately in parallel
    this.prefetchNextItems(this.currentIndex);

    const selectedVoice =
      this.voices.find((v) => v.voiceURI === this.selectedVoiceURI) || STUDIO_CLOUD_VOICES[0];

    // Path A: Studio Neural Cloud Voice with Exact Hardware WordBoundary Sync
    if (selectedVoice?.isStudioCloud) {
      const prepared = await this.prepareCloudAudio(
        textToSpeak,
        selectedVoice.voiceURI,
        selectedVoice.lang
      );

      if (sessionId !== this.playbackSessionId || !this.isPlaying) return;

      if (prepared && prepared.wordTimings.length > 0) {
        this.currentWordTimings = prepared.wordTimings;
        const audio = new Audio(prepared.audioBlobUrl);
        (audio as any).preservesPitch = true;
        audio.playbackRate = this.rate;
        this.currentAudio = audio;

        let lastMediaTime = 0;
        let lastPerfTime = performance.now();

        const syncLoop = () => {
          if (sessionId !== this.playbackSessionId || !this.isPlaying) return;

          if (this.currentAudio && !this.isPaused && !this.currentAudio.paused) {
            const rawMediaTime = this.currentAudio.currentTime;
            const now = performance.now();
            if (rawMediaTime !== lastMediaTime) {
              lastMediaTime = rawMediaTime;
              lastPerfTime = now;
            }

            // Do not advance past 0.000s before the OS audio output clock actually starts moving
            const subFrameDelta =
              rawMediaTime > 0
                ? Math.min(0.022, ((now - lastPerfTime) / 1000) * this.currentAudio.playbackRate)
                : 0;
            // Add 20ms visual paint lead compensation so highlight lands at the exact phoneme onset
            const lookupSec = rawMediaTime > 0 ? rawMediaTime + subFrameDelta + 0.02 : 0;

            const timings = this.currentWordTimings;
            if (timings.length > 0) {
              let lo = 0;
              let hi = timings.length - 1;
              let matchedIdx = 0;
              while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (timings[mid].startSec <= lookupSec) {
                  matchedIdx = mid;
                  lo = mid + 1;
                } else {
                  hi = mid - 1;
                }
              }
              if (matchedIdx !== this.currentWordIndex) {
                this.notifyWord(matchedIdx);
              }
            }
          }

          this.rafId = window.requestAnimationFrame(syncLoop);
        };

        audio.onplay = () => {
          if (sessionId !== this.playbackSessionId) return;
          lastMediaTime = audio.currentTime;
          lastPerfTime = performance.now();
          this.notifyState();
          this.itemStartListeners.forEach((l) => l(this.currentIndex, currentItem));
          this.notifyWord(0);
          this.cancelSyncLoop();
          this.rafId = window.requestAnimationFrame(syncLoop);
        };

        audio.onended = () => {
          if (sessionId !== this.playbackSessionId) return;
          this.cancelSyncLoop();
          if (this.currentWords.length > 0) {
            this.notifyWord(this.currentWords.length - 1);
          }
          if (this.isPlaying && !this.isPaused) {
            if (this.currentIndex + 1 < this.items.length) {
              this.currentIndex++;
              this.playCurrent();
            } else {
              this.stop();
            }
          }
        };

        audio.onerror = () => {
          if (sessionId !== this.playbackSessionId) return;
          this.cancelSyncLoop();
          this.playWithBrowserSynth(textToSpeak, currentItem, selectedVoice, sessionId);
        };

        try {
          if (!this.isPaused) {
            await audio.play();
          } else {
            this.notifyState();
            this.itemStartListeners.forEach((l) => l(this.currentIndex, currentItem));
            this.notifyWord(0);
          }
          return;
        } catch {
          this.cancelSyncLoop();
          this.stopCurrentAudio();
        }
      }
    }

    // Path B: Browser Web Speech API with character-offset boundary tracking + 60fps phonetic fallback
    this.playWithBrowserSynth(textToSpeak, currentItem, selectedVoice, sessionId);
  }

  private playWithBrowserSynth(
    textToSpeak: string,
    currentItem: SpeechItem,
    selectedVoice: VoiceOption,
    sessionId: number
  ) {
    if (!this.synth) {
      this.stop();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    this.currentUtterance = utterance;
    this.boundaryEventFired = false;

    if (selectedVoice?.nativeVoice) {
      utterance.voice = selectedVoice.nativeVoice;
    } else {
      const fallbackSystem = this.voices.find((v) => v.nativeVoice && v.lang.startsWith('en'));
      if (fallbackSystem?.nativeVoice) {
        utterance.voice = fallbackSystem.nativeVoice;
      }
    }

    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    const wordCharSpans: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const w of this.currentWords) {
      const idx = textToSpeak.indexOf(w, cursor);
      const start = idx >= 0 ? idx : cursor;
      const end = start + w.length;
      wordCharSpans.push({ start, end });
      cursor = end;
    }

    const profiles = this.currentWords.map(getWordPhoneticProfile);
    const cumulativeWeights: number[] = [];
    let totalWeight = 0;
    for (const p of profiles) {
      totalWeight += p.spokenWeight + p.pauseWeight * 0.55;
      cumulativeWeights.push(totalWeight);
    }
    if (totalWeight <= 0) totalWeight = 1;

    const estimatedDurationSec = Math.max(0.8, totalWeight / (3.15 * this.rate));
    let synthStartPerf = performance.now();
    let pausedAccumMs = 0;
    let lastPauseStart = 0;

    const startFallbackRaf = () => {
      const tick = () => {
        if (sessionId !== this.playbackSessionId || !this.isPlaying) return;
        if (this.isPaused) {
          if (lastPauseStart === 0) lastPauseStart = performance.now();
        } else {
          if (lastPauseStart !== 0) {
            pausedAccumMs += performance.now() - lastPauseStart;
            lastPauseStart = 0;
          }
          if (!this.boundaryEventFired) {
            const elapsedSec = (performance.now() - synthStartPerf - pausedAccumMs) / 1000;
            const ratio = Math.min(0.99, Math.max(0, elapsedSec / estimatedDurationSec));
            const targetW = ratio * totalWeight;
            let idx = cumulativeWeights.findIndex((cw) => cw >= targetW);
            if (idx === -1) idx = this.currentWords.length - 1;
            if (idx !== this.currentWordIndex) {
              this.notifyWord(idx);
            }
          }
        }
        this.rafId = window.requestAnimationFrame(tick);
      };
      this.cancelSyncLoop();
      this.rafId = window.requestAnimationFrame(tick);
    };

    utterance.onstart = () => {
      if (sessionId !== this.playbackSessionId) return;
      synthStartPerf = performance.now();
      this.notifyState();
      this.itemStartListeners.forEach((l) => l(this.currentIndex, currentItem));
      this.notifyWord(0);
      startFallbackRaf();
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (sessionId !== this.playbackSessionId) return;
      // Only lock onto native boundary events if they are word-level events (not a single sentence event at index 0)
      if (typeof event.charIndex === 'number' && (event.name === 'word' || event.charIndex > 0)) {
        if (event.charIndex > 0) {
          this.boundaryEventFired = true;
        }
        const cIdx = event.charIndex;
        let matched = 0;
        for (let i = 0; i < wordCharSpans.length; i++) {
          if (wordCharSpans[i].start <= cIdx + 1) {
            matched = i;
          } else {
            break;
          }
        }
        if (matched !== this.currentWordIndex) {
          this.notifyWord(matched);
        }
      }
    };

    utterance.onend = () => {
      if (sessionId !== this.playbackSessionId) return;
      this.cancelSyncLoop();
      if (this.currentWords.length > 0) {
        this.notifyWord(this.currentWords.length - 1);
      }
      if (this.isPlaying && !this.isPaused) {
        if (this.currentIndex + 1 < this.items.length) {
          this.currentIndex++;
          this.playCurrent();
        } else {
          this.stop();
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        return;
      }
      this.cancelSyncLoop();
      if (this.isPlaying && !this.isPaused) {
        if (this.currentIndex + 1 < this.items.length) {
          this.currentIndex++;
          this.playCurrent();
        } else {
          this.stop();
        }
      }
    };

    this.synth.speak(utterance);
  }

  public pause() {
    if (!this.isPlaying) return;
    if (this.currentAudio) {
      this.currentAudio.pause();
    } else if (this.synth) {
      this.synth.pause();
    }
    this.isPaused = true;
    this.stopKeepAlive();
    this.notifyState();
  }

  public resume() {
    if (!this.isPlaying) return;
    if (this.currentAudio) {
      this.currentAudio.play().catch(() => {});
    } else if (this.synth) {
      this.synth.resume();
    }
    this.isPaused = false;
    this.startKeepAlive();
    this.notifyState();
  }

  public togglePlayPause() {
    if (!this.isPlaying) return;
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  public stop() {
    this.playbackSessionId++;
    this.cancelSyncLoop();
    this.stopKeepAlive();
    this.stopCurrentAudio();
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentIndex = -1;
    this.currentWordIndex = -1;
    this.currentWords = [];
    this.currentWordTimings = [];
    this.notifyState();
  }

  public next() {
    if (!this.isPlaying) return;
    if (this.currentIndex + 1 < this.items.length) {
      this.currentIndex++;
      this.playCurrent();
    } else {
      this.stop();
    }
  }

  public previous() {
    if (!this.isPlaying) return;
    if (this.currentIndex - 1 >= 0) {
      this.currentIndex--;
      this.playCurrent();
    }
  }

  public jumpToIndex(index: number) {
    if (index >= 0 && index < this.items.length) {
      this.currentIndex = index;
      this.isPlaying = true;
      this.isPaused = false;
      this.startKeepAlive();
      this.playCurrent();
    }
  }

  public async previewVoice(
    voice: VoiceOption,
    sampleText: string = 'Welcome to OpenTranscript. Hardware word boundary alignment and neural narration are active.'
  ) {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.stopCurrentAudio();
      if (this.synth) this.synth.cancel();
    }

    if (voice.isStudioCloud) {
      const prepared = await this.prepareCloudAudio(sampleText, voice.voiceURI, voice.lang);
      if (prepared) {
        this.stopCurrentAudio();
        const audio = new Audio(prepared.audioBlobUrl);
        (audio as any).preservesPitch = true;
        audio.playbackRate = this.rate;
        this.currentAudio = audio;
        audio.play().catch(() => {});
        return;
      }
    }

    if (this.synth) {
      const testUtterance = new SpeechSynthesisUtterance(sampleText);
      if (voice.nativeVoice) {
        testUtterance.voice = voice.nativeVoice;
      }
      testUtterance.rate = this.rate;
      testUtterance.pitch = this.pitch;
      this.synth.speak(testUtterance);
    }
  }

  public getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentIndex: this.currentIndex,
      currentItem: this.items[this.currentIndex] || null,
      totalItems: this.items.length,
      selectedVoiceURI: this.selectedVoiceURI,
      rate: this.rate,
      pitch: this.pitch,
      autoScroll: this.autoScroll,
      currentWordIndex: this.currentWordIndex,
      currentWords: this.currentWords,
    };
  }
}

export const speechService = new SpeechService();
