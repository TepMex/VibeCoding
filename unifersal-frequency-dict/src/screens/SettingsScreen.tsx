import { useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import type { Language } from '../utils/languageDetection';

interface SettingsScreenProps {
  exclusionList: string;
  language: Language;
  onExclusionListChange: (exclusionList: string) => void;
}

export const SettingsScreen = ({
  exclusionList,
  language,
  onExclusionListChange,
}: SettingsScreenProps) => {
  const handleExport = useCallback(() => {
    if (!exclusionList.trim()) {
      return;
    }

    const blob = new Blob([exclusionList], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `exclusion-list-${language}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exclusionList, language]);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Exclusion List
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter words you already know (one per line). These words will be excluded from the report.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={12}
            value={exclusionList}
            onChange={(e) => onExclusionListChange(e.target.value)}
            placeholder="word1&#10;word2&#10;word3"
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={!exclusionList.trim()}
          >
            Export Exclusion List
          </Button>
        </Paper>
      </Stack>
    </Box>
  );
};

