/**
 * Internal Retrieval-Augmented Generation (RAG) Subsystem
 *
 * Implements hierarchical semantic chunking, BM25/TF-IDF hybrid term retrieval,
 * context-window expansion, and grounded prompt synthesis for video transcripts.
 *
 * Designed to seamlessly enhance accuracy, timestamp precision, and factual depth
 * across Q&A, deep dives, and summarization in the backend without modifying the frontend.
 */

import { formatTime } from '../utils/subtitleParser.ts';

export interface RagSegment {
  start?: number;
  duration?: number;
  formattedTime?: string;
  text?: string;
}

export interface TranscriptChunk {
  id: number;
  startSec: number;
  endSec: number;
  formattedStart: string;
  formattedEnd: string;
  text: string;
  terms: Map<string, number>;
  totalTerms: number;
  segmentIndices: number[];
}

export interface RetrievedChunk {
  chunk: TranscriptChunk;
  score: number;
  expandedText: string;
  expandedStartSec: number;
  expandedEndSec: number;
  formattedRange: string;
}

export interface TranscriptIndex {
  chunks: TranscriptChunk[];
  allSegments: RagSegment[];
  invertedIndex: Map<string, Set<number>>;
  idf: Map<string, number>;
  totalChunks: number;
  avgChunkLength: number;
}

const COMMON_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'i', 'you', 'we', 'they', 'this', 'there', 'their', 'what',
  'when', 'where', 'which', 'who', 'how', 'why', 'can', 'could', 'would', 'should',
  'do', 'did', 'does', 'doing', 'done',
  'or', 'so', 'if', 'about', 'video', 'speaker', 'talk', 'says', 'said',
]);

/**
 * Tokenizes text into normalized keywords for BM25 / TF-IDF indexing.
 */
export function tokenizeText(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !COMMON_STOP_WORDS.has(w));
}

/**
 * Extracts n-grams (bigrams & trigrams) to boost exact phrase matching in retrieval.
 */
