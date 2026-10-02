import { WebSearchResult, ImageSearchResult } from '../types';
import { isSafeHttpUrl } from '../utils/subtitleParser';

export function escapeMarkdownInline(raw?: string | null): string {
  return String(raw || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .trim();
}

export function sanitizeMarkdownBlockquote(raw?: string | null): string {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return '> (No description provided)';
  return lines.map((l) => `> ${l}`).join('\n');
}

export function safeMarkdownUrl(rawUrl?: string | null, fallback = 'https://en.wikipedia.org'): string {
  if (!rawUrl || !isSafeHttpUrl(rawUrl)) return fallback;
  return rawUrl.trim().replace(/\)/g, '%29').replace(/\(/g, '%28');
}

/**
 * High-efficiency, ZERO-TOKEN entity and term extractor.
 * Extracts key topics, entities, and research queries directly from the summary
 * and video title without sending any tokens to an LLM. Supports Unicode / translated summaries.
 */
export function extractSmartTermsFromSummary(
  summaryMarkdown: string,
  videoTitle: string = ''
): string[] {
  const termsSet = new Set<string>();

  // 1. Add cleaned video title (remove common YouTube clutter)
  if (videoTitle) {
    const cleanTitle = videoTitle
      .replace(/\|.*$/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/commencement address/gi, '')
      .replace(/official video/gi, '')
      .trim();
    if (cleanTitle.length > 2 && cleanTitle.length < 60) {
      termsSet.add(cleanTitle);
    }
  }

  if (!summaryMarkdown) {
    return Array.from(termsSet);
  }

  // 2. Extract Headings (H2 and H3)
  const headingMatches = summaryMarkdown.match(/^#{2,3}\s+(.+)$/gm) || [];
  for (const h of headingMatches) {
    let text = h
      .replace(/^#{2,3}\s+/, '')
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/^[IVXLCDM]+\.\s*/i, '')
      .replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*-?\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^(Chapter|Section|Concept|Part)\s*\d*:\s*/i, '')
      .trim();

    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/\*\*|__/g, '');

    const isGeneric =
      /^(Executive Thesis|Chronological|Minute-by-Minute|Deep Concept|Empirical Data|Pivotal Quotes|Step-by-Step|Master Study|People, Tools|People, Books|Exact Resources|Final Synthesis|Action Checklist|Key Terminology|Flashcard|Core Objective|What This Video|How You Can|Best Quotes|Common Questions|Practical Takeaways)/i.test(
        text
      );

    if (!isGeneric && text.length > 2 && text.length < 50) {
      termsSet.add(text);
    }
  }

  // 3. Extract bold concepts e.g. **Concept Name**: or **[MM:SS] Topic** (Unicode-aware)
  const boldMatches = summaryMarkdown.match(/\*\*([\p{L}\p{N}\s—–'’-]{3,45})\*\*\s*:/gu) || [];
  for (const b of boldMatches.slice(0, 15)) {
    const cleaned = b
      .replace(/\*\*/g, '')
      .replace(/:$/, '')
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/^\[.*?\]/, '')
      .trim();

    if (
      cleaned.length >= 3 &&
      cleaned.length <= 45 &&
      !/^(Core Thesis|Problem Statement|Concept Name|Underlying Mechanism|Significance|Phase|Step|Rule|Checklist|Question|Answer|Front|Back|The Main Message|Why It Matters|The Big Picture|In Plain English|How It Works|Real-Life Example)/i.test(
        cleaned
      )
    ) {
      termsSet.add(cleaned);
    }
  }

  // 4. Extract specific people/tools/books/resources listed in the resources section
  const refSectionMatch = summaryMarkdown.match(
    /(?:People,\s*(?:Tools,\s*)?Books|Exact Resources)[\s\S]*?(?=\n##\s|\n#\s|$)/i
  );
  if (refSectionMatch) {
    const linkTitles = refSectionMatch[0].match(/\[([^\]]{3,55})\]\((https?:\/\/[^\)]+)\)/g) || [];
    for (const lt of linkTitles) {
      const m = lt.match(/\[([^\]]+)\]/);
      if (m && m[1]) {
        const cleanRef = m[1].replace(/\*\*|__/g, '').replace(/\([^)]*\)/g, '').trim();
        if (cleanRef.length > 2 && cleanRef.length < 45) {
          termsSet.add(cleanRef);
        }
      }
    }
    const listItems = refSectionMatch[0].match(/^[*-]\s+\*\*?([\p{L}\p{N}\s.'’-]{3,40})\*\*?/gmu) || [];
    for (const item of listItems) {
      const cleanRef = item.replace(/^[*-]\s+\*\*?/, '').replace(/\*\*?$/, '').trim();
      if (cleanRef.length > 2 && cleanRef.length < 40) {
        termsSet.add(cleanRef);
      }
    }
  }

  const result = Array.from(termsSet).filter((t) => t.trim().length > 2);
  return result.slice(0, 14);
}

/**
 * Appends a Web Search Result into the Markdown Summary safely (escaped & deduplicated)
 */
export function appendWebResultToSummary(
  currentMarkdown: string,
  result: WebSearchResult
): string {
  const safeUrl = safeMarkdownUrl(result.url);
  if (currentMarkdown.includes(`(${safeUrl})`)) {
    return currentMarkdown;
  }
  const safeTitle = escapeMarkdownInline(result.title || 'Web Reference');
  const safeSource = escapeMarkdownInline(result.source || 'Web');
  const safeQuote = sanitizeMarkdownBlockquote(result.snippet);

  const sectionHeader = '\n\n---\n\n## Verified Web Research & Context\n';
  const hasSection = currentMarkdown.includes('## Verified Web Research & Context');

  const contentToAppend = `
### [${safeTitle}](${safeUrl})
${safeQuote}

*Source: ${safeSource} — [Read Original Article](${safeUrl})*
`;

  if (hasSection) {
    return currentMarkdown.trimEnd() + '\n' + contentToAppend;
  }
  return currentMarkdown.trimEnd() + sectionHeader + contentToAppend;
}

/**
 * Appends an Image Search Result into the Markdown Summary safely (escaped & deduplicated)
 */
export function appendImageResultToSummary(
  currentMarkdown: string,
  image: ImageSearchResult
): string {
  const safeImgUrl = safeMarkdownUrl(image.url);
  if (currentMarkdown.includes(`(${safeImgUrl})`)) {
    return currentMarkdown;
  }
  const safeTitle = escapeMarkdownInline(image.title || 'Visual Figure');
  const safeDesc = escapeMarkdownInline(image.description);
  const safeSourceName = escapeMarkdownInline(image.sourceName || 'Wikimedia');
  const safeSourceUrl = safeMarkdownUrl(image.sourceUrl || image.url, safeImgUrl);

  const sectionHeader = '\n\n---\n\n## Supplementary Visuals & Figures\n';
  const hasSection = currentMarkdown.includes('## Supplementary Visuals & Figures');

  const contentToAppend = `
### ${safeTitle}
![${safeTitle}](${safeImgUrl})
${safeDesc ? `*${safeDesc}*\n` : ''}
*Source: [${safeSourceName}](${safeSourceUrl})*
`;

  if (hasSection) {
    return currentMarkdown.trimEnd() + '\n' + contentToAppend;
  }
  return currentMarkdown.trimEnd() + sectionHeader + contentToAppend;
}

/**
 * Appends batch of web and image results together safely
 */
export function appendBatchToSummary(
  currentMarkdown: string,
  webResults: WebSearchResult[],
  images: ImageSearchResult[]
): string {
  let updated = currentMarkdown;
  for (const img of images) {
    updated = appendImageResultToSummary(updated, img);
  }
  for (const web of webResults) {
    updated = appendWebResultToSummary(updated, web);
  }
  return updated;
}
