import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HabitsList />} />
          <Route path="/questionnaire/:habitId" element={<Questionnaire />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
