export interface WordFrequency {
  word: string;
  frequency: number;
}

export function calculateWordFrequencies(words: string[]): WordFrequency[] {
  const frequencyMap = new Map<string, number>();
  
  for (const word of words) {
    const normalizedWord = word.toLowerCase();
    frequencyMap.set(normalizedWord, (frequencyMap.get(normalizedWord) || 0) + 1);
  }
  
  const frequencies: WordFrequency[] = Array.from(frequencyMap.entries())
    .map(([word, frequency]) => ({ word, frequency }))
    .sort((a, b) => b.frequency - a.frequency);
  
  return frequencies;
}

export function normalizeExclusionList(exclusionList: string): Set<string> {
  return new Set(
    exclusionList
      .split('\n')
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length > 0)
  );
}



