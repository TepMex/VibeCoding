import type { Language } from './languageDetection';

export interface WordOccurrence {
  sentence: string;
  index: number;
}

export interface SentenceIndex {
  sentences: string[];
  text: string;
  language: Language;
}

/**
 * Split text into sentences based on language
 * Chinese: split by Chinese full stop (。)
 * Space-separated languages: split by western period (.)
 * This is optimized to be called once and cached.
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
 * Create a sentence index for efficient word occurrence searches
 * Pre-processes sentences once to avoid repeated splitting
 */
export function createSentenceIndex(text: string, language: Language): SentenceIndex {
  return {
    sentences: splitIntoSentences(text, language),
    text,
    language,
  };
}

/**
 * Optimized word matching using indexOf for simple cases
 * Falls back to regex for complex patterns (word boundaries)
 */
function findWordMatchesInSentence(
  sentence: string,
  word: string,
  language: Language
): number {
  const lowerSentence = sentence.toLowerCase();
  const lowerWord = word.toLowerCase();
  
  if (language === 'chinese') {
    // For Chinese, use indexOf for exact matches (faster than regex)
    let count = 0;
    let index = 0;
    while ((index = lowerSentence.indexOf(lowerWord, index)) !== -1) {
      count++;
      index += lowerWord.length;
    }
    return count;
  } else {
    // For space-separated languages, we need word boundaries
    // Use regex but optimize by checking if word exists first
    if (!lowerSentence.includes(lowerWord)) {
      return 0;
    }
    
    // Escape special regex characters
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use Unicode-aware word boundary: match word that is not preceded/followed by letter or digit
    // This works with Cyrillic, Latin, and other Unicode scripts
    // Using (^|[^\p{L}\p{N}]) and ([^\p{L}\p{N}]|$) for compatibility (no lookbehind)
    const searchRegex = new RegExp(`(^|[^\\p{L}\\p{N}])${escapedWord}([^\\p{L}\\p{N}]|$)`, 'gui');
    
    const matches = sentence.matchAll(searchRegex);
    return Array.from(matches).length;
  }
}

/**
 * Find all occurrences of a word using pre-indexed sentences
 * Optimized version that uses cached sentence index
 */
export function findWordOccurrencesWithIndex(
  index: SentenceIndex,
  word: string
): WordOccurrence[] {
  const occurrences: WordOccurrence[] = [];
  
  index.sentences.forEach((sentence, sentenceIndex) => {
    const matchCount = findWordMatchesInSentence(sentence, word, index.language);
    
    // Add one occurrence entry per match in the sentence
    for (let i = 0; i < matchCount; i++) {
      occurrences.push({
        sentence,
        index: sentenceIndex,
      });
    }
  });
  
  return occurrences;
}

/**
 * Find all occurrences of a word in the text with sentence context
 * Returns array of occurrences, each containing the sentence and index
 * This is the legacy function kept for backward compatibility
 * For better performance, use findWordOccurrencesWithIndex with a cached index
 */
export function findWordOccurrences(
  text: string,
  word: string,
  language: Language
): WordOccurrence[] {
  const index = createSentenceIndex(text, language);
  return findWordOccurrencesWithIndex(index, word);
}

/**
 * Highlight a word in a sentence by wrapping it in a span with highlighting
 * Returns JSX-ready string with highlighted word
 */
export function highlightWordInSentence(
  sentence: string,
  word: string,
  language: Language
): string {
  // Escape special regex characters
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // For Chinese, search for the exact word (no word boundaries needed)
  // For space-separated languages, match whole words with Unicode-aware word boundaries
  // Using (^|[^\p{L}\p{N}]) and ([^\p{L}\p{N}]|$) for compatibility (no lookbehind)
  const searchRegex =
    language === 'chinese'
      ? new RegExp(escapedWord, 'gi')
      : new RegExp(`(^|[^\\p{L}\\p{N}])${escapedWord}([^\\p{L}\\p{N}]|$)`, 'gui');
  
  // Replace matches with highlighted version
  if (language === 'chinese') {
    return sentence.replace(searchRegex, (match) => {
      return `<mark style="background-color: #ffeb3b; padding: 2px 0; font-weight: 500;">${match}</mark>`;
    });
  } else {
    // For space-separated: match includes boundaries, groups capture before and after boundaries
    // Extract the actual matched word (preserving original case) from the match
    return sentence.replace(searchRegex, (match, before, after) => {
      // The word is in the middle: extract it by removing boundaries
      const wordInMatch = match.slice((before || '').length, match.length - (after || '').length);
      const highlightedWord = `<mark style="background-color: #ffeb3b; padding: 2px 0; font-weight: 500;">${wordInMatch}</mark>`;
      return (before || '') + highlightedWord + (after || '');
    });
  }
}

