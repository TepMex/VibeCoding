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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  Link,
} from '@mui/material';
import { Close as CloseIcon, Menu as MenuIcon, Download as DownloadIcon } from '@mui/icons-material';
import {
  normalizeExclusionList,
  type WordFrequency,
  calculateWordFrequencies,
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
import {
  splitIntoChapters,
} from '../utils/chapterSplitting';
import { segmentText } from '../utils/wordSegmentation';
import type { ChapterBoundary } from '../utils/textExtraction';

interface ChaptersScreenProps {
  text: string;
  language: Language;
  exclusionList: string;
  chapterBoundaries?: ChapterBoundary[];
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

export const ChaptersScreen = ({
  text,
  language,
  exclusionList,
  chapterBoundaries,
  wordFrequencies,
  isProcessing,
  error,
}: ChaptersScreenProps) => {
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordOccurrences, setWordOccurrences] = useState<WordOccurrence[]>([]);
  const [isChapterPanelOpen, setIsChapterPanelOpen] = useState(true);
  const [occurrencesWithNoUnknownWords, setOccurrencesWithNoUnknownWords] = useState<Set<number>>(new Set());
  const chapterFrequenciesCacheRef = useRef<Map<number, WordFrequency[]>>(new Map());

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

  // Split text into chapters (memoized)
  const chapters = useMemo(() => {
    if (!text.trim()) return [];
    return splitIntoChapters(text, language, chapterBoundaries);
  }, [text, language, chapterBoundaries]);

  // Auto-select first chapter when chapters are available
  useEffect(() => {
    if (chapters.length > 0 && selectedChapterIndex === null) {
      setSelectedChapterIndex(0);
    }
  }, [chapters, selectedChapterIndex]);

  // Clear chapter cache when text changes
  useEffect(() => {
    const newCache = new Map();
    chapterFrequenciesCacheRef.current = newCache;
  }, [text, language]);

  // Get selected chapter
  const selectedChapter = useMemo(() => {
    if (selectedChapterIndex === null || !chapters[selectedChapterIndex]) {
      return null;
    }
    return chapters[selectedChapterIndex];
  }, [chapters, selectedChapterIndex]);

  // Chapter frequencies state (cached)
  const [currentChapterFrequencies, setCurrentChapterFrequencies] = useState<WordFrequency[]>([]);

  useEffect(() => {
    if (!selectedChapter) {
      setCurrentChapterFrequencies([]);
      return;
    }

    // Check cache first (using ref for immediate access without dependency)
    const cached = chapterFrequenciesCacheRef.current.get(selectedChapter.index);
    if (cached) {
      setCurrentChapterFrequencies(cached);
      return;
    }

    // Compute chapter frequencies asynchronously
    let cancelled = false;
    segmentText(selectedChapter.text, language)
      .then(words => {
        if (cancelled) return;
        const frequencies = calculateWordFrequencies(words);
        const newCache = new Map(chapterFrequenciesCacheRef.current);
        newCache.set(selectedChapter.index, frequencies);
        chapterFrequenciesCacheRef.current = newCache;
        setCurrentChapterFrequencies(frequencies);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Error computing chapter frequencies:', err);
        setCurrentChapterFrequencies([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChapter, language]);

  // Create map of whole text frequencies for quick lookup
  const wholeTextFrequencyMap = useMemo(() => {
    const map = new Map<string, number>();
    wordFrequencies.forEach(({ word, frequency }) => {
      map.set(word.toLowerCase(), frequency);
    });
    return map;
  }, [wordFrequencies]);

  // Create map of chapter frequencies for quick lookup
  const chapterFrequencyMap = useMemo(() => {
    const map = new Map<string, number>();
    currentChapterFrequencies.forEach(({ word, frequency }) => {
      map.set(word.toLowerCase(), frequency);
    });
    return map;
  }, [currentChapterFrequencies]);

  // Merge frequencies: combine whole text and chapter frequencies
  const mergedFrequencies = useMemo(() => {
    const merged = new Map<string, { word: string; wholeTextFreq: number; chapterFreq: number }>();
    
    // Add all words from whole text frequencies
    wordFrequencies.forEach(({ word }) => {
      const lowerWord = word.toLowerCase();
      merged.set(lowerWord, {
        word,
        wholeTextFreq: wholeTextFrequencyMap.get(lowerWord) || 0,
        chapterFreq: chapterFrequencyMap.get(lowerWord) || 0,
      });
    });

    // Add words that are only in chapter (not in whole text)
    currentChapterFrequencies.forEach(({ word }) => {
      const lowerWord = word.toLowerCase();
      if (!merged.has(lowerWord)) {
        merged.set(lowerWord, {
          word,
          wholeTextFreq: wholeTextFrequencyMap.get(lowerWord) || 0,
          chapterFreq: chapterFrequencyMap.get(lowerWord) || 0,
        });
      }
    });

    // Convert to array, filter out words with zero chapter frequency, and sort by whole text frequency (descending)
    return Array.from(merged.values())
      .filter(item => item.chapterFreq > 0)
      .sort((a, b) => b.wholeTextFreq - a.wholeTextFreq);
  }, [wordFrequencies, currentChapterFrequencies, wholeTextFrequencyMap, chapterFrequencyMap]);

  // Filter Chinese words to only show hanzi words
  const filteredMergedFrequencies = useMemo(() => {
    if (language !== 'chinese') {
      return mergedFrequencies;
    }
    return mergedFrequencies.filter(({ word }) => containsOnlyHanzi(word));
  }, [mergedFrequencies, language]);

  // Pre-compute and memoize all chip styles (O(n) once instead of O(n) per render)
  const chipStyles = useMemo(() => {
    const styles = new Map<string, ChipStyle>();
    
    filteredMergedFrequencies.forEach(({ word, wholeTextFreq }) => {
      const lowerWord = word.toLowerCase();
      const isExcluded = exclusionSet.has(lowerWord);
      
      let color: 'default' | 'success' | 'error' = 'default';
      let knownHanziPercentage: number | undefined = undefined;
      
      if (!isExcluded) {
        // For Chinese, check known hanzi percentage
        if (language === 'chinese') {
          knownHanziPercentage = calculateKnownHanziPercentage(word, knownHanziSet, hanziCache);
          if (knownHanziPercentage === 0) {
            color = wholeTextFreq >= 5 ? 'success' : 'error';
          }
        } else {
          color = wholeTextFreq >= 5 ? 'success' : 'error';
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
  }, [filteredMergedFrequencies, exclusionSet, knownHanziSet, language, selectedWord, hanziCache]);

  // Pre-compute sentence index for selected chapter
  const chapterSentenceIndex = useMemo<SentenceIndex | null>(() => {
    if (!selectedChapter) return null;
    return createSentenceIndex(selectedChapter.text, language);
  }, [selectedChapter, language]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
    
    if (chapterSentenceIndex) {
      const occurrences = findWordOccurrencesWithIndex(chapterSentenceIndex, word);
      setWordOccurrences(occurrences);
    } else {
      setWordOccurrences([]);
    }
  }, [chapterSentenceIndex]);

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
    setOccurrencesWithNoUnknownWords(new Set());
  }, []);

  const handleChapterSelect = useCallback((index: number) => {
    setSelectedChapterIndex(index);
    setSelectedWord(null);
    setWordOccurrences([]);
  }, []);

  const handleExportToCSV = useCallback(() => {
    if (filteredMergedFrequencies.length === 0 || selectedChapterIndex === null) return;

    // CSV escaping: wrap in quotes if contains comma, quote, or newline, and escape quotes
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Create CSV header
    const headers = ['word', 'whole text frequency count', 'chapter frequency count', 'is word in exclusions'];
    const csvRows = [headers.join(',')];

    // Add data rows
    filteredMergedFrequencies.forEach(({ word, wholeTextFreq, chapterFreq }) => {
      const lowerWord = word.toLowerCase();
      const isExcluded = exclusionSet.has(lowerWord);
      csvRows.push([
        escapeCSV(word),
        wholeTextFreq.toString(),
        chapterFreq.toString(),
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
    link.setAttribute('download', `chapter-${selectedChapterIndex + 1}-frequency-dictionary.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredMergedFrequencies, exclusionSet, selectedChapterIndex]);

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
      {/* Chapter Selection Panel */}
      <Drawer
        variant="persistent"
        open={isChapterPanelOpen}
        sx={{
          width: isChapterPanelOpen ? 280 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Chapters</Typography>
          <IconButton
            size="small"
            onClick={() => setIsChapterPanelOpen(false)}
            sx={{ ml: 1 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />
        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {chapters.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No chapters available.
            </Typography>
          ) : (
            <List>
              {chapters.map((chapter) => (
                <ListItem key={chapter.index} disablePadding>
                  <ListItemButton
                    selected={selectedChapterIndex === chapter.index}
                    onClick={() => handleChapterSelect(chapter.index)}
                  >
                    <ListItemText
                      primary={chapter.name || `Chapter ${chapter.index + 1}`}
                      secondary={`${chapter.text.length.toLocaleString()} chars`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Drawer>

      {/* Toggle button for chapter panel */}
      {!isChapterPanelOpen && (
        <IconButton
          onClick={() => setIsChapterPanelOpen(true)}
          sx={{
            position: 'fixed',
            left: 8,
            top: 8,
            zIndex: 1300,
            bgcolor: 'background.paper',
            boxShadow: 2,
          }}
        >
          <MenuIcon />
        </IconButton>
      )}

      {/* Main Content */}
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
          Chapter Frequency Dictionary
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
            {selectedChapterIndex === null ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  Select a chapter from the left panel to view its frequency dictionary.
                </Typography>
              </Paper>
            ) : filteredMergedFrequencies.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No words found in this chapter.
                </Typography>
              </Paper>
            ) : (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {selectedChapter && selectedChapter.name 
                      ? `${selectedChapter.name} (${selectedChapterIndex + 1} of ${chapters.length})`
                      : `Chapter ${selectedChapterIndex + 1} of ${chapters.length}`} • Total unique words: {filteredMergedFrequencies.length}
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
                  <Typography variant="caption" component="div" sx={{ mt: 1, color: 'text.secondary' }}>
                    Format: word (whole text frequency / chapter frequency)
                  </Typography>
                </Paper>
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
                  {filteredMergedFrequencies.map(({ word, wholeTextFreq, chapterFreq }) => {
                    const chipStyle = chipStyles.get(word);
                    if (!chipStyle) return null;
                    
                    return (
                      <Chip
                        key={word}
                        data-word={word}
                        label={`${word} (${wholeTextFreq}/${chapterFreq})`}
                        color={chipStyle.color}
                        variant={chipStyle.variant}
                        sx={chipStyle.sx}
                      />
                    );
                  })}
                </Box>
              </>
            )}
          </>
        )}
      </Box>

      {/* Word Occurrences Drawer */}
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
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ overflow: 'auto' }}>
          {wordOccurrences.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No occurrences found in this chapter.
            </Typography>
          ) : (
            <Stack spacing={3}>
              {wordOccurrences.map((occurrence, index) => {
                const highlightedSentence = highlightWordInSentence(
                  occurrence.sentence,
                  selectedWord!,
                  language
                );
                const hasNoUnknown = occurrencesWithNoUnknownWords.has(index);
                return (
                  <Card 
                    key={index} 
                    variant="elevation"
                    elevation={2}
                    sx={{
                      backgroundColor: hasNoUnknown ? 'rgba(76, 175, 80, 0.1)' : 'background.paper',
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

