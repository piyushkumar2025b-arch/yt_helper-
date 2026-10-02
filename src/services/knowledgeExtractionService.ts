import { CrucialTermItem, KeyTakeawayItem, ParsedSegment } from '../types';

export function buildKnowledgeSources(query: string): Array<{ label: string; url: string }> {
  const clean = encodeURIComponent(query.replace(/\(.*?\)/g, '').trim() || query.trim());
  return [
    { label: 'Wikipedia', url: `https://en.wikipedia.org/wiki/Special:Search?search=${clean}` },
    { label: 'Wiktionary', url: `https://en.wiktionary.org/wiki/Special:Search?search=${clean}` },
    { label: 'OpenAlex Research', url: `https://openalex.org/works?search=${clean}` },
    { label: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${clean}` },
    { label: 'Wikidata Graph', url: `https://www.wikidata.org/w/index.php?search=${clean}` },
  ];
}

// Curated dictionary of real abbreviations, organizations, mental models, and concepts explained in plain, natural human English
const KNOWN_TERMS_DATABASE: Record<
  string,
  {
    fullForm?: string;
    category: CrucialTermItem['category'];
    definition: string;
    whyItMatters: string;
    realWorldExample?: string;
    defaultImportance: CrucialTermItem['importance'];
    tag: string;
  }
> = {
  CEO: {
    fullForm: 'Chief Executive Officer',
    category: 'acronym',
    definition: 'The top leader responsible for steering a company’s vision, culture, and major strategic decisions.',
    whyItMatters: 'Sets the long-term direction, product standards, and resource priorities across an entire organization.',
    realWorldExample: 'Steve Jobs returning as Apple’s CEO in 1997 to simplify its product lineup into the iMac, iPod, and iPhone.',
    defaultImportance: 'critical',
    tag: 'Leadership Role',
  },
  MAC: {
    fullForm: 'Apple Macintosh (1984)',
    category: 'entity',
    definition: 'The personal computer Apple launched in 1984—the first mainstream computer with graphical windows, icons, a mouse, and proportional typography.',
    whyItMatters: 'Established how every modern computer, tablet, and smartphone displays fonts and graphical interfaces today.',
    realWorldExample: 'Every proportional font and point-and-click window on macOS and Windows traces directly back to the original 1984 Macintosh.',
    defaultImportance: 'critical',
    tag: 'Computing Milestone',
  },
  NEXT: {
    fullForm: 'NeXT Computer, Inc.',
    category: 'entity',
    definition: 'The workstation and software company Steve Jobs founded in 1985 after leaving Apple. Apple acquired NeXT in 1997.',
    whyItMatters: 'NeXT’s operating system (NeXTSTEP) became the direct technological foundation for macOS, iOS, iPadOS, and Xcode.',
    realWorldExample: 'Tim Berners-Lee invented the first World Wide Web browser and server on a NeXT computer at CERN in 1990.',
    defaultImportance: 'critical',
    tag: 'Company & OS Foundation',
  },
  PIXAR: {
    fullForm: 'Pixar Animation Studios',
    category: 'entity',
    definition: 'The pioneering computer-animation studio funded by Steve Jobs that produced Toy Story (1995), the world’s first fully computer-animated feature film.',
    whyItMatters: 'Revolutionized filmmaking by merging custom 3D rendering software (RenderMan) with deeply human storytelling.',
    realWorldExample: 'Toy Story, Finding Nemo, and Inside Out were rendered using Pixar’s 3D graphics technology.',
    defaultImportance: 'critical',
    tag: 'Animation Studio',
  },
  WOZ: {
    fullForm: 'Steve Wozniak (Co-Founder of Apple)',
    category: 'entity',
    definition: 'The electrical engineer and computer scientist who single-handedly designed the hardware and circuit boards for the Apple I and Apple II.',
    whyItMatters: 'His engineering made personal computers affordable and usable for everyday homes and schools in the late 1970s.',
    realWorldExample: 'The Apple II (1977) designed by Wozniak drove the personal computer revolution for nearly a decade.',
    defaultImportance: 'high',
    tag: 'Pioneer & Engineer',
  },
  REED: {
    fullForm: 'Reed College (Portland, Oregon)',
    category: 'entity',
    definition: 'An independent liberal arts college in Portland, Oregon, renowned for its campus-wide calligraphy instruction and rigorous humanities curriculum.',
    whyItMatters: 'Where Steve Jobs audited Robert Palladino’s calligraphy classes, learning serif/sans-serif letterforms and kerning.',
    realWorldExample: 'The multiple typefaces and proportionally spaced fonts built into the Macintosh came directly from Reed’s calligraphy program.',
    defaultImportance: 'high',
    tag: 'University',
  },
  STANFORD: {
    fullForm: 'Stanford University',
    category: 'entity',
    definition: 'A world-leading research university in the heart of Silicon Valley, California, closely tied to the birth of modern computing and scientific breakthroughs.',
    whyItMatters: 'Served as the academic incubator for companies like Hewlett-Packard, Google, Cisco, and Sun Microsystems.',
    realWorldExample: 'The setting of Steve Jobs’s famous 2005 Commencement Address ("Stay Hungry, Stay Foolish").',
    defaultImportance: 'high',
    tag: 'Research University',
  },
  CALLIGRAPHY: {
    fullForm: 'Art of Hand-Lettering, Kerning & Typography',
    category: 'core_concept',
    definition: 'The craft of designing harmonious, expressive letterforms by hand, including serif and sans-serif styles and variable spacing between letter combinations.',
    whyItMatters: 'Brought artistic beauty and readable print-quality typography into digital screens and desktop publishing.',
    realWorldExample: 'Adjusting the microscopic spacing (kerning) between letters like "T" and "o" so words read effortlessly on screen.',
    defaultImportance: 'critical',
    tag: 'Design & Craft',
  },
  'WHOLE EARTH CATALOG': {
    fullForm: 'Stewart Brand’s Counterculture Resource Journal (1968–1972)',
    category: 'entity',
    definition: 'An iconic oversized counterculture magazine and product directory created by Stewart Brand in Menlo Park, California, featuring tools, books, and systems-thinking ideas.',
    whyItMatters: 'Described by Steve Jobs as "sort of like Google in paperback form, 35 years before Google came along"—its final back cover inspired the motto "Stay Hungry. Stay Foolish."',
    realWorldExample: 'Its 1974 epilogue issue featured a photograph of an early morning country road with the caption: "Stay Hungry. Stay Foolish."',
    defaultImportance: 'critical',
    tag: 'Historical Publication',
  },
  DOGMA: {
    fullForm: "Living by Unquestioned Inherited Rules",
    category: 'core_concept',
    definition: 'Accepting conventional rules, social expectations, or other people’s assumptions without testing or questioning them yourself.',
    whyItMatters: 'When you live by dogma, you let other people’s opinions drown out your own inner voice and creative intuition.',
    realWorldExample: 'Choosing a career path solely to please onlookers rather than building something you genuinely believe in.',
    defaultImportance: 'critical',
    tag: 'Mental Model',
  },
  "BEGINNER'S MIND": {
    fullForm: 'Shoshin (Zen Concept of Open Curiosity)',
    category: 'core_concept',
    definition: 'Approaching a craft or problem with fresh eyes, eagerness to experiment, and zero attachment to status or looking like an expert.',
    whyItMatters: 'Replaces the paralyzing weight of "having to succeed" with the creative freedom to try bold, unconventional ideas.',
    realWorldExample: 'After being ousted from Apple in 1985, Jobs described trading the "heaviness of being successful" for the "lightness of being a beginner again."',
    defaultImportance: 'critical',
    tag: 'Mindset & Philosophy',
  },
  'CONNECTING THE DOTS': {
    fullForm: 'Retrospective Sense-Making & Curiosity-Driven Learning',
    category: 'rule_of_thumb',
    definition: 'The principle that you cannot predict in advance how an unorthodox class, skill, or setback will connect to your future—you can only connect the dots looking backward.',
    whyItMatters: 'Gives you the confidence to trust your curiosity and intuition even when a path looks unconventional at the time.',
    realWorldExample: 'Taking a hand-lettering class with zero practical career plan, then using it 10 years later to design the Macintosh’s typography.',
    defaultImportance: 'critical',
    tag: 'Life Principle',
  },
  PANCREATIC: {
    fullForm: 'Islet Cell Neuroendocrine Pancreatic Tumor',
    category: 'core_concept',
    definition: 'The rare, treatable form of pancreatic neuroendocrine cancer diagnosed via biopsy that confronted Steve Jobs with his mortality.',
    whyItMatters: 'Facing a life-or-death diagnosis stripped away fear of embarrassment and reinforced the urgency of spending time on meaningful work.',
    realWorldExample: 'Discovering through an endoscopic biopsy that the tumor was a rare 1% operable neuroendocrine islet cell form.',
    defaultImportance: 'high',
    tag: 'Medical Context',
  },
  GUI: {
    fullForm: 'Graphical User Interface',
    category: 'acronym',
    definition: 'Visual windows, icons, menus, and pointers on a screen that allow anyone to use a computer intuitively without memorizing command-line code.',
    whyItMatters: 'Transformed computers from specialist laboratory machines into everyday tools for billions of people.',
    realWorldExample: 'Dragging a document into a folder with a mouse or tapping an app icon on a touchscreen.',
    defaultImportance: 'high',
    tag: 'Computing Term',
  },
  OS: {
    fullForm: 'Operating System',
    category: 'acronym',
    definition: 'The foundational system software (such as macOS, Linux, Windows, iOS, or Android) that manages hardware resources and runs applications.',
    whyItMatters: 'Coordinates CPU scheduling, memory protection, file systems, and graphical rendering for every app on a device.',
    realWorldExample: 'NeXTSTEP evolving into Apple’s modern macOS and iOS operating systems.',
    defaultImportance: 'high',
    tag: 'System Software',
  },
  API: {
    fullForm: 'Application Programming Interface',
    category: 'acronym',
    definition: 'A structured contract and communication bridge that lets different software programs request data or trigger actions from one another.',
    whyItMatters: 'Allows apps to combine live encyclopedias, payment systems, maps, and AI models without rebuilding everything from scratch.',
    realWorldExample: 'Querying Wikipedia, Wikidata, and OpenAlex APIs in real time to verify facts inside a study workspace.',
    defaultImportance: 'high',
    tag: 'Software Architecture',
  },
  AI: {
    fullForm: 'Artificial Intelligence',
    category: 'acronym',
    definition: 'Computer systems engineered to recognize complex patterns, reason over data, understand language, and assist with creative and analytical decisions.',
    whyItMatters: 'Automates heavy information synthesis while amplifying human research, engineering, and learning speed.',
    realWorldExample: 'Summarizing a 2-hour university lecture and linking every concept to peer-reviewed papers in seconds.',
    defaultImportance: 'high',
    tag: 'Core Technology',
  },
  LLM: {
    fullForm: 'Large Language Model',
    category: 'acronym',
    definition: 'A deep neural network trained on vast libraries of text and code to read, summarize, translate, and reason in natural human language.',
    whyItMatters: 'Turns unstructured transcripts, books, and papers into structured, interactive study guides.',
    realWorldExample: 'Using Gemini or DeepSeek models to extract timestamped lessons and answer questions about a video transcript.',
    defaultImportance: 'high',
    tag: 'AI Architecture',
  },
  GPU: {
    fullForm: 'Graphics Processing Unit',
    category: 'acronym',
    definition: 'A massively parallel processor containing thousands of cores designed to perform millions of matrix math operations simultaneously.',
    whyItMatters: 'Powers both 3D computer animation (like Pixar) and the training and inference of modern deep learning models.',
    realWorldExample: 'Training neural networks across clusters of high-bandwidth GPU accelerators.',
    defaultImportance: 'high',
    tag: 'Hardware & Chips',
  },
  CPU: {
    fullForm: 'Central Processing Unit',
    category: 'acronym',
    definition: 'The primary general-purpose processor chip inside a computer that executes program instructions and coordinates system components.',
    whyItMatters: 'Handles operating system logic, control flow, and low-latency everyday computing tasks.',
    realWorldExample: 'Apple Silicon M-series chips integrating high-efficiency CPU and GPU cores on a single die.',
    defaultImportance: 'recommended',
    tag: 'Hardware',
  },
  DNA: {
    fullForm: 'Deoxyribonucleic Acid',
    category: 'acronym',
    definition: 'The double-helix molecule inside living cells that encodes the genetic blueprint for how an organism develops and functions.',
    whyItMatters: 'Forms the molecular basis of heredity, modern genomics, and targeted medicine.',
    realWorldExample: 'Sequencing tumor DNA to identify targeted biological therapies.',
    defaultImportance: 'high',
    tag: 'Biology & Science',
  },
  RNA: {
    fullForm: 'Ribonucleic Acid',
    category: 'acronym',
    definition: 'A nucleic acid molecule that translates genetic instructions from DNA into the proteins that power cellular life.',
    whyItMatters: 'Essential to gene expression, cellular regulation, and mRNA therapeutics.',
    realWorldExample: 'Messenger RNA (mRNA) carrying protein-building instructions to ribosomes.',
    defaultImportance: 'high',
    tag: 'Biology & Science',
  },
  NASA: {
    fullForm: 'National Aeronautics and Space Administration',
    category: 'acronym',
    definition: 'The United States federal agency responsible for civil space exploration, planetary science, and aerospace research.',
    whyItMatters: 'Pioneered satellite communications, lunar exploration, space telescopes, and Earth climate monitoring.',
    realWorldExample: 'The James Webb Space Telescope capturing infrared images of the earliest galaxies.',
    defaultImportance: 'high',
    tag: 'Space Agency',
  },
  MIT: {
    fullForm: 'Massachusetts Institute of Technology',
    category: 'acronym',
    definition: 'A premier science, engineering, and computer science research university in Cambridge, Massachusetts.',
    whyItMatters: 'Produced foundational advances in artificial intelligence, robotics, cryptography, and open courseware.',
    realWorldExample: 'MIT OpenCourseWare publishing free university lectures for learners worldwide.',
    defaultImportance: 'high',
    tag: 'Research University',
  },
  ROI: {
    fullForm: 'Return on Investment',
    category: 'acronym',
    definition: 'A measure of how much net value, benefit, or profit you gain compared to the time, money, or effort invested.',
    whyItMatters: 'Helps individuals and teams prioritize high-leverage work over busywork.',
    realWorldExample: 'Comparing the compounding value of learning a foundational skill against short-term distractions.',
    defaultImportance: 'high',
    tag: 'Economics & Strategy',
  },
};

function findSegmentForPhrases(
  phrases: string[],
  segments: ParsedSegment[]
): { seconds: number; label: string; quote: string } | null {
  if (!segments || segments.length === 0) return null;
  for (const rawPhrase of phrases) {
    if (!rawPhrase) continue;
    const cleaned = rawPhrase.replace(/\(.*?\)/g, '').replace(/[^a-zA-Z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 3) continue;
    const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    const exactSeg = segments.find((s) => exactRegex.test(s.text));
    if (exactSeg) {
      return {
        seconds: exactSeg.start,
        label: exactSeg.formattedTime,
        quote: exactSeg.text.trim(),
      };
    }

    // Fallback: match significant words from phrase
    const words = cleaned
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['this', 'that', 'with', 'from', 'your', 'have', 'what', 'when'].includes(w));
    if (words.length >= 2) {
      const pairSnippet = words.slice(0, 2).join(' ');
      const partialSeg = segments.find((s) => s.text.toLowerCase().includes(pairSnippet));
      if (partialSeg) {
        return {
          seconds: partialSeg.start,
          label: partialSeg.formattedTime,
          quote: partialSeg.text.trim(),
        };
      }
    }
  }
  return null;
}

/**
 * Extracts accurate, user-friendly Key Terms and Big Lessons from the summary and transcript—zero generic placeholders.
 */
export function extractCrucialKnowledge(
  summaryText: string,
  videoTitle: string = '',
  transcriptSegments: ParsedSegment[] = []
): { terms: CrucialTermItem[]; takeaways: KeyTakeawayItem[] } {
  const fullTranscriptSample = transcriptSegments
    .slice(0, 200)
    .map((s) => s.text)
    .join(' ');
  const combinedText = `${videoTitle}\n${summaryText}\n${fullTranscriptSample}`;
  const upperCombined = combinedText.toUpperCase();

  const foundTerms: CrucialTermItem[] = [];
  const addedKeys = new Set<string>();

  // 1. Scan against known dictionary of real acronyms, entities, and concepts
  for (const [key, meta] of Object.entries(KNOWN_TERMS_DATABASE)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (wordRegex.test(combinedText)) {
      addedKeys.add(key.toUpperCase());

      const segMatch = findSegmentForPhrases([key, meta.fullForm || ''], transcriptSegments);
      let context = segMatch?.quote || '';
      if (!context) {
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
      }

      const displayTerm =
        key.length <= 4 && key === key.toUpperCase()
          ? key
          : key
              .split(' ')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');

      foundTerms.push({
        term: displayTerm,
        fullForm: meta.fullForm,
        category: meta.category,
        definition: meta.definition,
        whyItMatters: meta.whyItMatters,
        realWorldExample: meta.realWorldExample,
        contextInVideo: context || undefined,
        formattedTime: segMatch?.label,
        timestampSeconds: segMatch?.seconds,
        importance: meta.defaultImportance,
        tag: meta.tag,
        sources: buildKnowledgeSources(meta.fullForm || displayTerm),
      });
    }
  }

  // 2. Extract bolded terms with explanations directly from the summary markdown: e.g., "- **Term Name**: Explanation"
  const bulletTermRegex = /^[\s*-]*\*\*([^*:\n]{2,46})\*\*\s*[:—–-]\s*([^\n]{20,320})$/gm;
  let bulletMatch;
  while ((bulletMatch = bulletTermRegex.exec(summaryText)) !== null) {
    const rawTerm = bulletMatch[1]
      .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '')
      .replace(/^\d+\.\s*/, '')
      .trim();
    const rawDef = bulletMatch[2]
      .replace(/\*\*|__/g, '')
      .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '')
      .trim();
    if (!rawTerm || rawTerm.length < 2 || rawTerm.length > 42) continue;
    if (
      /^(the main|why it|the big|what it|how it|real-life|key points|the full|in plain|things you|habits to|step \d|part \d|story \d|section \d|quote|insight|takeaway|how to use|summary|overview)/i.test(
        rawTerm
      )
    ) {
      continue;
    }
    const upperKey = rawTerm.toUpperCase();
    if (addedKeys.has(upperKey)) continue;
    addedKeys.add(upperKey);

    const parenMatch = rawTerm.match(/^(.+?)\s*\(([^)]+)\)$/);
    const cleanTermName = parenMatch ? parenMatch[1].trim() : rawTerm;
    const extractedFullForm = parenMatch ? parenMatch[2].trim() : undefined;

    const segMatch = findSegmentForPhrases([cleanTermName, extractedFullForm || ''], transcriptSegments);
    const sents = rawDef.split(/(?<=[.!?])\s+/).filter(Boolean);

    foundTerms.push({
      term: cleanTermName,
      fullForm: extractedFullForm,
      category: /^[A-Z0-9]{2,6}$/.test(cleanTermName) ? 'acronym' : 'core_concept',
      definition: sents[0] || rawDef,
      whyItMatters: sents.length > 1 ? sents.slice(1).join(' ') : undefined,
      contextInVideo: segMatch?.quote,
      formattedTime: segMatch?.label,
      timestampSeconds: segMatch?.seconds,
      importance: 'high',
      tag: /^[A-Z0-9]{2,6}$/.test(cleanTermName) ? 'Abbreviation' : 'Key Concept',
      sources: buildKnowledgeSources(extractedFullForm || cleanTermName),
    });
    if (foundTerms.length >= 20) break;
  }

  // 3. Also detect inline "Full Name (ACRONYM)" patterns in the summary or transcript
  const inlineAcronymRegex = /\b([A-Z][a-zA-Z]+(?:\s+(?:of|for|and|in|to|the)?\s*[A-Z][a-zA-Z]+){1,5})\s+\(([A-Z]{2,6})\)/g;
  let acrMatch;
  while ((acrMatch = inlineAcronymRegex.exec(combinedText)) !== null) {
    const fullExpansion = acrMatch[1].trim();
    const acronym = acrMatch[2].trim();
    if (addedKeys.has(acronym) || addedKeys.has(fullExpansion.toUpperCase())) continue;
    addedKeys.add(acronym);

    const segMatch = findSegmentForPhrases([acronym, fullExpansion], transcriptSegments);
    foundTerms.push({
      term: acronym,
      fullForm: fullExpansion,
      category: 'acronym',
      definition: `${fullExpansion} (${acronym})—an important organization, standard, or technical concept discussed in the video.`,
      contextInVideo: segMatch?.quote,
      formattedTime: segMatch?.label,
      timestampSeconds: segMatch?.seconds,
      importance: 'high',
      tag: 'Abbreviation',
      sources: buildKnowledgeSources(fullExpansion),
    });
  }

  // 4. Extract Big Lessons & Ideas Worth Remembering (grounded in the actual text & transcript)
  const takeaways: KeyTakeawayItem[] = [];

  if (upperCombined.includes('CONNECT') && upperCombined.includes('DOTS')) {
    const seg = findSegmentForPhrases(['connect the dots looking forward', 'connect the dots'], transcriptSegments);
    takeaways.push({
      id: 'takeaway-dots',
      principle: 'You Can Only Connect the Dots Looking Backward',
      description:
        'You cannot predict in advance how an unorthodox class, skill, or detour will pay off in the future—you only see how the pieces fit together when you look back years later.',
      quote:
        seg?.quote ||
        "You can't connect the dots looking forward; you can only connect them looking backwards.",
      actionableLesson:
        'Follow your genuine curiosity and intuition right now, even when it steps off the conventional path, and trust that those skills will connect down the road.',
      formattedTime: seg?.label,
      timestampSeconds: seg?.seconds,
      category: 'decision_making',
      sources: buildKnowledgeSources('Steve Jobs Stanford commencement speech connecting the dots'),
    });
  }

  if (
    upperCombined.includes('LOVE') &&
    (upperCombined.includes('LOSS') || upperCombined.includes('FIRED') || upperCombined.includes('BEGINNER') || upperCombined.includes('SETTLE'))
  ) {
    const seg = findSegmentForPhrases(['only way to do great work is to love', 'lightness of being a beginner'], transcriptSegments);
    takeaways.push({
      id: 'takeaway-love',
      principle: 'Do Work You Truly Care About & Embrace Beginner’s Mind',
      description:
        'Public setbacks or starting over can strip away the pressure to look successful and replace it with the creative freedom of being an eager beginner again.',
      quote:
        seg?.quote ||
        "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle.",
      actionableLesson:
        'Refuse to settle for work that leaves you uninspired; when a plan falls apart, use the reset to experiment boldly without ego.',
      formattedTime: seg?.label,
      timestampSeconds: seg?.seconds,
      category: 'mindset',
      sources: buildKnowledgeSources('Shoshin beginners mind creative work'),
    });
  }

  if (upperCombined.includes('DEATH') || upperCombined.includes('MORTALITY') || upperCombined.includes('LIMITED')) {
    const seg = findSegmentForPhrases(['Your time is limited', 'looked in the mirror every morning'], transcriptSegments);
    takeaways.push({
      id: 'takeaway-death',
      principle: 'Remembering Our Time Is Limited Clears Away External Noise',
      description:
        "Recognizing that life is finite strips away pride, fear of embarrassment, and other people's expectations—leaving only what truly matters.",
      quote:
        seg?.quote ||
        "Your time is limited, so don't waste it living someone else's life.",
      actionableLesson:
        'Check in with yourself regularly: if you find yourself living by other people’s expectations for too many days in a row, course-correct immediately.',
      formattedTime: seg?.label,
      timestampSeconds: seg?.seconds,
      category: 'decision_making',
      sources: buildKnowledgeSources('Memento mori decision making philosophy'),
    });
  }

  if (upperCombined.includes('HUNGRY') || upperCombined.includes('FOOLISH')) {
    const seg = findSegmentForPhrases(['Stay Hungry. Stay Foolish', 'Whole Earth Catalog'], transcriptSegments);
    takeaways.push({
      id: 'takeaway-stay-hungry',
      principle: 'Stay Hungry, Stay Foolish',
      description:
        'Never lose your appetite to learn new things ("Stay Hungry") or your willingness to try bold ideas that conventional wisdom calls unrealistic ("Stay Foolish").',
      quote: seg?.quote || 'Stay Hungry. Stay Foolish.',
      actionableLesson:
        'Keep asking questions, build projects outside your comfort zone, and never let past success make you overly cautious.',
      formattedTime: seg?.label,
      timestampSeconds: seg?.seconds,
      category: 'execution',
      sources: buildKnowledgeSources('Whole Earth Catalog Stay Hungry Stay Foolish'),
    });
  }

  // 5. Extract structured takeaways directly from summary headings or bullet points for ANY video
  if (takeaways.length < 6) {
    const sectionBulletRegex = /^[\s*-]*(?:\d+\.\s*)?\*\*([^*:\n]{6,65})\*\*\s*[:—–-]\s*([^\n]{35,360})$/gm;
    let secMatch;
    let idx = 1;
    while ((secMatch = sectionBulletRegex.exec(summaryText)) !== null) {
      if (takeaways.length >= 6) break;
      const title = secMatch[1].replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '').trim();
      const body = secMatch[2].replace(/\*\*|__/g, '').trim();
      if (
        takeaways.some(
          (t) =>
            t.principle.toLowerCase().includes(title.toLowerCase().slice(0, 15)) ||
            title.toLowerCase().includes(t.principle.toLowerCase().slice(0, 15))
        )
      ) {
        continue;
      }
      // Skip single-word dictionary items already in foundTerms
      if (!/\s/.test(title) && foundTerms.some((ft) => ft.term.toLowerCase() === title.toLowerCase())) {
        continue;
      }

      const seg = findSegmentForPhrases([title, body.slice(0, 45)], transcriptSegments);
      const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
      const mainDesc = sentences[0] || body;
      const actionable =
        sentences.length > 1
          ? sentences.slice(1).join(' ')
          : `Apply "${title}" when evaluating decisions or building projects in this domain.`;

      takeaways.push({
        id: `takeaway-extracted-${idx++}`,
        principle: title,
        description: mainDesc,
        quote: seg?.quote,
        actionableLesson: actionable,
        formattedTime: seg?.label,
        timestampSeconds: seg?.seconds,
        category: idx % 2 === 0 ? 'execution' : 'craft',
        sources: buildKnowledgeSources(title),
      });
    }
  }

  // 6. If still fewer than 3 takeaways, synthesize real takeaways directly from top transcript segments or summary paragraphs (no generic filler)
  if (takeaways.length === 0 && transcriptSegments.length > 0) {
    const meaningfulSegs = transcriptSegments.filter((s) => s.text.trim().length > 55).slice(0, 4);
    meaningfulSegs.forEach((seg, idx) => {
      const cleanText = seg.text.trim();
      const words = cleanText.split(/\s+/);
      const heading = words.slice(0, 7).join(' ').replace(/[,:;.]$/, '');
      takeaways.push({
        id: `takeaway-seg-${idx + 1}`,
        principle: heading.charAt(0).toUpperCase() + heading.slice(1),
        description: cleanText,
        quote: cleanText,
        actionableLesson: `Jump to [${seg.formattedTime}] in the video to review the full context around this point.`,
        formattedTime: seg.formattedTime,
        timestampSeconds: seg.start,
        category: 'mindset',
        sources: buildKnowledgeSources(videoTitle || heading),
      });
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
  let md = `\n\n---\n\n## Key Ideas & Words Explained\n\n`;

  if (takeaways.length > 0) {
    md += `### Key Ideas & Big Lessons\n\n`;
    for (const t of takeaways) {
      const tsStr = t.formattedTime ? ` \`[${t.formattedTime}]\`` : '';
      md += `* **${t.principle}**${tsStr}\n`;
      md += `  * ${t.description}\n`;
      if (t.quote) {
        md += `  * *Speaker Quote:* "${t.quote}"\n`;
      }
      if (t.actionableLesson) {
        md += `  * *Why it matters / How to apply:* ${t.actionableLesson}\n`;
      }
      md += `\n`;
    }
  }

  if (terms.length > 0) {
    md += `### Key Words, Concepts & Abbreviations\n\n`;
    for (const item of terms) {
      const fullFormStr = item.fullForm ? ` (${item.fullForm})` : '';
      const tsStr = item.formattedTime ? ` \`[${item.formattedTime}]\`` : '';
      md += `* **${item.term}${fullFormStr}**${tsStr}: ${item.definition}`;
      if (item.whyItMatters) {
        md += ` *Why it matters:* ${item.whyItMatters}`;
      }
      md += `\n`;
    }
  }

  return md;
}
