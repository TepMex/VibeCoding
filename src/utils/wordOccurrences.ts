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
    const searchRegex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    
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
  // For space-separated languages, match whole words with word boundaries
  const searchRegex =
    language === 'chinese'
      ? new RegExp(escapedWord, 'gi')
      : new RegExp(`\\b${escapedWord}\\b`, 'gi');
  
  // Replace matches with highlighted version
  return sentence.replace(searchRegex, (match) => {
    return `<mark style="background-color: #ffeb3b; padding: 2px 0; font-weight: 500;">${match}</mark>`;
  });
}

