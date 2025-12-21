import type { MistakenPair } from '../types';
import pairsData from '../assets/pairs.json';

const STORAGE_KEY = 'hanzi-mistaken-pairs';

export const getPairs = (): MistakenPair[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // If parsing fails, fall back to default
    }
  }
  // Seed from pairs.json if no stored data
  const defaultPairs = pairsData as MistakenPair[];
  savePairs(defaultPairs);
  return defaultPairs;
};

export const savePairs = (pairs: MistakenPair[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
};

export const addPair = (pair: MistakenPair): void => {
  const pairs = getPairs();
  pairs.push(pair);
  savePairs(pairs);
};

export const updatePair = (index: number, pair: MistakenPair): void => {
  const pairs = getPairs();
  if (index >= 0 && index < pairs.length) {
    pairs[index] = pair;
    savePairs(pairs);
  }
};

export const deletePair = (index: number): void => {
  const pairs = getPairs();
  if (index >= 0 && index < pairs.length) {
    pairs.splice(index, 1);
    savePairs(pairs);
  }
};

const HIGHSCORE_KEY = 'hanzi-mistaken-pairs-highscore';

export const getHighscore = (): number => {
  const stored = localStorage.getItem(HIGHSCORE_KEY);
  if (stored) {
    try {
      return parseInt(stored, 10);
    } catch {
      return 0;
    }
  }
  return 0;
};

export const setHighscore = (score: number): void => {
  localStorage.setItem(HIGHSCORE_KEY, score.toString());
  window.dispatchEvent(new Event('highscoreChanged'));
};

export const clearHighscore = (): void => {
  localStorage.removeItem(HIGHSCORE_KEY);
  window.dispatchEvent(new Event('highscoreChanged'));
};



