export type FileType = 'audio' | 'text';

export interface RecentFile {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  lastModified: number;
  lastOpened: number;
  hasCachedContent: boolean;
  hasHandle: boolean;
}

const MAX_RECENT_FILES = 10;
const MAX_CACHE_FILE_SIZE_BYTES = 200 * 1024 * 1024;

const RECENT_AUDIO_KEY = 'recentAudioFiles';
const RECENT_TEXT_KEY = 'recentTextFiles';
const CURRENT_AUDIO_KEY = 'currentAudioFile';
const CURRENT_TEXT_KEY = 'currentTextFile';

const DB_NAME = 'RecentFilesDB';
const DB_VERSION = 1;
const HANDLES_STORE = 'fileHandles';

let dbPromise: Promise<IDBDatabase> | null = null;

interface StoredHandle {
  id: string;
  type: FileType;
  handle: FileSystemFileHandle;
  createdAt: number;
  lastOpened: number;
}

function getRecentStorageKey(type: FileType): string {
  return type === 'audio' ? RECENT_AUDIO_KEY : RECENT_TEXT_KEY;
}

function getCurrentStorageKey(type: FileType): string {
  return type === 'audio' ? CURRENT_AUDIO_KEY : CURRENT_TEXT_KEY;
}

function parseRecentFiles(raw: string | null): RecentFile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentFile => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as Partial<RecentFile>;
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.filename === 'string' &&
          typeof candidate.size === 'number' &&
          typeof candidate.mimeType === 'string' &&
          typeof candidate.lastModified === 'number' &&
          typeof candidate.lastOpened === 'number' &&
          typeof candidate.hasCachedContent === 'boolean' &&
          typeof candidate.hasHandle === 'boolean'
        );
      })
      .sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

function readRecentFiles(type: FileType): RecentFile[] {
  if (typeof localStorage === 'undefined') return [];
  return parseRecentFiles(localStorage.getItem(getRecentStorageKey(type)));
}

function writeRecentFiles(type: FileType, files: RecentFile[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(getRecentStorageKey(type), JSON.stringify(files));
}

async function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open file handles database'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(HANDLES_STORE)) {
        const store = db.createObjectStore(HANDLES_STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('lastOpened', 'lastOpened', { unique: false });
      }
    };
  });

  return dbPromise;
}

export function isFSAAAvailable(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export function isOPFSAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage;
}

async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  if (!isOPFSAvailable()) {
    throw new Error('OPFS not available');
  }
  return navigator.storage.getDirectory();
}

function iterateDirectory(
  dir: FileSystemDirectoryHandle,
): AsyncIterable<[string, FileSystemHandle]> {
  return dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
}

async function getTypeDirectory(type: FileType, create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await getOPFSRoot();
  const recentFilesDir = await root.getDirectoryHandle('recent-files', { create });
  return recentFilesDir.getDirectoryHandle(type, { create });
}

function removeRecentFile(type: FileType, fileId: string): void {
  const files = readRecentFiles(type).filter((file) => file.id !== fileId);
  writeRecentFiles(type, files);
  const currentId = getCurrentFileId(type);
  if (currentId === fileId) {
    setCurrentFileId(type, null);
  }
}

export async function saveFileHandle(
  type: FileType,
  fileId: string,
  handle: FileSystemFileHandle,
): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([HANDLES_STORE], 'readwrite');
    const store = transaction.objectStore(HANDLES_STORE);
    const payload: StoredHandle = {
      id: fileId,
      type,
      handle,
      createdAt: Date.now(),
      lastOpened: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(payload);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save file handle'));
    });
  } catch (error) {
    console.warn('[fileStorage] Failed to persist file handle:', error);
  }
}

export async function loadFileHandle(fileId: string): Promise<FileSystemFileHandle | null> {
  try {
    const db = await getDB();
    const transaction = db.transaction([HANDLES_STORE], 'readonly');
    const store = transaction.objectStore(HANDLES_STORE);

    const item = await new Promise<StoredHandle | null>((resolve, reject) => {
      const request = store.get(fileId);
      request.onsuccess = () => resolve((request.result as StoredHandle | undefined) ?? null);
      request.onerror = () => reject(new Error('Failed to load file handle'));
    });

    return item?.handle ?? null;
  } catch (error) {
    console.warn('[fileStorage] Failed to load file handle:', error);
    return null;
  }
}

