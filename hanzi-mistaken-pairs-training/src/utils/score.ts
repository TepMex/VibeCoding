/**
 * Simplified scoring: just count maximum correct answers in a row
 * Only used in Survival mode
 */

/**
 * Calculate maximum correct answers in a row (score)
 * 
 * @param isCorrect - Whether the answer was correct
 * @param currentStreak - Current streak count (consecutive correct answers)
 * @returns Object with score (max streak) and whether streak continues
 */
export function calculateScore(
  isCorrect: boolean,
  currentStreak: number
): { score: number; streakContinues: boolean } {
  if (!isCorrect) {
    return { score: currentStreak, streakContinues: false };
  }
  
  const newStreak = currentStreak + 1;
  return {
    score: newStreak,
    streakContinues: true,
  };
}








