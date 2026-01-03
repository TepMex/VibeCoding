import { Parser } from 'htmlparser2';
import { DOMParser } from '@xmldom/xmldom';

export interface ExtractedText {
  text: string;
  title?: string;
}

/**
 * Extract text from TXT file
 */
export async function extractFromTxt(file: File): Promise<ExtractedText> {
  const text = await file.text();
  return { text: text.trim() };
}

/**
 * Extract text from HTML file
 */
export async function extractFromHtml(file: File): Promise<ExtractedText> {
  const html = await file.text();
  let extractedText = '';
  let title = '';

  const parser = new Parser({
    ontext(text: string) {
      extractedText += text + ' ';
    },
  });

  parser.write(html);
  parser.end();

  // Try to extract title from <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  return {
    text: extractedText.replace(/\s+/g, ' ').trim(),
    title: title || undefined,
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

  // Extract title from metadata
  const opfFile = Object.keys(zip.files).find((name) => name.endsWith('.opf'));
  if (opfFile) {
    const opfContent = await zip.files[opfFile].async('text');
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfContent, 'text/xml');
    const titleElement = opfDoc.getElementsByTagName('dc:title')[0];
    if (titleElement) {
      title = titleElement.textContent || '';
    }
  }

  // Extract text from all HTML/XHTML files
  const htmlFiles = Object.keys(zip.files).filter(
    (name) => name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')
  );

  for (const htmlFile of htmlFiles) {
    const content = await zip.files[htmlFile].async('text');
    let text = '';
    const parser = new Parser({
      ontext(t: string) {
        text += t + ' ';
      },
    });
    parser.write(content);
    parser.end();
    fullText += text + '\n';
  }

  return {
    text: fullText.replace(/\s+/g, ' ').trim(),
    title: title || undefined,
  };
}

/**
 * Extract text from FB2 file
 */
export async function extractFromFb2(file: File): Promise<ExtractedText> {
  const xml = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  let title = '';
  const titleElement = doc.getElementsByTagName('book-title')[0];
  if (titleElement) {
    title = titleElement.textContent || '';
  }

  const bodyElements = doc.getElementsByTagName('body');
  let fullText = '';

  for (let i = 0; i < bodyElements.length; i++) {
    const body = bodyElements[i];
    const paragraphs = body.getElementsByTagName('p');
    for (let j = 0; j < paragraphs.length; j++) {
      const text = paragraphs[j].textContent || '';
      fullText += text + '\n';
    }
  }

  return {
    text: fullText.replace(/\s+/g, ' ').trim(),
    title: title || undefined,
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