export async function deleteFileHandle(fileId: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([HANDLES_STORE], 'readwrite');
    const store = transaction.objectStore(HANDLES_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(fileId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete file handle'));
    });
  } catch (error) {
    console.warn('[fileStorage] Failed to delete file handle:', error);
  }
}

export async function cacheFileInOPFS(fileId: string, type: FileType, file: File): Promise<void> {
  if (!isOPFSAvailable()) {
    throw new Error('OPFS not available');
  }
  if (file.size > MAX_CACHE_FILE_SIZE_BYTES) {
    throw new Error('File too large for cache');
  }

  const typeDir = await getTypeDirectory(type, true);
  const fileHandle = await typeDir.getFileHandle(fileId, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
}

export async function loadFileFromOPFS(
  fileId: string,
  type: FileType,
  filename: string,
  mimeType: string,
  lastModified: number,
): Promise<File> {
  const typeDir = await getTypeDirectory(type, false);
  const fileHandle = await typeDir.getFileHandle(fileId, { create: false });
  const file = await fileHandle.getFile();
  const data = await file.arrayBuffer();
  return new File([data], filename, {
    type: mimeType,
    lastModified,
  });
}

export async function deleteFileFromOPFS(fileId: string, type: FileType): Promise<void> {
  if (!isOPFSAvailable()) return;
  try {
    const typeDir = await getTypeDirectory(type, false);
    await typeDir.removeEntry(fileId, { recursive: false });
  } catch {
    // Ignore: file may already be absent.
  }
}

export async function getOPFSCacheSize(type?: FileType): Promise<number> {
  if (!isOPFSAvailable()) return 0;

  const accumulateDir = async (dir: FileSystemDirectoryHandle): Promise<number> => {
    let total = 0;
    for await (const [, handle] of iterateDirectory(dir)) {
      if (handle.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        total += file.size;
      } else {
        total += await accumulateDir(handle as FileSystemDirectoryHandle);
      }
    }
    return total;
  };

  try {
    if (type) {
      const dir = await getTypeDirectory(type, false);
      return accumulateDir(dir);
    }
    const root = await getOPFSRoot();
    const recentFilesDir = await root.getDirectoryHandle('recent-files', { create: false });
    return accumulateDir(recentFilesDir);
  } catch {
    return 0;
  }
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

async function generateFileId(file: File): Promise<string> {
  const seed = `${file.name}|${file.size}|${file.lastModified}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(seed);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
  }
  return simpleHash(seed);
}

async function cleanupEntry(type: FileType, entry: RecentFile): Promise<void> {
  if (entry.hasCachedContent) {
    await deleteFileFromOPFS(entry.id, type);
  }
  if (entry.hasHandle) {
    await deleteFileHandle(entry.id);
  }
}

async function enforceLimit(type: FileType, files: RecentFile[]): Promise<RecentFile[]> {
  if (files.length <= MAX_RECENT_FILES) {
    return files;
  }

  const kept = files.slice(0, MAX_RECENT_FILES);
  const toRemove = files.slice(MAX_RECENT_FILES);
  await Promise.all(toRemove.map((entry) => cleanupEntry(type, entry)));
  return kept;
}

function touchRecentFile(type: FileType, fileId: string): void {
  const files = readRecentFiles(type);
  const target = files.find((file) => file.id === fileId);
  if (!target) return;
  target.lastOpened = Date.now();
  files.sort((a, b) => b.lastOpened - a.lastOpened);
  writeRecentFiles(type, files);
}

export async function saveRecentFile(type: FileType, file: File, handle?: FileSystemFileHandle): Promise<string> {
  const fileId = await generateFileId(file);
  const files = readRecentFiles(type);
  const existing = files.find((item) => item.id === fileId);

  let hasHandle = existing?.hasHandle ?? false;
  let hasCachedContent = existing?.hasCachedContent ?? false;

  if (handle && isFSAAAvailable()) {
    await saveFileHandle(type, fileId, handle);
    hasHandle = true;
  }

  if (isOPFSAvailable() && file.size <= MAX_CACHE_FILE_SIZE_BYTES) {
    try {
      await cacheFileInOPFS(fileId, type, file);
      hasCachedContent = true;
    } catch (error) {
      console.warn('[fileStorage] Failed to cache file in OPFS:', error);
    }
  }

  const nextEntry: RecentFile = {
    id: fileId,
    filename: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    lastModified: file.lastModified,
    lastOpened: Date.now(),
    hasCachedContent,
    hasHandle,
  };

  const next = [
    nextEntry,
    ...files.filter((item) => item.id !== fileId),
  ].sort((a, b) => b.lastOpened - a.lastOpened);

  const limited = await enforceLimit(type, next);
  writeRecentFiles(type, limited);
  return fileId;
}

export async function getRecentFiles(type: FileType): Promise<RecentFile[]> {
  return readRecentFiles(type).sort((a, b) => b.lastOpened - a.lastOpened).slice(0, MAX_RECENT_FILES);
}

export async function loadRecentFile(fileId: string, type: FileType): Promise<File> {
  const files = readRecentFiles(type);
  const entry = files.find((item) => item.id === fileId);
  if (!entry) {
    throw new Error('Recent file metadata not found');
  }

  if (entry.hasHandle && isFSAAAvailable()) {
    try {
      const handle = await loadFileHandle(fileId);
      if (handle) {
        const file = await handle.getFile();
        touchRecentFile(type, fileId);
        return file;
      }
    } catch (error) {
      console.warn('[fileStorage] Failed to load file from FSAA handle, trying OPFS:', error);
    }
  }

  if (entry.hasCachedContent && isOPFSAvailable()) {
    try {
      const restored = await loadFileFromOPFS(fileId, type, entry.filename, entry.mimeType, entry.lastModified);
      touchRecentFile(type, fileId);
      return restored;
    } catch (error) {
      console.warn('[fileStorage] Failed to load file from OPFS:', error);
      removeRecentFile(type, fileId);
      throw new Error(`Could not restore ${entry.filename}. Please select it again.`);
    }
  }

  throw new Error(`No cached data is available for ${entry.filename}. Please select it again.`);
}

function getCurrentFileId(type: FileType): string | null {
  if (typeof localStorage === 'undefined') return null;
  const key = getCurrentStorageKey(type);
  const value = localStorage.getItem(key);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { fileId?: unknown } | null;
    return typeof parsed?.fileId === 'string' ? parsed.fileId : null;
  } catch {
    return null;
  }
}

function setCurrentFileId(type: FileType, fileId: string | null): void {
  if (typeof localStorage === 'undefined') return;
  const key = getCurrentStorageKey(type);
  if (!fileId) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify({ fileId }));
}

export async function setCurrentFile(type: FileType, fileId: string): Promise<void> {
  setCurrentFileId(type, fileId);
}

export async function getCurrentFile(type: FileType): Promise<File | null> {
  const fileId = getCurrentFileId(type);
  if (!fileId) return null;
  try {
    return await loadRecentFile(fileId, type);
  } catch (error) {
    console.warn('[fileStorage] Failed to restore current file:', error);
    setCurrentFileId(type, null);
    return null;
  }
}

export async function clearRecentFiles(type: FileType, keepCount = 0): Promise<void> {
  const files = readRecentFiles(type).sort((a, b) => b.lastOpened - a.lastOpened);
  const kept = files.slice(0, Math.max(0, keepCount));
  const toRemove = files.slice(Math.max(0, keepCount));

  await Promise.all(toRemove.map((entry) => cleanupEntry(type, entry)));
  writeRecentFiles(type, kept);

  const currentId = getCurrentFileId(type);
  if (currentId && !kept.some((file) => file.id === currentId)) {
    setCurrentFileId(type, null);
  }
}
