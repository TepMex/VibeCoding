import { Button, Container, Typography, Box, IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

interface StartScreenProps {
  onStart: (mode: 'training' | 'survival') => void;
  onSettings: () => void;
}

export const StartScreen = ({ onStart, onSettings }: StartScreenProps) => {
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

