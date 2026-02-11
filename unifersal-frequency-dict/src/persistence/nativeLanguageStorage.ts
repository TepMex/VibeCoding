import type { Language } from '../utils/languageDetection';

const STORAGE_KEY = 'nativeLanguage';

const DEFAULT_NATIVE_LANGUAGE: Language = 'english';

export function loadNativeLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored as Language;
    }
    return DEFAULT_NATIVE_LANGUAGE;
  } catch (error) {
    console.error('Failed to load native language from localStorage:', error);
    return DEFAULT_NATIVE_LANGUAGE;
  }
}

export function saveNativeLanguage(nativeLanguage: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, nativeLanguage);
  } catch (error) {
    console.error('Failed to save native language to localStorage:', error);
  }
}



