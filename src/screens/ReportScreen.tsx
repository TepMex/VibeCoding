import { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react';
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
  Button,
  Link,
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon } from '@mui/icons-material';
import { List } from 'react-window';
import {
  normalizeExclusionList,
  type WordFrequency,
} from '../utils/frequencyAnalysis';
import type { Language } from '../utils/languageDetection';
import { getDictionaryUrl } from '../utils/languageDetection';
import {
  findWordOccurrencesWithIndex,
  createSentenceIndex,
  highlightWordInSentence,
  hasNoUnknownWordsExceptSelected,
  type WordOccurrence,
  type SentenceIndex,
} from '../utils/wordOccurrences';

interface ReportScreenProps {
  text: string;
  language: Language;
  exclusionList: string;
  wordFrequencies: WordFrequency[];
  isProcessing: boolean;
  error: string | null;
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

interface WordChipProps {
  word: string;
  frequency: number;
  baseStyle: Omit<ChipStyle, 'sx'> & { baseSx: object };
  isSelected: boolean;
  onWordClick: (word: string) => void;
}

// Memoized chip component to prevent unnecessary re-renders
const WordChip = memo(({ word, frequency, baseStyle, isSelected, onWordClick }: WordChipProps) => {
  const sx = {
    ...baseStyle.baseSx,
    border: isSelected ? '2px solid' : 'none',
    borderColor: isSelected ? 'primary.main' : 'transparent',
  };

  return (
    <Chip
      data-word={word}
      label={`${word} (${frequency})`}
      color={baseStyle.color}
      variant={baseStyle.variant}
      sx={sx}
      onClick={() => onWordClick(word)}
    />
  );
});

WordChip.displayName = 'WordChip';

export const ReportScreen = ({
  text,
  language,
  exclusionList,
  wordFrequencies,
  isProcessing,
  error,
}: ReportScreenProps) => {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordOccurrences, setWordOccurrences] = useState<WordOccurrence[]>([]);
  const [occurrencesWithNoUnknownWords, setOccurrencesWithNoUnknownWords] = useState<Set<number>>(new Set());
  const [showUnderstandable, setShowUnderstandable] = useState(true);
  const [showOther, setShowOther] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chipsPerRow, setChipsPerRow] = useState(10);

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

  // Cache for hanzi characters per word (useRef to persist across renders)
  const hanziCacheRef = useRef(new Map<string, string[]>());

  // Lazy sentence index - only create when needed
  const sentenceIndexRef = useRef<SentenceIndex | null>(null);
  const getSentenceIndex = useCallback((): SentenceIndex | null => {
    if (!text.trim()) return null;
    if (!sentenceIndexRef.current) {
      sentenceIndexRef.current = createSentenceIndex(text, language);
    }
    return sentenceIndexRef.current;
  }, [text, language]);

  // Filter Chinese words to only show hanzi words
  const filteredWordFrequencies = useMemo(() => {
    if (language !== 'chinese') {
      return wordFrequencies;
    }
    return wordFrequencies.filter(({ word }) => containsOnlyHanzi(word));
  }, [wordFrequencies, language]);

  // Calculate how many chips fit per row based on container width
  useEffect(() => {
    const updateChipsPerRow = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Estimate chip width: average word length + frequency + padding
        // Using a conservative estimate of ~120px per chip (including gap)
        const estimatedChipWidth = 120;
        const calculatedChipsPerRow = Math.max(1, Math.floor(containerWidth / estimatedChipWidth));
        setChipsPerRow(calculatedChipsPerRow);
      }
    };

    updateChipsPerRow();
    window.addEventListener('resize', updateChipsPerRow);
    return () => window.removeEventListener('resize', updateChipsPerRow);
  }, [filteredWordFrequencies.length]);

  // Calculate number of rows needed
  const rowCount = useMemo(() => {
    return Math.ceil(filteredWordFrequencies.length / chipsPerRow);
  }, [filteredWordFrequencies.length, chipsPerRow]);

  // Pre-compute base chip styles (without selection dependency for better performance)
  const baseChipStyles = useMemo(() => {
    const styles = new Map<string, Omit<ChipStyle, 'sx'> & { baseSx: object }>();
    
    filteredWordFrequencies.forEach(({ word, frequency }) => {
      const lowerWord = word.toLowerCase();
      const isExcluded = exclusionSet.has(lowerWord);
      
      let color: 'default' | 'success' | 'error' = 'default';
      let knownHanziPercentage: number | undefined = undefined;
      
      if (!isExcluded) {
        // For Chinese, check known hanzi percentage
        if (language === 'chinese') {
          knownHanziPercentage = calculateKnownHanziPercentage(word, knownHanziSet, hanziCacheRef.current);
          if (knownHanziPercentage === 0) {
            color = frequency >= 5 ? 'success' : 'error';
          }
        } else {
          color = frequency >= 5 ? 'success' : 'error';
        }
      }
      
      const baseSx = {
        fontSize: '0.875rem',
        height: 'auto',
        py: 0.5,
        cursor: 'pointer',
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
        baseSx: sx,
        knownHanziPercentage,
      });
    });
    
    return styles;
  }, [filteredWordFrequencies, exclusionSet, knownHanziSet, language]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
    
    const index = getSentenceIndex();
    if (index) {
      const occurrences = findWordOccurrencesWithIndex(index, word);
      setWordOccurrences(occurrences);
    } else {
      setWordOccurrences([]);
    }
  }, [getSentenceIndex]);

  // Compute which occurrences have no unknown words except the selected one
  useEffect(() => {
    if (!selectedWord || wordOccurrences.length === 0) {
      setOccurrencesWithNoUnknownWords(new Set());
      return;
    }

    const computeUnknownWords = async () => {
      const results = new Set<number>();
      
      await Promise.all(
        wordOccurrences.map(async (occurrence, index) => {
          const hasNoUnknown = await hasNoUnknownWordsExceptSelected(
            occurrence.sentence,
            selectedWord,
            language,
            exclusionSet,
            language === 'chinese' ? knownHanziSet : undefined
          );
          if (hasNoUnknown) {
            results.add(index);
          }
        })
      );
      
      setOccurrencesWithNoUnknownWords(results);
    };

    computeUnknownWords();
  }, [wordOccurrences, selectedWord, language, exclusionSet, knownHanziSet]);

  const handleCloseDrawer = useCallback(() => {
    setSelectedWord(null);
    setWordOccurrences([]);
    setOccurrencesWithNoUnknownWords(new Set());
    setShowUnderstandable(true);
    setShowOther(true);
  }, []);

  const handleExportToCSV = useCallback(() => {
    if (filteredWordFrequencies.length === 0) return;

    // CSV escaping: wrap in quotes if contains comma, quote, or newline, and escape quotes
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Create CSV header
    const headers = ['word', 'frequency count', 'is word in exclusions'];
    const csvRows = [headers.join(',')];

    // Add data rows
    filteredWordFrequencies.forEach(({ word, frequency }) => {
      const lowerWord = word.toLowerCase();
      const isExcluded = exclusionSet.has(lowerWord);
      csvRows.push([
        escapeCSV(word),
        frequency.toString(),
        isExcluded ? 'TRUE' : 'FALSE',
      ].join(','));
    });

    // Create CSV content
    const csvContent = csvRows.join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'frequency-dictionary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredWordFrequencies, exclusionSet]);

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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total unique words: {filteredWordFrequencies.length}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportToCSV}
                    size="small"
                  >
                    Export to CSV
                  </Button>
                </Box>
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
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
                    {language === 'chinese' && (
                      <Chip
                        label="Contains known hanzi"
                        size="small"
                        variant="filled"
                        sx={{
                          backgroundColor: 'rgba(128, 128, 128, 0.4)',
                          color: 'text.primary',
                        }}
                      />
                    )}
                    <Chip
                      label="Known (in exclusion list)"
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Paper>
                <Box 
                  ref={containerRef}
                  sx={{ mb: 2, height: 600 }}
                >
                  <List
                    rowCount={rowCount}
                    rowHeight={36}
                    style={{ height: 600 }}
                    rowComponent={({ index, style, ...props }) => {
                      // Calculate which chips belong to this row
                      const startIndex = index * chipsPerRow;
                      const endIndex = Math.min(startIndex + chipsPerRow, filteredWordFrequencies.length);
                      const rowChips = filteredWordFrequencies.slice(startIndex, endIndex);
                      
                      return (
                        <Box 
                          style={style} 
                          sx={{ 
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1,
                            px: 0.5,
                          }} 
                          {...props}
                        >
                          {rowChips.map(({ word, frequency }) => {
                            const baseStyle = baseChipStyles.get(word);
                            if (!baseStyle) return null;
                            
                            return (
                              <WordChip
                                key={word}
                                word={word}
                                frequency={frequency}
                                baseStyle={baseStyle}
                                isSelected={selectedWord === word}
                                onWordClick={handleWordClick}
                              />
                            );
                          })}
                        </Box>
                      );
                    }}
                    rowProps={{}}
                  />
                </Box>
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
        {selectedWord && (
          <Box sx={{ mb: 2 }}>
            <Link
              href={getDictionaryUrl(language, selectedWord)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontSize: '0.875rem' }}
            >
              Look up in dictionary
            </Link>
          </Box>
        )}
        {selectedWord && wordOccurrences.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {(() => {
                const understandableCount = occurrencesWithNoUnknownWords.size;
                const otherCount = wordOccurrences.length - understandableCount;
                return (
                  <>
                    <Chip
                      label={`More understandable (${understandableCount})`}
                      onClick={() => setShowUnderstandable(!showUnderstandable)}
                      color={showUnderstandable ? 'success' : 'default'}
                      variant={showUnderstandable ? 'filled' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: showUnderstandable ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                        borderColor: showUnderstandable ? 'success.main' : 'divider',
                        '&:hover': {
                          opacity: 0.8,
                        },
                      }}
                    />
                    <Chip
                      label={`Other (${otherCount})`}
                      onClick={() => setShowOther(!showOther)}
                      color={showOther ? 'default' : 'default'}
                      variant={showOther ? 'filled' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: showOther 
                          ? 'rgba(0, 0, 0, 0.06)' 
                          : 'transparent',
                        borderColor: showOther ? 'divider' : 'divider',
                        borderWidth: showOther ? 1 : 1,
                        borderStyle: 'solid',
                        opacity: showOther ? 1 : 0.6,
                        '&:hover': {
                          opacity: showOther ? 0.9 : 0.8,
                          backgroundColor: showOther 
                            ? 'rgba(0, 0, 0, 0.08)' 
                            : 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    />
                  </>
                );
              })()}
            </Stack>
          </Box>
        )}
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ overflow: 'auto' }}>
          {wordOccurrences.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No occurrences found.
            </Typography>
          ) : (
            <Stack spacing={3}>
              {wordOccurrences
                .map((occurrence, index) => {
                  const hasNoUnknown = occurrencesWithNoUnknownWords.has(index);
                  return { occurrence, index, hasNoUnknown };
                })
                .filter(({ hasNoUnknown }) => {
                  if (hasNoUnknown) return showUnderstandable;
                  return showOther;
                })
                .map(({ occurrence, index, hasNoUnknown }, filteredIndex) => {
                  const highlightedSentence = highlightWordInSentence(
                    occurrence.sentence,
                    selectedWord!,
                    language
                  );
                  // Alternate background for visual separation
                  const isEven = filteredIndex % 2 === 0;
                  const baseBackground = isEven 
                    ? 'rgba(0, 0, 0, 0.02)' 
                    : 'rgba(0, 0, 0, 0.04)';
                  
                  return (
                    <Card 
                      key={index} 
                      variant="elevation"
                      elevation={2}
                      sx={{
                        backgroundColor: hasNoUnknown 
                          ? 'rgba(76, 175, 80, 0.1)' 
                          : baseBackground,
                        border: '1px solid',
                        borderColor: hasNoUnknown ? 'success.main' : 'divider',
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

