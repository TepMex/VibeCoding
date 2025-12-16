import type { Language } from './languageDetection';

export interface Chapter {
  index: number;
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Split text into chapters based on language
 * Chinese: ~3 print pages (~4500 characters)
 * Space-separated: ~5 print pages (~10000 characters)
 * 
 * Chapters are split at sentence boundaries to avoid breaking mid-sentence
 */
export function splitIntoChapters(text: string, language: Language): Chapter[] {
  if (!text.trim()) {
    return [];
  }

  // Approximate characters per print page
  const charsPerPage = language === 'chinese' ? 1500 : 2000;
  const pagesPerChapter = language === 'chinese' ? 3 : 5;
  const targetCharsPerChapter = charsPerPage * pagesPerChapter;

  // Split text into sentences first
  const sentences = splitIntoSentences(text, language);
  
  if (sentences.length === 0) {
    return [];
  }

  const chapters: Chapter[] = [];
  let currentChapterText = '';
  let currentChapterStart = 0;
  let chapterIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const potentialChapterText = currentChapterText 
      ? currentChapterText + (language === 'chinese' ? '。' : '. ') + sentence
      : sentence;

    // If adding this sentence would exceed target length and we have content, start new chapter
    if (
      currentChapterText.length > 0 &&
      potentialChapterText.length > targetCharsPerChapter &&
      currentChapterText.length >= targetCharsPerChapter * 0.7 // At least 70% of target
    ) {
      // Save current chapter
      const endIndex = currentChapterStart + currentChapterText.length;
      chapters.push({
        index: chapterIndex,
        text: currentChapterText.trim(),
        startIndex: currentChapterStart,
        endIndex,
      });

      // Start new chapter
      chapterIndex++;
      currentChapterStart = endIndex;
      currentChapterText = sentence;
    } else {
      // Add sentence to current chapter
      currentChapterText = potentialChapterText;
    }
  }

  // Add the last chapter if it has content
  if (currentChapterText.trim().length > 0) {
    const endIndex = currentChapterStart + currentChapterText.length;
    chapters.push({
      index: chapterIndex,
      text: currentChapterText.trim(),
      startIndex: currentChapterStart,
      endIndex,
    });
  }

  return chapters;
}

/**
 * Split text into sentences based on language
 * Chinese: split by Chinese full stop (。)
 * Space-separated languages: split by western period (.)
 */
function splitIntoSentences(text: string, language: Language): string[] {
  if (language === 'chinese') {
    // Split by Chinese full stop (。)
    return text
      .split(/[。]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  } else {
    // Split by western period (.)
    return text
      .split(/[.]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}

