import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import {
  normalizeExclusionList,
  type WordFrequency,
} from '../utils/frequencyAnalysis';
import type { Language } from '../utils/languageDetection';
import {
  findWordOccurrencesWithIndex,
  createSentenceIndex,
  highlightWordInSentence,
  type WordOccurrence,
  type SentenceIndex,
} from '../utils/wordOccurrences';
import type { WorkerMessage, WorkerResponse } from '../workers/textProcessor.worker';

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

// Cache for hanzi characters per word to avoid repeated splitting
const getHanziChars = (word: string): string[] => {
  return word.split('').filter(isHanzi);
};

// Calculate the percentage of known hanzi in a Chinese word (optimized with caching)
const calculateKnownHanziPercentage = (
  word: string,
  knownHanziSet: Set<string>,
  hanziCache: Map<string, string[]>
): number => {
  let hanziChars = hanziCache.get(word);
  if (!hanziChars) {
    hanziChars = getHanziChars(word);
    hanziCache.set(word, hanziChars);
  }
  
  if (hanziChars.length === 0) return 0;
  
  const knownHanzi = hanziChars.filter(char => knownHanziSet.has(char.toLowerCase()));
  return knownHanzi.length / hanziChars.length;
};

interface ChipStyle {
  color: 'default' | 'success' | 'error';
  variant: 'outlined' | 'filled';
  sx: object;
  knownHanziPercentage?: number;
}

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
  const workerRef = useRef<Worker | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

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

  // Cache for hanzi characters per word
  const hanziCache = useMemo(() => new Map<string, string[]>(), []);

  // Pre-compute sentence index for efficient word occurrence searches
  const sentenceIndex = useMemo<SentenceIndex | null>(() => {
    if (!text.trim()) return null;
    return createSentenceIndex(text, language);
  }, [text, language]);

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/textProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'result' && e.data.frequencies) {
        setWordFrequencies(e.data.frequencies);
        setIsProcessing(false);
      } else if (e.data.type === 'error') {
        setError(e.data.error || 'Failed to process text');
        setWordFrequencies([]);
        setIsProcessing(false);
      }
    };

    workerRef.current.onerror = (err) => {
      setError('Worker error: ' + err.message);
      setIsProcessing(false);
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Debounced text processing with Web Worker
  useEffect(() => {
    // Clear previous debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text.trim()) {
      // Use setTimeout to avoid synchronous setState in effect
      debounceTimerRef.current = window.setTimeout(() => {
        setWordFrequencies([]);
        setIsProcessing(false);
        setError(null);
      }, 0);
      return;
    }

    // Debounce processing by 400ms
    debounceTimerRef.current = window.setTimeout(() => {
      setIsProcessing(true);
      setError(null);
      
      if (workerRef.current) {
        const message: WorkerMessage = {
          type: 'process',
          text,
          language,
        };
        workerRef.current.postMessage(message);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [text, language]);

  // Filter Chinese words to only show hanzi words
  const filteredWordFrequencies = useMemo(() => {
    if (language !== 'chinese') {
      return wordFrequencies;
    }
    return wordFrequencies.filter(({ word }) => containsOnlyHanzi(word));
  }, [wordFrequencies, language]);

  // Pre-compute and memoize all chip styles (O(n) once instead of O(n) per render)
  const chipStyles = useMemo(() => {
    const styles = new Map<string, ChipStyle>();
    
    filteredWordFrequencies.forEach(({ word, frequency }) => {
      const lowerWord = word.toLowerCase();
      const isExcluded = exclusionSet.has(lowerWord);
      
      let color: 'default' | 'success' | 'error' = 'default';
      let knownHanziPercentage: number | undefined = undefined;
      
      if (!isExcluded) {
        // For Chinese, check known hanzi percentage
        if (language === 'chinese') {
          knownHanziPercentage = calculateKnownHanziPercentage(word, knownHanziSet, hanziCache);
          if (knownHanziPercentage === 0) {
            color = frequency >= 5 ? 'success' : 'error';
          }
        } else {
          color = frequency >= 5 ? 'success' : 'error';
        }
      }
      
      const isSelected = selectedWord === word;
      const baseSx = {
        fontSize: '0.875rem',
        height: 'auto',
        py: 0.5,
        cursor: 'pointer',
        border: isSelected ? '2px solid' : 'none',
        borderColor: isSelected ? 'primary.main' : 'transparent',
        '&:hover': {
          opacity: 0.8,
        },
      };

      let sx: object = baseSx;
      
      // Chinese-specific gray highlighting for words with known hanzi
      if (language === 'chinese' && !isExcluded && knownHanziPercentage && knownHanziPercentage > 0) {
        const grayIntensity = 0.1 + (knownHanziPercentage * 0.6);
        const backgroundColor = `rgba(128, 128, 128, ${grayIntensity})`;
        sx = {
          ...baseSx,
          backgroundColor: backgroundColor,
          color: 'text.primary',
        } as object;
      }
      
      styles.set(word, {
        color,
        variant: isExcluded ? 'outlined' : 'filled',
        sx,
        knownHanziPercentage,
      });
    });
    
    return styles;
  }, [filteredWordFrequencies, exclusionSet, knownHanziSet, language, selectedWord, hanziCache]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
    
    if (sentenceIndex) {
      const occurrences = findWordOccurrencesWithIndex(sentenceIndex, word);
      setWordOccurrences(occurrences);
    } else {
      setWordOccurrences([]);
    }
  }, [sentenceIndex]);

  // Event delegation handler for chip clicks
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const chip = target.closest('[data-word]') as HTMLElement;
    
    if (chip) {
      const word = chip.getAttribute('data-word');
      if (word) {
        handleWordClick(word);
      }
    }
  }, [handleWordClick]);

  const handleCloseDrawer = useCallback(() => {
    setSelectedWord(null);
    setWordOccurrences([]);
  }, []);

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
      <Box
        sx={{
          flexGrow: 1,
          p: 3,
          width: selectedWord ? { xs: '100%', sm: 'calc(100% - 400px)', md: 'calc(100% - 500px)' } : '100%',
          maxWidth: selectedWord ? 'none' : 1200,
          mx: selectedWord ? 0 : 'auto',
          transition: 'width 0.3s ease-in-out, max-width 0.3s ease-in-out',
          overflow: 'auto',
        }}
      >
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
                  onClick={handleContainerClick}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    mb: 2,
                    maxHeight: 600,
                    overflow: 'auto',
                  }}
                >
                  {filteredWordFrequencies.map(({ word, frequency }) => {
                    const chipStyle = chipStyles.get(word);
                    if (!chipStyle) return null;
                    
                    return (
                      <Chip
                        key={word}
                        data-word={word}
                        label={`${word} (${frequency})`}
                        color={chipStyle.color}
                        variant={chipStyle.variant}
                        sx={chipStyle.sx}
                      />
                    );
                  })}
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
      </Box>

      <Drawer
        anchor="right"
        open={selectedWord !== null}
        onClose={handleCloseDrawer}
        variant="persistent"
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400, md: 500 },
            p: 2,
            boxSizing: 'border-box',
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
            <Stack spacing={3}>
              {wordOccurrences.map((occurrence, index) => {
                const highlightedSentence = highlightWordInSentence(
                  occurrence.sentence,
                  selectedWord!,
                  language
                );
                return (
                  <Card 
                    key={index} 
                    variant="elevation"
                    elevation={2}
                    sx={{
                      backgroundColor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        elevation: 4,
                        boxShadow: 4,
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: 'pre-wrap' }}
                        dangerouslySetInnerHTML={{ __html: highlightedSentence }}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

