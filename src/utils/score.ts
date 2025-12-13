/**
 * Scoring formula based on game design best practices:
 * - Base score: 100 points for correct answer
 * - Time multiplier: Exponential decay (fast answers rewarded exponentially more)
 * - Streak multiplier: Linear growth with cap (consecutive correct answers boost score)
 * 
 * Formula: baseScore * timeMultiplier * streakMultiplier
 */

const BASE_SCORE = 100;
const MAX_TIME_MS = 4000; // Answers slower than this get minimum time multiplier
const MIN_TIME_MULTIPLIER = 0.3; // Minimum time bonus (30% of base score)
const STREAK_GROWTH_RATE = 0.25; // Each streak adds 25% multiplier
const MAX_STREAK_MULTIPLIER = 4.0; // Cap streak at 4x (reached at streak 13)

/**
 * Calculate time multiplier using exponential decay
 * Formula: e^(-time/decayConstant) scaled to [MIN_TIME_MULTIPLIER, 1.0]
 * Fast answers (< 500ms) get ~1.0 multiplier
 * Slow answers (> 3000ms) get ~MIN_TIME_MULTIPLIER
 */
function calculateTimeMultiplier(timeToAnswer: number): number {
  // Clamp time to reasonable bounds
  const clampedTime = Math.max(0, Math.min(timeToAnswer, MAX_TIME_MS));
  
  // Exponential decay: faster answers get exponentially better scores
  // Using e^(-t/tau) where tau = 1200ms gives good curve
  const decayConstant = 1200;
  const rawMultiplier = Math.exp(-clampedTime / decayConstant);
  
  // Scale from [e^(-MAX_TIME/decayConstant), 1.0] to [MIN_TIME_MULTIPLIER, 1.0]
  const minRawValue = Math.exp(-MAX_TIME_MS / decayConstant);
  const scaledMultiplier = MIN_TIME_MULTIPLIER + 
    (rawMultiplier - minRawValue) / (1.0 - minRawValue) * (1.0 - MIN_TIME_MULTIPLIER);
  
  return Math.max(MIN_TIME_MULTIPLIER, Math.min(1.0, scaledMultiplier));
}

/**
 * Calculate streak multiplier
 * Formula: 1 + STREAK_GROWTH_RATE * (streak - 1), capped at MAX_STREAK_MULTIPLIER
 * Streak of 1: 1.0x
 * Streak of 2: 1.25x
 * Streak of 3: 1.5x
 * Streak of 13+: 4.0x (capped)
 */
function calculateStreakMultiplier(numberInStreak: number): number {
  if (numberInStreak < 1) return 1.0;
  
  const multiplier = 1.0 + STREAK_GROWTH_RATE * (numberInStreak - 1);
  return Math.min(multiplier, MAX_STREAK_MULTIPLIER);
}

/**
 * Calculate score for an answer
 * 
 * @param isCorrect - Whether the answer was correct
 * @param timeToAnswer - Time taken to answer in milliseconds
 * @param numberInStreak - Current streak count (consecutive correct answers)
 * @returns Object with score earned and whether streak continues
 */
export function calculateScore(
  isCorrect: boolean,
  timeToAnswer: number,
  numberInStreak: number
): { score: number; streakContinues: boolean } {
  // Incorrect answer: no points, streak resets
  if (!isCorrect) {
    return { score: 0, streakContinues: false };
  }
  
  // Correct answer: calculate score with multipliers
  const timeMultiplier = calculateTimeMultiplier(timeToAnswer);
  const streakMultiplier = calculateStreakMultiplier(numberInStreak);
  
  const finalScore = Math.floor(BASE_SCORE * timeMultiplier * streakMultiplier);
  
  return {
    score: finalScore,
    streakContinues: true,
  };
}

/**
 * Get the maximum possible score (instant answer, max streak)
 */
export function getMaxScore(): number {
  return Math.floor(BASE_SCORE * 1.0 * MAX_STREAK_MULTIPLIER);
}

