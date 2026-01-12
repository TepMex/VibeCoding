import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppBar, Tabs, Tab, Box, ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { MainScreen } from './components/MainScreen';
import { SettingsScreen } from './components/SettingsScreen';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

function NavigationTabs() {
  const location = useLocation();
  const value = location.pathname === '/settings' ? 1 : 0;

  return (
    <AppBar position="static">
      <Tabs value={value} textColor="inherit" indicatorColor="secondary">
        <Tab label="Events" component={Link} to="/" />
        <Tab label="Settings" component={Link} to="/settings" />
      </Tabs>
    </AppBar>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <NavigationTabs />
          <Box component="main" sx={{ flexGrow: 1 }}>
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
