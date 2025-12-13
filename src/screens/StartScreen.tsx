import { Button, Container, Typography, Box, IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

interface StartScreenProps {
  onStart: () => void;
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
        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          sx={{
            fontSize: '1.5rem',
            padding: '16px 48px',
            minWidth: '200px',
          }}
        >
          Start
        </Button>
      </Box>
    </Container>
  );
};

