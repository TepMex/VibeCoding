use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

const DEFAULT_WINDOW_SIZE_WORDS: usize = 100;
const DEFAULT_STEP_SIZE_WORDS: usize = 30;
const DEFAULT_TOP_K: usize = 20;
const SCORE_EXACT: i32 = 2;
const SCORE_FUZZY: i32 = 1;
const SCORE_MISMATCH: i32 = -1;
const SCORE_GAP: i32 = -1;

#[derive(Clone, Serialize, Deserialize)]
struct Window {
    id: usize,
    start_word_index: usize,
    end_word_index: usize,
    tokens: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct AlignmentResult {
    alignment_score: i32,
    start_index_in_window: usize,
    end_index_in_window: usize,
}

#[derive(Clone, Serialize, Deserialize)]
struct QueryResult {
    window_id: usize,
    start_word_index: usize,
    end_word_index: usize,
    matched_text: String,
    alignment_score: f64,
    confidence: f64,
}

#[derive(Clone, Serialize, Deserialize)]
struct TextLocatorState {
    words: Vec<String>,
    windows: Vec<Window>,
    inverted_index: HashMap<String, HashSet<usize>>,
    window_size_words: usize,
    step_size_words: usize,
}

#[wasm_bindgen]
pub struct TextLocator {
    state: TextLocatorState,
}

#[wasm_bindgen]
impl TextLocator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TextLocator {
        TextLocator {
            state: TextLocatorState {
                words: Vec::new(),
                windows: Vec::new(),
                inverted_index: HashMap::new(),
                window_size_words: DEFAULT_WINDOW_SIZE_WORDS,
                step_size_words: DEFAULT_STEP_SIZE_WORDS,
            },
        }
    }

    #[wasm_bindgen]
    pub fn preprocess(&mut self, book_text: &str) {
        let normalized = normalize_text(book_text);
        let words: Vec<String> = normalized
            .split_whitespace()
            .filter(|w| !w.is_empty())
            .map(|w| w.to_string())
            .collect();

        let mut windows = Vec::new();
        let mut inverted_index: HashMap<String, HashSet<usize>> = HashMap::new();

        let mut start = 0usize;
        let mut window_id = 0usize;
        while start < words.len() {
            let end_exclusive = (start + self.state.window_size_words).min(words.len());
            if end_exclusive <= start {
                break;
            }
            let tokens = words[start..end_exclusive].to_vec();
            let window = Window {
                id: window_id,
                start_word_index: start,
                end_word_index: end_exclusive.saturating_sub(1),
                tokens: tokens.clone(),
            };

            for gram in generate_token_ngrams(&tokens, 3) {
                inverted_index.entry(gram).or_default().insert(window_id);
            }

            windows.push(window);
            window_id += 1;

            if end_exclusive == words.len() {
                break;
            }
            start += self.state.step_size_words;
        }

        self.state.words = words;
        self.state.windows = windows;
        self.state.inverted_index = inverted_index;
    }

