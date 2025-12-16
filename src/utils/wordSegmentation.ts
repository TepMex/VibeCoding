import initJieba, { cut } from 'jieba-wasm/web';
import type { Language } from './languageDetection';

let jiebaInitialized = false;
let jiebaInitPromise: Promise<void> | null = null;

async function ensureJiebaInitialized(): Promise<void> {
  if (jiebaInitialized) {
    return;
  }

  if (jiebaInitPromise) {
    return jiebaInitPromise;
  }

  jiebaInitPromise = initJieba().then(() => {
    jiebaInitialized = true;
  });

  return jiebaInitPromise;
}

export async function segmentText(text: string, language: Language): Promise<string[]> {
  if (language === 'chinese') {
    // Ensure jieba-wasm is initialized before use
    await ensureJiebaInitialized();
    
    // Use jieba-wasm for Chinese word segmentation
    // Enable HMM (Hidden Markov Model) for better unknown word detection
    const words = cut(text, true);
    // Filter out empty strings and whitespace-only strings
    return words.filter(word => word.trim().length > 0);
  } else {
    // For space-separated languages, split by whitespace and punctuation
    // Keep words that contain at least one letter or number
    const words = text
      .split(/[\s\p{P}\p{Z}]+/u)
      .filter(word => word.trim().length > 0 && /[\p{L}\p{N}]/u.test(word));
    return words;
  }
}

