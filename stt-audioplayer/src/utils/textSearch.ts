import Fuse from 'fuse.js';

export interface SearchResult {
  index: number;
  text: string;
  score?: number;
}

let fuse: Fuse<string> | null = null;
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

  fuse = new Fuse(chunks, {
    threshold: 0.4, // Lower = more strict matching
    minMatchCharLength: 3,
    includeScore: true,
  });
}

/**
 * Search for text in the indexed book
 * Returns the best matching chunk and its index
 */
export function searchText(query: string): SearchResult | null {
  if (!fuse || textChunks.length === 0) {
    return null;
  }

  const results = fuse.search(query, { limit: 1 });

  if (results.length === 0) {
    return null;
  }

  const bestMatch = results[0];
  return {
    index: bestMatch.refIndex,
    text: bestMatch.item,
    score: bestMatch.score,
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

