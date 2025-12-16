import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
} from '@mui/material';
import { CloudUpload, Clear } from '@mui/icons-material';
import { extractTextFromFile } from '../utils/textExtraction';
import { detectLanguage } from '../utils/languageDetection';
import type { Language } from '../utils/languageDetection';

interface TextInputScreenProps {
  text: string;
  language: Language;
  exclusionList: string;
  onTextChange: (text: string) => void;
  onLanguageChange: (language: Language) => void;
  onExclusionListChange: (exclusionList: string) => void;
}

export const TextInputScreen = ({
  text,
  language,
  exclusionList,
  onTextChange,
  onLanguageChange,
  onExclusionListChange,
}: TextInputScreenProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsExtracting(true);
    setError(null);

    try {
      const result = await extractTextFromFile(file);
      onTextChange(result.text);
      
      // Auto-detect language
      const detectedLanguage = detectLanguage(result.text);
      onLanguageChange(detectedLanguage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text from file');
    } finally {
      setIsExtracting(false);
    }
  }, [onTextChange, onLanguageChange]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleClearText = useCallback(() => {
    onTextChange('');
    setError(null);
  }, [onTextChange]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    onTextChange(newText);
    
    // Auto-detect language when text changes
    if (newText.trim()) {
      const detectedLanguage = detectLanguage(newText);
      onLanguageChange(detectedLanguage);
    }
  }, [onTextChange, onLanguageChange]);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Text Input
      </Typography>

      <Stack spacing={3}>
        {/* File Upload Section */}
        <Paper
          sx={{
            p: 3,
            border: `2px dashed ${isDragging ? 'primary.main' : 'grey.300'}`,
            backgroundColor: isDragging ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s',
            cursor: 'pointer',
            position: 'relative',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".txt,.pdf,.epub,.fb2,.html,.htm"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            id="file-upload-input"
            disabled={isExtracting}
          />
          <label htmlFor="file-upload-input">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
              }}
            >
              {isExtracting ? (
                <CircularProgress />
              ) : (
                <>
                  <CloudUpload sx={{ fontSize: 48, color: 'primary.main' }} />
                  <Typography variant="body1">
                    Drag and drop a file here, or click to select
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Supported formats: TXT, PDF, EPUB, FB2, HTML
                  </Typography>
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<CloudUpload />}
                  >
                    Upload File
                  </Button>
                </>
              )}
            </Box>
          </label>
        </Paper>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Language Selection */}
        <FormControl fullWidth>
          <InputLabel>Language</InputLabel>
          <Select
            value={language}
            label="Language"
            onChange={(e) => onLanguageChange(e.target.value as Language)}
          >
            <MenuItem value="chinese">Chinese</MenuItem>
            <MenuItem value="english">English</MenuItem>
            <MenuItem value="polish">Polish</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </Select>
        </FormControl>

        {/* Text Input */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Text Content</Typography>
            {text && (
              <Button
                size="small"
                startIcon={<Clear />}
                onClick={handleClearText}
              >
                Clear
              </Button>
            )}
          </Box>
          <TextField
            fullWidth
            multiline
            rows={12}
            value={text}
            onChange={handleTextChange}
            placeholder="Paste your text here or upload a file..."
            variant="outlined"
          />
        </Box>

        {/* Exclusion List */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Exclusion List
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Enter words you already know (one per line). These words will be excluded from the report.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={exclusionList}
            onChange={(e) => onExclusionListChange(e.target.value)}
            placeholder="word1&#10;word2&#10;word3"
            variant="outlined"
          />
        </Box>
      </Stack>
    </Box>
  );
};
