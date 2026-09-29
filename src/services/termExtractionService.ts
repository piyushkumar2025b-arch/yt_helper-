import { WebSearchResult, ImageSearchResult } from '../types';

/**
 * High-efficiency, ZERO-TOKEN entity and term extractor.
 * Extracts key topics, entities, and research queries directly from the summary
 * and video title without sending any tokens to an LLM.
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
    // Clean markdown hashes, emojis, and roman numerals
    let text = h
      .replace(/^#{2,3}\s+/, '')
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '') // strip emojis
      .replace(/^[IVXLCDM]+\.\s*/i, '') // strip roman numerals
      .replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*-?\s*/, '') // strip timestamps
      .replace(/^\d+\.\s*/, '') // strip numbered lists
      .replace(/^(Chapter|Section|Concept|Part)\s*\d*:\s*/i, '')
      .trim();

    // Remove markdown links or formatting
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/\*\*|__/g, '');

    // Skip generic meta headings
    const isGeneric = /^(Executive Thesis|Chronological|Minute-by-Minute|Deep Concept|Empirical Data|Pivotal Quotes|Step-by-Step|Master Study|People, Tools|Final Synthesis|Action Checklist|Key Terminology|Flashcard|Core Objective)/i.test(
      text
    );

    if (!isGeneric && text.length > 2 && text.length < 50) {
      termsSet.add(text);
    }
  }

  // 3. Extract bold concepts e.g. **Concept Name**: or **[MM:SS] Topic**
  const boldMatches = summaryMarkdown.match(/\*\*([A-Za-z0-9\s—–'-]{3,40})\*\*\s*:/g) || [];
  for (const b of boldMatches.slice(0, 15)) {
    const cleaned = b
      .replace(/\*\*/g, '')
      .replace(/:$/, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/^\[.*?\]/, '')
      .trim();

    if (
      cleaned.length >= 3 &&
      cleaned.length <= 40 &&
      !/^(Core Thesis|Problem Statement|Concept Name|Underlying Mechanism|Significance|Phase|Step|Rule|Checklist|Question|Answer|Front|Back)/i.test(
        cleaned
      )
    ) {
      termsSet.add(cleaned);
    }
  }

  // 4. Extract specific people/tools/books listed in Section VIII
  const refSectionMatch = summaryMarkdown.match(/People, Tools, Books[\s\S]*?(?=\n##|\n#|$)/i);
  if (refSectionMatch) {
    const listItems = refSectionMatch[0].match(/^[*-]\s+\*\*?([A-Za-z0-9\s.'-]{3,35})\*\*?/gm) || [];
    for (const item of listItems) {
      const cleanRef = item.replace(/^[*-]\s+\*\*?/, '').replace(/\*\*?$/, '').trim();
      if (cleanRef.length > 2 && cleanRef.length < 35) {
        termsSet.add(cleanRef);
      }
    }
  }

  // Deduplicate and limit to top 14 most relevant terms
  const result = Array.from(termsSet).filter((t) => t.trim().length > 2);
  return result.slice(0, 14);
}

/**
 * Appends a Web Search Result into the Markdown Summary
 */
export function appendWebResultToSummary(
  currentMarkdown: string,
  result: WebSearchResult
): string {
  const sectionHeader = '\n\n---\n\n## Verified Web Research & Context\n';
  const hasSection = currentMarkdown.includes('## Verified Web Research & Context');

  const contentToAppend = `
### [${result.title}](${result.url})
> ${result.snippet}

*Source: ${result.source} — [Read Original Article](${result.url})*
`;

  if (hasSection) {
    return currentMarkdown.trimEnd() + '\n' + contentToAppend;
  }
  return currentMarkdown.trimEnd() + sectionHeader + contentToAppend;
}

/**
 * Appends an Image Search Result into the Markdown Summary
 */
export function appendImageResultToSummary(
  currentMarkdown: string,
  image: ImageSearchResult
): string {
  const sectionHeader = '\n\n---\n\n## Supplementary Visuals & Figures\n';
  const hasSection = currentMarkdown.includes('## Supplementary Visuals & Figures');

  const contentToAppend = `
### ${image.title}
![${image.title}](${image.url})
${image.description ? `*${image.description}*\n` : ''}
*Source: [${image.sourceName || 'Wikimedia'}](${image.sourceUrl || image.url})*
`;

  if (hasSection) {
    return currentMarkdown.trimEnd() + '\n' + contentToAppend;
  }
  return currentMarkdown.trimEnd() + sectionHeader + contentToAppend;
}

/**
 * Appends batch of web and image results together
 */
export function appendBatchToSummary(
  currentMarkdown: string,
  webResults: WebSearchResult[],
  images: ImageSearchResult[]
): string {
  let updated = currentMarkdown.trimEnd();

  if (images.length > 0) {
    const hasImageSection = updated.includes('## Supplementary Visuals & Figures');
    if (!hasImageSection) {
      updated += '\n\n---\n\n## Supplementary Visuals & Figures\n';
    }
    for (const img of images) {
      updated += `
### ${img.title}
![${img.title}](${img.url})
${imageDescriptionLine(img.description)}
*Source: [${img.sourceName || 'Wikimedia'}](${img.sourceUrl || img.url})*
`;
    }
  }

  if (webResults.length > 0) {
    const hasWebSection = updated.includes('## Verified Web Research & Context');
    if (!hasWebSection) {
      updated += '\n\n---\n\n## Verified Web Research & Context\n';
    }
    for (const web of webResults) {
      updated += `
### [${web.title}](${web.url})
> ${web.snippet}

*Source: ${web.source} — [Read Article](${web.url})*
`;
    }
  }

  return updated;
}

function imageDescriptionLine(desc?: string): string {
  return desc ? `*${desc}*\n` : '';
}
