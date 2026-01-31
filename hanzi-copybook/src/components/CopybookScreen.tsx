import {
  Box,
  Button,
  Snackbar,
  Stack,
  SvgIcon,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import CopybookPage from './CopybookPage'
import CopybookSheet from './CopybookSheet'
import type { GridStyle, LinesPerHanzi } from '../types/copybook'
import { buildCopybookFilename, downloadCopybookPdf } from '../utils/pdf'
import { getBrowserTranslations } from '../i18n'

type CopybookScreenProps = {
  hanziList: string[]
  cellSizeMm: number
  exampleLines: number
  exampleCells: number
  linesPerHanzi: LinesPerHanzi
  useStrokeOrder: boolean
  maxExamples: number
  gridStyle: GridStyle
  onGridStyleChange: (value: GridStyle) => void
  onCopyLink: () => Promise<void> | void
  onBack: () => void
}

const BackIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </SvgIcon>
)

function CopybookScreen({
  hanziList,
  cellSizeMm,
  exampleLines,
  exampleCells,
  linesPerHanzi,
  useStrokeOrder,
  maxExamples,
  gridStyle,
  onGridStyleChange,
  onCopyLink,
  onBack,
}: CopybookScreenProps) {
  const strings = useMemo(() => getBrowserTranslations(), [])
  const [copied, setCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [pageScale, setPageScale] = useState(1)

  const normalizedList = useMemo(
    () => hanziList.filter((item) => item.trim().length > 0),
    [hanziList],
  )
  const renderFullPages = linesPerHanzi === 'full'

  useEffect(() => {
    const mmToPx = 96 / 25.4
    const pageWidthPx = 210 * mmToPx
    const updateScale = () => {
      const available = Math.max(window.innerWidth - 32, 0)
      const nextScale = Math.min(1, available / pageWidthPx)
      const safeScale = Number.isFinite(nextScale) ? Math.max(nextScale, 0.35) : 1
      setPageScale(safeScale)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return (
    <Box
      className="copybook-screen"
      style={
        {
          '--page-scale': pageScale,
        } as CSSProperties
      }
    >
      <Box className="screen-only copybook-controls">
        <Stack direction="row" spacing={2} alignItems="center">
          <Button variant="text" onClick={onBack} startIcon={<BackIcon />}>
            {strings.backButton}
          </Button>
          <ToggleButtonGroup
            exclusive
            value={gridStyle}
            onChange={(_, value) => {
              if (value) onGridStyleChange(value)
            }}
            size="small"
          >
            <ToggleButton value="tian">{strings.gridTian}</ToggleButton>
            <ToggleButton value="mi">{strings.gridMi}</ToggleButton>
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
            {strings.copyLink}
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
            {isDownloading ? strings.generatingPdf : strings.downloadPdf}
          </Button>
        </Stack>
      </Box>
      <Stack spacing={4} alignItems="center">
        {renderFullPages ? (
          normalizedList.map((hanzi) => (
            <CopybookPage
              key={`page-${hanzi}`}
              hanzi={hanzi}
              cellSizeMm={cellSizeMm}
              exampleLines={exampleLines}
              exampleCells={exampleCells}
              linesPerHanzi={linesPerHanzi}
              useStrokeOrder={useStrokeOrder}
              maxExamples={maxExamples}
              gridStyle={gridStyle}
            />
          ))
        ) : (
          <CopybookSheet
            hanziList={normalizedList}
            cellSizeMm={cellSizeMm}
            exampleLines={exampleLines}
            exampleCells={exampleCells}
            linesPerHanzi={linesPerHanzi}
            useStrokeOrder={useStrokeOrder}
            maxExamples={maxExamples}
            gridStyle={gridStyle}
          />
        )}
      </Stack>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message={strings.linkCopied}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}

export default CopybookScreen
