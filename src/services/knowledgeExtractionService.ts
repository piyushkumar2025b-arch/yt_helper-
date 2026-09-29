import { CrucialTermItem, KeyTakeawayItem, ParsedSegment } from '../types';

// Curated dictionary of common abbreviations, acronyms, and crucial terms across tech, philosophy, business, and speeches
const KNOWN_TERMS_DATABASE: Record<string, { fullForm?: string; category: CrucialTermItem['category']; definition: string; defaultImportance: CrucialTermItem['importance'] }> = {
  'CEO': {
    fullForm: 'Chief Executive Officer',
    category: 'acronym',
    definition: 'The highest-ranking executive manager in a company, responsible for making major corporate decisions and managing overall operations.',
    defaultImportance: 'critical',
  },
  'MAC': {
    fullForm: 'Macintosh Computer',
    category: 'entity',
    definition: 'The revolutionary personal computer introduced by Apple in 1984, notable for being the first mass-market computer with a graphical user interface and beautiful typography.',
    defaultImportance: 'critical',
  },
  'NEXT': {
    fullForm: 'NeXT Computer, Inc.',
    category: 'entity',
    definition: 'The computer and software workstation company founded by Steve Jobs in 1985 after leaving Apple. Its NeXTSTEP operating system became the technical foundation for modern macOS and iOS.',
    defaultImportance: 'critical',
  },
  'PIXAR': {
    fullForm: 'Pixar Animation Studios',
    category: 'entity',
    definition: 'The pioneering computer animation film studio acquired by Steve Jobs in 1986 from Lucasfilm, which went on to produce Toy Story and define 3D computer animation.',
    defaultImportance: 'critical',
  },
  'WOZ': {
    fullForm: 'Steve Wozniak ("Woz")',
    category: 'entity',
    definition: 'Co-founder of Apple and the brilliant electrical engineer who hand-built the Apple I and Apple II personal computers.',
    defaultImportance: 'high',
  },
  'REED': {
    fullForm: 'Reed College',
    category: 'entity',
    definition: 'A selective liberal arts college in Portland, Oregon where Steve Jobs attended before dropping out and auditing calligraphy courses that inspired Mac typography.',
    defaultImportance: 'high',
  },
  'STANFORD': {
    fullForm: 'Stanford University',
    category: 'entity',
    definition: 'Leading private research university located near Silicon Valley, California, where famous commencement addresses and technological innovations originated.',
    defaultImportance: 'high',
  },
  'GUI': {
    fullForm: 'Graphical User Interface',
    category: 'acronym',
    definition: 'A visual way of interacting with a computer using windows, icons, and menus instead of purely text-based command line interfaces.',
    defaultImportance: 'high',
  },
  'OS': {
    fullForm: 'Operating System',
    category: 'acronym',
    definition: 'The low-level system software that supports a computer\'s basic functions, such as scheduling tasks, executing applications, and controlling peripherals.',
    defaultImportance: 'high',
  },
  'API': {
    fullForm: 'Application Programming Interface',
    category: 'acronym',
    definition: 'A set of protocols, routines, and tools for building software and enabling applications to exchange data seamlessly.',
    defaultImportance: 'high',
  },
  'AI': {
    fullForm: 'Artificial Intelligence',
    category: 'acronym',
    definition: 'The simulation of human intelligence processes by computer systems, encompassing machine learning, NLP, and reasoning.',
    defaultImportance: 'high',
  },
  'LLM': {
    fullForm: 'Large Language Model',
    category: 'acronym',
    definition: 'A deep neural network trained on massive corpora of text capable of understanding, summarizing, generating, and reasoning across human languages.',
    defaultImportance: 'high',
  },
  'WWDC': {
    fullForm: 'Worldwide Developers Conference',
    category: 'acronym',
    definition: 'Apple\'s annual conference where new software platforms, operating system updates, and developer technologies are unveiled.',
    defaultImportance: 'high',
  },
  'VTT': {
    fullForm: 'Web Video Text Tracks',
    category: 'acronym',
    definition: 'A standard W3C file format (.vtt) for displaying timed text captions, subtitles, and chapter markers in HTML5 video players.',
    defaultImportance: 'recommended',
  },
  'SRT': {
    fullForm: 'SubRip Subtitle Format',
    category: 'acronym',
    definition: 'A widely used subtitle file format consisting of indexed sequential subtitles with start and end timestamps followed by text.',
    defaultImportance: 'recommended',
  },
  'JSON': {
    fullForm: 'JavaScript Object Notation',
    category: 'acronym',
    definition: 'A standard text-based format for representing structured data based on JavaScript object syntax, used in web APIs and scraping feeds.',
    defaultImportance: 'recommended',
  },
  'TTML': {
    fullForm: 'Timed Text Markup Language',
    category: 'acronym',
    definition: 'An XML-based captioning standard developed by the W3C used for broadcast and streaming video subtitles.',
    defaultImportance: 'recommended',
  },
  'CALLIGRAPHY': {
    fullForm: 'Art of Beautiful Handwriting & Typography',
    category: 'core_concept',
    definition: 'The visual art related to writing and letter styling. Steve Jobs audited calligraphy at Reed, directly informing proportional spacing and multiple font families on Mac.',
    defaultImportance: 'high',
  },
  'DOGMA': {
    fullForm: 'Living with Results of Others\' Thinking',
    category: 'core_concept',
    definition: 'A principle or set of principles laid down by an authority as incontrovertibly true. In Jobs\' words: "Don\'t be trapped by dogma — which is living with the results of other people\'s thinking."',
    defaultImportance: 'critical',
  },
  'BEGINNER\'S MIND': {
    fullForm: 'Shoshin (Zen Concept of Fresh Curiosity)',
    category: 'core_concept',
    definition: 'Approaching life without rigid preconceptions, allowing one to enter creative periods with lightness and experimentation rather than the burden of existing success.',
    defaultImportance: 'critical',
  },
  'CONNECTING THE DOTS': {
    fullForm: 'Retrospective Coherence Heuristic',
    category: 'rule_of_thumb',
    definition: 'The mental model that life events only reveal their purpose and synergy when evaluated looking backwards; requires trust and intuition in the present.',
    defaultImportance: 'critical',
  }
};

