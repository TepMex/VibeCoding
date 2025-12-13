import { Button, Container, Typography, Box } from '@mui/material';

interface StartScreenProps {
  onStart: () => void;
}

export const StartScreen = ({ onStart }: StartScreenProps) => {
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
        }}
      >
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

