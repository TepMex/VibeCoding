import { fuzzySearch, normalizeText, generateNGrams } from './fuzzySearch';
import { 
  generateBookHash, 
  indexExists, 
  loadIndex, 
  saveIndex, 
  type BookIndex 
} from './searchIndex';

export interface SearchResult {
  index: number;
  text: string;
  score?: number;
}

let textChunks: string[] = [];
let currentBookHash: string | null = null;
let bookIndex: BookIndex | null = null;

/**
 * Build search index from chunks (normalize, compute n-grams, etc.)
 */
async function buildIndex(
  chunks: string[],
  title: string,
  onProgress?: (progress: number) => void
): Promise<BookIndex> {
  const normalizedChunks: string[] = [];
  const nGrams: { [n: number]: { [ngram: string]: number[] } } = {
    2: {},
    3: {},
    4: {},
  };
  const wordPositions: { [word: string]: number[] } = {};

  const totalChunks = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const normalized = normalizeText(chunk);
    normalizedChunks.push(normalized);

    // Generate n-grams for this chunk
    for (const n of [2, 3, 4]) {
      const ngrams = generateNGrams(normalized, n);
      for (const ngram of ngrams) {
        if (!nGrams[n][ngram]) {
          nGrams[n][ngram] = [];
        }
        nGrams[n][ngram].push(i);
      }
    }

    // Extract words for word positions
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    for (const word of words) {
      if (!wordPositions[word]) {
        wordPositions[word] = [];
      }
      if (!wordPositions[word].includes(i)) {
        wordPositions[word].push(i);
      }
    }

    // Report progress
    if (onProgress && i % 100 === 0) {
      onProgress((i + 1) / totalChunks);
    }
  }

  if (onProgress) {
    onProgress(1.0);
  }

  return {
    bookHash: currentBookHash!,
    normalizedChunks,
    nGrams,
    wordPositions,
    metadata: {
      title,
      chunkCount: chunks.length,
      createdAt: Date.now(),
      version: 1,
    },
  };
}

/**
 * Create search index from book text
 * Splits text into chunks and builds IndexedDB index
 */
export async function createSearchIndex(
  text: string,
  title?: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  // Split text into sentences and paragraphs for better matching
  const chunks = text
    .split(/([.!?]\s+|\n\n+)/)
    .filter((chunk) => chunk.trim().length > 10) // Filter out very short chunks
    .map((chunk) => chunk.trim());

  textChunks = chunks;

  // Generate book hash
  currentBookHash = await generateBookHash(text);

  // Check if index already exists
  const exists = await indexExists(currentBookHash);
  if (exists) {
    const loaded = await loadIndex(currentBookHash);
    if (loaded) {
      bookIndex = loaded;
      return;
    }
  }

  // Build new index
  bookIndex = await buildIndex(chunks, title || 'Untitled', onProgress);

  // Save to IndexedDB
  await saveIndex(bookIndex);
}

/**
 * Search for text in the indexed book using robust fuzzy search
 * Returns the best matching chunk and its index
 * Handles transcription errors by using multiple similarity metrics
 * Uses pre-normalized chunks from IndexedDB if available
 * Uses n-gram index for candidate filtering when available
 */
export function searchText(query: string): SearchResult | null {
  if (textChunks.length === 0) {
    return null;
  }

  // Use pre-normalized chunks from index if available, otherwise use original chunks
  const chunksToSearch = bookIndex?.normalizedChunks || textChunks;
  
  // Use n-gram index for candidate filtering if available
  const nGramIndex = bookIndex?.nGrams;

  const result = fuzzySearch(query, chunksToSearch, 0.25, nGramIndex);

  if (!result) {
    return null;
  }

  // Return original chunk text (not normalized) for display
  return {
    index: result.index,
    text: textChunks[result.index] || result.text,
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


