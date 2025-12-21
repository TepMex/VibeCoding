import { TextField, Box, Typography, Container, Stack } from '@mui/material';

interface TextInputScreenProps {
  text: string;
  onTextChange: (text: string) => void;
  exceptions: string;
  onExceptionsChange: (exceptions: string) => void;
}

export const TextInputScreen = ({ text, onTextChange, exceptions, onExceptionsChange }: TextInputScreenProps) => {
  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: 10 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Enter Mandarin Text
      </Typography>
      <Stack spacing={3} sx={{ mt: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={15}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Paste your Mandarin text here..."
          sx={{
            '& .MuiInputBase-root': {
              fontSize: '1.2rem',
              fontFamily: 'serif',
            },
          }}
        />
        <Box>
          <Typography variant="h6" gutterBottom>
            Exceptions
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={exceptions}
            onChange={(e) => onExceptionsChange(e.target.value)}
            placeholder="Enter hanzi that you already know..."
            sx={{
              '& .MuiInputBase-root': {
                fontSize: '1.2rem',
                fontFamily: 'serif',
              },
            }}
          />
        </Box>
      </Stack>
    </Container>
  );
};



