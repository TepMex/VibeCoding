import { Box, Link, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import type { GridStyle } from '../types/copybook'
import {
  loadHanziStrokeData,
  type HanziStrokeData,
} from '../utils/hanziStrokeData'

type CopybookPageProps = {
  hanzi: string
  cellSizeMm: number
  exampleLines: number
  useStrokeOrder: boolean
  maxExamples: number
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
  useStrokeOrder,
  maxExamples,
  gridStyle,
}: CopybookPageProps) {
  const [strokeData, setStrokeData] = useState<HanziStrokeData | null>(null)

  useEffect(() => {
    if (!useStrokeOrder) return
    let active = true

    loadHanziStrokeData(hanzi).then((data) => {
      if (active) setStrokeData(data)
    })

    return () => {
      active = false
    }
  }, [hanzi, useStrokeOrder])

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

  const strokeCount = strokeData?.strokes.length ?? 0
  const totalExampleStages = useMemo(() => {
    if (!useStrokeOrder || strokeCount === 0) return 0
    return Math.min(maxExamples, strokeCount)
  }, [useStrokeOrder, maxExamples, strokeCount])

  const stageOffset = useMemo(() => {
    if (!useStrokeOrder || strokeCount === 0) return 0
    return Math.max(strokeCount - maxExamples, 0)
  }, [useStrokeOrder, maxExamples, strokeCount])

  return (
    <Box className="copybook-page" sx={{ px: 0, py: 0 }} style={styleVars}>
      <Box className="copybook-page-inner">
        <Box className="copybook-header">
          <Typography className="copybook-header-hanzi">{hanzi}</Typography>
          <Link
            className="copybook-header-link"
            href="https://tepmex.github.io/hanzi-copybook"
            target="_blank"
            rel="noreferrer"
            underline="none"
          >
            tepmex.github.io/hanzi-copybook
          </Link>
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
            const columnIndex = cellIndex % layout.columns
            const isExampleRow = rowIndex < exampleLines
            const exampleCellIndex = rowIndex * layout.columns + columnIndex
            const showStrokeOrder = isExampleRow && useStrokeOrder && strokeData
            const stageCount = showStrokeOrder
              ? exampleCellIndex < totalExampleStages
                ? Math.min(stageOffset + exampleCellIndex + 1, strokeCount)
                : strokeCount
              : 0
            const showFallbackText =
              isExampleRow && (!useStrokeOrder || !strokeData)
            return (
              <Box
                className={`copybook-cell ${
                  isExampleRow ? 'copybook-cell-example' : ''
                }`}
                key={`${hanzi}-${cellIndex}`}
              >
                <span className="copybook-cell-diagonal copybook-cell-diagonal-1" />
                <span className="copybook-cell-diagonal copybook-cell-diagonal-2" />
                {showStrokeOrder && strokeData && (
                  <svg
                    className="copybook-cell-strokes"
                    viewBox="0 -100 1024 1024"
                    aria-hidden="true"
                  >
                    <g transform="translate(0 824) scale(1 -1)">
                      {strokeData.strokes
                        .slice(0, stageCount)
                        .map((stroke, index) => (
                          <path
                            key={`${hanzi}-stroke-${index}`}
                            d={stroke}
                          />
                        ))}
                    </g>
                  </svg>
                )}
                {showFallbackText && (
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
