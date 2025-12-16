import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Paper,
} from '@mui/material';
import { segmentText } from '../utils/wordSegmentation';
import {
  calculateWordFrequencies,
  normalizeExclusionList,
  type WordFrequency,
} from '../utils/frequencyAnalysis';
import type { Language } from '../utils/languageDetection';

interface ReportScreenProps {
  text: string;
  language: Language;
  exclusionList: string;
}

export const ReportScreen = ({
  text,
  language,
  exclusionList,
}: ReportScreenProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordFrequencies, setWordFrequencies] = useState<WordFrequency[]>([]);

  const exclusionSet = useMemo(
    () => normalizeExclusionList(exclusionList),
    [exclusionList]
  );

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

  const getChipColor = (word: string, frequency: number): 'default' | 'success' | 'error' => {
    if (exclusionSet.has(word.toLowerCase())) {
      return 'default';
    }
    return frequency >= 5 ? 'success' : 'error';
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
          {wordFrequencies.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No words found. Please add some text on the Text Input screen.
              </Typography>
            </Paper>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Total unique words: {wordFrequencies.length}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  mb: 2,
                }}
              >
                {wordFrequencies.map(({ word, frequency }) => (
                  <Chip
                    key={word}
                    label={`${word} (${frequency})`}
                    color={getChipColor(word, frequency)}
                    variant={exclusionSet.has(word.toLowerCase()) ? 'outlined' : 'filled'}
                    sx={{
                      fontSize: '0.875rem',
                      height: 'auto',
                      py: 0.5,
                    }}
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
    </Box>
  );
};

