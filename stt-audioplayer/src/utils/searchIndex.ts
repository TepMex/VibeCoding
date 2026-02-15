/**
 * IndexedDB manager for storing and loading search indices
 * Provides persistent storage for pre-computed fuzzy search data
 */

const DB_NAME = 'FuzzySearchDB';
const DB_VERSION = 1;
const STORE_NAME = 'bookIndices';

export interface BookIndexMetadata {
  title: string;
  chunkCount: number;
  createdAt: number;
  version: number;
  chapters?: ChapterRange[];
}

export interface ChapterRange {
  id: string;
  title: string;
  startChunkIndex: number;
  endChunkIndex: number;
}

export interface BookIndex {
  bookHash: string;
  normalizedChunks: string[];
  nGrams: {
    [n: number]: { [ngram: string]: number[] };
  };
  wordPositions: { [word: string]: number[] };
  metadata: BookIndexMetadata;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB database
 */
function getDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'bookHash' });
        store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Check if an index exists for the given book hash
 */
export async function indexExists(bookHash: string): Promise<boolean> {
  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(bookHash);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        resolve(!!request.result);
      };
      request.onerror = () => {
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Load an index from IndexedDB
 */
export async function loadIndex(bookHash: string): Promise<BookIndex | null> {
  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(bookHash);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(result as BookIndex);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        reject(new Error('Failed to load index from IndexedDB'));
      };
    });
  } catch (error) {
    console.warn('IndexedDB not available, falling back to in-memory index:', error);
    return null;
  }
}

/**
 * Save an index to IndexedDB
 */
export async function saveIndex(index: BookIndex): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(index);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error('Failed to save index to IndexedDB'));
      };
    });
  } catch (error) {
    console.warn('IndexedDB not available, index will not be persisted:', error);
    // Don't throw - allow fallback to in-memory index
  }
}

/**
 * Clear an index from IndexedDB
 */
export async function clearIndex(bookHash: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(bookHash);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error('Failed to clear index from IndexedDB'));
      };
    });
  } catch (error) {
    console.warn('IndexedDB not available:', error);
  }
}

/**
 * Generate a hash from text content (simple MD5-like hash)
 * Uses a simple hash function for browser compatibility
 */
export async function generateBookHash(text: string): Promise<string> {
  // Use Web Crypto API if available, otherwise fallback to simple hash
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback: simple hash function
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

