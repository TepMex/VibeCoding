import { useState, useEffect, useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import { storage, type ThemeMode } from '../utils/storage';

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => storage.getTheme());

  useEffect(() => {
    storage.saveTheme(mode);
  }, [mode]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#1976d2',
          },
        },
      }),
    [mode]
  );

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return { theme, mode, toggleTheme };
}
