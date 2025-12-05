import { HashRouter, Routes, Route } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { HabitsProvider } from './contexts/HabitsContext';
import HabitsList from './screens/HabitsList';
import Questionnaire from './screens/Questionnaire';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HabitsProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<HabitsList />} />
            <Route path="/questionnaire/:habitId" element={<Questionnaire />} />
          </Routes>
        </HashRouter>
      </HabitsProvider>
    </ThemeProvider>
  );
}

export default App;