    #[wasm_bindgen]
    pub fn query(&self, transcript_snippet: &str) -> JsValue {
        match self.query_internal(transcript_snippet) {
            Some(result) => serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL),
            None => JsValue::NULL,
        }
    }

    fn query_internal(&self, transcript_snippet: &str) -> Option<QueryResult> {
        if self.state.windows.is_empty() {
            return None;
        }

        let transcript_norm = normalize_text(transcript_snippet);
        let transcript_tokens: Vec<String> = transcript_norm
            .split_whitespace()
            .filter(|w| !w.is_empty())
            .map(|w| w.to_string())
            .collect();

        if transcript_tokens.is_empty() {
            return None;
        }

        let query_ngrams = generate_token_ngrams(&transcript_tokens, 3);
        let mut overlap_count: HashMap<usize, usize> = HashMap::new();
        for gram in query_ngrams {
            if let Some(window_ids) = self.state.inverted_index.get(&gram) {
                for window_id in window_ids {
                    *overlap_count.entry(*window_id).or_insert(0) += 1;
                }
            }
        }

        let mut ranked: Vec<(usize, usize)> = overlap_count.into_iter().collect();
        ranked.sort_by(|a, b| b.1.cmp(&a.1));

        let mut candidate_ids: Vec<usize> = ranked
            .into_iter()
            .take(DEFAULT_TOP_K)
            .map(|(window_id, _)| window_id)
            .collect();

        if candidate_ids.is_empty() {
            candidate_ids = (0..self.state.windows.len().min(DEFAULT_TOP_K)).collect();
        }

        let mut best_alignment = AlignmentResult {
            alignment_score: i32::MIN,
            start_index_in_window: 0,
            end_index_in_window: 0,
        };
        let mut best_window_id: Option<usize> = None;

        for window_id in candidate_ids {
            let window = match self.state.windows.get(window_id) {
                Some(w) => w,
                None => continue,
            };

            let alignment = smith_waterman_align(
                &transcript_tokens,
                &window.tokens,
                best_alignment.alignment_score.max(0),
            );
            if alignment.alignment_score > best_alignment.alignment_score {
                best_alignment = alignment;
                best_window_id = Some(window_id);
            }
        }

        let window_id = match best_window_id {
            Some(id) if best_alignment.alignment_score > 0 => id,
            _ => return None,
        };

        let window = &self.state.windows[window_id];
        let abs_start = window.start_word_index + best_alignment.start_index_in_window;
        let abs_end = window.start_word_index + best_alignment.end_index_in_window;
        if abs_start >= self.state.words.len() || abs_end >= self.state.words.len() || abs_start > abs_end {
            return None;
        }

        let matched_text = self.state.words[abs_start..=abs_end].join(" ");
        let transcript_len = transcript_tokens.len().max(1) as f64;
        let alignment_score = best_alignment.alignment_score as f64;
        let confidence = alignment_score / (2.0 * transcript_len);

        Some(QueryResult {
            window_id,
            start_word_index: abs_start,
            end_word_index: abs_end,
            matched_text,
            alignment_score,
            confidence,
        })
    }

    #[wasm_bindgen(js_name = serialize)]
    pub fn serialize_to_json(&self) -> String {
        serde_json::to_string(&self.state).unwrap_or_else(|_| "{}".to_string())
    }

    #[wasm_bindgen(js_name = from_json)]
    pub fn from_json(json: &str) -> TextLocator {
        let state = serde_json::from_str::<TextLocatorState>(json).unwrap_or(TextLocatorState {
            words: Vec::new(),
            windows: Vec::new(),
            inverted_index: HashMap::new(),
            window_size_words: DEFAULT_WINDOW_SIZE_WORDS,
            step_size_words: DEFAULT_STEP_SIZE_WORDS,
        });
        TextLocator { state }
    }
}

impl Default for TextLocator {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
pub fn levenshtein_distance(str1: &str, str2: &str) -> usize {
    let s1: Vec<char> = str1.chars().collect();
    let s2: Vec<char> = str2.chars().collect();
    let m = s1.len();
    let n = s2.len();

    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }

