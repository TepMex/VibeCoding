import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CopybookScreen from './components/CopybookScreen'
import type { CopybookState, GridStyle } from './types/copybook'
import { decodeCopybookState, encodeCopybookState } from './utils/shareLink'

const defaultCellSizeMm = 15
const defaultExampleLines = 1
const defaultMaxExamples = 6
const defaultGridStyle: GridStyle = 'tian'

function App() {
  const [hanziText, setHanziText] = useState('我的汉子')
  const [cellSizeMm, setCellSizeMm] = useState(defaultCellSizeMm)
  const [exampleLines, setExampleLines] = useState(defaultExampleLines)
  const [useStrokeOrder, setUseStrokeOrder] = useState(false)
  const [maxExamples, setMaxExamples] = useState(defaultMaxExamples)
  const [gridStyle, setGridStyle] = useState<GridStyle>(defaultGridStyle)
  const [copybookData, setCopybookData] = useState<CopybookState | null>(null)

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
    setUseStrokeOrder(decoded.useStrokeOrder)
    setMaxExamples(decoded.maxExamples)
    setGridStyle(decoded.gridStyle)
    setCopybookData(decoded)
  }, [defaultCopybookState])

  const updateHash = (state: CopybookState) => {
    const encoded = encodeCopybookState(state)
    window.location.hash = `data=${encoded}`
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
        gridStyle={copybookData.gridStyle}
        onGridStyleChange={(value) => {
          setGridStyle(value)
          const nextState = { ...copybookData, gridStyle: value }
          setCopybookData(nextState)
          updateHash(nextState)
        }}
        onCopyLink={() => copyToClipboard(window.location.href)}
      />
    )
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 6 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            Hanzi Copybook
          </Typography>

          <TextField
            label="Hanzi list"
            placeholder="例: 我,你,他 or 我你他"
            value={hanziText}
            onChange={(event) => setHanziText(event.target.value)}
            multiline
            minRows={3}
            fullWidth
          />

          <TextField
            label="Cell size (mm)"
            type="number"
            value={cellSizeMm}
            onChange={(event) => setCellSizeMm(Number(event.target.value))}
            inputProps={{ min: 1, step: 1 }}
            fullWidth
          />

          <TextField
            label="Number of example lines"
            type="number"
            value={exampleLines}
            onChange={(event) => setExampleLines(Number(event.target.value))}
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
            label="Use stroke order in example lines"
          />

          {useStrokeOrder && (
            <TextField
              label="Max number of examples"
              type="number"
              value={maxExamples}
              onChange={(event) => setMaxExamples(Number(event.target.value))}
              inputProps={{ min: 1, step: 1 }}
              fullWidth
            />
          )}

          <Button variant="contained" size="large" onClick={handleGenerate}>
            Generate copybook
          </Button>
        </Stack>
      </Box>
    </Container>
  )
}

export default App
