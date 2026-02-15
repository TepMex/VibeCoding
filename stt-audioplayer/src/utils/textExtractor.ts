import { Parser } from 'htmlparser2';
import { DOMParser } from '@xmldom/xmldom';

export interface Chapter {
  id: string;
  title: string;
  text: string;
}

export interface ExtractedText {
  text: string;
  title?: string;
  chapters?: Chapter[];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractTextFromMarkup(markup: string): string {
  let extractedText = '';
  const parser = new Parser({
    ontext(text: string) {
      extractedText += text + ' ';
    },
  });
  parser.write(markup);
  parser.end();
  return normalizeText(extractedText);
}

function resolveRelativePath(basePath: string, relativePath: string): string {
  const baseParts = basePath.split('/').filter(Boolean);
  const relParts = relativePath.split('/').filter(Boolean);
  const all = [...baseParts, ...relParts];
  const normalized: string[] = [];
  for (const part of all) {
    if (part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.join('/');
}

function extractHtmlHeadingChapters(html: string): Chapter[] {
  const headingRegex = /<h([12])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ title: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null = null;

  while ((match = headingRegex.exec(html)) !== null) {
    const title = extractTextFromMarkup(match[2]);
    headings.push({
      title: title || `Chapter ${headings.length + 1}`,
      start: match.index,
      end: headingRegex.lastIndex,
    });
  }

  if (headings.length === 0) return [];

  const chapters: Chapter[] = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const sectionMarkup = html.slice(heading.end, nextHeading ? nextHeading.start : html.length);
    const sectionText = extractTextFromMarkup(sectionMarkup);
    if (!sectionText) continue;
    chapters.push({
      id: `chapter-${i + 1}`,
      title: heading.title,
      text: sectionText,
    });
  }

  return chapters;
}

/**
 * Extract text from TXT file
 */
export async function extractFromTxt(file: File): Promise<ExtractedText> {
  const text = await file.text();
  return { text: text.trim(), chapters: [] };
}

/**
 * Extract text from HTML file
 */
export async function extractFromHtml(file: File): Promise<ExtractedText> {
  const html = await file.text();
  let title = '';
  const extractedText = extractTextFromMarkup(html);
  const chapters = extractHtmlHeadingChapters(html);

  // Try to extract title from <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  return {
    text: extractedText,
    title: title || undefined,
    chapters,
  };
}

/**
 * Extract text from EPUB file
 */
export async function extractFromEpub(file: File): Promise<ExtractedText> {
  const arrayBuffer = await file.arrayBuffer();
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  let fullText = '';
  let title = '';
  const chapters: Chapter[] = [];

  // Extract title from metadata
  const opfFile = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.opf'));
  if (opfFile) {
    const opfContent = await zip.files[opfFile].async('text');
    const xmlParser = new DOMParser();
    const opfDoc = xmlParser.parseFromString(opfContent, 'text/xml');
    const titleElement = opfDoc.getElementsByTagName('dc:title')[0];
    if (titleElement) {
      title = titleElement.textContent || '';
    }

    const manifestById: Record<string, string> = {};
    const manifestItems = opfDoc.getElementsByTagName('item');
    for (let i = 0; i < manifestItems.length; i++) {
      const item = manifestItems[i];
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (id && href) {
        manifestById[id] = href;
      }
    }

    const opfDir = opfFile.includes('/') ? opfFile.slice(0, opfFile.lastIndexOf('/')) : '';
    const spineItems = opfDoc.getElementsByTagName('itemref');
    for (let i = 0; i < spineItems.length; i++) {
      const itemRef = spineItems[i].getAttribute('idref');
      if (!itemRef) continue;
      const href = manifestById[itemRef];
      if (!href) continue;

      const chapterPath = resolveRelativePath(opfDir, href);
      const chapterEntry = zip.files[chapterPath];
      if (!chapterEntry) continue;

      const chapterMarkup = await chapterEntry.async('text');
      const chapterText = extractTextFromMarkup(chapterMarkup);
      if (!chapterText) continue;

      const headingMatch = chapterMarkup.match(/<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/i);
      const chapterTitle = headingMatch
        ? extractTextFromMarkup(headingMatch[1])
        : `Chapter ${chapters.length + 1}`;

      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        title: chapterTitle || `Chapter ${chapters.length + 1}`,
        text: chapterText,
      });
    }
  }

  if (chapters.length === 0) {
    const htmlFiles = Object.keys(zip.files)
      .filter((name) => {
        const lower = name.toLowerCase();
        return lower.endsWith('.html') || lower.endsWith('.xhtml') || lower.endsWith('.htm');
      })
      .sort();

    for (const htmlFile of htmlFiles) {
      const content = await zip.files[htmlFile].async('text');
      const chapterText = extractTextFromMarkup(content);
      if (!chapterText) continue;
      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        title: `Chapter ${chapters.length + 1}`,
        text: chapterText,
      });
    }
  }

  for (const chapter of chapters) {
    fullText += `${chapter.text}\n\n`;
  }

  return {
    text: normalizeText(fullText),
    title: title || undefined,
    chapters,
  };
}

/**
 * Extract text from FB2 file
 */
export async function extractFromFb2(file: File): Promise<ExtractedText> {
  const xml = await file.text();
  const xmlParser = new DOMParser();
  const doc = xmlParser.parseFromString(xml, 'text/xml');

  let title = '';
  const titleElement = doc.getElementsByTagName('book-title')[0];
  if (titleElement) {
    title = titleElement.textContent || '';
  }

  const sections = doc.getElementsByTagName('section');
  const chapters: Chapter[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const titleNode = section.getElementsByTagName('title')[0];
    const titleParagraph = titleNode?.getElementsByTagName('p')[0];
    const chapterTitle = normalizeText(titleParagraph?.textContent || '') || `Chapter ${chapters.length + 1}`;
    const paragraphs = section.getElementsByTagName('p');
    let chapterText = '';
    for (let j = 0; j < paragraphs.length; j++) {
      const text = paragraphs[j].textContent || '';
      chapterText += `${text}\n`;
    }
    chapterText = normalizeText(chapterText);
    if (!chapterText) continue;
    chapters.push({
      id: `chapter-${chapters.length + 1}`,
      title: chapterTitle,
      text: chapterText,
    });
  }

  let fullText = '';
  if (chapters.length > 0) {
    for (const chapter of chapters) {
      fullText += `${chapter.text}\n\n`;
    }
  } else {
    const bodyElements = doc.getElementsByTagName('body');
    for (let i = 0; i < bodyElements.length; i++) {
      const body = bodyElements[i];
      const paragraphs = body.getElementsByTagName('p');
      for (let j = 0; j < paragraphs.length; j++) {
        const text = paragraphs[j].textContent || '';
        fullText += `${text}\n`;
      }
    }
  }

  return {
    text: normalizeText(fullText),
    title: title || undefined,
    chapters,
  };
}

/**
 * Extract text from file based on its type
 */
export async function extractTextFromFile(file: File): Promise<ExtractedText> {
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
      return extractFromTxt(file);
    case 'html':
    case 'htm':
      return extractFromHtml(file);
    case 'epub':
      return extractFromEpub(file);
    case 'fb2':
      return extractFromFb2(file);
    default:
      throw new Error(`Unsupported file format: ${extension}`);
  }
}
