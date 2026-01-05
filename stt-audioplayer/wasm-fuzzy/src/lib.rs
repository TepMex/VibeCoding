use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn levenshtein_distance(str1: &str, str2: &str) -> usize {
    let m = str1.len();
    let n = str2.len();
    
    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }
    
    let mut dp = vec![vec![0; n + 1]; m + 1];
    
    // Initialize first row and column
    for i in 0..=m {
        dp[i][0] = i;
    }
    for j in 0..=n {
        dp[0][j] = j;
    }
    
    // Fill DP table
    let str1_chars: Vec<char> = str1.chars().collect();
    let str2_chars: Vec<char> = str2.chars().collect();
    
    for i in 1..=m {
        for j in 1..=n {
            if str1_chars[i - 1] == str2_chars[j - 1] {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = (dp[i - 1][j] + 1)
                    .min(dp[i][j - 1] + 1)
                    .min(dp[i - 1][j - 1] + 1);
            }
        }
    }
    
    dp[m][n]
}

#[wasm_bindgen]
pub fn string_similarity(str1: &str, str2: &str) -> f64 {
    let max_len = str1.len().max(str2.len());
    if max_len == 0 {
        return 0.0;
    }
    
    let distance = levenshtein_distance(
        &str1.to_lowercase(),
        &str2.to_lowercase()
    );
    
    distance as f64 / max_len as f64
}

