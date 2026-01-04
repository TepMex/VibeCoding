/**
 * Robust fuzzy search algorithm for handling transcription errors
 * Uses multiple strategies: n-gram similarity, word-level matching, sequence alignment, and sliding window
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity between two strings (0 = identical, 1 = completely different)
 */
function stringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 0;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return distance / maxLen;
}

/**
 * Normalize text: remove punctuation, lowercase, trim
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate n-grams from text
 */
function generateNGrams(text: string, n: number): Set<string> {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const ngrams = new Set<string>();
  
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }
  
  return ngrams;
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate n-gram similarity between two texts
 */
function nGramSimilarity(text1: string, text2: string, n: number = 2): number {
  const ngrams1 = generateNGrams(text1, n);
  const ngrams2 = generateNGrams(text2, n);
  return jaccardSimilarity(ngrams1, ngrams2);
}

/**
 * Check if two words are similar (handles cases like "soberly" vs "so really")
 * Uses character-level matching with flexible thresholds
 */
function areWordsSimilar(word1: string, word2: string, threshold: number = 0.7): boolean {
  if (word1 === word2) return true;
  
  const similarity = 1 - stringSimilarity(word1, word2);
  if (similarity >= threshold) return true;
  
  // Check if one word is a substring of the other (for cases like "governor" vs "Governor")
  const longer = word1.length > word2.length ? word1 : word2;
  const shorter = word1.length > word2.length ? word2 : word1;
  if (longer.includes(shorter) && shorter.length >= 3) return true;
  
  return false;
}

/**
 * Calculate similarity between a word and a phrase (handles word splitting/merging)
 * Example: "soberly" should match "so really"
 */
function wordToPhraseSimilarity(word: string, phrase: string): number {
  const wordNorm = normalizeText(word);
  const phraseNorm = normalizeText(phrase);
  
  // Direct match
  if (wordNorm === phraseNorm) return 1.0;
  
  // Check if word matches when spaces removed from phrase (handles "soberly" vs "so really")
  const phraseNoSpaces = phraseNorm.replace(/\s+/g, '');
  const directSimilarity = 1 - stringSimilarity(wordNorm, phraseNoSpaces);
  if (directSimilarity > 0.75) return directSimilarity;
  
  // Check if phrase without spaces matches word (reverse direction)
  const wordNoSpaces = wordNorm.replace(/\s+/g, '');
  const reverseSimilarity = 1 - stringSimilarity(wordNoSpaces, phraseNorm);
  if (reverseSimilarity > 0.75) return reverseSimilarity;
  
  // Check character-level similarity
  const charSimilarity = 1 - stringSimilarity(wordNorm, phraseNorm);
  if (charSimilarity > 0.7) return charSimilarity;
  
  // Check if all characters are similar when ignoring spaces
  const wordChars = wordNoSpaces.split('').sort().join('');
  const phraseChars = phraseNoSpaces.split('').sort().join('');
  const charSetSimilarity = 1 - stringSimilarity(wordChars, phraseChars);
  if (charSetSimilarity > 0.8 && Math.abs(wordNoSpaces.length - phraseNoSpaces.length) <= 2) {
    return charSetSimilarity * 0.9;
  }
  
  return charSimilarity;
}

/**
 * Find best sequence alignment between transcript and chunk words
 * Uses dynamic programming to handle word splitting, merging, and extra words
 */
function sequenceAlignmentSimilarity(
  transcriptWords: string[],
  chunkWords: string[]
): number {
  if (transcriptWords.length === 0 || chunkWords.length === 0) return 0;

  const m = transcriptWords.length;
  const n = chunkWords.length;
  
  // DP table: dp[i][j] = best similarity score for transcript[0..i] and chunk[0..j]
  const dp: number[][] = Array(m + 1).fill(null).map(() => 
    Array(n + 1).fill(0)
  );

  // Initialize: empty sequences
  for (let i = 0; i <= m; i++) dp[i][0] = 0;
  for (let j = 0; j <= n; j++) dp[0][j] = 0;

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const transcriptWord = transcriptWords[i - 1];
      const chunkWord = chunkWords[j - 1];
      
      // Match: single word to single word
      const matchScore = areWordsSimilar(transcriptWord, chunkWord, 0.6) 
        ? 1.0 
        : 1 - stringSimilarity(transcriptWord, chunkWord);
      const match = dp[i - 1][j - 1] + matchScore;
      
      // Skip in transcript (insertion in chunk)
      const skipTranscript = dp[i][j - 1] - 0.1;
      
      // Skip in chunk (insertion in transcript)
      const skipChunk = dp[i - 1][j] - 0.1;
      
      // Match word to phrase (handles word splitting: "soberly" -> "so really")
      let phraseMatch = 0;
      // Try matching transcript word to 2-word phrase in chunk
      if (j >= 2) {
        const chunkPhrase = chunkWords.slice(j - 2, j).join(' ');
        const phraseSim = wordToPhraseSimilarity(transcriptWord, chunkPhrase);
        phraseMatch = Math.max(phraseMatch, dp[i - 1][j - 2] + phraseSim * 0.9);
      }
      // Try matching chunk word to 2-word phrase in transcript
      if (i >= 2) {
        const transcriptPhrase = transcriptWords.slice(i - 2, i).join(' ');
        const phraseSim = wordToPhraseSimilarity(chunkWord, transcriptPhrase);
        phraseMatch = Math.max(phraseMatch, dp[i - 2][j - 1] + phraseSim * 0.9);
      }
      // Try matching 2-word phrases in both
      if (i >= 2 && j >= 2) {
        const transcriptPhrase = transcriptWords.slice(i - 2, i).join(' ');
        const chunkPhrase = chunkWords.slice(j - 2, j).join(' ');
        const phraseSim = wordToPhraseSimilarity(transcriptPhrase, chunkPhrase);
        phraseMatch = Math.max(phraseMatch, dp[i - 2][j - 2] + phraseSim * 0.85);
      }
      
      dp[i][j] = Math.max(match, skipTranscript, skipChunk, phraseMatch);
    }
  }

  // Normalize by maximum possible score
  const maxScore = Math.min(m, n);
  return maxScore > 0 ? dp[m][n] / (maxScore * 1.2) : 0;
}

