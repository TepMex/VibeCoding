import { Box, TextField, Typography } from "@mui/material";

interface TextInputScreenProps {
  text: string;
  onTextChange: (text: string) => void;
}

export function TextInputScreen({ text, onTextChange }: TextInputScreenProps) {
  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Typography variant="h5" gutterBottom>
        Text Input
      </Typography>
      <TextField
        multiline
        rows={20}
        fullWidth
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Paste your Mandarin text here..."
        sx={{ flexGrow: 1, mt: 2 }}
      />
    </Box>
  );
}

