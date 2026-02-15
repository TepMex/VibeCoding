import { useState, useRef } from 'react';
import {
  Container,
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { AudioPlayer } from './components/AudioPlayer';
import { extractTextFromFile } from './utils/textExtractor';
import { createSearchIndex, getAllChunks, searchText } from './utils/textSearch';
import { transcribe } from './utils/whisperWrapper';

interface PerformanceLogEntry {
  id: string;
  createdAt: number;
  recognitionMs: number;
  searchMs: number | null;
  matched: boolean;
}

function App() {
  const [textFile, setTextFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [bookText, setBookText] = useState<string>('');
  const [bookTitle, setBookTitle] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<number | null>(null);
  const [performanceLogs, setPerformanceLogs] = useState<PerformanceLogEntry[]>([]);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  const handleTextFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTextFile(file);
    setIsLoadingText(true);
    setError(null);

    try {
      const extracted = await extractTextFromFile(file);
      setBookText(extracted.text);
      setBookTitle(extracted.title || file.name);
      await createSearchIndex(extracted.text, extracted.title || file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text from file');
      setBookText('');
      setBookTitle('');
    } finally {
      setIsLoadingText(false);
    }
  };

  const handleAudioFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setError(null);
    }
  };

  const handleStop = async (last5Seconds: AudioBuffer) => {
    console.log('[App] handleStop called with AudioBuffer:', {
      duration: last5Seconds.duration,
      sampleRate: last5Seconds.sampleRate,
      numberOfChannels: last5Seconds.numberOfChannels,
      length: last5Seconds.length
    });

    if (!bookText) {
      console.warn('[App] handleStop: No book text loaded');
      setError('Please load a text file first');
      return;
    }

    console.log('[App] Starting transcription process');
    setIsTranscribing(true);
    setError(null);

    try {
      // Transcribe the last 5 seconds
      console.log('[App] Calling transcribe function...');
      const recognitionStart = performance.now();
      const transcript = await transcribe(last5Seconds);
      const recognitionMs = performance.now() - recognitionStart;
      console.log('[App] Transcription completed:', { transcript });
      
      if (!transcript || transcript.trim().length === 0) {
        console.warn('[App] Empty transcript received');
        setError('No speech detected in the last 5 seconds');
        setPerformanceLogs((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            createdAt: Date.now(),
            recognitionMs,
            searchMs: null,
            matched: false,
          },
          ...prev,
        ].slice(0, 10));
        setIsTranscribing(false);
        return;
      }

      // Search for the transcript in the book text
      console.log('[App] Searching for transcript in book text...');
      const searchStart = performance.now();
      const searchResult = searchText(transcript.trim());
      const searchMs = performance.now() - searchStart;
      console.log('[App] Search result:', searchResult);

      if (!searchResult) {
        console.warn('[App] Transcript not found in book text');
        setError(`Could not find transcript in text: "${transcript}"`);
        setPerformanceLogs((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            createdAt: Date.now(),
            recognitionMs,
            searchMs,
            matched: false,
          },
          ...prev,
        ].slice(0, 10));
        setIsTranscribing(false);
        return;
      }

      setPerformanceLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          createdAt: Date.now(),
          recognitionMs,
          searchMs,
          matched: true,
        },
        ...prev,
      ].slice(0, 10));

      // Scroll to the found location
      console.log('[App] Scrolling to chunk:', searchResult.index);
      scrollToChunk(searchResult.index);
    } catch (err) {
      console.error('[App] Error in handleStop:', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  const scrollToChunk = (chunkIndex: number) => {
    if (!textDisplayRef.current) return;

    const chunks = getAllChunks();
    if (chunkIndex < 0 || chunkIndex >= chunks.length) return;

    // Set the highlighted chunk index in state (persistent)
    setHighlightedChunkIndex(chunkIndex);

    // Find the element with data-chunk-index attribute and scroll to it
    const targetElement = textDisplayRef.current.querySelector(
      `[data-chunk-index="${chunkIndex}"]`
    ) as HTMLElement;

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const chunks = getAllChunks();

  return (
    <Container maxWidth="lg" sx={{ py: 2, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, flexShrink: 0 }}>
        <Typography variant="h4" gutterBottom>
          Language Learning Audio Player
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" component="label">
            Upload Text File
            <input
              type="file"
              hidden
              accept=".txt,.html,.htm,.epub,.fb2"
              onChange={handleTextFileChange}
            />
          </Button>
          {textFile && (
            <Typography variant="body2" sx={{ alignSelf: 'center' }}>
              {textFile.name}
            </Typography>
          )}

          <Button variant="outlined" component="label">
            Upload Audio File
            <input
              type="file"
              hidden
              accept="audio/mpeg,audio/mp3,.mp3"
              onChange={handleAudioFileChange}
            />
          </Button>
          {audioFile && (
            <Typography variant="body2" sx={{ alignSelf: 'center' }}>
              {audioFile.name}
            </Typography>
          )}
        </Box>

        {isLoadingText && <CircularProgress size={24} sx={{ mb: 2 }} />}
        {isTranscribing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Transcribing audio...</Typography>
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Performance Log
          </Typography>
          {performanceLogs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No measurements yet. Press stop during playback to run sync.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {performanceLogs.map((entry) => (
                <Typography key={entry.id} variant="body2" color={entry.matched ? 'text.primary' : 'warning.main'}>
                  {new Date(entry.createdAt).toLocaleTimeString()} - STT: {entry.recognitionMs.toFixed(1)}ms - Search:{' '}
                  {entry.searchMs === null ? 'n/a' : `${entry.searchMs.toFixed(1)}ms`} - Match:{' '}
                  {entry.matched ? 'yes' : 'no'}
                </Typography>
              ))}
            </Box>
          )}
        </Paper>

        <AudioPlayer audioFile={audioFile} onStop={handleStop} />
      </Box>

      <Paper
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 3,
          backgroundColor: 'background.default',
        }}
      >
        {bookTitle && (
          <Typography variant="h5" gutterBottom>
            {bookTitle}
          </Typography>
        )}
        {bookText ? (
          <Box ref={textDisplayRef} sx={{ lineHeight: 1.8 }}>
            {chunks.map((chunk, index) => (
              <span
                key={index}
                data-chunk-index={index}
                style={{
                  display: 'inline-block',
                  marginBottom: '0.5em',
                  padding: '2px 4px',
                  transition: 'background-color 0.3s',
                  backgroundColor: highlightedChunkIndex === index ? 'yellow' : 'transparent',
                }}
              >
                {chunk}{' '}
              </span>
            ))}
          </Box>
        ) : (
          <Typography variant="body1" color="text.secondary">
            Upload a text file to display the book content
          </Typography>
        )}
      </Paper>
    </Container>
  );
}

export default App;