#[wasm_bindgen]
pub fn normalize_text(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c.is_whitespace() {
            c
        } else {
            ' '
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
        .trim()
        .to_string()
}

#[wasm_bindgen]
pub fn n_gram_similarity(text1: &str, text2: &str, n: usize) -> f64 {
    let ngrams1 = generate_ngrams(text1, n);
    let ngrams2 = generate_ngrams(text2, n);
    jaccard_similarity(&ngrams1, &ngrams2)
}

fn generate_ngrams(text: &str, n: usize) -> std::collections::HashSet<String> {
    let words: Vec<&str> = text.split_whitespace().filter(|w| !w.is_empty()).collect();
    let mut ngrams = std::collections::HashSet::new();
    
    for i in 0..=words.len().saturating_sub(n) {
        if i + n <= words.len() {
            ngrams.insert(words[i..i + n].join(" "));
        }
    }
    
    ngrams
}

fn jaccard_similarity(set1: &std::collections::HashSet<String>, set2: &std::collections::HashSet<String>) -> f64 {
    let intersection: usize = set1.intersection(set2).count();
    let union: usize = set1.union(set2).count();
    
    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

#[wasm_bindgen]
pub fn are_words_similar(word1: &str, word2: &str, threshold: f64) -> bool {
    if word1 == word2 {
        return true;
    }
    
    let similarity = 1.0 - string_similarity(word1, word2);
    if similarity >= threshold {
        return true;
    }
    
    // Check if one word is a substring of the other
    let longer = if word1.len() > word2.len() { word1 } else { word2 };
    let shorter = if word1.len() > word2.len() { word2 } else { word1 };
    
    if longer.contains(shorter) && shorter.len() >= 3 {
        return true;
    }
    
    false
}

#[wasm_bindgen]
pub fn word_to_phrase_similarity(word: &str, phrase: &str) -> f64 {
    let word_norm = normalize_text(word);
    let phrase_norm = normalize_text(phrase);
    
    // Direct match
    if word_norm == phrase_norm {
        return 1.0;
    }
    
    // Check if word matches when spaces removed from phrase
    let phrase_no_spaces: String = phrase_norm.chars().filter(|c| !c.is_whitespace()).collect();
    let direct_similarity = 1.0 - string_similarity(&word_norm, &phrase_no_spaces);
    if direct_similarity > 0.75 {
        return direct_similarity;
    }
    
    // Check reverse direction
    let word_no_spaces: String = word_norm.chars().filter(|c| !c.is_whitespace()).collect();
    let reverse_similarity = 1.0 - string_similarity(&word_no_spaces, &phrase_norm);
    if reverse_similarity > 0.75 {
        return reverse_similarity;
    }
    
    // Character-level similarity
    let char_similarity = 1.0 - string_similarity(&word_norm, &phrase_norm);
    if char_similarity > 0.7 {
        return char_similarity;
    }
    
    // Character set similarity
    let mut word_chars: Vec<char> = word_no_spaces.chars().collect();
    let mut phrase_chars: Vec<char> = phrase_no_spaces.chars().collect();
    word_chars.sort();
    phrase_chars.sort();
    let word_chars_str: String = word_chars.iter().collect();
    let phrase_chars_str: String = phrase_chars.iter().collect();
    let char_set_similarity = 1.0 - string_similarity(&word_chars_str, &phrase_chars_str);
    
    if char_set_similarity > 0.8 && (word_no_spaces.len() as i32 - phrase_no_spaces.len() as i32).abs() <= 2 {
        return char_set_similarity * 0.9;
    }
    
    char_similarity
}

fn sequence_alignment_similarity(
    transcript_words: &[String],
    chunk_words: &[String],
) -> f64 {
    if transcript_words.is_empty() || chunk_words.is_empty() {
        return 0.0;
    }
    
    let m = transcript_words.len();
    let n = chunk_words.len();
    
    let mut dp = vec![vec![0.0; n + 1]; m + 1];
    
    // Initialize
    for i in 0..=m {
        dp[i][0] = 0.0;
    }
    for j in 0..=n {
        dp[0][j] = 0.0;
    }
    
    // Fill DP table
    for i in 1..=m {
        for j in 1..=n {
            let transcript_word = &transcript_words[i - 1];
            let chunk_word = &chunk_words[j - 1];
            
            // Match: single word to single word
            let match_score = if are_words_similar(transcript_word, chunk_word, 0.6) {
                1.0
            } else {
                1.0 - string_similarity(transcript_word, chunk_word)
            };
            let match_val = dp[i - 1][j - 1] + match_score;
            
            // Skip in transcript (insertion in chunk)
            let skip_transcript = dp[i][j - 1] - 0.1;
            
            // Skip in chunk (insertion in transcript)
            let skip_chunk = dp[i - 1][j] - 0.1;
            
            // Match word to phrase
            let mut phrase_match: f64 = 0.0;
            
            // Try matching transcript word to 2-word phrase in chunk
            if j >= 2 {
                let chunk_phrase = format!("{} {}", chunk_words[j - 2], chunk_words[j - 1]);
                let phrase_sim = word_to_phrase_similarity(transcript_word, &chunk_phrase);
                phrase_match = phrase_match.max(dp[i - 1][j - 2] + phrase_sim * 0.9);
            }
            
            // Try matching chunk word to 2-word phrase in transcript
            if i >= 2 {
                let transcript_phrase = format!("{} {}", transcript_words[i - 2], transcript_words[i - 1]);
                let phrase_sim = word_to_phrase_similarity(chunk_word, &transcript_phrase);
                phrase_match = phrase_match.max(dp[i - 2][j - 1] + phrase_sim * 0.9);
            }
            
            // Try matching 2-word phrases in both
            if i >= 2 && j >= 2 {
                let transcript_phrase = format!("{} {}", transcript_words[i - 2], transcript_words[i - 1]);
                let chunk_phrase = format!("{} {}", chunk_words[j - 2], chunk_words[j - 1]);
                let phrase_sim = word_to_phrase_similarity(&transcript_phrase, &chunk_phrase);
                phrase_match = phrase_match.max(dp[i - 2][j - 2] + phrase_sim * 0.85);
            }
            
            dp[i][j] = match_val.max(skip_transcript).max(skip_chunk).max(phrase_match);
        }
    }
    
    // Normalize by maximum possible score
    let max_score = m.min(n);
    if max_score > 0 {
        dp[m][n] / (max_score as f64 * 1.2)
    } else {
        0.0
    }
}

#[wasm_bindgen]
pub fn word_level_similarity(transcript: &str, chunk: &str) -> f64 {
    let transcript_norm = normalize_text(transcript);
    let chunk_norm = normalize_text(chunk);
    
    let transcript_words: Vec<String> = transcript_norm
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|s| s.to_string())
        .collect();
    
    let chunk_words: Vec<String> = chunk_norm
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|s| s.to_string())
        .collect();
    
    if transcript_words.is_empty() || chunk_words.is_empty() {
        return 0.0;
    }
    
    // Use sliding window to find best matching subsequence
    let mut max_score: f64 = 0.0;
    let window_size = (transcript_words.len() + 3).min(chunk_words.len());
    
    for start in 0..=(chunk_words.len().saturating_sub(window_size).max(0)) {
        let end = (start + window_size + 5).min(chunk_words.len());
        let window: Vec<String> = chunk_words[start..end].to_vec();
        
        let score = sequence_alignment_similarity(transcript_words.as_slice(), window.as_slice());
        max_score = max_score.max(score);
    }
    
    // Also try reverse
    let transcript_window_size = (chunk_words.len() + 3).min(transcript_words.len());
    for start in 0..=(transcript_words.len().saturating_sub(transcript_window_size).max(0)) {
        let end = (start + transcript_window_size + 5).min(transcript_words.len());
        let window: Vec<String> = transcript_words[start..end].to_vec();
        
        let score = sequence_alignment_similarity(window.as_slice(), chunk_words.as_slice());
        max_score = max_score.max(score);
    }
    
    max_score.min(1.0)
}

#[wasm_bindgen]
pub fn calculate_combined_similarity(transcript: &str, chunk: &str) -> f64 {
    let normalized_transcript = normalize_text(transcript);
    let normalized_chunk = normalize_text(chunk);
    
    // Strategy 1: N-gram similarity
    let ngram_score_2 = n_gram_similarity(&normalized_transcript, &normalized_chunk, 2);
    let ngram_score_3 = n_gram_similarity(&normalized_transcript, &normalized_chunk, 3);
    let ngram_score_4 = n_gram_similarity(&normalized_transcript, &normalized_chunk, 4);
    
    // Strategy 2: Word-level sequence alignment
    let word_level_score = word_level_similarity(&normalized_transcript, &normalized_chunk);
    
    // Strategy 3: Character-level similarity
    let char_similarity = 1.0 - string_similarity(&normalized_transcript, &normalized_chunk);
    
    // Strategy 4: Substring matching
    let substring_score = if normalized_chunk.contains(&normalized_transcript) 
        || normalized_transcript.contains(&normalized_chunk) {
        0.5
    } else {
        0.0
    };
    
    // Weighted combination
    word_level_score * 0.5 +
        ngram_score_3 * 0.15 +
        ngram_score_2 * 0.15 +
        ngram_score_4 * 0.1 +
        char_similarity * 0.05 +
        substring_score * 0.05
}

