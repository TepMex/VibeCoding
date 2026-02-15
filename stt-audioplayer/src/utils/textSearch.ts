import { fuzzySearch, normalizeText, generateNGrams } from './fuzzySearch';
import {
  generateBookHash,
  indexExists,
  loadIndex,
  saveIndex,
  type BookIndex,
  type ChapterRange,
} from './searchIndex';
import type { Chapter } from './textExtractor';

export interface SearchResult {
  index: number;
  text: string;
  score?: number;
}

let textChunks: string[] = [];
let currentBookHash: string | null = null;
let bookIndex: BookIndex | null = null;
let chapterRanges: ChapterRange[] = [];

function splitTextToChunks(text: string): string[] {
  return text
    .split(/([.!?]\s+|\n\n+)/)
    .filter((chunk) => chunk.trim().length > 10)
    .map((chunk) => chunk.trim());
}

function buildChapterRanges(chapters: Chapter[] | undefined): ChapterRange[] {
  if (!chapters || chapters.length === 0) return [];

  const ranges: ChapterRange[] = [];
  let cursor = 0;
  for (const chapter of chapters) {
    const chapterChunks = splitTextToChunks(chapter.text || '');
    if (chapterChunks.length === 0) continue;

    const startChunkIndex = cursor;
    const endChunkIndex = cursor + chapterChunks.length - 1;
    ranges.push({
      id: chapter.id,
      title: chapter.title,
      startChunkIndex,
      endChunkIndex,
    });
    cursor += chapterChunks.length;
  }

  return ranges;
}

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
      chapters: chapterRanges,
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
  onProgress?: (progress: number) => void,
  chapters?: Chapter[],
): Promise<void> {
  const chunks = splitTextToChunks(text);

  textChunks = chunks;
  chapterRanges = buildChapterRanges(chapters);

  // Generate book hash
  currentBookHash = await generateBookHash(text);

  // Check if index already exists
  const exists = await indexExists(currentBookHash);
  if (exists) {
    const loaded = await loadIndex(currentBookHash);
    if (loaded) {
      bookIndex = loaded;
      chapterRanges = loaded.metadata.chapters || [];
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
export function searchText(query: string, chapterId?: string): SearchResult | null {
  if (textChunks.length === 0) {
    return null;
  }

  const chapter = chapterId ? chapterRanges.find((item) => item.id === chapterId) : null;
  const fullChunks = bookIndex?.normalizedChunks || textChunks;
  const rangeStart = chapter ? chapter.startChunkIndex : 0;
  const rangeEnd = chapter ? chapter.endChunkIndex : fullChunks.length - 1;
  const scopedChunks = fullChunks.slice(rangeStart, rangeEnd + 1);
  const result = fuzzySearch(query, scopedChunks, 0.25);

  if (!result) {
    return null;
  }

  const absoluteIndex = rangeStart + result.index;

  // Return original chunk text (not normalized) for display
  return {
    index: absoluteIndex,
    text: textChunks[absoluteIndex] || result.text,
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

export function getChapterRanges(): ChapterRange[] {
  return chapterRanges;
}


