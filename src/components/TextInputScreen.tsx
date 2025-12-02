import { TextField, Box, Typography, Container } from '@mui/material';

interface TextInputScreenProps {
  text: string;
  onTextChange: (text: string) => void;
}

export const TextInputScreen = ({ text, onTextChange }: TextInputScreenProps) => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Enter Mandarin Text
      </Typography>
      <Box sx={{ mt: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={20}
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
      </Box>
    </Container>
  );
};



