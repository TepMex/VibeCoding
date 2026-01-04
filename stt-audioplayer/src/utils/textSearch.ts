import { fuzzySearch } from './fuzzySearch';

export interface SearchResult {
  index: number;
  text: string;
  score?: number;
}

let textChunks: string[] = [];

/**
 * Create search index from book text
 * Splits text into chunks for better search results
 */
export function createSearchIndex(text: string): void {
  // Split text into sentences and paragraphs for better matching
  // Split by sentence endings and paragraph breaks
  const chunks = text
    .split(/([.!?]\s+|\n\n+)/)
    .filter((chunk) => chunk.trim().length > 10) // Filter out very short chunks
    .map((chunk) => chunk.trim());

  textChunks = chunks;
}

/**
 * Search for text in the indexed book using robust fuzzy search
 * Returns the best matching chunk and its index
 * Handles transcription errors by using multiple similarity metrics
 */
export function searchText(query: string): SearchResult | null {
  if (textChunks.length === 0) {
    return null;
  }

  const result = fuzzySearch(query, textChunks, 0.25);

  if (!result) {
    return null;
  }

  return {
    index: result.index,
    text: result.text,
    score: result.score,
  };
}

/**
 * Get text chunk by index
 */
export function getChunkByIndex(index: number): string | null {
  if (index < 0 || index >= textChunks.length) {
    return null;
  }
  return textChunks[index];
}

/**
 * Get all chunks (for display)
 */
export function getAllChunks(): string[] {
  return textChunks;
}


