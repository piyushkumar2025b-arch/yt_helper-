import { ExactVideoResource, TranscriptSegment, VideoMetadata } from '../types';
import { isSafeHttpUrl } from '../utils/subtitleParser';

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function findMatchingSegment(
  segments: TranscriptSegment[],
  keywords: RegExp
): { segment?: TranscriptSegment; quote?: string; timestampSeconds?: number; formattedTime?: string } {
  for (const seg of segments) {
    if (keywords.test(seg.text)) {
      return {
        segment: seg,
        quote: seg.text.trim(),
        timestampSeconds: Math.floor(seg.start),
        formattedTime: seg.formattedTime || formatSeconds(seg.start),
      };
    }
  }
  return {};
}

export function extractExactVideoResources(
  metadata: VideoMetadata | null,
  segments: TranscriptSegment[],
  summaryMarkdown: string
): ExactVideoResource[] {
  const resources: ExactVideoResource[] = [];
  const seenTitles = new Set<string>();

  const videoId = metadata?.videoId || '';
  const videoTitle = metadata?.title || 'YouTube Video';
  const watchUrl =
    metadata?.url && isSafeHttpUrl(metadata.url)
      ? metadata.url
      : videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : 'https://www.youtube.com';
  const combinedCorpus = `${videoTitle}\n${summaryMarkdown}\n${segments.map((s) => s.text).join(' ')}`;

  const addResource = (res: ExactVideoResource) => {
    const key = (res.title || '').toLowerCase().trim();
    if (!key || seenTitles.has(key)) return;
    seenTitles.add(key);
    resources.push(res);
  };

  // 1. Primary Video Source (only when a real video or document is loaded)
  if (metadata || videoId) {
    const firstQuote = segments[0]?.text
      ? `"${segments[0].text.slice(0, 180)}${segments[0].text.length > 180 ? '...' : ''}"`
      : undefined;
    addResource({
      id: `exact-primary-video-${videoId || 'current'}`,
      title: `${videoTitle}${metadata?.authorName ? ` — ${metadata.authorName}` : ''}`,
      type: 'Primary Video Source',
      description: `Primary source${
        metadata?.durationFormatted ? ` (${metadata.durationFormatted})` : ''
      } with ${segments.length} transcript segments and ${
        metadata?.totalWords?.toLocaleString() || '0'
      } words.`,
      exactQuote: firstQuote,
      timestampSeconds: segments.length > 0 ? Math.floor(segments[0].start) : undefined,
      formattedTime: segments.length > 0 ? segments[0].formattedTime || '00:00' : undefined,
      primaryUrl: watchUrl,
      primaryLabel: videoId ? 'Watch Original on YouTube' : 'Primary Document Source',
      authorOrCreator: metadata?.authorName || 'Creator',
      verified: Boolean(videoId),
      secondaryLinks: [
        ...(metadata?.authorUrl && isSafeHttpUrl(metadata.authorUrl)
          ? [{ label: 'Creator Channel', url: metadata.authorUrl, sourceName: 'YouTube' }]
          : []),
        ...(videoId
          ? [
              {
                label: 'Wayback Archive',
                url: `https://web.archive.org/web/*/${encodeURIComponent(watchUrl)}`,
                sourceName: 'Internet Archive',
              },
            ]
          : []),
        {
          label: 'Google Scholar Citations',
          url: `https://scholar.google.com/scholar?q=${encodeURIComponent(videoTitle)}`,
          sourceName: 'Google Scholar',
        },
        {
          label: 'Semantic Scholar',
          url: `https://www.semanticscholar.org/search?q=${encodeURIComponent(videoTitle)}`,
          sourceName: 'Semantic Scholar',
        },
      ],
    });
  }

  // 2. Video-ID-matched Primary Resources (strictly gated by exact videoId, never loose text regexes, and never inventing timestamps)
  if (videoId === 'UF8uR6Z6KLc') {
    const wecMatch = findMatchingSegment(segments, /whole earth catalog|stewart brand|stay hungry/i);
    addResource({
      id: 'exact-steve-jobs-wec',
      title: 'The Whole Earth Catalog (Stewart Brand, 1968–1974 Final Issue)',
      type: 'Book / Publication',
      description:
        'Counterculture maker catalog created by Stewart Brand in Menlo Park. Referenced by Steve Jobs for its 1974 final issue back-cover farewell message: "Stay Hungry. Stay Foolish."',
      exactQuote: wecMatch.quote,
      timestampSeconds: wecMatch.timestampSeconds,
      formattedTime: wecMatch.formattedTime,
      primaryUrl: 'https://archive.org/details/wholeearth',
      primaryLabel: 'Internet Archive Full Scans',
      authorOrCreator: 'Stewart Brand',
      year: '1968–1974',
      verified: Boolean(wecMatch.segment),
      secondaryLinks: [
        {
          label: 'Whole Earth Official Archive',
          url: 'https://wholeearth.info/',
          sourceName: 'WholeEarth.info',
        },
        {
          label: 'Wikipedia Entry',
          url: 'https://en.wikipedia.org/wiki/Whole_Earth_Catalog',
          sourceName: 'Wikipedia',
        },
        ...(wecMatch.timestampSeconds !== undefined
          ? [
              {
                label: 'Jump to Video Quote',
                url: `https://www.youtube.com/watch?v=${videoId}&t=${wecMatch.timestampSeconds}s`,
                sourceName: 'YouTube',
              },
            ]
          : []),
      ],
    });

    const reedMatch = findMatchingSegment(segments, /reed college|calligraphy|serif|typography/i);
    addResource({
      id: 'exact-steve-jobs-reed-calligraphy',
      title: 'Reed College Calligraphy Program (Prof. Robert Palladino)',
      type: 'Historical / Key Reference',
      description:
        'Calligraphy instruction at Reed College covering serif and sans-serif typefaces and proportional letter spacing, which later influenced Macintosh typography.',
      exactQuote: reedMatch.quote,
      timestampSeconds: reedMatch.timestampSeconds,
      formattedTime: reedMatch.formattedTime,
      primaryUrl: 'https://www.reed.edu/reed-magazine/in-memoriam/obituaries/2016/robert-palladino-faculty.html',
      primaryLabel: 'Reed College Official Archive',
      authorOrCreator: 'Prof. Robert Palladino',
      year: '1972',
      verified: Boolean(reedMatch.segment),
      secondaryLinks: [
        {
          label: 'Wikipedia: Reed College',
          url: 'https://en.wikipedia.org/wiki/Reed_College',
          sourceName: 'Wikipedia',
        },
        {
          label: 'Macintosh Typography History',
          url: 'https://en.wikipedia.org/wiki/Fonts_on_Macintosh',
          sourceName: 'Wikipedia',
        },
      ],
    });
  }

  if (videoId === 'aircAruvnKk') {
    const mnistMatch = findMatchingSegment(segments, /28 by 28|784|mnist|handwritten|pixel/i);
    addResource({
      id: 'exact-3b1b-mnist',
      title: 'MNIST Handwritten Digit Database (28×28 Grayscale Benchmark)',
      type: 'Dataset / Benchmark',
      description:
        'The 70,000-image dataset of handwritten digits (0–9) created by Yann LeCun, Corinna Cortes, and Christopher J.C. Burges.',
      exactQuote: mnistMatch.quote,
      timestampSeconds: mnistMatch.timestampSeconds,
      formattedTime: mnistMatch.formattedTime,
      primaryUrl: 'https://huggingface.co/datasets/ylecun/mnist',
      primaryLabel: 'Open MNIST on HuggingFace',
      authorOrCreator: 'Yann LeCun, Corinna Cortes, C.J.C. Burges',
      year: '1998',
      verified: Boolean(mnistMatch.segment),
      secondaryLinks: [
        {
          label: 'Wikipedia: MNIST Database',
          url: 'https://en.wikipedia.org/wiki/MNIST_database',
          sourceName: 'Wikipedia',
        },
      ],
    });

    const nielsenMatch = findMatchingSegment(segments, /michael nielsen|book|textbook/i);
    addResource({
      id: 'exact-3b1b-nielsen-book',
      title: 'Neural Networks and Deep Learning (Michael Nielsen Free Online Book & Code)',
      type: 'Book / Publication',
      description:
        'Online interactive textbook and Python repository recommended in the video for building and training an MNIST handwritten digit classifier.',
      exactQuote: nielsenMatch.quote,
      timestampSeconds: nielsenMatch.timestampSeconds,
      formattedTime: nielsenMatch.formattedTime,
      primaryUrl: 'http://neuralnetworksanddeeplearning.com/',
      primaryLabel: 'Read Free Online Book',
      authorOrCreator: 'Michael A. Nielsen',
      year: '2015',
      verified: Boolean(nielsenMatch.segment),
      secondaryLinks: [
        {
          label: 'GitHub Code: mnielsen/neural-networks-and-deep-learning',
          url: 'https://github.com/mnielsen/neural-networks-and-deep-learning',
          sourceName: 'GitHub',
        },
      ],
    });
  }

  if (videoId === '094y1Z2wpJg') {
    const taoMatch = findMatchingSegment(segments, /tao|terence|almost all|logarithmic/i);
    addResource({
      id: 'exact-veritasium-tao-collatz',
      title: 'Almost All Orbits of the Collatz Map Attain Almost Bounded Values (Terence Tao, 2019)',
      type: 'Research Paper',
      description:
        'Terence Tao’s 2019 paper proving logarithmic density bounds on 3x + 1 orbits.',
      exactQuote: taoMatch.quote,
      timestampSeconds: taoMatch.timestampSeconds,
      formattedTime: taoMatch.formattedTime,
      primaryUrl: 'https://arxiv.org/abs/1909.03562',
      primaryLabel: 'Read Paper (arXiv:1909.03562)',
      authorOrCreator: 'Terence Tao (UCLA)',
      year: '2019',
      verified: Boolean(taoMatch.segment),
      secondaryLinks: [
        {
          label: 'PDF Full Text',
          url: 'https://arxiv.org/pdf/1909.03562.pdf',
          sourceName: 'arXiv PDF',
        },
      ],
    });
  }

  // 3. Extract Explicit HTTP/HTTPS Links from Transcript or Summary
  const urlRegex = /https?:\/\/[^\s)>\]"']+/gi;
  const rawUrls = Array.from(new Set(combinedCorpus.match(urlRegex) || [])).filter(
    (u) => isSafeHttpUrl(u) && !u.includes('youtube.com/watch') && !u.includes('youtu.be/') && !u.includes('ytimg.com')
  );
  for (const foundUrl of rawUrls.slice(0, 6)) {
    try {
      const parsed = new URL(foundUrl);
      const host = parsed.hostname.replace(/^www\./, '');
      addResource({
        id: `exact-url-${foundUrl.replace(/[^a-z0-9]/gi, '-').slice(0, 40)}`,
        title: `Referenced External Link (${host}${parsed.pathname !== '/' ? parsed.pathname.slice(0, 32) : ''})`,
        type: 'Historical / Key Reference',
        description: 'Direct external web resource linked in the transcript or summary.',
        primaryUrl: foundUrl,
        primaryLabel: `Open on ${host}`,
        verified: true,
        secondaryLinks: [
          {
            label: 'Wayback Machine',
            url: `https://web.archive.org/web/*/${encodeURIComponent(foundUrl)}`,
            sourceName: 'Internet Archive',
          },
        ],
      });
    } catch {}
  }

  // 4. Extract Bold Concepts / Named Entities from Summary & Match them to Actual Transcript Timestamps (marked verified: false when heuristic)
  const boldMatches = Array.from(summaryMarkdown.matchAll(/\*\*([A-Z][A-Za-z0-9\s\-/()'.]{3,48})\*\*/g)).map((m) =>
    m[1].trim()
  );

  const stopPhrases = new Set([
    'Core Thesis',
    'Key Takeaways',
    'Executive Summary',
    'Main Points',
    'What This Video Is Really About',
    'What This Talk Is Really About',
    'Step-by-Step Breakdown',
    'Step-by-Step Story Walkthrough',
    'Memorable Quotes',
    'Best Quotes to Remember',
    'Practical Takeaways',
    'Important Numbers',
    'The Main Message',
    'Why It Matters',
    'The Big Picture',
    'In Plain English',
    'How It Works',
    'Real-Life Example',
    'Note',
    'Summary',
    'Example',
    'Conclusion',
    'Core Takeaway',
    'Closing Thought',
  ]);

  for (const phrase of boldMatches) {
    if (resources.length >= 14) break;
    if (stopPhrases.has(phrase) || phrase.split(/\s+/).length > 6) continue;
    if (/^\d+$/.test(phrase)) continue;

    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const segMatch = findMatchingSegment(segments, regex);

    const sentences = summaryMarkdown
      .replace(/[#>*_`]/g, '')
      .split(/(?<=[.!?])\s+/)
      .filter((s) => regex.test(s) && s.length > 35 && s.length < 280);

    addResource({
      id: `exact-extracted-${phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: phrase,
      type: 'Historical / Key Reference',
      description:
        sentences[0] ||
        `Extracted topic from "${videoTitle}" with external search links for further reading.`,
      exactQuote: segMatch.quote,
      timestampSeconds: segMatch.timestampSeconds,
      formattedTime: segMatch.formattedTime,
      primaryUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(phrase)}`,
      primaryLabel: 'Search Wikipedia',
      verified: Boolean(segMatch.segment),
      secondaryLinks: [
        {
          label: 'Google Scholar Papers',
          url: `https://scholar.google.com/scholar?q=${encodeURIComponent(phrase)}`,
          sourceName: 'Google Scholar',
        },
        {
          label: 'OpenLibrary Books',
          url: `https://openlibrary.org/search?q=${encodeURIComponent(phrase)}`,
          sourceName: 'OpenLibrary',
        },
        ...(videoId && segMatch.timestampSeconds !== undefined
          ? [
              {
                label: `Watch at [${segMatch.formattedTime}]`,
                url: `https://www.youtube.com/watch?v=${videoId}&t=${segMatch.timestampSeconds}s`,
                sourceName: 'YouTube',
              },
            ]
          : []),
      ],
    });
  }

  // 5. Direct Deep-Research Portals for the Current Video Topic
  const cleanVideoTopic = videoTitle
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .split('|')[0]
    .trim();

  if (cleanVideoTopic && cleanVideoTopic !== 'YouTube Video') {
    addResource({
      id: `exact-portal-scholar-${videoId || 'topic'}`,
      title: `Academic Literature & Citations Search for "${cleanVideoTopic}"`,
      type: 'Research Paper',
      description: `Search academic papers, preprints, and citation graphs related to "${cleanVideoTopic}" across Google Scholar, Semantic Scholar, and arXiv.`,
      primaryUrl: `https://scholar.google.com/scholar?q=${encodeURIComponent(cleanVideoTopic)}`,
      primaryLabel: 'Search Google Scholar',
      authorOrCreator: 'Academic Search Portal',
      verified: false,
      secondaryLinks: [
        {
          label: 'Semantic Scholar',
          url: `https://www.semanticscholar.org/search?q=${encodeURIComponent(cleanVideoTopic)}`,
          sourceName: 'Semantic Scholar',
        },
        {
          label: 'arXiv Preprints',
          url: `https://arxiv.org/search/?query=${encodeURIComponent(cleanVideoTopic)}&searchtype=all`,
          sourceName: 'arXiv',
        },
      ],
    });
  }

  return resources;
}