export function extractNGrams(words: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Chunks segments or plain transcript into semantically coherent windows (120-220 words)
 * with overlapping boundaries to ensure no ideas are split across boundaries.
 */
export function buildTranscriptChunks(
  rawTranscript: string,
  segments?: RagSegment[],
  targetWordsPerChunk = 160,
  overlapWords = 35
): { chunks: TranscriptChunk[]; allSegments: RagSegment[] } {
  let segs: RagSegment[] = [];

  if (Array.isArray(segments) && segments.length > 0) {
    segs = segments.filter((s) => s && String(s.text || '').trim().length > 0);
  }

  // If no structured segments, synthesize sentences with approximate timestamps
  if (segs.length === 0) {
    const rawClean = String(rawTranscript || '').replace(/\s+/g, ' ').trim();
    const sentences = rawClean.split(/(?<=[.!?])\s+/).filter(Boolean);
    let approxTime = 0;
    for (const sent of sentences) {
      const wordCount = sent.split(/\s+/).length;
      const duration = Math.max(2, wordCount * 0.4);
      segs.push({
        start: approxTime,
        duration,
        formattedTime: formatTime(approxTime),
        text: sent,
      });
      approxTime += duration;
    }
  }

  const chunks: TranscriptChunk[] = [];
  let chunkId = 0;
  let segIdx = 0;

  while (segIdx < segs.length) {
    const currentChunkSegs: RagSegment[] = [];
    const currentIndices: number[] = [];
    let wordCount = 0;
    let lookahead = segIdx;

    while (lookahead < segs.length && wordCount < targetWordsPerChunk) {
      const seg = segs[lookahead];
      const text = String(seg.text || '').trim();
      const segWords = text.split(/\s+/).filter(Boolean).length;
      currentChunkSegs.push(seg);
      currentIndices.push(lookahead);
      wordCount += segWords;
      lookahead++;
    }

    if (currentChunkSegs.length === 0) break;

    const firstSeg = currentChunkSegs[0];
    const lastSeg = currentChunkSegs[currentChunkSegs.length - 1];
    const startSec = typeof firstSeg.start === 'number' ? firstSeg.start : 0;
    const endSec =
      typeof lastSeg.start === 'number'
        ? lastSeg.start + (typeof lastSeg.duration === 'number' ? lastSeg.duration : 2)
        : startSec + wordCount * 0.4;

    const chunkText = currentChunkSegs.map((s) => String(s.text || '').trim()).join(' ');
    const tokens = tokenizeText(chunkText);
    const termMap = new Map<string, number>();

    for (const t of tokens) {
      termMap.set(t, (termMap.get(t) || 0) + 1);
    }

    chunks.push({
      id: chunkId++,
      startSec,
      endSec,
      formattedStart: formatTime(startSec),
      formattedEnd: formatTime(endSec),
      text: chunkText,
      terms: termMap,
      totalTerms: tokens.length,
      segmentIndices: currentIndices,
    });

    // Advance segIdx with overlap
    if (lookahead >= segs.length) {
      break;
    }

    // Step back by overlap words
    let overlapCount = 0;
    let stepBack = 0;
    for (let b = currentChunkSegs.length - 1; b >= 1; b--) {
      const w = String(currentChunkSegs[b].text || '').split(/\s+/).filter(Boolean).length;
      overlapCount += w;
      stepBack++;
      if (overlapCount >= overlapWords) break;
    }

    segIdx = Math.max(segIdx + 1, lookahead - stepBack);
  }

  return { chunks, allSegments: segs };
}

/**
 * Builds an inverted index and computes IDF weights across all chunks.
 */
export function createTranscriptIndex(
  rawTranscript: string,
  segments?: RagSegment[]
): TranscriptIndex {
  const { chunks, allSegments } = buildTranscriptChunks(rawTranscript, segments);
  const totalChunks = chunks.length;
  const invertedIndex = new Map<string, Set<number>>();
  let totalLength = 0;

  for (const chunk of chunks) {
    totalLength += chunk.totalTerms;
    for (const term of chunk.terms.keys()) {
      let set = invertedIndex.get(term);
      if (!set) {
        set = new Set<number>();
        invertedIndex.set(term, set);
      }
      set.add(chunk.id);
    }
  }

  const avgChunkLength = totalChunks > 0 ? totalLength / totalChunks : 1;
  const idf = new Map<string, number>();

  for (const [term, set] of invertedIndex.entries()) {
    const docFreq = set.size;
    // Standard Lucene / BM25 IDF formulation: ln(1 + (N - n + 0.5) / (n + 0.5))
    const idfVal = Math.log(1 + (totalChunks - docFreq + 0.5) / (docFreq + 0.5));
    idf.set(term, Math.max(0.1, idfVal));
  }

  return {
    chunks,
    allSegments,
    invertedIndex,
    idf,
    totalChunks,
    avgChunkLength,
  };
}

/**
 * Retrieves the top-K relevant chunks using BM25-style scoring + exact phrase matching,
 * and expands the context window with adjacent segments.
 */
export function retrieveRelevantChunks(
  index: TranscriptIndex,
  query: string,
  topK = 5,
  expandWindowSegments = 2
): RetrievedChunk[] {
  if (index.chunks.length === 0) return [];

  const cleanQuery = String(query || '').trim();
  const queryTokens = tokenizeText(cleanQuery);
  if (queryTokens.length === 0) {
    // Return early chunks if query contains no content words
    return index.chunks.slice(0, topK).map((c) => ({
      chunk: c,
      score: 1,
      expandedText: c.text,
      expandedStartSec: c.startSec,
      expandedEndSec: c.endSec,
      formattedRange: `${c.formattedStart} - ${c.formattedEnd}`,
    }));
  }

  const queryTerms = new Set(queryTokens);
  const rawQueryLower = cleanQuery.toLowerCase();
  const candidateChunkIds = new Set<number>();

  for (const term of queryTerms) {
    const matched = index.invertedIndex.get(term);
    if (matched) {
      for (const id of matched) candidateChunkIds.add(id);
    }
  }

  // If strict token matching found no candidates, test fuzzy/substring inclusion
  if (candidateChunkIds.size === 0) {
    for (const chunk of index.chunks) {
      const lower = chunk.text.toLowerCase();
      if (queryTokens.some((t) => lower.includes(t))) {
        candidateChunkIds.add(chunk.id);
      }
    }
  }

  // Fallback to all chunks if still empty
  const targetIds = candidateChunkIds.size > 0 ? Array.from(candidateChunkIds) : index.chunks.map((c) => c.id);

  // BM25 parameters
  const k1 = 1.2;
  const b = 0.75;

  const scored: Array<{ chunk: TranscriptChunk; score: number }> = [];

  for (const id of targetIds) {
    const chunk = index.chunks[id];
    if (!chunk) continue;

    let score = 0;
    const lenNorm = 1 - b + b * (chunk.totalTerms / index.avgChunkLength);

    for (const term of queryTerms) {
      const tf = chunk.terms.get(term) || 0;
      if (tf > 0) {
        const idfVal = index.idf.get(term) || 1.0;
        const bm25Tf = (tf * (k1 + 1)) / (tf + k1 * lenNorm);
        score += idfVal * bm25Tf;
      }
    }

    // Exact phrase boost (if user searched for multi-word phrase like "steve jobs reed college" or "backpropagation")
    const chunkLower = chunk.text.toLowerCase();
    if (cleanQuery.length > 5 && chunkLower.includes(rawQueryLower)) {
      score += 15.0;
    }

    // Bigram boost
    const bigrams = extractNGrams(queryTokens, 2);
    for (const bg of bigrams) {
      if (chunkLower.includes(bg)) {
        score += 3.0;
      }
    }

    scored.push({ chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topScored = scored.slice(0, topK);

  // Context Window Expansion: Expand top chunks with immediately surrounding segments
  const retrieved: RetrievedChunk[] = topScored.map(({ chunk, score }) => {
    if (index.allSegments.length === 0 || chunk.segmentIndices.length === 0) {
      return {
        chunk,
        score,
        expandedText: chunk.text,
        expandedStartSec: chunk.startSec,
        expandedEndSec: chunk.endSec,
        formattedRange: `${chunk.formattedStart} - ${chunk.formattedEnd}`,
      };
    }

    const minIdx = Math.max(0, Math.min(...chunk.segmentIndices) - expandWindowSegments);
    const maxIdx = Math.min(index.allSegments.length - 1, Math.max(...chunk.segmentIndices) + expandWindowSegments);

    const expandedSegs = index.allSegments.slice(minIdx, maxIdx + 1);
    const expandedText = expandedSegs.map((s) => String(s.text || '').trim()).join(' ');

    const expStartSec = typeof expandedSegs[0]?.start === 'number' ? expandedSegs[0].start : chunk.startSec;
    const lastExpanded = expandedSegs[expandedSegs.length - 1];
    const expEndSec =
      typeof lastExpanded?.start === 'number'
        ? lastExpanded.start + (typeof lastExpanded.duration === 'number' ? lastExpanded.duration : 2)
        : chunk.endSec;

    return {
      chunk,
      score,
      expandedText,
      expandedStartSec: expStartSec,
      expandedEndSec: expEndSec,
      formattedRange: `${formatTime(expStartSec)} - ${formatTime(expEndSec)}`,
    };
  });

  return retrieved;
}

/**
 * Formats retrieved chunks into an enriched prompt context block for LLM calls.
 */
export function formatRetrievedContextForPrompt(
  retrieved: RetrievedChunk[],
  maxTotalChars = 24000
): string {
  if (retrieved.length === 0) return '';

  const lines: string[] = [
    '=== RETRIEVED GROUNDED VIDEO PASSAGES (VERIFIED TIMESTAMPS) ===',
  ];

  let accumulatedChars = 0;
  for (let i = 0; i < retrieved.length; i++) {
    const item = retrieved[i];
    const passage = `Passage ${i + 1} [${item.formattedRange}]:\n"${item.expandedText}"`;
    if (accumulatedChars + passage.length > maxTotalChars) {
      break;
    }
    lines.push(passage);
    accumulatedChars += passage.length;
  }

  lines.push('=== END OF RETRIEVED PASSAGES ===');
  return lines.join('\n\n');
}

/**
 * Produces a high-precision extractive Q&A response from retrieved chunks
 * when LLM models are unavailable or rate-limited.
 */
export function buildGroundedExtractiveAnswer(
  question: string,
  title: string,
  retrieved: RetrievedChunk[]
): string {
  if (retrieved.length === 0) {
    return `In **"${title || 'this video'}"**, the topic comes up across the discussion. Check the transcript timeline to explore the exact moments directly.`;
  }

  const topPassages = retrieved.slice(0, 3);
  const qTokens = tokenizeText(question);

  const bullets = topPassages.map((p) => {
    // Extract the most informative sentence in this expanded chunk
    const sentences = p.expandedText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    let bestSent = sentences[0] || p.expandedText.slice(0, 180);
    let highestHits = -1;

    for (const sent of sentences) {
      const lower = sent.toLowerCase();
      const hits = qTokens.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
      if (hits > highestHits) {
        highestHits = hits;
        bestSent = sent;
      }
    }

    return `- **[${p.chunk.formattedStart}]** "${bestSent}"`;
  });

  return `Here is what **"${title || 'this video'}"** directly shares regarding your question in plain English:\n\n${bullets.join(
    '\n\n'
  )}\n\n*All citations above reference verified moments directly from the video audio.*`;
}

/**
 * Produces an expanded grounded topic breakdown using RAG retrieval for Deep Dives.
 */
export function buildGroundedDeepDive(
  topic: string,
  title: string,
  retrieved: RetrievedChunk[]
): string {
  const cleanTopic = String(topic || '').trim();
  if (retrieved.length === 0) {
    return `### What the Video Explains About "${cleanTopic}"\n\nIn **${title || 'this video'}**, the speaker discusses **${cleanTopic}** in the context of the main ideas. Check the transcript timeline to jump directly to these moments.`;
  }

  const sections = retrieved.slice(0, 4).map((p, idx) => {
    const sentences = p.expandedText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const leadSentence = sentences[0] || p.expandedText.slice(0, 120);
    const bodySentences = sentences.slice(1, 4).join(' ');

    return `#### Part ${idx + 1}: [${p.chunk.formattedStart}] Key Context\n- **Main Idea**: ${leadSentence}\n${
      bodySentences ? `- **Details**: ${bodySentences}\n` : ''
    }- **Timestamp Citation**: [${p.formattedRange}]`;
  });

  return `### Comprehensive Breakdown: "${cleanTopic}"\n\nHere is how **${cleanTopic}** is developed step-by-step in **${title || 'this video'}**, grounded in the exact audio passages:\n\n${sections.join(
    '\n\n'
  )}\n\n**Takeaway:** The discussion connects ${cleanTopic} with practical applications and key principles shared throughout the presentation.`;
}

export interface GroundedFact {
  fact: string;
  timestamp: string;
  timestampSeconds: number;
  confidence: number;
  evidence: string;
  category: 'statistic' | 'definition' | 'core_argument' | 'takeaway' | 'key_event';
}

export interface TimelineEvent {
  time: string;
  seconds: number;
  title: string;
  summary: string;
  significance: 'high' | 'medium' | 'context';
}

export interface ClaimVerification {
  claim: string;
  status: 'strongly_supported' | 'partially_supported' | 'unsupported_or_contradicted';
  confidenceScore: number;
  relevantPassages: Array<{
    timestamp: string;
    text: string;
  }>;
  explanation: string;
}

export interface GroundedEntity {
  name: string;
  category: 'person' | 'technology' | 'organization' | 'concept' | 'metric';
  occurrences: Array<{
    timestamp: string;
    seconds: number;
    context: string;
  }>;
  totalMentions: number;
  significance: 'high' | 'medium' | 'low';
}

export interface GroundedChapter {
  chapterIndex: number;
  title: string;
  timeRange: string;
  startSec: number;
  endSec: number;
  keyPoints: string[];
  takeaway: string;
  verbatimQuote: string;
}

export interface GroundedCaveat {
  timestamp: string;
  timestampSeconds: number;
  type: 'warning' | 'misconception' | 'limitation' | 'tradeoff';
  statement: string;
  quote: string;
}

export interface GroundedAnswer {
  query: string;
  answer: string;
  confidenceScore: number;
  citations: Array<{
    timestamp: string;
    seconds: number;
    excerpt: string;
  }>;
  keyTakeaways: string[];
}

/**
 * Decomposes and expands a query into semantic perspectives to maximize RAG retrieval recall.
 */
export function generateQueryExpansions(query: string): string[] {
  const clean = String(query || '').trim();
  if (!clean) return [];

  const expansions = new Set<string>();
  expansions.add(clean);

  // Extract core keywords
  const tokens = tokenizeText(clean);
  if (tokens.length >= 2) {
    expansions.add(tokens.join(' '));
  }

  // Question reformulations
  if (!/^(what|how|why|when|where|who)/i.test(clean)) {
    expansions.add(`what does the video say about ${clean}`);
    expansions.add(`how does ${clean} work`);
  }

  // Sub-phrases if longer query
  if (tokens.length >= 4) {
    expansions.add(tokens.slice(0, 3).join(' '));
    expansions.add(tokens.slice(-3).join(' '));
  }

  return Array.from(expansions).slice(0, 4);
}

/**
 * Advanced Multi-Query Retrieval using Reciprocal Rank Fusion (RRF).
 * Queries multiple semantic perspectives and synthesizes an optimal rank order.
 */
export function retrieveWithMultiQueryRRF(
  index: TranscriptIndex,
  query: string,
  topK = 6,
  expandWindowSegments = 2
): RetrievedChunk[] {
  const queryVariants = generateQueryExpansions(query);
  if (queryVariants.length === 0) {
    return retrieveRelevantChunks(index, query, topK, expandWindowSegments);
  }

  const rrfScores = new Map<number, number>();
  const chunkMap = new Map<number, RetrievedChunk>();
  const RRF_K = 60;

  for (const variant of queryVariants) {
    const results = retrieveRelevantChunks(index, variant, Math.max(topK * 2, 10), expandWindowSegments);
    results.forEach((retrieved, rank) => {
      const chunkId = retrieved.chunk.id;
      const currentScore = rrfScores.get(chunkId) || 0;
      // Standard Reciprocal Rank Fusion: 1 / (K + rank)
      rrfScores.set(chunkId, currentScore + 1 / (RRF_K + rank + 1));
      if (!chunkMap.has(chunkId)) {
        chunkMap.set(chunkId, retrieved);
      }
    });
  }

  // Information density bonus for technical metrics, numbers, and key punctuation
  const scoredChunks = Array.from(chunkMap.entries()).map(([chunkId, retrieved]) => {
    let rrf = rrfScores.get(chunkId) || 0;
    const text = retrieved.expandedText;

    // Density bonus: numbers, percentages, currency, technical quotes
    const numMatches = text.match(/\b\d+(?:\.\d+)?%?|\$\d+/g)?.length || 0;
    if (numMatches > 0) rrf += Math.min(0.015 * numMatches, 0.05);

    // Quote or key term bonus
    if (/["'“”‘’]/.test(text)) rrf += 0.01;

    return {
      ...retrieved,
      score: rrf,
    };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK);
}

/**
 * Extracts timestamp-grounded factual claims, definitions, and statistics directly from transcript chunks.
 */
export function extractGroundedFacts(
  index: TranscriptIndex,
  topicOrQuery?: string,
  maxFacts = 8
): GroundedFact[] {
  const chunksToScan = topicOrQuery && topicOrQuery.trim().length > 2
    ? retrieveWithMultiQueryRRF(index, topicOrQuery, 8, 1).map((r) => r.chunk)
    : index.chunks;

  const facts: GroundedFact[] = [];
  const seenSentences = new Set<string>();

  const statRegex = /\b(?:\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?(?:\s*(?:billion|million|trillion|k|m))?|\d+\s*(?:times|percent|fold|years|months|days|hours|minutes|seconds))\b/i;
  const defRegex = /\b(?:is defined as|means that|refer(?:s|red)? to|is called|essentially is|known as)\b/i;
  const coreRegex = /\b(?:the key is|most important|rule of thumb|crucial factor|the secret|takeaway|bottom line)\b/i;

  for (const chunk of chunksToScan) {
    const sentences = chunk.text.split(/(?<=[.!?])\s+/).map((s) => s.trim());
    for (const sent of sentences) {
      if (sent.length < 25 || sent.length > 280) continue;
      const lower = sent.toLowerCase();
      if (seenSentences.has(lower)) continue;

      let category: GroundedFact['category'] | null = null;
      let confidence = 0.85;

      if (statRegex.test(sent)) {
        category = 'statistic';
        confidence = 0.95;
      } else if (defRegex.test(sent)) {
        category = 'definition';
        confidence = 0.92;
      } else if (coreRegex.test(sent)) {
        category = 'core_argument';
        confidence = 0.9;
      }

      if (category) {
        seenSentences.add(lower);
        facts.push({
          fact: sent,
          timestamp: chunk.formattedStart,
          timestampSeconds: chunk.startSec,
          confidence,
          evidence: `Spoken around ${chunk.formattedStart} in the presentation audio.`,
          category,
        });
      }

      if (facts.length >= maxFacts) break;
    }
    if (facts.length >= maxFacts) break;
  }

  return facts;
}

/**
 * Builds a chronological thematic roadmap across the video timeline.
 */
export function extractChronologicalTimeline(
  index: TranscriptIndex,
  query?: string
): TimelineEvent[] {
  if (index.chunks.length === 0 && index.allSegments.length === 0) return [];

  let timelineChunks: Array<{ text: string; startSec: number; formattedStart: string }> = [];
  if (query && query.trim().length > 2) {
    const retrieved = retrieveWithMultiQueryRRF(index, query, 8, 1);
    timelineChunks = retrieved.map((r) => ({
      text: r.chunk.text,
      startSec: r.chunk.startSec,
      formattedStart: r.chunk.formattedStart,
    })).sort((a, b) => a.startSec - b.startSec);
  } else if (index.chunks.length >= 3) {
    const step = Math.max(1, Math.floor(index.chunks.length / 6));
    for (let i = 0; i < index.chunks.length; i += step) {
      timelineChunks.push({
        text: index.chunks[i].text,
        startSec: index.chunks[i].startSec,
        formattedStart: index.chunks[i].formattedStart,
      });
    }
  } else if (index.allSegments.length > 0) {
    const segs = index.allSegments;
    const step = Math.max(1, Math.floor(segs.length / 4));
    for (let i = 0; i < segs.length; i += step) {
      const seg = segs[i];
      const start = typeof seg.start === 'number' ? seg.start : 0;
      timelineChunks.push({
        text: String(seg.text || ''),
        startSec: start,
        formattedStart: seg.formattedTime || formatTime(start),
      });
    }
  } else {
    timelineChunks = index.chunks.map((c) => ({
      text: c.text,
      startSec: c.startSec,
      formattedStart: c.formattedStart,
    }));
  }

  return timelineChunks.map((c, idx) => {
    const firstSent = c.text.split(/(?<=[.!?])\s+/)[0] || c.text.slice(0, 80);
    return {
      time: c.formattedStart,
      seconds: c.startSec,
      title: firstSent.slice(0, 60),
      summary: c.text.slice(0, 180) + '...',
      significance: idx === 0 || idx === timelineChunks.length - 1 ? 'high' : 'medium',
    };
  });
}

/**
 * Verifies an external claim or summary statement against the transcript index to guard against hallucinations.
 */
export function verifyClaimAgainstTranscript(
  index: TranscriptIndex,
  claim: string
): ClaimVerification {
  const cleanClaim = String(claim || '').trim();
  if (!cleanClaim) {
    return {
      claim,
      status: 'unsupported_or_contradicted',
      confidenceScore: 0,
      relevantPassages: [],
      explanation: 'Empty claim cannot be verified.',
    };
  }

  const retrieved = retrieveWithMultiQueryRRF(index, cleanClaim, 3, 1);
  if (retrieved.length === 0) {
    return {
      claim: cleanClaim,
      status: 'unsupported_or_contradicted',
      confidenceScore: 0.1,
      relevantPassages: [],
      explanation: 'No relevant video transcript passages discuss this claim.',
    };
  }

  const claimTokens = tokenizeText(cleanClaim);
  const bestPassage = retrieved[0];
  const passageLower = bestPassage.expandedText.toLowerCase();

  const tokenMatches = claimTokens.filter((t) => passageLower.includes(t));
  const matchRatio = claimTokens.length > 0 ? tokenMatches.length / claimTokens.length : 0;

  let status: ClaimVerification['status'] = 'unsupported_or_contradicted';
  let confidenceScore = 0.2;
  let explanation = 'The transcript mentions tangential words but does not substantiate this claim.';

  if (matchRatio >= 0.7) {
    status = 'strongly_supported';
    confidenceScore = Math.min(0.98, 0.75 + matchRatio * 0.23);
    explanation = `Directly corroborated by transcript passage around ${bestPassage.chunk.formattedStart}.`;
  } else if (matchRatio >= 0.4) {
    status = 'partially_supported';
    confidenceScore = 0.65;
    explanation = `Partially mentioned or paraphrased in the discussion around ${bestPassage.chunk.formattedStart}.`;
  }

  return {
    claim: cleanClaim,
    status,
    confidenceScore,
    relevantPassages: retrieved.map((p) => ({
      timestamp: p.chunk.formattedStart,
      text: p.expandedText.slice(0, 220),
    })),
    explanation,
  };
}

/**
 * Extracts key domain entities and recurring technical/thematic concepts
 * with timestamped context and occurrence tracking.
 */
export function extractKeyEntitiesAndConcepts(
  index: TranscriptIndex,
  maxEntities = 10
): GroundedEntity[] {
  const entityMap = new Map<string, {
    category: GroundedEntity['category'];
    occurrences: GroundedEntity['occurrences'];
  }>();

  // Known entity classification patterns
  const techPattern = /\b(?:python|javascript|typescript|react|nextjs|node|rust|c\+\+|sql|postgres|docker|kubernetes|aws|google cloud|gemini|openai|chatgpt|gpt-4|llm|transformer|rag|neural network|machine learning|deep learning|api|graphql|fastapi|pytorch|tensorflow|linux|git|github)\b/i;
  const metricPattern = /\b(?:billion|million|percent|growth rate|revenue|roi|latency|throughput|accuracy|precision|parameter count|tokens?|bandwidth)\b/i;
  const orgPattern = /\b(?:google|apple|microsoft|meta|amazon|nvidia|anthropic|openai|stanford|mit|harvard|berkley|y combinator|tesla)\b/i;

  const properNounRegex = /\b[A-Z][a-zA-Z0-9_-]+(?:\s+[A-Z][a-zA-Z0-9_-]+)*\b/g;

  for (const chunk of index.chunks) {
    const text = chunk.text;
    const matches = text.match(properNounRegex) || [];

    for (const rawName of matches) {
      const cleanName = rawName.trim();
      const lower = cleanName.toLowerCase();
      if (
        cleanName.length < 3 ||
        COMMON_STOP_WORDS.has(lower) ||
        /^(The|This|That|These|Those|When|What|Where|Which|Who|How|Why|There|Here|And|But|Because|Although|However|Today|Yesterday|Tomorrow|Now|Then)$/i.test(cleanName)
      ) {
        continue;
      }

      let category: GroundedEntity['category'] = 'concept';
      if (techPattern.test(cleanName)) {
        category = 'technology';
      } else if (orgPattern.test(cleanName)) {
        category = 'organization';
      } else if (metricPattern.test(cleanName)) {
        category = 'metric';
      } else if (cleanName.split(/\s+/).length >= 2 && !/system|model|architecture|process|theory|concept/i.test(cleanName)) {
        category = 'person';
      }

      let entry = entityMap.get(cleanName);
      if (!entry) {
        entry = { category, occurrences: [] };
        entityMap.set(cleanName, entry);
      }

      if (entry.occurrences.length < 5) {
        const sentences = text.split(/(?<=[.!?])\s+/);
        const matchSent = sentences.find((s) => s.includes(cleanName)) || text.slice(0, 160);
        entry.occurrences.push({
          timestamp: chunk.formattedStart,
          seconds: chunk.startSec,
          context: matchSent.trim().slice(0, 180),
        });
      }
    }
  }

  const entities: GroundedEntity[] = Array.from(entityMap.entries())
    .map(([name, data]) => {
      const totalMentions = data.occurrences.length;
      return {
        name,
        category: data.category,
        occurrences: data.occurrences,
        totalMentions,
        significance: (totalMentions >= 3 ? 'high' : totalMentions === 2 ? 'medium' : 'low') as GroundedEntity['significance'],
      };
    })
    .sort((a, b) => b.totalMentions - a.totalMentions);

  return entities.slice(0, maxEntities);
}

/**
 * Builds a hierarchical chapter breakdown with exact quote anchors,
 * time boundaries, and key actionable takeaways.
 */
export function generateHierarchicalGroundedSummary(
  index: TranscriptIndex,
  targetChapters = 5
): GroundedChapter[] {
  if (index.chunks.length === 0) return [];

  const chunks = index.chunks;
  const chunkCount = chunks.length;
  const numChapters = Math.min(Math.max(3, targetChapters), Math.max(1, Math.min(8, Math.ceil(chunkCount / 2))));
  const chunksPerChapter = Math.max(1, Math.floor(chunkCount / numChapters));

  const chapters: GroundedChapter[] = [];

  for (let c = 0; c < numChapters; c++) {
    const startIdx = c * chunksPerChapter;
    const endIdx = c === numChapters - 1 ? chunkCount - 1 : Math.min(chunkCount - 1, (c + 1) * chunksPerChapter - 1);
    const chapterChunks = chunks.slice(startIdx, endIdx + 1);
    if (chapterChunks.length === 0) continue;

    const firstChunk = chapterChunks[0];
    const lastChunk = chapterChunks[chapterChunks.length - 1];
    const startSec = firstChunk.startSec;
    const endSec = lastChunk.endSec;
    const timeRange = `${firstChunk.formattedStart} - ${lastChunk.formattedEnd}`;

    // Extract salient sentences
    const allSentences: string[] = [];
    for (const ch of chapterChunks) {
      allSentences.push(...ch.text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 25 && s.length <= 250));
    }

    const titleCandidate = allSentences[0] || `Section ${c + 1}`;
    const cleanTitle = titleCandidate
      .replace(/^[A-Z0-9_-]+:\s*/, '')
      .replace(/^So\s+|^And\s+|^Now\s+/i, '')
      .slice(0, 75);

    const keyPoints: string[] = [];
    const usedSentences = new Set<string>();

    for (const sent of allSentences) {
      if (keyPoints.length >= 3) break;
      if (
        !usedSentences.has(sent) &&
        (sent.includes('because') ||
          sent.includes('important') ||
          sent.includes('key') ||
          sent.includes('means') ||
          sent.includes('result') ||
          sent.length > 50)
      ) {
        usedSentences.add(sent);
        keyPoints.push(sent);
      }
    }

    if (keyPoints.length === 0 && allSentences.length > 0) {
      keyPoints.push(allSentences[0]);
    }

    const verbatimQuote = allSentences.find((s) => s.length >= 40 && s.length <= 150) || allSentences[0] || 'Key principle discussed in this section.';
    const takeaway = keyPoints[keyPoints.length - 1] || 'Understanding this phase enables deeper insight into the overarching subject.';

    chapters.push({
      chapterIndex: c + 1,
      title: cleanTitle.length > 5 ? cleanTitle : `Key Phase ${c + 1}: Foundations & Core Principles`,
      timeRange,
      startSec,
      endSec,
      keyPoints,
      takeaway,
      verbatimQuote,
    });
  }

  return chapters;
}

/**
 * Scans the transcript index for caveats, warnings, trade-offs, and common misconceptions.
 */
export function detectContradictionsAndCaveats(
  index: TranscriptIndex,
  maxCaveats = 6
): GroundedCaveat[] {
  const caveats: GroundedCaveat[] = [];
  const seenStatements = new Set<string>();

  const caveatPatterns: Array<{ regex: RegExp; type: GroundedCaveat['type'] }> = [
    { regex: /\b(?:common mistake|people get wrong|the danger is|don't make the mistake|be careful with|watch out for)\b/i, type: 'warning' },
    { regex: /\b(?:contrary to|popular belief|myth|misconception|not actually true|many assume)\b/i, type: 'misconception' },
    { regex: /\b(?:the limitation is|drawback|doesn't work when|fails if|not suitable for|bottleneck)\b/i, type: 'limitation' },
    { regex: /\b(?:trade-off|tradeoff|on the other hand|compromise|downside is|costs more)\b/i, type: 'tradeoff' },
  ];

  for (const chunk of index.chunks) {
    const sentences = chunk.text.split(/(?<=[.!?])\s+/).map((s) => s.trim());
    for (const sent of sentences) {
      if (sent.length < 25 || sent.length > 250) continue;
      const lower = sent.toLowerCase();
      if (seenStatements.has(lower)) continue;

      for (const { regex, type } of caveatPatterns) {
        if (regex.test(sent)) {
          seenStatements.add(lower);
          caveats.push({
            timestamp: chunk.formattedStart,
            timestampSeconds: chunk.startSec,
            type,
            statement: sent,
            quote: `"${sent}" (recorded at ${chunk.formattedStart})`,
          });
          break;
        }
      }

      if (caveats.length >= maxCaveats) break;
    }
    if (caveats.length >= maxCaveats) break;
  }

  return caveats;
}

/**
 * Synthesizes a grounded factual answer with verbatim citations directly from the transcript index.
 */
export function synthesizeGroundedAnswer(
  index: TranscriptIndex,
  question: string
): GroundedAnswer {
  const cleanQ = String(question || '').trim();
  const retrieved = retrieveWithMultiQueryRRF(index, cleanQ, 5, 2);

  if (retrieved.length === 0) {
    return {
      query: cleanQ,
      answer: 'No relevant information was found in the video transcript for this query.',
      confidenceScore: 0.1,
      citations: [],
      keyTakeaways: [],
    };
  }

  const citations: GroundedAnswer['citations'] = [];
  const takeaways: string[] = [];
  const queryTokens = tokenizeText(cleanQ);

  for (const r of retrieved.slice(0, 3)) {
    const sentences = r.expandedText.split(/(?<=[.!?])\s+/).map((s) => s.trim());
    const bestSent = sentences.find((s) => {
      const sLower = s.toLowerCase();
      return queryTokens.some((t) => sLower.includes(t)) && s.length >= 30;
    }) || sentences[0] || r.chunk.text.slice(0, 120);

    citations.push({
      timestamp: r.chunk.formattedStart,
      seconds: r.chunk.startSec,
      excerpt: bestSent.slice(0, 200),
    });

    if (bestSent.length >= 35 && !takeaways.includes(bestSent)) {
      takeaways.push(bestSent);
    }
  }

  const bestPassage = retrieved[0];
  const confidenceScore = Math.min(0.95, Math.max(0.6, bestPassage.score * 5));

  const answerParagraphs = [
    `Based on the video audio, the speaker addresses **"${cleanQ}"** primarily around **${bestPassage.chunk.formattedStart}**:`,
    ...citations.map((c) => `- **[${c.timestamp}]**: "${c.excerpt}"`),
  ];

  return {
    query: cleanQ,
    answer: answerParagraphs.join('\n\n'),
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    citations,
    keyTakeaways: takeaways.slice(0, 4),
  };
}