/**
 * Deterministically extracts crucial terms, acronyms, and mental models from text without token wastage
 */
export function extractCrucialKnowledge(
  summaryText: string,
  videoTitle: string = '',
  transcriptSegments: ParsedSegment[] = []
): { terms: CrucialTermItem[]; takeaways: KeyTakeawayItem[] } {
  const combinedText = `${videoTitle}\n${summaryText}\n${transcriptSegments.slice(0, 50).map((s) => s.text).join(' ')}`;
  const upperCombined = combinedText.toUpperCase();

  const foundTerms: CrucialTermItem[] = [];
  const addedKeys = new Set<string>();

  // 1. Scan against known dictionary
  for (const [key, meta] of Object.entries(KNOWN_TERMS_DATABASE)) {
    const wordRegex = new RegExp(`\\b${key.replace(/'/g, "\\'")}\\b`, 'i');
    if (wordRegex.test(combinedText)) {
      addedKeys.add(key);

      // Extract a sentence mentioning it
      let context = '';
      const sentences = combinedText.split(/(?<=[.?!])\s+/);
      for (const s of sentences) {
        if (wordRegex.test(s) && s.length > 20 && s.length < 220) {
          context = s.trim();
          break;
        }
      }

      foundTerms.push({
        term: key.length <= 4 ? key : key.charAt(0) + key.slice(1).toLowerCase(),
        fullForm: meta.fullForm,
        category: meta.category,
        definition: meta.definition,
        contextInVideo: context || `Referenced in the discourse regarding ${key.toLowerCase()}.`,
        importance: meta.defaultImportance,
        tag: meta.category === 'acronym' ? 'Acronym' : meta.category === 'entity' ? 'Key Entity' : 'Mental Model',
      });
    }
  }

  // 2. Scan for capitalized acronyms in parentheses: e.g. "Artificial Intelligence (AI)" or "CEO"
  const acronymRegex = /\b([A-Z]{2,6})\b/g;
  let match;
  while ((match = acronymRegex.exec(combinedText)) !== null) {
    const rawAcronym = match[1];
    if (addedKeys.has(rawAcronym)) continue;
    if (['AND', 'THE', 'FOR', 'NOT', 'YOU', 'WAS', 'ALL', 'OUT', 'HAD', 'BUT', 'HIS', 'HER', 'WHY', 'HOW'].includes(rawAcronym)) continue;

    addedKeys.add(rawAcronym);
    foundTerms.push({
      term: rawAcronym,
      fullForm: `Acronym (${rawAcronym})`,
      category: 'acronym',
      definition: `Specialized term or abbreviation identified in the discourse.`,
      contextInVideo: `Used in the speech context for concise reference.`,
      importance: 'recommended',
      tag: 'Acronym',
    });
  }

  // 3. Extract Core Takeaways & Things to Keep in Mind
  const takeaways: KeyTakeawayItem[] = [];

  // Extract from quotes or highlighted sentences in summary
  const quoteMatches = summaryText.match(/"([^"]{20,180})"/g) || summaryText.match(/“([^”]{20,180})”/g) || [];
  let takeawayIdx = 1;

  for (const q of quoteMatches.slice(0, 3)) {
    const cleanQuote = q.replace(/^["“]|["”]$/g, '').trim();
    takeaways.push({
      id: `takeaway-quote-${takeawayIdx++}`,
      principle: cleanQuote.length > 45 ? `${cleanQuote.substring(0, 42)}...` : cleanQuote,
      description: `Core quote emphasized in the material reflecting fundamental priorities and attitude.`,
      quote: cleanQuote,
      actionableLesson: `Remember this guidance during critical career and life crossroads.`,
      category: 'mindset',
    });
  }

  // Check for classic Steve Jobs Stanford pillars if relevant
  if (upperCombined.includes('CONNECT') && upperCombined.includes('DOTS')) {
    takeaways.unshift({
      id: 'takeaway-dots',
      principle: 'You Can Only Connect the Dots Looking Backward',
      description: 'You cannot predict how a random class, hobby, or detour will pay off in the future—you can only see how it all fits together when you look back later.',
      quote: 'You can\'t connect the dots looking forward; you can only connect them looking backwards.',
      actionableLesson: 'Follow your genuine curiosity and gut feelings right now, even if you cannot see how it fits on a resume yet.',
      category: 'decision_making',
    });
  }

  if (upperCombined.includes('LOVE') && (upperCombined.includes('LOSS') || upperCombined.includes('FIRED') || upperCombined.includes('BEGINNER'))) {
    takeaways.unshift({
      id: 'takeaway-love',
      principle: 'Do Work You Actually Love & Embrace Starting Fresh',
      description: 'Getting knocked down or starting over can actually free you up. The pressure of "being successful" gets replaced by the freedom of being a curious beginner again.',
      quote: 'The only way to do great work is to love what you do. If you haven\'t found it yet, keep looking. Don\'t settle.',
      actionableLesson: 'Don\'t settle for work you don\'t care about. When plans fall apart, use that moment to build something better.',
      category: 'mindset',
    });
  }

  if (upperCombined.includes('DEATH') || upperCombined.includes('MORTALITY') || upperCombined.includes('CANCER')) {
    takeaways.unshift({
      id: 'takeaway-death',
      principle: 'Remembering Life Is Short Clears Away the Noise',
      description: 'Remembering that our time here is limited makes pride, fear of embarrassment, and other people\'s expectations fall away—leaving only what really matters to you.',
      quote: 'Death is very likely the single best invention of Life. It is Life\'s change agent.',
      actionableLesson: 'Ask yourself honestly: "If today were my last day, would I feel good about how I\'m spending my time?" If the answer is no for too many days in a row, change something.',
      category: 'decision_making',
    });
  }

  if (upperCombined.includes('HUNGRY') || upperCombined.includes('FOOLISH')) {
    takeaways.push({
      id: 'takeaway-stay-hungry',
      principle: 'Stay Hungry, Stay Foolish',
      description: 'Stay curious, keep learning, and never be afraid to look like a beginner or try new ideas when everyone else plays it safe.',
      quote: 'Stay Hungry. Stay Foolish.',
      actionableLesson: 'Keep asking questions, try things outside your comfort zone, and never act like you have it all figured out.',
      category: 'execution',
    });
  }

  // Fallback heuristic takeaways if none detected
  if (takeaways.length === 0) {
    takeaways.push(
      {
        id: 'takeaway-1',
        principle: 'Focus on What Really Matters',
        description: 'Cut through the background noise and pay attention to the few core ideas that actually make a difference.',
        actionableLesson: 'Pick one or two practical ideas from this video that you can realistically try out this week.',
        category: 'execution',
      },
      {
        id: 'takeaway-2',
        principle: 'Understand the Key Words in Plain English',
        description: 'Once you know what the buzzwords and abbreviations mean in everyday language, the whole topic becomes easy to follow.',
        actionableLesson: 'Take a quick look through the word list below so none of the technical terms get in your way.',
        category: 'craft',
      }
    );
  }

  return {
    terms: foundTerms,
    takeaways,
  };
}

/**
 * Formats terms and takeaways as Markdown to append to the summary
 */
export function formatKnowledgeAsMarkdown(terms: CrucialTermItem[], takeaways: KeyTakeawayItem[]): string {
  let md = `\n\n---\n\n## Big Lessons & Helpful Words\n\n`;

  if (takeaways.length > 0) {
    md += `### Lessons Worth Remembering\n\n`;
    for (const t of takeaways) {
      md += `* **${t.principle}**\n`;
      md += `  * *What it means:* ${t.description}\n`;
      if (t.quote) {
        md += `  * *Memorable quote:* > "${t.quote}"\n`;
      }
      md += `  * *How to use it in real life:* ${t.actionableLesson}\n\n`;
    }
  }

  if (terms.length > 0) {
    md += `### Words & Jargon Explained Simply\n\n`;
    md += `| Word / Term | Stands For | Topic | Plain-English Meaning |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const term of terms) {
      const full = term.fullForm ? `**${term.fullForm}**` : '—';
      md += `| \`${term.term}\` | ${full} | ${term.tag || term.category} | ${term.definition} |\n`;
    }
    md += `\n`;
  }

  return md;
}
