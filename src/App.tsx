import { useState } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { TextInputScreen } from './components/TextInputScreen.tsx'
import './App.css'

const theme = createTheme()

function App() {
  const [text, setText] = useState('')

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TextInputScreen text={text} onTextChange={setText} />
    </ThemeProvider>
  )
}

export default App
