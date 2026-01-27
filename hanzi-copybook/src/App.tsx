import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  IconButton,
  Stack,
  SvgIcon,
  TextField,
  Typography,
} from '@mui/material'
import CopybookScreen from './components/CopybookScreen'
import type { CopybookState, GridStyle } from './types/copybook'
import { decodeCopybookState, encodeCopybookState } from './utils/shareLink'
import copybookBackground from './assets/copybook.png'
import { getBrowserTranslations } from './i18n'

const defaultCellSizeMm = 16
const defaultExampleLines = 1
const defaultExampleCells = 4
const defaultMaxExamples = 6
const defaultGridStyle: GridStyle = 'mi'

const SettingsIcon = (props: ComponentProps<typeof SvgIcon>) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M19.14,12.94c0.04-0.31,0.06-0.63,0.06-0.94s-0.02-0.63-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.2-0.37-0.28-0.58-0.22l-2.39,0.96c-0.5-0.38-1.04-0.7-1.64-0.94L14.5,2.5C14.47,2.22,14.24,2,13.96,2h-3.92C9.76,2,9.53,2.22,9.5,2.5L9.13,5.3c-0.6,0.24-1.15,0.56-1.64,0.94L5.1,5.28c-0.22-0.09-0.47,0.02-0.58,0.22L2.6,8.82c-0.12,0.2-0.06,0.47,0.12,0.61l2.03,1.58C4.71,11.37,4.69,11.68,4.69,12s0.02,0.63,0.06,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.2,0.37,0.28,0.58,0.22l2.39-0.96c0.5,0.38,1.04,0.7,1.64,0.94l0.37,2.8c0.03,0.28,0.26,0.5,0.54,0.5h3.92c0.28,0,0.51-0.22,0.54-0.5l0.37-2.8c0.6-0.24,1.15-0.56,1.64-0.94l2.39,0.96c0.22,0.09,0.47-0.02,0.58-0.22l1.92-3.32c0.12-0.2,0.06-0.47-0.12-0.61l-2.03-1.58ZM12,15.5c-1.93,0-3.5-1.57-3.5-3.5s1.57-3.5,3.5-3.5,3.5,1.57,3.5,3.5-1.57,3.5-3.5,3.5Z" />
  </SvgIcon>
)

function App() {
  const strings = useMemo(() => getBrowserTranslations(), [])
  const [hanziText, setHanziText] = useState('我的汉子')
  const [cellSizeMm, setCellSizeMm] = useState(defaultCellSizeMm)
  const [exampleLines, setExampleLines] = useState(defaultExampleLines)
  const [exampleCells, setExampleCells] = useState(defaultExampleCells)
  const [useStrokeOrder, setUseStrokeOrder] = useState(false)
  const [maxExamples, setMaxExamples] = useState(defaultMaxExamples)
  const [gridStyle, setGridStyle] = useState<GridStyle>(defaultGridStyle)
  const [copybookData, setCopybookData] = useState<CopybookState | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const hanziList = useMemo(
    () =>
      hanziText
        .replace(/[\s,，]+/g, '')
        .split('')
        .map((value) => value.trim())
        .filter(Boolean),
    [hanziText],
  )

  const defaultCopybookState: CopybookState = useMemo(
    () => ({
      hanziList: [],
      cellSizeMm: defaultCellSizeMm,
      exampleLines: defaultExampleLines,
      exampleCells: defaultExampleCells,
      useStrokeOrder: false,
      maxExamples: defaultMaxExamples,
      gridStyle: defaultGridStyle,
    }),
    [],
  )

  useEffect(() => {
    const decoded = decodeCopybookState(
      window.location.hash,
      defaultCopybookState,
    )
    if (!decoded) return
    setHanziText(decoded.hanziList.join(''))
    setCellSizeMm(decoded.cellSizeMm)
    setExampleLines(decoded.exampleLines)
    setExampleCells(decoded.exampleCells)
    setUseStrokeOrder(decoded.useStrokeOrder)
    setMaxExamples(decoded.maxExamples)
    setGridStyle(decoded.gridStyle)
    setCopybookData(decoded)
  }, [defaultCopybookState])

  const updateHash = (state: CopybookState) => {
    const encoded = encodeCopybookState(state)
    window.location.hash = `data=${encoded}`
  }

  const clearHash = () => {
    window.location.hash = ''
  }

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (!success) {
      throw new Error('Copy failed')
    }
  }

  const handleGenerate = () => {
    const nextState: CopybookState = {
      hanziList,
      cellSizeMm,
      exampleLines,
      exampleCells,
      useStrokeOrder,
      maxExamples,
      gridStyle,
    }
    setCopybookData(nextState)
    updateHash(nextState)
  }

  if (copybookData) {
    return (
      <CopybookScreen
        hanziList={copybookData.hanziList}
        cellSizeMm={copybookData.cellSizeMm}
        exampleLines={copybookData.exampleLines}
        exampleCells={copybookData.exampleCells}
        useStrokeOrder={copybookData.useStrokeOrder}
        maxExamples={copybookData.maxExamples}
        gridStyle={copybookData.gridStyle}
        onGridStyleChange={(value) => {
          setGridStyle(value)
          const nextState = { ...copybookData, gridStyle: value }
          setCopybookData(nextState)
          updateHash(nextState)
        }}
        onCopyLink={() => copyToClipboard(window.location.href)}
        onBack={() => {
          setCopybookData(null)
          clearHash()
        }}
      />
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f6efe4',
        backgroundImage: `url(${copybookBackground})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ py: 6 }}>
          <Box
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.88)',
              borderRadius: 3,
              px: { xs: 3, sm: 4 },
              py: { xs: 3, sm: 4 },
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <Stack spacing={3}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h4" component="h1">
                  {strings.appTitle}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={strings.settingsToggleLabel}
                  onClick={() => setShowSettings((value) => !value)}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Stack>

              <TextField
                label={strings.hanziListLabel}
                placeholder={strings.hanziListPlaceholder}
                value={hanziText}
                onChange={(event) => setHanziText(event.target.value)}
                multiline
                minRows={3}
                fullWidth
              />

              {showSettings && (
                <Stack spacing={3}>
                  <TextField
                    label={strings.cellSizeLabel}
                    type="number"
                    value={cellSizeMm}
                    onChange={(event) => setCellSizeMm(Number(event.target.value))}
                    inputProps={{ min: 1, step: 1 }}
                    fullWidth
                  />

                  <TextField
                    label={strings.exampleLinesLabel(exampleLines)}
                    type="number"
                    value={exampleLines}
                    onChange={(event) => setExampleLines(Number(event.target.value))}
                    inputProps={{ min: 0, step: 1 }}
                    fullWidth
                  />

                  <TextField
                    label={strings.exampleCellsLabel(exampleCells)}
                    type="number"
                    value={exampleCells}
                    onChange={(event) => setExampleCells(Number(event.target.value))}
                    inputProps={{ min: 0, step: 1 }}
                    fullWidth
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={useStrokeOrder}
                        onChange={(event) => setUseStrokeOrder(event.target.checked)}
                      />
                    }
                    label={strings.useStrokeOrderLabel}
                  />

                  {useStrokeOrder && (
                    <TextField
                      label={strings.maxExamplesLabel}
                      type="number"
                      value={maxExamples}
                      onChange={(event) => setMaxExamples(Number(event.target.value))}
                      inputProps={{ min: 1, step: 1 }}
                      fullWidth
                    />
                  )}
                </Stack>
              )}

              <Button
                variant="contained"
                color="success"
                size="large"
                onClick={handleGenerate}
              >
                {strings.generateCopybookButton}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default App
