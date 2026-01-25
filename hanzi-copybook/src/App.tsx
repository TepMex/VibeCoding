import { useMemo, useState } from 'react'
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

const defaultCellSizeMm = 15
const defaultExampleLines = 1
const defaultMaxExamples = 6

function App() {
  const [hanziText, setHanziText] = useState('我的汉子')
  const [cellSizeMm, setCellSizeMm] = useState(defaultCellSizeMm)
  const [exampleLines, setExampleLines] = useState(defaultExampleLines)
  const [useStrokeOrder, setUseStrokeOrder] = useState(false)
  const [maxExamples, setMaxExamples] = useState(defaultMaxExamples)
  const [copybookData, setCopybookData] = useState<{
    hanziList: string[]
    cellSizeMm: number
    exampleLines: number
  } | null>(null)

  const hanziList = useMemo(
    () =>
      hanziText
        .replace(/[\s,，]+/g, '')
        .split('')
        .map((value) => value.trim())
        .filter(Boolean),
    [hanziText],
  )

  const handleGenerate = () => {
    setCopybookData({
      hanziList,
      cellSizeMm,
      exampleLines,
    })
  }

  if (copybookData) {
    return (
      <CopybookScreen
        hanziList={copybookData.hanziList}
        cellSizeMm={copybookData.cellSizeMm}
        exampleLines={copybookData.exampleLines}
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
