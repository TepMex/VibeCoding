import type { Language } from './languageDetection';

const STORAGE_KEY_PREFIX = 'exclusionList_';

function getStorageKey(language: Language): string {
  return `${STORAGE_KEY_PREFIX}${language}`;
}

export function loadExclusionList(language: Language): string {
  try {
    const stored = localStorage.getItem(getStorageKey(language));
    return stored || '';
  } catch (error) {
    console.error('Failed to load exclusion list from localStorage:', error);
    return '';
  }
}

export function saveExclusionList(language: Language, exclusionList: string): void {
  try {
    localStorage.setItem(getStorageKey(language), exclusionList);
  } catch (error) {
    console.error('Failed to save exclusion list to localStorage:', error);
  }
}

