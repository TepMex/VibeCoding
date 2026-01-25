import {
  Box,
  Button,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { useMemo, useState } from 'react'
import CopybookPage from './CopybookPage'
import type { GridStyle } from '../types/copybook'
import { buildCopybookFilename, downloadCopybookPdf } from '../utils/pdf'

type CopybookScreenProps = {
  hanziList: string[]
  cellSizeMm: number
  exampleLines: number
  gridStyle: GridStyle
  onGridStyleChange: (value: GridStyle) => void
  onCopyLink: () => Promise<void> | void
  onBack: () => void
}

function CopybookScreen({
  hanziList,
  cellSizeMm,
  exampleLines,
  gridStyle,
  onGridStyleChange,
  onCopyLink,
  onBack,
}: CopybookScreenProps) {
  const [copied, setCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const normalizedList = useMemo(
    () => hanziList.filter((item) => item.trim().length > 0),
    [hanziList],
  )

  return (
    <Box className="copybook-screen">
      <Box className="screen-only copybook-controls">
        <Stack direction="row" spacing={2} alignItems="center">
          <Button variant="text" onClick={onBack}>
            Back
          </Button>
          <ToggleButtonGroup
            exclusive
            value={gridStyle}
            onChange={(_, value) => {
              if (value) onGridStyleChange(value)
            }}
            size="small"
          >
            <ToggleButton value="tian">Tian zi ge</ToggleButton>
            <ToggleButton value="mi">Mi zi ge</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            onClick={async () => {
              try {
                await onCopyLink()
                setCopied(true)
              } catch {
                setCopied(false)
              }
            }}
          >
            Copy link
          </Button>
          <Button
            variant="contained"
            disabled={isDownloading}
            onClick={async () => {
              setIsDownloading(true)
              try {
                await downloadCopybookPdf(buildCopybookFilename(normalizedList))
              } finally {
                setIsDownloading(false)
              }
            }}
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </Stack>
      </Box>
      <Stack spacing={4} alignItems="center">
        {normalizedList.map((hanzi) => (
          <CopybookPage
            key={`page-${hanzi}`}
            hanzi={hanzi}
            cellSizeMm={cellSizeMm}
            exampleLines={exampleLines}
            gridStyle={gridStyle}
          />
        ))}
      </Stack>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Link copied"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}

export default CopybookScreen
