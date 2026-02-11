import { PREDEFINED_LISTS } from '../data/predefinedLists';

// Check if a character is a hanzi (Chinese character)
const isHanzi = (char: string): boolean => {
  return /[\u4e00-\u9fff]/.test(char);
};

// Build a map of hanzi to HSK level (1-6)
// Only include Old HSK lists (1-6)
let hanziToHSKLevelMap: Map<string, number> | null = null;

function buildHanziToHSKLevelMap(): Map<string, number> {
  if (hanziToHSKLevelMap) {
    return hanziToHSKLevelMap;
  }

  const map = new Map<string, number>();
  
  // Process Old HSK lists (1-6)
  PREDEFINED_LISTS.forEach((list) => {
    const match = list.name.match(/^Old HSK (\d+)$/);
    if (match) {
      const level = parseInt(match[1], 10);
      const hanziChars = list.data.split('');
      hanziChars.forEach((hanzi) => {
        if (isHanzi(hanzi)) {
          // If hanzi already exists, keep the higher level
          const existingLevel = map.get(hanzi);
          if (!existingLevel || level > existingLevel) {
            map.set(hanzi, level);
          }
        }
      });
    }
  });

  hanziToHSKLevelMap = map;
  return map;
}

/**
 * Determine the HSK level for a Chinese word based on its hanzi characters.
 * 
 * Rules:
 * - If all hanzi are from one HSK level, return that level
 * - If hanzi are from different HSK levels, return the highest level
 * - If one or more hanzi are not in any HSK level, return null (no HSK level)
 * 
 * @param word The Chinese word to analyze
 * @returns The HSK level (1-6) or null if not determinable
 */
export function getHSKLevel(word: string): number | null {
  const map = buildHanziToHSKLevelMap();
  const hanziChars = word.split('').filter(isHanzi);
  
  if (hanziChars.length === 0) {
    return null;
  }

  const levels: number[] = [];
  
  for (const hanzi of hanziChars) {
    const level = map.get(hanzi);
    if (level) {
      levels.push(level);
    } else {
      // If any hanzi is not in any HSK level, return null
      return null;
    }
  }

  if (levels.length === 0) {
    return null;
  }

  // Return the highest level
  return Math.max(...levels);
}

/**
 * Get the color for a given HSK level
 * @param level HSK level (1-6)
 * @returns Color string or undefined if not found
 */
export function getHSKLevelColor(level: number): string | undefined {
  const list = PREDEFINED_LISTS.find((l) => l.name === `Old HSK ${level}`);
  return list?.color;
}


