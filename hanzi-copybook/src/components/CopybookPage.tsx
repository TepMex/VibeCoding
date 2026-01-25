import { Box, Typography } from '@mui/material'
import { useMemo } from 'react'

type GridStyle = 'tian' | 'mi'

type CopybookPageProps = {
  hanzi: string
  cellSizeMm: number
  exampleLines: number
  gridStyle: GridStyle
}

const pageWidthMm = 210
const pageHeightMm = 297
const pageMarginMm = 12
const headerHeightMm = 14

const formatMm = (value: number) => `${value}mm`

const clamp = (value: number, min: number) => Math.max(value, min)

function CopybookPage({
  hanzi,
  cellSizeMm,
  exampleLines,
  gridStyle,
}: CopybookPageProps) {
  const layout = useMemo(() => {
    const usableWidth = pageWidthMm - pageMarginMm * 2
    const usableHeight = pageHeightMm - pageMarginMm * 2 - headerHeightMm
    const columns = clamp(Math.floor(usableWidth / cellSizeMm), 1)
    const rows = clamp(Math.floor(usableHeight / cellSizeMm), 1)
    return { columns, rows }
  }, [cellSizeMm])

  const cells = useMemo(() => {
    const total = layout.columns * layout.rows
    return Array.from({ length: total }, (_, index) => index)
  }, [layout.columns, layout.rows])

  const styleVars = useMemo(
    () =>
      ({
        '--cell-size': formatMm(cellSizeMm),
        '--page-margin': formatMm(pageMarginMm),
        '--header-height': formatMm(headerHeightMm),
      }) as React.CSSProperties,
    [cellSizeMm],
  )

  return (
    <Box className="copybook-page" sx={{ px: 0, py: 0 }} style={styleVars}>
      <Box className="copybook-page-inner">
        <Box className="copybook-header">
          <Typography className="copybook-header-hanzi">{hanzi}</Typography>
          <Typography className="copybook-header-meta">
            {`${cellSizeMm}mm · ${exampleLines} example lines · ${
              gridStyle === 'tian' ? 'Tian zi ge' : 'Mi zi ge'
            }`}
          </Typography>
        </Box>
        <Box
          className={`copybook-grid copybook-grid-${gridStyle}`}
          sx={{
            gridTemplateColumns: `repeat(${layout.columns}, var(--cell-size))`,
            gridTemplateRows: `repeat(${layout.rows}, var(--cell-size))`,
          }}
        >
          {cells.map((cellIndex) => {
            const rowIndex = Math.floor(cellIndex / layout.columns)
            const isExampleRow = rowIndex < exampleLines
            return (
              <Box
                className={`copybook-cell ${
                  isExampleRow ? 'copybook-cell-example' : ''
                }`}
                key={`${hanzi}-${cellIndex}`}
              >
                <span className="copybook-cell-diagonal copybook-cell-diagonal-1" />
                <span className="copybook-cell-diagonal copybook-cell-diagonal-2" />
                {isExampleRow && (
                  <span className="copybook-cell-hanzi">{hanzi}</span>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

export default CopybookPage
