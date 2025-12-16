import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  Drawer,
  IconButton,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { segmentText } from '../utils/wordSegmentation';
import {
  calculateWordFrequencies,
  normalizeExclusionList,
  type WordFrequency,
} from '../utils/frequencyAnalysis';
import type { Language } from '../utils/languageDetection';
import { findWordOccurrences, type WordOccurrence } from '../utils/wordOccurrences';

interface ReportScreenProps {
  text: string;
  language: Language;
  exclusionList: string;
}

// Check if a character is a hanzi (Chinese character)
const isHanzi = (char: string): boolean => {
  return /[\u4e00-\u9fff]/.test(char);
};

// Check if a word contains only hanzi characters
const containsOnlyHanzi = (word: string): boolean => {
  return word.split('').every(char => isHanzi(char));
};

// Extract all hanzi characters from exclusion list entries
const extractKnownHanzi = (exclusionList: string): Set<string> => {
  const knownHanziSet = new Set<string>();
  const entries = exclusionList.split('\n').map(entry => entry.trim()).filter(entry => entry.length > 0);
  
  for (const entry of entries) {
    const hanziChars = entry.split('').filter(isHanzi);
    for (const hanzi of hanziChars) {
      knownHanziSet.add(hanzi.toLowerCase());
    }
  }
  
  return knownHanziSet;
};

// Calculate the percentage of known hanzi in a Chinese word
const getKnownHanziPercentage = (word: string, knownHanziSet: Set<string>): number => {
  const hanziChars = word.split('').filter(isHanzi);
  if (hanziChars.length === 0) return 0;
  
  const knownHanzi = hanziChars.filter(char => knownHanziSet.has(char.toLowerCase()));
  return knownHanzi.length / hanziChars.length;
};

export const ReportScreen = ({
  text,
  language,
  exclusionList,
}: ReportScreenProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordFrequencies, setWordFrequencies] = useState<WordFrequency[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordOccurrences, setWordOccurrences] = useState<WordOccurrence[]>([]);

  const exclusionSet = useMemo(
    () => normalizeExclusionList(exclusionList),
    [exclusionList]
  );

  // For Chinese, extract individual hanzi characters from exclusion list
  const knownHanziSet = useMemo(() => {
    if (language === 'chinese') {
      return extractKnownHanzi(exclusionList);
    }
    return new Set<string>();
  }, [exclusionList, language]);

  useEffect(() => {
    if (!text.trim()) {
      setWordFrequencies([]);
      return;
    }

    setIsProcessing(true);
    setError(null);

    const processText = async () => {
      try {
        const words = await segmentText(text, language);
        const frequencies = calculateWordFrequencies(words);
        setWordFrequencies(frequencies);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process text');
        setWordFrequencies([]);
      } finally {
        setIsProcessing(false);
      }
    };

    processText();
  }, [text, language]);

  // Filter Chinese words to only show hanzi words
  const filteredWordFrequencies = useMemo(() => {
    if (language !== 'chinese') {
      return wordFrequencies;
    }
    return wordFrequencies.filter(({ word }) => containsOnlyHanzi(word));
  }, [wordFrequencies, language]);

  const getChipColor = (word: string, frequency: number): 'default' | 'success' | 'error' => {
    if (exclusionSet.has(word.toLowerCase())) {
      return 'default';
    }
    
    // For Chinese, if word has any known hanzi, use gray highlighting instead of green/red
    if (language === 'chinese') {
      const knownPercentage = getKnownHanziPercentage(word, knownHanziSet);
      if (knownPercentage > 0) {
        return 'default';
      }
    }
    
    return frequency >= 5 ? 'success' : 'error';
  };

  const getChipSx = (word: string) => {
    const baseSx = {
      fontSize: '0.875rem',
      height: 'auto',
      py: 0.5,
      cursor: 'pointer',
      '&:hover': {
        opacity: 0.8,
      },
    };

    // Chinese-specific gray highlighting for words with known hanzi
    // Gray highlighting has priority over green/red
    if (language === 'chinese' && !exclusionSet.has(word.toLowerCase())) {
      const knownPercentage = getKnownHanziPercentage(word, knownHanziSet);
      if (knownPercentage > 0) {
        // Gray intensity: more known hanzi = darker gray
        // Scale from 0.1 (light gray) to 0.7 (dark gray) based on percentage
        const grayIntensity = 0.1 + (knownPercentage * 0.6);
        const backgroundColor = `rgba(128, 128, 128, ${grayIntensity})`;
        return {
          ...baseSx,
          backgroundColor,
          color: 'text.primary',
        };
      }
    }

    return baseSx;
  };

  const handleWordClick = (word: string) => {
    setSelectedWord(word);
    const occurrences = findWordOccurrences(text, word, language);
    setWordOccurrences(occurrences);
  };

  const handleCloseDrawer = () => {
    setSelectedWord(null);
    setWordOccurrences([]);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Frequency Dictionary Report
      </Typography>

      {isProcessing && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!isProcessing && !error && (
        <>
          {filteredWordFrequencies.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No words found. Please add some text on the Text Input screen.
              </Typography>
            </Paper>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Total unique words: {filteredWordFrequencies.length}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  mb: 2,
                }}
              >
                {filteredWordFrequencies.map(({ word, frequency }) => (
                  <Chip
                    key={word}
                    label={`${word} (${frequency})`}
                    color={getChipColor(word, frequency)}
                    variant={exclusionSet.has(word.toLowerCase()) ? 'outlined' : 'filled'}
                    sx={getChipSx(word)}
                    onClick={() => handleWordClick(word)}
                  />
                ))}
              </Box>
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                  <strong>Legend:</strong>
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip
                    label="Frequent (≥5 occurrences)"
                    color="success"
                    size="small"
                    variant="filled"
                  />
                  <Chip
                    label="Rare (<5 occurrences)"
                    color="error"
                    size="small"
                    variant="filled"
                  />
                  <Chip
                    label="Known (in exclusion list)"
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              </Paper>
            </>
          )}
        </>
      )}

      <Drawer
        anchor="right"
        open={selectedWord !== null}
        onClose={handleCloseDrawer}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400, md: 500 },
            p: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Occurrences of "{selectedWord}"
          </Typography>
          <IconButton onClick={handleCloseDrawer}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ overflow: 'auto' }}>
          {wordOccurrences.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No occurrences found.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {wordOccurrences.map((occurrence, index) => (
                <Card key={index} variant="outlined">
                  <CardContent>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {occurrence.sentence}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

