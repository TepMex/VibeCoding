import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Snackbar,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import BarChartIcon from '@mui/icons-material/BarChart';
import { AudioPlayer } from './components/AudioPlayer';
import { FilePickerModal } from './components/FilePickerModal';
import { extractTextFromFile, type Chapter } from './utils/textExtractor';
import { createSearchIndex, getAllChunks, searchText } from './utils/textSearch';
import { preloadModel, transcribe } from './utils/whisperWrapper';
import { getCurrentFile, type FileType } from './utils/fileStorage';

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
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<number | null>(null);
  const [performanceLogs, setPerformanceLogs] = useState<PerformanceLogEntry[]>([]);
  const [showPerformanceLog, setShowPerformanceLog] = useState(false);
  const [activePickerType, setActivePickerType] = useState<FileType | null>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  const loadTextFile = async (file: File) => {
    setTextFile(file);
    setIsLoadingText(true);
    setError(null);

    try {
      const extracted = await extractTextFromFile(file);
      setBookText(extracted.text);
      setBookTitle(extracted.title || file.name);
      const extractedChapters = extracted.chapters || [];
      setChapters(extractedChapters);
      setSelectedChapterId('');
      await createSearchIndex(extracted.text, extracted.title || file.name, undefined, extractedChapters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text from file');
      setBookText('');
      setBookTitle('');
      setChapters([]);
      setSelectedChapterId('');
    } finally {
      setIsLoadingText(false);
    }
  };

  const handleTextFileSelect = async (file: File) => {
    await loadTextFile(file);
  };

  const handleAudioFileSelect = async (file: File) => {
    setAudioFile(file);
    setError(null);
  };

  useEffect(() => {
    const restoreFiles = async () => {
      try {
        const [restoredAudio, restoredText] = await Promise.all([
          getCurrentFile('audio'),
          getCurrentFile('text'),
        ]);

        if (restoredAudio) {
          setAudioFile(restoredAudio);
        }
        if (restoredText) {
          await loadTextFile(restoredText);
        }
      } catch (restoreError) {
        console.warn('[App] Failed to restore files:', restoreError);
      }
    };

    restoreFiles().catch((restoreError) => {
      console.warn('[App] Restore process failed:', restoreError);
    });
  }, []);

  useEffect(() => {
    preloadModel().catch((warmupError: unknown) => {
      console.warn('[App] Model warm-up on app mount failed:', warmupError);
    });
  }, []);

  useEffect(() => {
    if (!audioFile) return;
    preloadModel().catch((warmupError: unknown) => {
      console.warn('[App] Model warm-up after audio load failed:', warmupError);
    });
  }, [audioFile]);

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
      const searchResult = searchText(transcript.trim(), selectedChapterId || undefined);
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
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Paper
        elevation={0}
        square
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          px: 1,
          pt: 1,
          pb: 0.5,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, minHeight: 48 }}>
          <Tooltip title="Upload text file">
            <IconButton
              size="small"
              color="primary"
              aria-label="upload text file"
              onClick={() => setActivePickerType('text')}
            >
              <UploadFileIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Upload audio file">
            <IconButton
              size="small"
              color="primary"
              aria-label="upload audio file"
              onClick={() => setActivePickerType('audio')}
            >
              <AudioFileIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle performance log">
            <IconButton
              size="small"
              color={showPerformanceLog ? 'secondary' : 'default'}
              onClick={() => setShowPerformanceLog((prev) => !prev)}
              aria-label="toggle performance log"
            >
              <BarChartIcon />
            </IconButton>
          </Tooltip>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1, overflow: 'hidden' }}>
            {textFile && <Chip size="small" variant="outlined" label={textFile.name} sx={{ maxWidth: '45%' }} />}
            {audioFile && <Chip size="small" variant="outlined" label={audioFile.name} sx={{ maxWidth: '45%' }} />}
          </Box>

          {isLoadingText && <CircularProgress size={16} />}
          {isTranscribing && <CircularProgress size={16} color="secondary" />}
        </Box>

        {chapters.length > 0 && (
          <FormControl size="small" fullWidth sx={{ mb: 1 }}>
            <InputLabel id="chapter-selector-label">Chapter</InputLabel>
            <Select
              labelId="chapter-selector-label"
              value={selectedChapterId}
              label="Chapter"
              onChange={(event) => setSelectedChapterId(event.target.value)}
            >
              <MenuItem value="">
                <em>All chapters</em>
              </MenuItem>
              {chapters.map((chapter) => (
                <MenuItem key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <AudioPlayer
          audioFile={audioFile}
          mediaTitle={bookTitle || audioFile?.name || 'Audio Book'}
          onStop={handleStop}
        />

        <Collapse in={showPerformanceLog}>
          <Paper variant="outlined" sx={{ mt: 1, p: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Performance Log
            </Typography>
            {performanceLogs.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No measurements yet. Press stop during playback to run sync.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, maxHeight: 120, overflow: 'auto' }}>
                {performanceLogs.map((entry) => (
                  <Typography key={entry.id} variant="caption" color={entry.matched ? 'text.primary' : 'warning.main'}>
                    {new Date(entry.createdAt).toLocaleTimeString()} - STT: {entry.recognitionMs.toFixed(1)}ms - Search:{' '}
                    {entry.searchMs === null ? 'n/a' : `${entry.searchMs.toFixed(1)}ms`} - Match: {entry.matched ? 'yes' : 'no'}
                  </Typography>
                ))}
              </Box>
            )}
          </Paper>
        </Collapse>
      </Paper>

      <Paper
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: { xs: 1.5, sm: 2 },
          backgroundColor: 'background.default',
          minHeight: '66vh',
        }}
      >
        {bookTitle && (
          <Typography variant="h6" gutterBottom>
            {bookTitle}
          </Typography>
        )}
        {bookText ? (
          <Box ref={textDisplayRef} sx={{ lineHeight: 1.75, fontSize: { xs: '1rem', sm: '1.05rem' } }}>
            {chunks.map((chunk, index) => (
              <span
                key={index}
                data-chunk-index={index}
                style={{
                  display: 'inline-block',
                  marginBottom: '0.4em',
                  padding: '2px 4px',
                  transition: 'background-color 0.3s',
                  backgroundColor: highlightedChunkIndex === index ? '#fff59d' : 'transparent',
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

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        message={error}
      />

      {activePickerType && (
        <FilePickerModal
          open={Boolean(activePickerType)}
          type={activePickerType}
          onClose={() => setActivePickerType(null)}
          onFileSelect={async (file) => {
            if (activePickerType === 'text') {
              await handleTextFileSelect(file);
              return;
            }
            await handleAudioFileSelect(file);
          }}
        />
      )}
    </Box>
  );
}

export default App;
