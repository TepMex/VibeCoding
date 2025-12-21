import { useState, useRef } from "react";
import {
  Box,
  TextField,
  Typography,
  Button,
  Stack,
  Alert,
  Input,
} from "@mui/material";
import { parseFile } from "../utils/fileParsers";

interface TextInputScreenProps {
  text: string;
  onTextChange: (text: string) => void;
}

export function TextInputScreen({ text, onTextChange }: TextInputScreenProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadFromUrl = async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load: ${response.statusText}`);
      }
      const content = await response.text();
      onTextChange(content);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load from URL");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const content = await parseFile(file);
      onTextChange(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Typography variant="h5" gutterBottom>
        Text Input
      </Typography>

      <Stack spacing={2} sx={{ mt: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Load from URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/text.txt"
            fullWidth
            size="small"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleLoadFromUrl();
              }
            }}
          />
          <Button
            variant="contained"
            onClick={handleLoadFromUrl}
            disabled={loading}
            sx={{ minWidth: 100 }}
          >
            Load
          </Button>
        </Stack>

        <Button
          variant="outlined"
          onClick={handleFileButtonClick}
          disabled={loading}
          fullWidth
        >
          Load from File (TXT, HTML, EPUB, FB2)
        </Button>

        <Input
          type="file"
          inputRef={fileInputRef}
          onChange={handleFileSelect}
          accept=".txt,.html,.htm,.epub,.fb2"
          sx={{ display: "none" }}
        />

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Stack>

      <TextField
        multiline
        rows={20}
        fullWidth
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Paste your Mandarin text here..."
        sx={{ flexGrow: 1, mt: 2 }}
        disabled={loading}
      />
    </Box>
  );
}

