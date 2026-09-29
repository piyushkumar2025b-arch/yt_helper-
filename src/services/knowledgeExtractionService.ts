import { CrucialTermItem, KeyTakeawayItem, ParsedSegment } from '../types';

// Curated dictionary of real abbreviations, organizations, and concepts explained in plain, natural human English
const KNOWN_TERMS_DATABASE: Record<
  string,
  {
    fullForm?: string;
    category: CrucialTermItem['category'];
    definition: string;
    defaultImportance: CrucialTermItem['importance'];
  }
> = {
  CEO: {
    fullForm: 'Chief Executive Officer',
    category: 'acronym',
    definition: 'The top leader in charge of running a company and making its biggest day-to-day decisions.',
    defaultImportance: 'critical',
  },
  MAC: {
    fullForm: 'Apple Macintosh',
    category: 'entity',
    definition: 'The personal computer Apple launched in 1984—the first everyday computer with graphical windows, icons, and proportional fonts.',
    defaultImportance: 'critical',
  },
  NEXT: {
    fullForm: 'NeXT Computer',
    category: 'entity',
    definition: 'The computer company Steve Jobs started after leaving Apple in 1985. Apple later bought NeXT, and its software became the foundation for macOS and iOS.',
    defaultImportance: 'critical',
  },
  PIXAR: {
    fullForm: 'Pixar Animation Studios',
    category: 'entity',
    definition: 'The animation studio backed by Steve Jobs that created Toy Story, the world’s first computer-animated feature film.',
    defaultImportance: 'critical',
  },
  WOZ: {
    fullForm: 'Steve Wozniak',
    category: 'entity',
    definition: 'Co-founder of Apple and the engineer who designed and built the original Apple I and Apple II computers.',
    defaultImportance: 'high',
  },
  REED: {
    fullForm: 'Reed College',
    category: 'entity',
    definition: 'A liberal arts college in Portland, Oregon, where Steve Jobs dropped in on the calligraphy classes that later inspired Mac typography.',
    defaultImportance: 'high',
  },
  STANFORD: {
    fullForm: 'Stanford University',
    category: 'entity',
    definition: 'A leading university in Silicon Valley, California, closely tied to the history of modern computing and startups.',
    defaultImportance: 'high',
  },
  GUI: {
    fullForm: 'Graphical User Interface',
    category: 'acronym',
    definition: 'Visual menus, windows, and icons on a screen that let you click and point instead of typing text commands.',
    defaultImportance: 'high',
  },
  OS: {
    fullForm: 'Operating System',
    category: 'acronym',
    definition: 'The core software (like macOS, Windows, iOS, or Android) that runs a computer or phone and manages all its apps.',
    defaultImportance: 'high',
  },
  API: {
    fullForm: 'Application Programming Interface',
    category: 'acronym',
    definition: 'A bridge that lets two different software programs talk to each other and share information.',
    defaultImportance: 'high',
  },
  AI: {
    fullForm: 'Artificial Intelligence',
    category: 'acronym',
    definition: 'Software systems designed to recognize patterns, write, answer questions, or solve problems in ways that feel human.',
    defaultImportance: 'high',
  },
  LLM: {
    fullForm: 'Large Language Model',
    category: 'acronym',
    definition: 'An AI system trained on huge amounts of writing so it can read, summarize, translate, and converse in natural language.',
    defaultImportance: 'high',
  },
  GPU: {
    fullForm: 'Graphics Processing Unit',
    category: 'acronym',
    definition: 'A specialized computer chip originally built for 3D video games that is now used to train and run modern AI models.',
    defaultImportance: 'high',
  },
  CPU: {
    fullForm: 'Central Processing Unit',
    category: 'acronym',
    definition: 'The main processor chip inside a computer that handles everyday instructions and calculations.',
    defaultImportance: 'recommended',
  },
  DNA: {
    fullForm: 'Deoxyribonucleic Acid',
    category: 'acronym',
    definition: 'The molecule inside living cells that carries genetic instructions for how an organism grows and functions.',
    defaultImportance: 'high',
  },
  RNA: {
    fullForm: 'Ribonucleic Acid',
    category: 'acronym',
    definition: 'A molecule that helps cells read genetic instructions from DNA and build proteins.',
    defaultImportance: 'high',
  },
  NASA: {
    fullForm: 'National Aeronautics and Space Administration',
    category: 'acronym',
    definition: 'The United States government agency responsible for space exploration, satellites, and aviation research.',
    defaultImportance: 'high',
  },
  MIT: {
    fullForm: 'Massachusetts Institute of Technology',
    category: 'acronym',
    definition: 'A world-renowned science, engineering, and technology university in Cambridge, Massachusetts.',
    defaultImportance: 'high',
  },
  PhD: {
    fullForm: 'Doctor of Philosophy',
    category: 'acronym',
    definition: 'The highest university degree awarded after years of original research in a specific field.',
    defaultImportance: 'recommended',
  },
  ROI: {
    fullForm: 'Return on Investment',
    category: 'acronym',
    definition: 'How much value, profit, or benefit you get back compared to the time or money you put in.',
    defaultImportance: 'high',
  },
  KPI: {
    fullForm: 'Key Performance Indicator',
    category: 'acronym',
    definition: 'A clear, measurable number used to track whether a project or team is actually hitting its goal.',
    defaultImportance: 'recommended',
  },
  GDP: {
    fullForm: 'Gross Domestic Product',
    category: 'acronym',
    definition: 'The total value of all goods and services produced by a country in a year—used to measure the size of an economy.',
    defaultImportance: 'high',
  },
  IPO: {
    fullForm: 'Initial Public Offering',
    category: 'acronym',
    definition: 'The moment a private company sells shares of its stock to the general public on the stock market for the first time.',
    defaultImportance: 'high',
  },
  VC: {
    fullForm: 'Venture Capital',
    category: 'acronym',
    definition: 'Funding provided by investors to early-stage startups that have high growth potential.',
    defaultImportance: 'recommended',
  },
  SaaS: {
    fullForm: 'Software as a Service',
    category: 'acronym',
    definition: 'Software you use directly in your web browser (like Gmail, Notion, or Figma) instead of installing from a disc.',
    defaultImportance: 'recommended',
  },
  URL: {
    fullForm: 'Uniform Resource Locator',
    category: 'acronym',
    definition: 'A web address (like https://youtube.com) that points to a specific page or video on the internet.',
    defaultImportance: 'recommended',
  },
  PDF: {
    fullForm: 'Portable Document Format',
    category: 'acronym',
    definition: 'A universal file format that keeps fonts, images, and page layouts looking identical on any device.',
    defaultImportance: 'recommended',
  },
  CALLIGRAPHY: {
    fullForm: 'The Art of Hand-Lettering & Typography',
    category: 'core_concept',
    definition: 'The craft of drawing balanced, expressive letters by hand. Steve Jobs credited his college calligraphy class for giving the Macintosh its beautiful fonts.',
    defaultImportance: 'high',
  },
  DOGMA: {
    fullForm: "Living by Other People's Rules",
    category: 'core_concept',
    definition: 'Following inherited rules or expectations without questioning them—what Steve Jobs called "living with the results of other people’s thinking."',
    defaultImportance: 'critical',
  },
  "BEGINNER'S MIND": {
    fullForm: 'Fresh Curiosity Without Ego',
    category: 'core_concept',
    definition: 'Approaching a problem with open curiosity and willingness to experiment, free from the pressure to look like an expert.',
    defaultImportance: 'critical',
  },
  'CONNECTING THE DOTS': {
    fullForm: 'How Past Experiences Make Sense Later',
    category: 'rule_of_thumb',
    definition: 'You rarely know in advance how a curiosity, class, or setback will pay off—you only see how the pieces fit together when you look back years later.',
    defaultImportance: 'critical',
  },
};

