import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import type { Language } from '../utils/languageDetection';
import { LANGUAGES } from '../utils/languageDetection';
import { getDeckNames, getModelNames, checkConnection } from '../clients/ankiConnect';
import type { AnkiSettings } from '../persistence/ankiSettingsStorage';

interface SettingsScreenProps {
  exclusionList: string;
  language: Language;
  onExclusionListChange: (exclusionList: string) => void;
  ankiSettings: AnkiSettings;
  onAnkiSettingsChange: (settings: AnkiSettings) => void;
  nativeLanguage: Language;
  onNativeLanguageChange: (nativeLanguage: Language) => void;
}

export const SettingsScreen = ({
  exclusionList,
  language,
  onExclusionListChange,
  ankiSettings,
  onAnkiSettingsChange,
  nativeLanguage,
  onNativeLanguageChange,
}: SettingsScreenProps) => {
  const [deckNames, setDeckNames] = useState<string[]>([]);
  const [modelNames, setModelNames] = useState<string[]>([]);
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [ankiError, setAnkiError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const loadAnkiData = async () => {
      try {
        const connected = await checkConnection();
        setIsConnected(connected);
        
        if (!connected) {
          setAnkiError('Cannot connect to AnkiConnect. Make sure Anki is running and AnkiConnect addon is installed.');
          return;
        }

        setAnkiError(null);
        setIsLoadingDecks(true);
        setIsLoadingModels(true);

        const [decks, models] = await Promise.all([
          getDeckNames(),
          getModelNames(),
        ]);

        setDeckNames(decks);
        setModelNames(models);
      } catch (error) {
        setAnkiError(error instanceof Error ? error.message : 'Failed to load Anki data');
        setIsConnected(false);
      } finally {
        setIsLoadingDecks(false);
        setIsLoadingModels(false);
      }
    };

    loadAnkiData();
  }, []);

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

  const handleDeckChange = useCallback((deckName: string) => {
    onAnkiSettingsChange({
      ...ankiSettings,
      deckName,
    });
  }, [ankiSettings, onAnkiSettingsChange]);

  const handleModelChange = useCallback((modelName: string) => {
    onAnkiSettingsChange({
      ...ankiSettings,
      modelName,
    });
  }, [ankiSettings, onAnkiSettingsChange]);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Translation Settings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select your native language. This will be used as the target language for Google Translate.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Native Language</InputLabel>
            <Select
              value={nativeLanguage}
              label="Native Language"
              onChange={(e) => onNativeLanguageChange(e.target.value as Language)}
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang} value={lang}>
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

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

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Anki Card Creation Settings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the deck and model to use when creating Anki cards.
          </Typography>
          
          {ankiError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {ankiError}
            </Alert>
          )}

          {isConnected === null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Checking AnkiConnect connection...
              </Typography>
            </Box>
          )}

          <Stack spacing={2}>
            <FormControl fullWidth disabled={!isConnected || isLoadingDecks}>
              <InputLabel>Deck Name</InputLabel>
              <Select
                value={ankiSettings.deckName}
                label="Deck Name"
                onChange={(e) => handleDeckChange(e.target.value)}
              >
                {deckNames.map((deck) => (
                  <MenuItem key={deck} value={deck}>
                    {deck}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={!isConnected || isLoadingModels}>
              <InputLabel>Model Name</InputLabel>
              <Select
                value={ankiSettings.modelName}
                label="Model Name"
                onChange={(e) => handleModelChange(e.target.value)}
              >
                {modelNames.map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};



