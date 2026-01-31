import { Box, Link } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import type { GridStyle, LinesPerHanzi } from '../types/copybook'
import {
  loadHanziStrokeData,
  type HanziStrokeData,
} from '../utils/hanziStrokeData'

type CopybookPageProps = {
  hanzi: string
  cellSizeMm: number
  exampleLines: number
  exampleCells: number
  linesPerHanzi: LinesPerHanzi
  useStrokeOrder: boolean
  maxExamples: number
  gridStyle: GridStyle
}

const pageWidthMm = 210
const pageHeightMm = 297
const pageMarginMm = 12
const pageHeaderHeightMm = 12
const pageInnerGapMm = 4

const formatMm = (value: number) => `${value}mm`

const clamp = (value: number, min: number) => Math.max(value, min)

function CopybookPage({
  hanzi,
  cellSizeMm,
  exampleLines,
  exampleCells,
  linesPerHanzi,
  useStrokeOrder,
  maxExamples,
  gridStyle,
}: CopybookPageProps) {
  const [strokeData, setStrokeData] = useState<HanziStrokeData | null>(null)

  useEffect(() => {
    let active = true

    loadHanziStrokeData(hanzi).then((data) => {
      if (active) setStrokeData(data)
    })

    return () => {
      active = false
    }
  }, [hanzi])

  const hanziHeaderHeightMm = useMemo(() => cellSizeMm / 3, [cellSizeMm])

  const layout = useMemo(() => {
    const usableWidth = pageWidthMm - pageMarginMm * 2
    const usableHeight =
      pageHeightMm -
      pageMarginMm * 2 -
      pageHeaderHeightMm -
      hanziHeaderHeightMm -
      pageInnerGapMm * 2
    const columns = clamp(Math.floor(usableWidth / cellSizeMm), 1)
    const rows = clamp(Math.floor(usableHeight / cellSizeMm), 1)
    const limitedRows =
      linesPerHanzi === 'full' ? rows : Math.min(rows, linesPerHanzi)
    return { columns, rows: limitedRows }
  }, [cellSizeMm, hanziHeaderHeightMm, linesPerHanzi])

  const cells = useMemo(() => {
    const total = layout.columns * layout.rows
    return Array.from({ length: total }, (_, index) => index)
  }, [layout.columns, layout.rows])

  const styleVars = useMemo(
    () =>
      ({
        '--cell-size': formatMm(cellSizeMm),
        '--page-margin': formatMm(pageMarginMm),
        '--page-header-height': formatMm(pageHeaderHeightMm),
        '--hanzi-header-height': formatMm(hanziHeaderHeightMm),
      }) as React.CSSProperties,
    [cellSizeMm, hanziHeaderHeightMm],
  )

  const strokeCount = strokeData?.strokes.length ?? 0
  const headerStages = Math.max(strokeCount, 1)
  const headerCellSizeMm = useMemo(() => {
    const usableWidth = pageWidthMm - pageMarginMm * 2
    const fitSize = usableWidth / headerStages
    return Math.min(hanziHeaderHeightMm, fitSize)
  }, [headerStages, hanziHeaderHeightMm])
  const exampleCellsPerRow = useMemo(
    () => Math.min(Math.max(exampleCells, 0), layout.columns),
    [exampleCells, layout.columns],
  )
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
          <Link
            className="copybook-header-link"
            href="https://premium-chinese.ru/"
            target="_blank"
            rel="noreferrer"
            underline="none"
          >
            https://premium-chinese.ru/
          </Link>
        </Box>
        <Box className="copybook-section">
          <Box
            className="copybook-hanzi-header"
            sx={{
              gridTemplateColumns: `repeat(${headerStages}, var(--hanzi-header-cell-size))`,
            }}
            style={
              {
                '--hanzi-header-cell-size': formatMm(headerCellSizeMm),
              } as React.CSSProperties
            }
          >
            {Array.from({ length: headerStages }, (_, index) => {
              const stageCount = strokeCount > 0 ? index + 1 : 0
              return (
                <Box
                  className="copybook-hanzi-header-cell"
                  key={`${hanzi}-header-${index}`}
                >
                  {strokeData && strokeCount > 0 ? (
                    <svg
                      className="copybook-hanzi-header-strokes"
                      viewBox="0 -100 1024 1024"
                      aria-hidden="true"
                    >
                      <g transform="translate(0 824) scale(1 -1)">
                        {strokeData.strokes
                          .slice(0, stageCount)
                          .map((stroke, strokeIndex) => (
                            <path
                              key={`${hanzi}-header-stroke-${index}-${strokeIndex}`}
                              d={stroke}
                            />
                          ))}
                      </g>
                    </svg>
                  ) : (
                    <span className="copybook-hanzi-header-text">{hanzi}</span>
                  )}
                </Box>
              )
            })}
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
              const isExampleCell =
                isExampleRow && columnIndex < exampleCellsPerRow
              const exampleCellIndex =
                rowIndex * exampleCellsPerRow + columnIndex
              const showStrokeOrder = isExampleCell && useStrokeOrder && strokeData
              const stageCount = showStrokeOrder
                ? exampleCellIndex < totalExampleStages
                  ? Math.min(stageOffset + exampleCellIndex + 1, strokeCount)
                  : strokeCount
                : 0
              const showFallbackText =
                isExampleCell && (!useStrokeOrder || !strokeData)
              return (
                <Box
                  className={`copybook-cell ${
                    isExampleCell ? 'copybook-cell-example' : ''
                  } ${isExampleCell && columnIndex === 0 ? 'copybook-cell-example-first' : ''}`}
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
    </Box>
  )
}

export default CopybookPage
