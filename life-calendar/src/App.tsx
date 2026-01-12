import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppBar, Tabs, Tab, Box, ThemeProvider, CssBaseline, IconButton, Tooltip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useEffect } from 'react';
import { MainScreen } from './components/MainScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { useTheme } from './hooks/useTheme';

function NavigationTabs({ onToggleTheme, themeMode }: { onToggleTheme: () => void; themeMode: 'light' | 'dark' }) {
  const location = useLocation();
  const value = location.pathname === '/settings' ? 1 : 0;

  return (
    <AppBar position="static">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Tabs 
          value={value} 
          textColor="inherit" 
          indicatorColor="secondary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flexGrow: 1,
            '& .MuiTab-root': {
              minWidth: { xs: 80, sm: 120 },
              fontSize: { xs: '0.875rem', sm: '1rem' },
              padding: { xs: '12px 16px', sm: '16px 24px' },
            },
          }}
        >
          <Tab label="Events" component={Link} to="/" />
          <Tab label="Settings" component={Link} to="/settings" />
        </Tabs>
        <Tooltip title={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
          <IconButton
            color="inherit"
            onClick={onToggleTheme}
            sx={{
              mr: { xs: 1, sm: 2 },
              '& .MuiSvgIcon-root': {
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
              },
            }}
          >
            {themeMode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Tooltip>
      </Box>
    </AppBar>
  );
}

function App() {
  const { theme, mode, toggleTheme } = useTheme();

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', mode === 'dark' ? '#121212' : '#1976d2');
    }
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          <NavigationTabs onToggleTheme={toggleTheme} themeMode={mode} />
          <Box component="main" sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<MainScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
