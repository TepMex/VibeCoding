import { useState, useEffect } from 'react';
import { Button, Container, Typography, Box, IconButton, Paper } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { getHighscore } from '../utils/pairsStorage';

interface StartScreenProps {
  onStart: (mode: 'training' | 'survival') => void;
  onSettings: () => void;
}

export const StartScreen = ({ onStart, onSettings }: StartScreenProps) => {
  const [highscore, setHighscore] = useState(0);

  useEffect(() => {
    const loadHighscore = () => {
      setHighscore(getHighscore());
    };
    
    loadHighscore();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hanzi-mistaken-pairs-highscore') {
        loadHighscore();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab updates)
    const handleHighscoreChange = () => {
      loadHighscore();
    };
    
    window.addEventListener('highscoreChanged', handleHighscoreChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('highscoreChanged', handleHighscoreChange);
    };
  }, []);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 4,
          position: 'relative',
        }}
      >
        <IconButton
          onClick={onSettings}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
          }}
        >
          <SettingsIcon />
        </IconButton>
        <Typography variant="h3" component="h1" align="center" gutterBottom>
          Hanzi Training
        </Typography>
        {highscore > 0 && (
          <Paper
            sx={{
              padding: 2,
              backgroundColor: 'primary.light',
              color: 'primary.contrastText',
            }}
          >
            <Typography variant="h6" align="center">
              Highscore: {highscore}
            </Typography>
          </Paper>
        )}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: '100%',
            maxWidth: 300,
          }}
        >
          <Button
            variant="contained"
            size="large"
            onClick={() => onStart('training')}
            sx={{
              fontSize: '1.5rem',
              padding: '16px 48px',
            }}
          >
            Training
          </Button>
          <Button
            variant="contained"
            size="large"
            onClick={() => onStart('survival')}
            sx={{
              fontSize: '1.5rem',
              padding: '16px 48px',
            }}
          >
            Survival
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

