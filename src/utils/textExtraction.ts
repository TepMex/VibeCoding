import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export type FileType = 'txt' | 'pdf' | 'epub' | 'fb2' | 'html';

export interface ExtractionResult {
  text: string;
  encoding?: string;
}

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'txt':
      return extractTextFromTxt(file);
    case 'pdf':
      return extractTextFromPdf(file);
    case 'epub':
      return extractTextFromEpub(file);
    case 'fb2':
      return extractTextFromFb2(file);
    case 'html':
    case 'htm':
      return extractTextFromHtml(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

async function extractTextFromTxt(file: File): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  
  // List of encodings to try, prioritizing Chinese encodings
  const chineseEncodings = [
    'GB18030', // Modern Chinese standard (superset of GB2312 and GBK)
    'GBK',     // Common Chinese encoding
    'GB2312',  // Simplified Chinese
    'Big5',    // Traditional Chinese
  ];
  
  const otherEncodings = [
    'UTF-8',
    'Windows-1252', // Western European
    'ISO-8859-1', // Latin-1
  ];

  // First, try Chinese encodings if the file might contain Chinese
  // We'll try all encodings and pick the best one
  const results: Array<{ text: string; encoding: string; score: number }> = [];

  for (const encoding of [...chineseEncodings, ...otherEncodings]) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: false });
      const text = decoder.decode(arrayBuffer);
      
      // Skip if we got replacement characters (invalid encoding)
      if (text.includes('\uFFFD')) {
        continue;
      }
      
      // Calculate a score: prefer encodings that produce valid Chinese characters
      const hasChinese = /[\u4e00-\u9fff]/.test(text);
      
      let score = 0;
      if (hasChinese && chineseEncodings.includes(encoding)) {
        score = 100; // High score for Chinese encoding with Chinese text
      } else if (!hasChinese && encoding === 'UTF-8') {
        score = 90; // High score for UTF-8 with non-Chinese text
      } else if (text.length > 0) {
        score = 50; // Medium score for any valid text
      }
      
      results.push({ text, encoding, score });
    } catch (e) {
      // Encoding not supported, skip
      continue;
    }
  }

  // Sort by score and return the best match
  if (results.length > 0) {
    results.sort((a, b) => b.score - a.score);
    const best = results[0];
    return { text: best.text, encoding: best.encoding };
  }

  // Fallback: try UTF-8 with non-fatal decoder
  try {
    const decoder = new TextDecoder('UTF-8', { fatal: false });
    const text = decoder.decode(arrayBuffer);
    return { text, encoding: 'UTF-8 (fallback)' };
  } catch (e) {
    throw new Error('Failed to decode text file with any supported encoding');
  }
}

async function extractTextFromPdf(file: File): Promise<ExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return { text: fullText.trim() };
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

async function extractTextFromEpub(file: File): Promise<ExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    
    if (!containerXml) {
      throw new Error('Invalid EPUB file: missing container.xml');
    }

    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, 'text/xml');
    const rootfile = containerDoc.querySelector('rootfile');
    const opfPath = rootfile?.getAttribute('full-path');

    if (!opfPath) {
      throw new Error('Invalid EPUB file: missing OPF path');
    }

    const opfXml = await zip.file(opfPath)?.async('string');
    if (!opfXml) {
      throw new Error('Invalid EPUB file: missing OPF file');
    }

    const opfDoc = parser.parseFromString(opfXml, 'text/xml');
    const manifestItems = opfDoc.querySelectorAll('manifest item');
    const spineItems = opfDoc.querySelectorAll('spine itemref');
    
    const htmlFiles: string[] = [];
    const idToHref: Map<string, string> = new Map();

    manifestItems.forEach((item) => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (id && href) {
        idToHref.set(id, href);
      }
    });

    spineItems.forEach((item) => {
      const idref = item.getAttribute('idref');
      if (idref) {
        const href = idToHref.get(idref);
        if (href) {
          const fullPath = opfPath.includes('/')
            ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) + href
            : href;
          htmlFiles.push(fullPath);
        }
      }
    });

    let fullText = '';
    for (const htmlPath of htmlFiles) {
      const htmlContent = await zip.file(htmlPath)?.async('string');
      if (htmlContent) {
        const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
        const text = htmlDoc.body?.textContent || '';
        fullText += text + '\n';
      }
    }

    return { text: fullText.trim() };
  } catch (error) {
    throw new Error(`Failed to extract text from EPUB: ${error}`);
  }
}

async function extractTextFromFb2(file: File): Promise<ExtractionResult> {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    // FB2 files are XML, extract text from body
    const body = doc.querySelector('body');
    const textContent = body?.textContent || '';
    
    return { text: textContent.trim() };
  } catch (error) {
    throw new Error(`Failed to extract text from FB2: ${error}`);
  }
}

async function extractTextFromHtml(file: File): Promise<ExtractionResult> {
  try {
    // Try to detect encoding from HTML meta tag first, then use encoding detection
    const arrayBuffer = await file.arrayBuffer();
    
    // Try UTF-8 first (most common for HTML)
    let text: string;
    let encoding = 'UTF-8';
    
    try {
      const decoder = new TextDecoder('UTF-8', { fatal: false });
      text = decoder.decode(arrayBuffer);
      
      // Check for charset in meta tag
      const charsetMatch = text.match(/<meta[^>]*charset\s*=\s*["']?([^"'\s>]+)/i);
      if (charsetMatch) {
        const detectedCharset = charsetMatch[1].toLowerCase();
        // Try the detected charset
        try {
          const detectedDecoder = new TextDecoder(detectedCharset, { fatal: false });
          const detectedText = detectedDecoder.decode(arrayBuffer);
          if (!detectedText.includes('\uFFFD')) {
            text = detectedText;
            encoding = detectedCharset;
          }
        } catch (e) {
          // Use UTF-8 if detected charset fails
        }
      }
      
      // If UTF-8 has replacement characters, try Chinese encodings
      if (text.includes('\uFFFD')) {
        const chineseEncodings = ['GB18030', 'GBK', 'GB2312', 'Big5'];
        for (const enc of chineseEncodings) {
          try {
            const decoder = new TextDecoder(enc, { fatal: false });
            const decoded = decoder.decode(arrayBuffer);
            if (!decoded.includes('\uFFFD')) {
              text = decoded;
              encoding = enc;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e) {
      throw new Error('Failed to decode HTML file');
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const textContent = doc.body?.textContent || '';
    
    return { text: textContent.trim(), encoding };
  } catch (error) {
    throw new Error(`Failed to extract text from HTML: ${error}`);
  }
}

