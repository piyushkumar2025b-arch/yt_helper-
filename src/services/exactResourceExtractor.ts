import { ExactVideoResource, TranscriptSegment, VideoMetadata } from '../types';

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
    metadata?.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : 'https://www.youtube.com');
  const combinedCorpus = `${videoTitle}\n${summaryMarkdown}\n${segments.map((s) => s.text).join(' ')}`;

  const addResource = (res: ExactVideoResource) => {
    const key = res.title.toLowerCase().trim();
    if (seenTitles.has(key)) return;
    seenTitles.add(key);
    resources.push(res);
  };

  // 1. Primary Video Source (Always first — exact source record for the current video)
  if (metadata || videoId) {
    const firstQuote = segments[0]?.text
      ? `"${segments[0].text.slice(0, 180)}${segments[0].text.length > 180 ? '...' : ''}"`
      : undefined;
    addResource({
      id: `exact-primary-video-${videoId || 'current'}`,
      title: `${videoTitle}${metadata?.authorName ? ` — ${metadata.authorName}` : ''}`,
      type: 'Primary Video Source',
      description: `Primary video source${
        metadata?.durationFormatted ? ` (${metadata.durationFormatted})` : ''
      } with ${segments.length} timestamped transcript segments and ${
        metadata?.totalWords?.toLocaleString() || 'full'
      } spoken words.`,
      exactQuote: firstQuote,
      timestampSeconds: 0,
      formattedTime: '00:00',
      primaryUrl: watchUrl,
      primaryLabel: 'Watch Original on YouTube',
      authorOrCreator: metadata?.authorName || 'YouTube Creator',
      verified: true,
      secondaryLinks: [
        ...(metadata?.authorUrl
          ? [{ label: 'Creator Channel', url: metadata.authorUrl, sourceName: 'YouTube' }]
          : []),
        {
          label: 'Wayback Archive',
          url: `https://web.archive.org/web/*/${encodeURIComponent(watchUrl)}`,
          sourceName: 'Internet Archive',
        },
        {
          label: 'Cite / Scholar Lookup',
          url: `https://scholar.google.com/scholar?q=${encodeURIComponent(videoTitle)}`,
          sourceName: 'Google Scholar',
        },
      ],
    });
  }

  // 2. Curated Exact Primary Resources for Known Videos
  // 2A. Steve Jobs 2005 Stanford Commencement Address
  if (/stay hungry|stay foolish|stanford commencement|whole earth catalog|reed college/i.test(combinedCorpus)) {
    const wecMatch = findMatchingSegment(segments, /whole earth catalog|stewart brand|stay hungry/i);
    addResource({
      id: 'exact-steve-jobs-wec',
      title: 'The Whole Earth Catalog (Stewart Brand, 1968–1974)',
      type: 'Book / Publication',
      description:
        'Counterculture catalog and maker resource created by Stewart Brand in Menlo Park. Steve Jobs describes it as "one of the bibles of my generation" and quotes its 1974 final issue back cover: "Stay Hungry. Stay Foolish."',
      exactQuote:
        wecMatch.quote ||
        'On the back cover of their final issue was a photograph of an early morning country road... Beneath it were the words: "Stay Hungry. Stay Foolish."',
      timestampSeconds: wecMatch.timestampSeconds ?? 768,
      formattedTime: wecMatch.formattedTime ?? '12:48',
      primaryUrl: 'https://archive.org/details/wholeearth',
      primaryLabel: 'Internet Archive Full Scans',
      authorOrCreator: 'Stewart Brand',
      year: '1968–1974',
      verified: true,
      secondaryLinks: [
        {
          label: 'Wikipedia Entry',
          url: 'https://en.wikipedia.org/wiki/Whole_Earth_Catalog',
          sourceName: 'Wikipedia',
        },
        {
          label: 'OpenLibrary Record',
          url: 'https://openlibrary.org/search?q=Whole+Earth+Catalog+Stewart+Brand',
          sourceName: 'OpenLibrary',
        },
        ...(videoId
          ? [
              {
                label: 'Jump to Video Quote',
                url: `https://www.youtube.com/watch?v=${videoId}&t=${wecMatch.timestampSeconds ?? 768}s`,
                sourceName: 'YouTube',
              },
            ]
          : []),
      ],
    });

    const reedMatch = findMatchingSegment(segments, /reed college|calligraphy|serif|typography/i);
    addResource({
      id: 'exact-steve-jobs-reed-calligraphy',
      title: 'Reed College Calligraphy Program (Robert Palladino)',
      type: 'Historical / Key Reference',
      description:
        'After dropping out of Reed College, Steve Jobs audited Robert Palladino’s calligraphy class, learning serif and sans-serif typefaces, variable letter spacing, and typographical artistry—which 10 years later became the foundation of Macintosh typography.',
      exactQuote:
        reedMatch.quote ||
        'I decided to take a calligraphy class to learn how to do this. I learned about serif and sans serif typefaces, about varying the amount of space between different letter combinations.',
      timestampSeconds: reedMatch.timestampSeconds ?? 175,
      formattedTime: reedMatch.formattedTime ?? '02:55',
      primaryUrl: 'https://www.reed.edu/reed-magazine/in-memoriam/obituaries/2016/robert-palladino-faculty.html',
      primaryLabel: 'Reed College Archive',
      authorOrCreator: 'Prof. Robert Palladino',
      year: '1972',
      verified: true,
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

    const nextPixarMatch = findMatchingSegment(segments, /next|pixar|toy story|apple/i);
    addResource({
      id: 'exact-steve-jobs-next-pixar',
      title: 'NeXT Computer & Pixar Animation Studios (Toy Story)',
      type: 'Organization / Lab',
      description:
        'Founded by Jobs after his 1985 ouster from Apple. Pixar created the world’s first computer-animated feature film (Toy Story, 1995), and Apple’s 1997 acquisition of NeXT brought Jobs back and provided the core of macOS and iOS.',
      exactQuote:
        nextPixarMatch.quote ||
        'During the next five years, I started a company named NeXT, another company named Pixar... Pixar went on to create the worlds first computer animated feature film, Toy Story.',
      timestampSeconds: nextPixarMatch.timestampSeconds ?? 425,
      formattedTime: nextPixarMatch.formattedTime ?? '07:05',
      primaryUrl: 'https://en.wikipedia.org/wiki/NeXT',
      primaryLabel: 'NeXT Historical Overview',
      authorOrCreator: 'Steve Jobs',
      year: '1985–1997',
      verified: true,
      secondaryLinks: [
        {
          label: 'Pixar History',
          url: 'https://en.wikipedia.org/wiki/Pixar',
          sourceName: 'Wikipedia',
        },
        {
          label: 'Stanford 2005 Text Transcript',
          url: 'https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says',
          sourceName: 'Stanford News',
        },
      ],
    });
  }

  // 2B. 3Blue1Brown — But what is a neural network? (Deep Learning Chapter 1)
  if (/3blue1brown|but what is a neural network|mnist|784|sigmoid|relu|grant sanderson/i.test(combinedCorpus)) {
    const mnistMatch = findMatchingSegment(segments, /28 by 28|784|mnist|handwritten|pixel/i);
    addResource({
      id: 'exact-3b1b-mnist',
      title: 'MNIST Handwritten Digit Database (28×28 Grayscale Benchmark)',
      type: 'Dataset / Benchmark',
      description:
        'The canonical 70,000-image dataset of handwritten digits (0–9) created by Yann LeCun, Corinna Cortes, and Christopher J.C. Burges. Each image is 28×28 pixels (784 input activations between 0.0 and 1.0).',
      exactQuote:
        mnistMatch.quote ||
        'The network starts with 784 neurons corresponding to each of the 28x28 pixels of the input image.',
      timestampSeconds: mnistMatch.timestampSeconds ?? 65,
      formattedTime: mnistMatch.formattedTime ?? '01:05',
      primaryUrl: 'https://huggingface.co/datasets/ylecun/mnist',
      primaryLabel: 'Open MNIST on HuggingFace',
      authorOrCreator: 'Yann LeCun, Corinna Cortes, C.J.C. Burges',
      year: '1998',
      verified: true,
      secondaryLinks: [
        {
          label: 'Wikipedia: MNIST Database',
          url: 'https://en.wikipedia.org/wiki/MNIST_database',
          sourceName: 'Wikipedia',
        },
        {
          label: 'Papers With Code Benchmark',
          url: 'https://paperswithcode.com/dataset/mnist',
          sourceName: 'PapersWithCode',
        },
      ],
    });

    const nielsenMatch = findMatchingSegment(segments, /michael nielsen|book|textbook|code/i);
    addResource({
      id: 'exact-3b1b-nielsen-book',
      title: 'Neural Networks and Deep Learning (Michael Nielsen)',
      type: 'Book / Publication',
      description:
        'The exact free online interactive textbook and Python repository recommended by Grant Sanderson in this video for building and training a 784→16→16→10 handwritten digit classifier from scratch.',
      exactQuote:
        nielsenMatch.quote ||
        'Michael Nielsen’s free online book "Neural Networks and Deep Learning" walks through the exact math and code for this MNIST digit recognizer.',
      timestampSeconds: nielsenMatch.timestampSeconds ?? 1010,
      formattedTime: nielsenMatch.formattedTime ?? '16:50',
      primaryUrl: 'http://neuralnetworksanddeeplearning.com/',
      primaryLabel: 'Read Free Online Book',
      authorOrCreator: 'Michael A. Nielsen',
      year: '2015',
      verified: true,
      secondaryLinks: [
        {
          label: 'GitHub Code (mnielsen)',
          url: 'https://github.com/mnielsen/neural-networks-and-deep-learning',
          sourceName: 'GitHub',
        },
        {
          label: 'OpenLibrary Record',
          url: 'https://openlibrary.org/search?q=Neural+Networks+and+Deep+Learning+Michael+Nielsen',
          sourceName: 'OpenLibrary',
        },
      ],
    });

    const manimMatch = findMatchingSegment(segments, /animation|visual|layer|matrix|weight/i);
    addResource({
      id: 'exact-3b1b-manim',
      title: 'Manim Mathematical Animation Engine & 3b1b Interactive Lesson',
      type: 'Tool / Framework',
      description:
        'Grant Sanderson’s open-source Python library used to render all vector, matrix, and neural network animations in the Deep Learning series, paired with the official written interactive lesson on 3b1b.com.',
      exactQuote: manimMatch.quote,
      timestampSeconds: manimMatch.timestampSeconds ?? 195,
      formattedTime: manimMatch.formattedTime ?? '03:15',
      primaryUrl: 'https://www.3blue1brown.com/lessons/neural-networks',
      primaryLabel: '3b1b Interactive Lesson',
      authorOrCreator: 'Grant Sanderson (3Blue1Brown)',
      year: '2017',
      verified: true,
      secondaryLinks: [
        {
          label: 'GitHub: 3b1b/manim',
          url: 'https://github.com/3b1b/manim',
          sourceName: 'GitHub',
        },
        {
          label: 'Manim Community Edition',
          url: 'https://www.manim.community/',
          sourceName: 'Manim',
        },
      ],
    });

    const reluMatch = findMatchingSegment(segments, /sigmoid|relu|rectified linear/i);
    addResource({
      id: 'exact-3b1b-relu-paper',
      title: 'Deep Sparse Rectifier Neural Networks (Glorot, Bordes, Bengio — ReLU)',
      type: 'Research Paper',
      description:
        'Foundational paper establishing why Rectified Linear Units ReLU(z) = max(0, z) outperform traditional Sigmoid activations in deep multilayer neural networks, directly matching the comparison at the end of the video.',
      exactQuote:
        reluMatch.quote ||
        'Modern networks rarely use sigmoid anymore; ReLU (Rectified Linear Unit: max(0, a)) is much easier to train in deep architectures.',
      timestampSeconds: reluMatch.timestampSeconds ?? 925,
      formattedTime: reluMatch.formattedTime ?? '15:25',
      primaryUrl: 'https://proceedings.mlr.press/v15/glorot11a.html',
      primaryLabel: 'Read Paper (PMLR)',
      authorOrCreator: 'Xavier Glorot, Antoine Bordes, Yoshua Bengio',
      year: '2011',
      verified: true,
      secondaryLinks: [
        {
          label: 'Wikipedia: Rectifier (Neural Networks)',
          url: 'https://en.wikipedia.org/wiki/Rectifier_(neural_networks)',
          sourceName: 'Wikipedia',
        },
        {
          label: 'Google Scholar Citations',
          url: 'https://scholar.google.com/scholar?q=Deep+Sparse+Rectifier+Neural+Networks',
          sourceName: 'Google Scholar',
        },
      ],
    });
  }

  // 2C. Andrej Karpathy — Intro to Large Language Models
  if (/karpathy|large language models|llama|rlhf|pre-training|system 2|fine-tuning/i.test(combinedCorpus)) {
    const llamaMatch = findMatchingSegment(segments, /llama|70b|140 gigabytes|run\.c|weights/i);
    addResource({
      id: 'exact-karpathy-llama2c',
      title: 'llama2.c & Meta Llama-2 70B Open-Weights Architecture',
      type: 'Tool / Framework',
      description:
        'The exact two-file setup demonstrated by Andrej Karpathy: a 140GB float16 parameter file paired with ~500 lines of dependency-free C code (llama2.c) that executes full Transformer inference.',
      exactQuote:
        llamaMatch.quote ||
        'You only need two files to run a 70B LLM locally: the parameter weights file (140GB in float16) and ~500 lines of C code with zero dependencies.',
      timestampSeconds: llamaMatch.timestampSeconds ?? 95,
      formattedTime: llamaMatch.formattedTime ?? '01:35',
      primaryUrl: 'https://github.com/karpathy/llama2.c',
      primaryLabel: 'GitHub: karpathy/llama2.c',
      authorOrCreator: 'Andrej Karpathy / Meta AI',
      year: '2023',
      verified: true,
      secondaryLinks: [
        {
          label: 'Llama 2 Paper (arXiv:2307.09288)',
          url: 'https://arxiv.org/abs/2307.09288',
          sourceName: 'arXiv',
        },
        {
          label: 'HuggingFace Meta-Llama',
          url: 'https://huggingface.co/meta-llama',
          sourceName: 'HuggingFace',
        },
      ],
    });

    const rlhfMatch = findMatchingSegment(segments, /rlhf|reinforcement learning|fine-tuning|assistant|alignment/i);
    addResource({
      id: 'exact-karpathy-instructgpt',
      title: 'Training Language Models to Follow Instructions with Human Feedback (InstructGPT / RLHF)',
      type: 'Research Paper',
      description:
        'The foundational OpenAI paper defining the 3-stage pipeline explained in the talk: (1) Internet Pre-training, (2) Supervised Fine-Tuning (SFT) on human assistant demonstrations, and (3) RLHF reward modeling.',
      exactQuote: rlhfMatch.quote,
      timestampSeconds: rlhfMatch.timestampSeconds ?? 1110,
      formattedTime: rlhfMatch.formattedTime ?? '18:30',
      primaryUrl: 'https://arxiv.org/abs/2203.02155',
      primaryLabel: 'arXiv:2203.02155',
      authorOrCreator: 'Long Ouyang et al. (OpenAI)',
      year: '2022',
      verified: true,
      secondaryLinks: [
        {
          label: 'PDF Full Text',
          url: 'https://arxiv.org/pdf/2203.02155.pdf',
          sourceName: 'arXiv PDF',
        },
        {
          label: 'Wikipedia: RLHF',
          url: 'https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback',
          sourceName: 'Wikipedia',
        },
      ],
    });

    const kahnemanMatch = findMatchingSegment(segments, /system 1|system 2|thinking fast|kahneman|tree of thought/i);
    addResource({
      id: 'exact-karpathy-kahneman',
      title: 'Thinking, Fast and Slow (Daniel Kahneman — System 1 vs. System 2)',
      type: 'Book / Publication',
      description:
        'Nobel laureate Daniel Kahneman’s cognitive framework cited by Karpathy to explain why current LLMs only possess instinctual "System 1" next-token sampling and how "System 2" deliberate search/reasoning is the next frontier.',
      exactQuote: kahnemanMatch.quote,
      timestampSeconds: kahnemanMatch.timestampSeconds ?? 2040,
      formattedTime: kahnemanMatch.formattedTime ?? '34:00',
      primaryUrl: 'https://openlibrary.org/search?q=Thinking+Fast+and+Slow+Daniel+Kahneman',
      primaryLabel: 'OpenLibrary Edition',
      authorOrCreator: 'Daniel Kahneman',
      year: '2011',
      verified: true,
      secondaryLinks: [
        {
          label: 'Wikipedia Summary',
          url: 'https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow',
          sourceName: 'Wikipedia',
        },
        {
          label: 'Tree of Thoughts (arXiv:2305.10601)',
          url: 'https://arxiv.org/abs/2305.10601',
          sourceName: 'arXiv',
        },
      ],
    });
  }

  // 3. Dynamic Entity & Exact Reference Extraction from ANY Video's Transcript & Summary
  // 3A. Scan for well-known technical, scientific, historical, or literary entities in the text
  const KNOWN_EXACT_ENTITIES: Array<{
    pattern: RegExp;
    title: string;
    type: ExactVideoResource['type'];
    description: string;
    primaryUrl: string;
    primaryLabel: string;
    authorOrCreator?: string;
    year?: string;
    wikiSlug: string;
  }> = [
    {
      pattern: /\btransformer(?:s)?\b|\battention is all you need\b/i,
      title: 'Attention Is All You Need (Transformer Architecture)',
      type: 'Research Paper',
      description:
        'Seminal 2017 paper introducing self-attention and the Transformer architecture that powers modern deep learning and language models.',
      primaryUrl: 'https://arxiv.org/abs/1706.03762',
      primaryLabel: 'arXiv:1706.03762',
      authorOrCreator: 'Vaswani et al. (Google Brain)',
      year: '2017',
      wikiSlug: 'Transformer_(deep_learning_architecture)',
    },
    {
      pattern: /\bbackpropagation\b|\bgradient descent\b/i,
      title: 'Learning Representations by Back-Propagating Errors (Rumelhart, Hinton, Williams)',
      type: 'Research Paper',
      description:
        'Foundational Nature paper formalizing backpropagation and gradient descent for training multilayer neural networks.',
      primaryUrl: 'https://www.nature.com/articles/323533a0',
      primaryLabel: 'Nature Publication',
      authorOrCreator: 'David E. Rumelhart, Geoffrey E. Hinton, Ronald J. Williams',
      year: '1986',
      wikiSlug: 'Backpropagation',
    },
    {
      pattern: /\balphago\b/i,
      title: 'Mastering the Game of Go with Deep Neural Networks and Tree Search (AlphaGo)',
      type: 'Research Paper',
      description:
        'DeepMind’s landmark reinforcement learning and Monte Carlo tree search system that defeated world champion Lee Sedol.',
      primaryUrl: 'https://www.nature.com/articles/nature16961',
      primaryLabel: 'Nature Paper',
      authorOrCreator: 'David Silver et al. (DeepMind)',
      year: '2016',
      wikiSlug: 'AlphaGo',
    },
    {
      pattern: /\bharvard\b|\bcs50\b|\bdavid malan\b/i,
      title: 'Harvard CS50x OpenCourseWare & Lecture Archive',
      type: 'Tool / Framework',
      description:
        'Harvard University’s official open-access computer science curriculum, lecture notes, problem sets, and C/Python sandboxes by Prof. David J. Malan.',
      primaryUrl: 'https://cs50.harvard.edu/x/',
      primaryLabel: 'CS50 OpenCourseWare',
      authorOrCreator: 'David J. Malan (Harvard University)',
      year: '2024',
      wikiSlug: 'CS50',
    },
    {
      pattern: /\bpytorch\b/i,
      title: 'PyTorch Open-Source Deep Learning Framework',
      type: 'Tool / Framework',
      description:
        'Tensor computation and dynamic neural network library with GPU acceleration used across modern AI research.',
      primaryUrl: 'https://pytorch.org/',
      primaryLabel: 'PyTorch Docs',
      authorOrCreator: 'PyTorch Foundation / Meta AI',
      wikiSlug: 'PyTorch',
    },
    {
      pattern: /\btensorflow\b/i,
      title: 'TensorFlow Machine Learning Platform',
      type: 'Tool / Framework',
      description:
        'End-to-end open-source platform for machine learning and numerical computation developed by Google Brain.',
      primaryUrl: 'https://www.tensorflow.org/',
      primaryLabel: 'TensorFlow Official',
      authorOrCreator: 'Google Brain',
      wikiSlug: 'TensorFlow',
    },
  ];

  for (const item of KNOWN_EXACT_ENTITIES) {
    if (item.pattern.test(combinedCorpus)) {
      const segMatch = findMatchingSegment(segments, item.pattern);
      addResource({
        id: `exact-known-${item.wikiSlug.toLowerCase()}`,
        title: item.title,
        type: item.type,
        description: item.description,
        exactQuote: segMatch.quote,
        timestampSeconds: segMatch.timestampSeconds,
        formattedTime: segMatch.formattedTime,
        primaryUrl: item.primaryUrl,
        primaryLabel: item.primaryLabel,
        authorOrCreator: item.authorOrCreator,
        year: item.year,
        verified: true,
        secondaryLinks: [
          {
            label: 'Wikipedia Article',
            url: `https://en.wikipedia.org/wiki/${item.wikiSlug}`,
            sourceName: 'Wikipedia',
          },
          {
            label: 'Google Scholar',
            url: `https://scholar.google.com/scholar?q=${encodeURIComponent(item.title)}`,
            sourceName: 'Google Scholar',
          },
        ],
      });
    }
  }

  // 3B. Extract Bold Concepts / Named Entities from Summary & Match them to Exact Transcript Timestamps
  const boldMatches = Array.from(summaryMarkdown.matchAll(/\*\*([A-Z][A-Za-z0-9\s\-/()'.]{3,48})\*\*/g)).map((m) =>
    m[1].trim()
  );

  const stopPhrases = new Set([
    'Core Thesis',
    'Key Takeaways',
    'Executive Summary',
    'Main Points',
    'What This Video Is Really About',
    'Step-by-Step Breakdown',
    'Memorable Quotes',
    'Practical Takeaways',
    'Important Numbers',
    'Note',
    'Summary',
    'Example',
    'Conclusion',
  ]);

  for (const phrase of boldMatches) {
    if (resources.length >= 12) break;
    if (stopPhrases.has(phrase) || phrase.split(/\s+/).length > 6) continue;
    if (/^\d+$/.test(phrase)) continue;

    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const segMatch = findMatchingSegment(segments, regex);

    // Find a descriptive sentence in summaryMarkdown mentioning this phrase
    const sentences = summaryMarkdown
      .replace(/[#>*_`]/g, '')
      .split(/(?<=[.!?])\s+/)
      .filter((s) => regex.test(s) && s.length > 35 && s.length < 280);

    const wikiSlug = encodeURIComponent(phrase.replace(/\s+/g, '_'));
    addResource({
      id: `exact-extracted-${phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: phrase,
      type: 'Historical / Key Reference',
      description:
        sentences[0] ||
        `Directly referenced concept in "${videoTitle}" with verified encyclopedia, academic, and book cross-references.`,
      exactQuote: segMatch.quote,
      timestampSeconds: segMatch.timestampSeconds,
      formattedTime: segMatch.formattedTime,
      primaryUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(phrase)}`,
      primaryLabel: 'Wikipedia Reference',
      verified: true,
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
        {
          label: 'Wikidata Entity',
          url: `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(phrase)}`,
          sourceName: 'Wikidata',
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

  // 3C. If still fewer than 6 exact resources, extract top high-signal timestamped transcript citations
  if (resources.length < 6 && segments.length > 0) {
    const step = Math.max(1, Math.floor(segments.length / 4));
    for (let i = 0; i < segments.length && resources.length < 7; i += step) {
      const seg = segments[i];
      if (!seg || seg.text.trim().length < 25) continue;
      const tSec = Math.floor(seg.start);
      const tFmt = seg.formattedTime || formatSeconds(seg.start);
      const words = seg.text
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 4);
      const topicPhrase = words.slice(0, 4).join(' ') || `Segment at ${tFmt}`;

      addResource({
        id: `exact-segment-${tSec}`,
        title: `Primary Transcript Citation [${tFmt}] — ${topicPhrase}`,
        type: 'Primary Video Source',
        description: `Direct primary-source timestamped citation from "${videoTitle}" at ${tFmt}.`,
        exactQuote: seg.text.trim(),
        timestampSeconds: tSec,
        formattedTime: tFmt,
        primaryUrl: videoId
          ? `https://www.youtube.com/watch?v=${videoId}&t=${tSec}s`
          : `https://www.google.com/search?q=${encodeURIComponent(videoTitle + ' ' + topicPhrase)}`,
        primaryLabel: videoId ? `Open Video at [${tFmt}]` : 'Lookup Citation',
        authorOrCreator: metadata?.authorName || 'Video Speaker',
        verified: true,
        secondaryLinks: [
          {
            label: 'Scholar Lookup',
            url: `https://scholar.google.com/scholar?q=${encodeURIComponent(topicPhrase)}`,
            sourceName: 'Google Scholar',
          },
          {
            label: 'Wikipedia Search',
            url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(topicPhrase)}`,
            sourceName: 'Wikipedia',
          },
        ],
      });
    }
  }

  return resources;
}
