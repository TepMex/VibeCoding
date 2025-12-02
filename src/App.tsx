import { useState } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Box } from '@mui/material'
import { TextInputScreen } from './components/TextInputScreen.tsx'
import { HeatmapScreen } from './components/HeatmapScreen.tsx'
import { BottomNavigation } from './components/BottomNavigation.tsx'
import './App.css'

const theme = createTheme()

function App() {
  const [text, setText] = useState('')
  const [currentScreen, setCurrentScreen] = useState(0)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ pb: 7 }}>
        {currentScreen === 0 && <TextInputScreen text={text} onTextChange={setText} />}
        {currentScreen === 1 && <HeatmapScreen text={text} />}
      </Box>
      <BottomNavigation currentScreen={currentScreen} onScreenChange={setCurrentScreen} />
    </ThemeProvider>
  )
}

export default App