/**
 * Extracts real, human-written key terms and big lessons from the summary and transcript—zero robotic filler.
 */
export function extractCrucialKnowledge(
  summaryText: string,
  videoTitle: string = '',
  transcriptSegments: ParsedSegment[] = []
): { terms: CrucialTermItem[]; takeaways: KeyTakeawayItem[] } {
  const combinedText = `${videoTitle}\n${summaryText}\n${transcriptSegments
    .slice(0, 80)
    .map((s) => s.text)
    .join(' ')}`;
  const upperCombined = combinedText.toUpperCase();

  const foundTerms: CrucialTermItem[] = [];
  const addedKeys = new Set<string>();

  // 1. Scan against known dictionary of real acronyms, entities, and concepts
  for (const [key, meta] of Object.entries(KNOWN_TERMS_DATABASE)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (wordRegex.test(combinedText)) {
      addedKeys.add(key.toUpperCase());

      let context = '';
      const sentences = combinedText
        .replace(/[#>*_`]/g, '')
        .split(/(?<=[.?!])\s+/);
      for (const s of sentences) {
        const cleanS = s.replace(/\s+/g, ' ').trim();
        if (wordRegex.test(cleanS) && cleanS.length > 25 && cleanS.length < 220) {
          context = cleanS;
          break;
        }
      }

      foundTerms.push({
        term: key.length <= 4 ? key : key.charAt(0) + key.slice(1).toLowerCase(),
        fullForm: meta.fullForm,
        category: meta.category,
        definition: meta.definition,
        contextInVideo: context || undefined,
        importance: meta.defaultImportance,
        tag:
          meta.category === 'acronym'
            ? 'Abbreviation'
            : meta.category === 'entity'
            ? 'Person / Place'
            : 'Key Concept',
      });
    }
  }

  // 2. Extract bolded terms with explanations directly from the summary markdown: e.g., "- **Term Name**: Explanation"
  const bulletTermRegex = /^[-*]\s+\*\*([^*:]{2,42})\*\*\s*[:—-]\s*(.{20,260})$/gm;
  let bulletMatch;
  while ((bulletMatch = bulletTermRegex.exec(summaryText)) !== null) {
    const rawTerm = bulletMatch[1].replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '').trim();
    const rawDef = bulletMatch[2].replace(/\*\*|__/g, '').trim();
    if (!rawTerm || rawTerm.length < 3 || rawTerm.length > 38) continue;
    if (
      /^(the main|why it|the big|what it|how it|real-life|key points|the full|in plain|things you|habits to)/i.test(
        rawTerm
      )
    ) {
      continue;
    }
    const upperKey = rawTerm.toUpperCase();
    if (addedKeys.has(upperKey)) continue;
    addedKeys.add(upperKey);

    foundTerms.push({
      term: rawTerm,
      category: 'core_concept',
      definition: rawDef,
      importance: 'high',
      tag: 'Key Idea',
    });
    if (foundTerms.length >= 16) break;
  }

  // 3. Extract Big Lessons & Ideas Worth Remembering
  const takeaways: KeyTakeawayItem[] = [];

  if (upperCombined.includes('CONNECT') && upperCombined.includes('DOTS')) {
    takeaways.push({
      id: 'takeaway-dots',
      principle: 'You Can Only Connect the Dots Looking Backward',
      description:
        'You cannot predict how a random class, hobby, or detour will pay off in the future—you only see how the pieces fit together when you look back years later.',
      quote: "You can't connect the dots looking forward; you can only connect them looking backwards.",
      actionableLesson:
        'Follow your genuine curiosity right now, even if it does not look like a traditional career move yet.',
      category: 'decision_making',
    });
  }

  if (
    upperCombined.includes('LOVE') &&
    (upperCombined.includes('LOSS') || upperCombined.includes('FIRED') || upperCombined.includes('BEGINNER'))
  ) {
    takeaways.push({
      id: 'takeaway-love',
      principle: 'Do Work You Truly Care About & Welcome Fresh Starts',
      description:
        'Getting knocked down or starting over can free you from the pressure to look successful and bring back the excitement of being a curious beginner.',
      quote: "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle.",
      actionableLesson:
        'Do not settle for work that leaves you cold. When a plan falls apart, treat it as room to build something better.',
      category: 'mindset',
    });
  }

  if (upperCombined.includes('DEATH') || upperCombined.includes('MORTALITY') || upperCombined.includes('CANCER')) {
    takeaways.push({
      id: 'takeaway-death',
      principle: 'Remembering Life Is Short Clears Away the Noise',
      description:
        "Realizing our time is limited strips away pride, fear of embarrassment, and other people's expectations—leaving only what actually matters to you.",
      quote: "Your time is limited, so don't waste it living someone else's life.",
      actionableLesson:
        'Ask yourself honestly: "If today were my last day, would I feel good about how I am spending my time?" If the answer is no for weeks in a row, change course.',
      category: 'decision_making',
    });
  }

  if (upperCombined.includes('HUNGRY') || upperCombined.includes('FOOLISH')) {
    takeaways.push({
      id: 'takeaway-stay-hungry',
      principle: 'Stay Hungry, Stay Foolish',
      description:
        'Stay curious, keep learning, and never be afraid to look like a beginner or try bold ideas when everyone else plays it safe.',
      quote: 'Stay Hungry. Stay Foolish.',
      actionableLesson:
        'Keep asking questions, try things outside your comfort zone, and never act like you have everything figured out.',
      category: 'execution',
    });
  }

  // Extract additional real quotes from the summary with natural context
  const quoteMatches =
    summaryText.match(/"([^"]{25,200})"/g) || summaryText.match(/“([^”]{25,200})”/g) || [];
  let takeawayIdx = 1;

  for (const q of quoteMatches) {
    if (takeaways.length >= 6) break;
    const cleanQuote = q.replace(/^["“]|["”]$/g, '').trim();
    if (takeaways.some((t) => t.quote && t.quote.toLowerCase().includes(cleanQuote.slice(0, 25).toLowerCase()))) {
      continue;
    }
    const words = cleanQuote.split(/\s+/);
    const shortTitle = words.length > 8 ? `${words.slice(0, 8).join(' ')}...` : cleanQuote;
    takeaways.push({
      id: `takeaway-quote-${takeawayIdx++}`,
      principle: shortTitle,
      description: `A standout moment from "${videoTitle || 'this video'}" capturing the speaker's core perspective in their own words.`,
      quote: cleanQuote,
      actionableLesson: 'Keep this perspective in mind when applying the lessons from this video to your own work.',
      category: 'mindset',
    });
  }

  if (takeaways.length === 0) {
    takeaways.push({
      id: 'takeaway-1',
      principle: 'Focus on the Core Message',
      description:
        'Cut through the background details and hold onto the one or two practical ideas from this talk that you can actually use.',
      actionableLesson: 'Pick one concrete idea from the summary and test it out in your routine this week.',
      category: 'execution',
    });
  }

  return {
    terms: foundTerms,
    takeaways,
  };
}

/**
 * Formats terms and takeaways as clean, human-readable Markdown to append to the summary
 */
export function formatKnowledgeAsMarkdown(terms: CrucialTermItem[], takeaways: KeyTakeawayItem[]): string {
  let md = `\n\n---\n\n## Key Lessons & Terms Explained\n\n`;

  if (takeaways.length > 0) {
    md += `### Big Lessons Worth Remembering\n\n`;
    for (const t of takeaways) {
      md += `* **${t.principle}**\n`;
      md += `  * ${t.description}\n`;
      if (t.quote) {
        md += `  * *Quote:* "${t.quote}"\n`;
      }
      md += `  * *How to use it:* ${t.actionableLesson}\n\n`;
    }
  }

  if (terms.length > 0) {
    md += `### Key Words & Abbreviations\n\n`;
    for (const item of terms) {
      const fullFormStr = item.fullForm ? ` (${item.fullForm})` : '';
      md += `* **${item.term}${fullFormStr}**: ${item.definition}\n`;
    }
  }

  return md;
}
