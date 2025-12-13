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



