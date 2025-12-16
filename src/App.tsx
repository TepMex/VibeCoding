import { useState } from 'react';
import { Box, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { TextFields, Assessment } from '@mui/icons-material';
import { TextInputScreen } from './screens/TextInputScreen';
import { ReportScreen } from './screens/ReportScreen';
import type { Language } from './utils/languageDetection';

type Screen = 'input' | 'report';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('input');
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<Language>('english');
  const [exclusionList, setExclusionList] = useState('');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box sx={{ flex: 1, overflow: 'auto', pb: 7 }}>
        {currentScreen === 'input' && (
          <TextInputScreen
            text={text}
            language={language}
            exclusionList={exclusionList}
            onTextChange={setText}
            onLanguageChange={setLanguage}
            onExclusionListChange={setExclusionList}
          />
        )}
        {currentScreen === 'report' && (
          <ReportScreen
            text={text}
            language={language}
            exclusionList={exclusionList}
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
      </BottomNavigation>
    </Box>
  );
}

export default App;