/**
 * Calculate word-level similarity score using sequence alignment
 */
function wordLevelSimilarity(transcript: string, chunk: string): number {
  const transcriptWords = normalizeText(transcript).split(/\s+/).filter(w => w.length > 0);
  const chunkWords = normalizeText(chunk).split(/\s+/).filter(w => w.length > 0);

  if (transcriptWords.length === 0 || chunkWords.length === 0) {
    return 0;
  }

  // Use sliding window to find best matching subsequence
  let maxScore = 0;
  const windowSize = Math.min(transcriptWords.length + 3, chunkWords.length);

  for (let start = 0; start <= Math.max(0, chunkWords.length - windowSize); start++) {
    const end = Math.min(start + windowSize + 5, chunkWords.length);
    const window = chunkWords.slice(start, end);
    
    const score = sequenceAlignmentSimilarity(transcriptWords, window);
    maxScore = Math.max(maxScore, score);
  }

  // Also try reverse (chunk words in transcript window)
  const transcriptWindowSize = Math.min(chunkWords.length + 3, transcriptWords.length);
  for (let start = 0; start <= Math.max(0, transcriptWords.length - transcriptWindowSize); start++) {
    const end = Math.min(start + transcriptWindowSize + 5, transcriptWords.length);
    const window = transcriptWords.slice(start, end);
    
    const score = sequenceAlignmentSimilarity(window, chunkWords);
    maxScore = Math.max(maxScore, score);
  }

  return Math.min(1.0, maxScore);
}

/**
 * Calculate combined similarity score using multiple metrics
 */
function calculateCombinedSimilarity(transcript: string, chunk: string): number {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedChunk = normalizeText(chunk);

  // Strategy 1: N-gram similarity (good for word order variations)
  const ngramScore2 = nGramSimilarity(normalizedTranscript, normalizedChunk, 2);
  const ngramScore3 = nGramSimilarity(normalizedTranscript, normalizedChunk, 3);
  const ngramScore4 = nGramSimilarity(normalizedTranscript, normalizedChunk, 4);

  // Strategy 2: Word-level sequence alignment (best for transcription errors)
  const wordLevelScore = wordLevelSimilarity(normalizedTranscript, normalizedChunk);

  // Strategy 3: Character-level similarity
  const charSimilarity = 1 - stringSimilarity(normalizedTranscript, normalizedChunk);

  // Strategy 4: Substring matching (for partial matches)
  const substringScore = normalizedChunk.includes(normalizedTranscript) || 
                        normalizedTranscript.includes(normalizedChunk)
    ? 0.5 : 0;

  // Weighted combination (prioritize word-level matching for transcription errors)
  const combinedScore = 
    wordLevelScore * 0.5 +      // Most important for transcription errors
    ngramScore3 * 0.15 +        // Good for phrases
    ngramScore2 * 0.15 +        // Good for word pairs
    ngramScore4 * 0.1 +         // Good for longer phrases
    charSimilarity * 0.05 +     // Character-level fallback
    substringScore * 0.05;      // Substring bonus

  return combinedScore;
}

export interface FuzzyMatchResult {
  index: number;
  text: string;
  score: number;
}

/**
 * Find the best matching chunk in a list of text chunks using robust fuzzy search
 * 
 * @param query - The transcript to search for (may contain transcription errors)
 * @param chunks - Array of text chunks from the book
 * @param threshold - Minimum similarity score (0-1), default 0.25 (lowered for better matching)
 * @returns Best matching chunk or null if no match found
 */
export function fuzzySearch(
  query: string,
  chunks: string[],
  threshold: number = 0.25
): FuzzyMatchResult | null {
  if (!query || chunks.length === 0) {
    return null;
  }

  let bestMatch: FuzzyMatchResult | null = null;
  let bestScore = threshold;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk || chunk.trim().length === 0) continue;

    const score = calculateCombinedSimilarity(query, chunk);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        index: i,
        text: chunk,
        score,
      };
    }
  }

  return bestMatch;
}
