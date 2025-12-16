import type { Language } from './languageDetection';

export interface WordOccurrence {
  sentence: string;
  index: number;
}

/**
 * Split text into sentences based on language
 * Chinese: split by Chinese full stop (。)
 * Space-separated languages: split by western period (.)
 */
export function splitIntoSentences(text: string, language: Language): string[] {
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

/**
 * Find all occurrences of a word in the text with sentence context
 * Returns array of occurrences, each containing the sentence and index
 */
export function findWordOccurrences(
  text: string,
  word: string,
  language: Language
): WordOccurrence[] {
  const sentences = splitIntoSentences(text, language);
  const occurrences: WordOccurrence[] = [];
  
  // Escape special regex characters
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // For Chinese, search for the exact word (no word boundaries needed)
  // For space-separated languages, match whole words with word boundaries
  const searchRegex =
    language === 'chinese'
      ? new RegExp(escapedWord, 'gi')
      : new RegExp(`\\b${escapedWord}\\b`, 'gi');
  
  sentences.forEach((sentence, index) => {
    // Check if the sentence contains the word
    if (searchRegex.test(sentence)) {
      // Reset regex lastIndex for next test
      searchRegex.lastIndex = 0;
      
      // Count all occurrences in this sentence
      const matches = sentence.matchAll(searchRegex);
      const matchCount = Array.from(matches).length;
      
      // Add one occurrence entry per match in the sentence
      for (let i = 0; i < matchCount; i++) {
        occurrences.push({
          sentence,
          index,
        });
      }
    }
  });
  
  return occurrences;
}