    let mut prev: Vec<usize> = (0..=n).collect();
    let mut curr = vec![0usize; n + 1];
    for i in 1..=m {
        curr[0] = i;
        for j in 1..=n {
            let cost = usize::from(s1[i - 1] != s2[j - 1]);
            curr[j] = (prev[j] + 1).min(curr[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[n]
}

#[wasm_bindgen]
pub fn string_similarity(str1: &str, str2: &str) -> f64 {
    let s1 = str1.to_lowercase();
    let s2 = str2.to_lowercase();
    let max_len = s1.chars().count().max(s2.chars().count());
    if max_len == 0 {
        return 0.0;
    }
    levenshtein_distance(&s1, &s2) as f64 / max_len as f64
}

#[wasm_bindgen]
pub fn normalize_text(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c.is_whitespace() {
                c
            } else {
                ' '
            }
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

fn generate_ngrams(text: &str, n: usize) -> HashSet<String> {
    let words: Vec<&str> = text.split_whitespace().filter(|w| !w.is_empty()).collect();
    let mut ngrams = HashSet::new();
    if n == 0 || words.len() < n {
        return ngrams;
    }
    for i in 0..=words.len() - n {
        ngrams.insert(words[i..i + n].join(" "));
    }
    ngrams
}

fn generate_token_ngrams(tokens: &[String], n: usize) -> Vec<String> {
    if n == 0 || tokens.len() < n {
        return Vec::new();
    }
    let mut out = Vec::with_capacity(tokens.len() - n + 1);
    for i in 0..=tokens.len() - n {
        out.push(tokens[i..i + n].join(" "));
    }
    out
}

fn jaccard_similarity(set1: &HashSet<String>, set2: &HashSet<String>) -> f64 {
    let intersection = set1.intersection(set2).count();
    let union = set1.union(set2).count();
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
    let longer = if word1.len() > word2.len() { word1 } else { word2 };
    let shorter = if word1.len() > word2.len() { word2 } else { word1 };
    longer.contains(shorter) && shorter.len() >= 3
}

#[wasm_bindgen]
pub fn word_to_phrase_similarity(word: &str, phrase: &str) -> f64 {
    let word_norm = normalize_text(word);
    let phrase_norm = normalize_text(phrase);

    if word_norm == phrase_norm {
        return 1.0;
    }

    let phrase_no_spaces: String = phrase_norm.chars().filter(|c| !c.is_whitespace()).collect();
    let direct_similarity = 1.0 - string_similarity(&word_norm, &phrase_no_spaces);
    if direct_similarity > 0.75 {
        return direct_similarity;
    }

    let word_no_spaces: String = word_norm.chars().filter(|c| !c.is_whitespace()).collect();
    let reverse_similarity = 1.0 - string_similarity(&word_no_spaces, &phrase_norm);
    if reverse_similarity > 0.75 {
        return reverse_similarity;
    }

    let char_similarity = 1.0 - string_similarity(&word_norm, &phrase_norm);
    if char_similarity > 0.7 {
        return char_similarity;
    }

    let mut word_chars: Vec<char> = word_no_spaces.chars().collect();
    let mut phrase_chars: Vec<char> = phrase_no_spaces.chars().collect();
    word_chars.sort_unstable();
    phrase_chars.sort_unstable();
    let word_chars_str: String = word_chars.iter().collect();
    let phrase_chars_str: String = phrase_chars.iter().collect();
    let char_set_similarity = 1.0 - string_similarity(&word_chars_str, &phrase_chars_str);
    if char_set_similarity > 0.8 && (word_no_spaces.len() as i32 - phrase_no_spaces.len() as i32).abs() <= 2 {
        return char_set_similarity * 0.9;
    }

    char_similarity
}

fn word_match_score(a: &str, b: &str) -> i32 {
    if a == b {
        SCORE_EXACT
    } else if levenshtein_distance(a, b) <= 1 {
        SCORE_FUZZY
    } else {
        SCORE_MISMATCH
    }
}

fn smith_waterman_align(
    transcript_tokens: &[String],
    window_tokens: &[String],
    best_score_found: i32,
) -> AlignmentResult {
    let m = transcript_tokens.len();
    let n = window_tokens.len();
    if m == 0 || n == 0 {
        return AlignmentResult {
            alignment_score: 0,
            start_index_in_window: 0,
            end_index_in_window: 0,
        };
    }

    let mut dp = vec![vec![0i32; n + 1]; m + 1];
    let mut trace = vec![vec![0u8; n + 1]; m + 1];
    let mut max_score = 0i32;
    let mut max_pos = (0usize, 0usize);

    for i in 1..=m {
        let mut row_max = 0i32;
        for j in 1..=n {
            let match_score = word_match_score(&transcript_tokens[i - 1], &window_tokens[j - 1]);
            let diag = dp[i - 1][j - 1] + match_score;
            let up = dp[i - 1][j] + SCORE_GAP;
            let left = dp[i][j - 1] + SCORE_GAP;

            let mut best = 0i32;
            let mut dir = 0u8;
            if diag > best {
                best = diag;
                dir = 1;
            }
            if up > best {
                best = up;
                dir = 2;
            }
            if left > best {
                best = left;
                dir = 3;
            }

            dp[i][j] = best;
            trace[i][j] = if best > 0 { dir } else { 0 };

            if best > max_score {
                max_score = best;
                max_pos = (i, j);
            }
            row_max = row_max.max(best);
        }

        let remaining = (m - i) as i32;
        let theoretical_max = row_max + remaining * SCORE_EXACT;
        if theoretical_max < best_score_found {
            break;
        }
    }

    if max_score <= 0 {
        return AlignmentResult {
            alignment_score: 0,
            start_index_in_window: 0,
            end_index_in_window: 0,
        };
    }

    let (mut i, mut j) = max_pos;
    let end_j = j.saturating_sub(1);
    while i > 0 && j > 0 {
        match trace[i][j] {
            0 => break,
            1 => {
                i -= 1;
                j -= 1;
            }
            2 => {
                i -= 1;
            }
            3 => {
                j -= 1;
            }
            _ => break,
        }
    }

    AlignmentResult {
        alignment_score: max_score,
        start_index_in_window: j,
        end_index_in_window: end_j,
    }
}

fn sequence_alignment_similarity(transcript_words: &[String], chunk_words: &[String]) -> f64 {
    let alignment = smith_waterman_align(transcript_words, chunk_words, 0);
    if transcript_words.is_empty() {
        return 0.0;
    }
    let max_possible = (2 * transcript_words.len()) as f64;
    (alignment.alignment_score as f64 / max_possible).clamp(0.0, 1.0)
}

#[wasm_bindgen]
pub fn word_level_similarity(transcript: &str, chunk: &str) -> f64 {
    let transcript_tokens: Vec<String> = normalize_text(transcript)
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|w| w.to_string())
        .collect();
    let chunk_tokens: Vec<String> = normalize_text(chunk)
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|w| w.to_string())
        .collect();
    sequence_alignment_similarity(&transcript_tokens, &chunk_tokens)
}

#[wasm_bindgen]
pub fn calculate_combined_similarity(transcript: &str, chunk: &str) -> f64 {
    let normalized_transcript = normalize_text(transcript);
    let normalized_chunk = normalize_text(chunk);

    let ngram_score_2 = n_gram_similarity(&normalized_transcript, &normalized_chunk, 2);
    let ngram_score_3 = n_gram_similarity(&normalized_transcript, &normalized_chunk, 3);
    let ngram_score_4 = n_gram_similarity(&normalized_transcript, &normalized_chunk, 4);
    let word_level_score = word_level_similarity(&normalized_transcript, &normalized_chunk);
    let char_similarity = 1.0 - string_similarity(&normalized_transcript, &normalized_chunk);
    let substring_score = if normalized_chunk.contains(&normalized_transcript)
        || normalized_transcript.contains(&normalized_chunk)
    {
        0.5
    } else {
        0.0
    };

    word_level_score * 0.5
        + ngram_score_3 * 0.15
        + ngram_score_2 * 0.15
        + ngram_score_4 * 0.1
        + char_similarity * 0.05
        + substring_score * 0.05
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    fn make_locator(book: &str) -> TextLocator {
        let mut locator = TextLocator::new();
        locator.preprocess(book);
        locator
    }

    #[test]
    fn exact_match() {
        let locator = make_locator("the quick brown fox jumps over the lazy dog");
        let value = locator.query_internal("quick brown fox jumps");
        assert!(value.is_some());
    }

    #[test]
    fn one_word_substitution() {
        let locator = make_locator("the quick brown fox jumps over the lazy dog");
        let value = locator.query_internal("quick brawn fox jumps");
        assert!(value.is_some());
    }

    #[test]
    fn missing_word() {
        let locator = make_locator("the quick brown fox jumps over the lazy dog");
        let value = locator.query_internal("quick fox jumps over");
        assert!(value.is_some());
    }

    #[test]
    fn extra_word() {
        let locator = make_locator("the quick brown fox jumps over the lazy dog");
        let value = locator.query_internal("quick brown fox really jumps over");
        assert!(value.is_some());
    }

    #[test]
    fn wrong_snippet_low_quality_or_none() {
        let locator = make_locator("the quick brown fox jumps over the lazy dog");
        let value = locator.query_internal("unrelated galaxy banana quantum phrase");
        if let Some(parsed) = value {
            assert!(parsed.confidence < 0.4);
        }
    }

    #[test]
    fn serde_roundtrip() {
        let mut locator = TextLocator::new();
        locator.preprocess("a b c d e f g h i j k l m n o p q r");
        let json = locator.serialize_to_json();
        let restored = TextLocator::from_json(&json);
        let value = restored.query_internal("f g h");
        assert!(value.is_some());
    }

    #[test]
    fn performance_100k_words() {
        let mut words = Vec::with_capacity(100_000);
        for i in 0..100_000 {
            words.push(format!("word{}", i % 2000));
        }
        let book = words.join(" ");
        let locator = make_locator(&book);

        let start = Instant::now();
        let _ = locator.query_internal("word120 word121 word122 word123 word124 word125");
        let elapsed = start.elapsed().as_millis();
        assert!(elapsed < 500, "expected <500ms query, got {}ms", elapsed);
    }
}

