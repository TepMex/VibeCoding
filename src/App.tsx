import { useState, useEffect, useRef } from 'react';
import { Box, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { TextFields, Assessment, MenuBook } from '@mui/icons-material';
import { TextInputScreen } from './screens/TextInputScreen';
import { ReportScreen } from './screens/ReportScreen';
import { ChaptersScreen } from './screens/ChaptersScreen';
import type { Language } from './utils/languageDetection';
import type { ChapterBoundary } from './utils/textExtraction';
import { loadExclusionList, saveExclusionList } from './utils/exclusionListStorage';
import type { WordFrequency } from './utils/frequencyAnalysis';
import type { WorkerMessage, WorkerResponse } from './workers/textProcessor.worker';

type Screen = 'input' | 'report' | 'chapters';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('input');
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<Language>('english');
  const [exclusionList, setExclusionList] = useState('');
  const [chapterBoundaries, setChapterBoundaries] = useState<ChapterBoundary[] | undefined>(undefined);
  
  // Background processing state
  const [wordFrequencies, setWordFrequencies] = useState<WordFrequency[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Load exclusion list from localStorage on mount
  useEffect(() => {
    const stored = loadExclusionList(language);
    setExclusionList(stored);
  }, []);

  // Load exclusion list when language changes
  useEffect(() => {
    const stored = loadExclusionList(language);
    setExclusionList(stored);
  }, [language]);

  // Save exclusion list to localStorage whenever it changes
  useEffect(() => {
    saveExclusionList(language, exclusionList);
  }, [language, exclusionList]);

  // Initialize Web Worker for background text processing
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./workers/textProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'result' && e.data.frequencies) {
        setWordFrequencies(e.data.frequencies);
        setIsProcessing(false);
        setProcessingError(null);
      } else if (e.data.type === 'error') {
        setProcessingError(e.data.error || 'Failed to process text');
        setWordFrequencies([]);
        setIsProcessing(false);
      }
    };

    workerRef.current.onerror = (err) => {
      setProcessingError('Worker error: ' + err.message);
      setWordFrequencies([]);
      setIsProcessing(false);
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Debounced background text processing
  useEffect(() => {
    // Clear previous debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text.trim()) {
      // Clear results immediately for empty text
      debounceTimerRef.current = window.setTimeout(() => {
        setWordFrequencies([]);
        setIsProcessing(false);
        setProcessingError(null);
      }, 0);
      return;
    }

    // Debounce processing by 400ms
    debounceTimerRef.current = window.setTimeout(() => {
      setIsProcessing(true);
      setProcessingError(null);
      
      if (workerRef.current) {
        const message: WorkerMessage = {
          type: 'process',
          text,
          language,
        };
        workerRef.current.postMessage(message);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [text, language]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box sx={{ flex: 1, overflow: 'auto', pb: 7 }}>
        {currentScreen === 'input' && (
          <TextInputScreen
            text={text}
            language={language}
            exclusionList={exclusionList}
            onTextChange={(newText) => {
              setText(newText);
              setChapterBoundaries(undefined); // Clear boundaries when text changes manually
            }}
            onLanguageChange={setLanguage}
            onExclusionListChange={setExclusionList}
            onChapterBoundariesChange={setChapterBoundaries}
          />
        )}
        {currentScreen === 'report' && (
          <ReportScreen
            text={text}
            language={language}
            exclusionList={exclusionList}
            wordFrequencies={wordFrequencies}
            isProcessing={isProcessing}
            error={processingError}
          />
        )}
        {currentScreen === 'chapters' && (
          <ChaptersScreen
            text={text}
            language={language}
            exclusionList={exclusionList}
            chapterBoundaries={chapterBoundaries}
            wordFrequencies={wordFrequencies}
            isProcessing={isProcessing}
            error={processingError}
          />
        )}
      </Box>
      <BottomNavigation
        value={currentScreen}
        onChange={(_, newValue) => setCurrentScreen(newValue)}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <BottomNavigationAction
          label="Text Input"
          value="input"
          icon={<TextFields />}
        />
        <BottomNavigationAction
          label="Report"
          value="report"
          icon={<Assessment />}
        />
        <BottomNavigationAction
          label="Chapters"
          value="chapters"
          icon={<MenuBook />}
        />
      </BottomNavigation>
    </Box>
  );
}

export default App;
