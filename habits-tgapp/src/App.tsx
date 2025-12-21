import { useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import WebApp from '@twa-dev/sdk';
import { HabitsProvider } from './contexts/HabitsContext';
import HabitsList from './screens/HabitsList';
import Questionnaire from './screens/Questionnaire';

function App() {
  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    WebApp.enableClosingConfirmation();
  }, []);

  const theme = useMemo(() => {
    const colorScheme = WebApp.colorScheme || 'light';
    return createTheme({
      palette: {
        mode: colorScheme,
        ...(colorScheme === 'dark' && {
          background: {
            default: WebApp.backgroundColor,
            paper: WebApp.backgroundColor,
          },
        }),
      },
    });
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HabitsProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<HabitsList />} />
            <Route path="/questionnaire/:habitId" element={<Questionnaire />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </HabitsProvider>
    </ThemeProvider>
  );
}

export default App;
