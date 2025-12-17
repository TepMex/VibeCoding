import { useState, useEffect } from 'react';
import { Box, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { TextFields, Assessment, MenuBook } from '@mui/icons-material';
import { TextInputScreen } from './screens/TextInputScreen';
import { ReportScreen } from './screens/ReportScreen';
import { ChaptersScreen } from './screens/ChaptersScreen';
import type { Language } from './utils/languageDetection';
import type { ChapterBoundary } from './utils/textExtraction';
import { loadExclusionList, saveExclusionList } from './utils/exclusionListStorage';

type Screen = 'input' | 'report' | 'chapters';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('input');
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<Language>('english');
  const [exclusionList, setExclusionList] = useState('');
  const [chapterBoundaries, setChapterBoundaries] = useState<ChapterBoundary[] | undefined>(undefined);

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
          />
        )}
        {currentScreen === 'chapters' && (
          <ChaptersScreen
            text={text}
            language={language}
            exclusionList={exclusionList}
            chapterBoundaries={chapterBoundaries}
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
