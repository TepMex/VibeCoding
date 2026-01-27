import { Box, Link, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import type { GridStyle, LinesPerHanzi } from '../types/copybook'
import {
  loadHanziStrokeData,
  type HanziStrokeData,
} from '../utils/hanziStrokeData'

type CopybookSheetProps = {
  hanziList: string[]
  cellSizeMm: number
  exampleLines: number
  exampleCells: number
  linesPerHanzi: LinesPerHanzi
  useStrokeOrder: boolean
  maxExamples: number
  gridStyle: GridStyle
}

type CopybookSectionProps = {
  hanzi: string
  columns: number
  rows: number
  showLink: boolean
  exampleLines: number
  exampleCells: number
  useStrokeOrder: boolean
  maxExamples: number
  gridStyle: GridStyle
}

const pageWidthMm = 210
const pageHeightMm = 297
const pageMarginMm = 12
const headerHeightMm = 14
const headerGapMm = 4
const sectionGapMm = 4

const formatMm = (value: number) => `${value}mm`

const clamp = (value: number, min: number) => Math.max(value, min)

function CopybookSection({
  hanzi,
  columns,
  rows,
  showLink,
  exampleLines,
  exampleCells,
  useStrokeOrder,
  maxExamples,
  gridStyle,
}: CopybookSectionProps) {
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

  const cells = useMemo(() => {
    const total = columns * rows
    return Array.from({ length: total }, (_, index) => index)
  }, [columns, rows])

  const strokeCount = strokeData?.strokes.length ?? 0
  const exampleCellsPerRow = useMemo(
    () => Math.min(Math.max(exampleCells, 0), columns),
    [exampleCells, columns],
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
    <Box className="copybook-section">
      <Box className="copybook-header">
        <Typography className="copybook-header-hanzi">{hanzi}</Typography>
        {showLink && (
          <Link
            className="copybook-header-link"
            href="https://tepmex.github.io/hanzi-copybook"
            target="_blank"
            rel="noreferrer"
            underline="none"
          >
            tepmex.github.io/hanzi-copybook
          </Link>
        )}
      </Box>
      <Box
        className={`copybook-grid copybook-grid-${gridStyle}`}
        sx={{
          gridTemplateColumns: `repeat(${columns}, var(--cell-size))`,
          gridTemplateRows: `repeat(${rows}, var(--cell-size))`,
        }}
      >
        {cells.map((cellIndex) => {
          const rowIndex = Math.floor(cellIndex / columns)
          const columnIndex = cellIndex % columns
          const isExampleRow = rowIndex < exampleLines
          const isExampleCell = isExampleRow && columnIndex < exampleCellsPerRow
          const exampleCellIndex = rowIndex * exampleCellsPerRow + columnIndex
          const showStrokeOrder = isExampleCell && useStrokeOrder && strokeData
          const stageCount = showStrokeOrder
            ? exampleCellIndex < totalExampleStages
              ? Math.min(stageOffset + exampleCellIndex + 1, strokeCount)
              : strokeCount
            : 0
          const showFallbackText = isExampleCell && (!useStrokeOrder || !strokeData)
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
                        <path key={`${hanzi}-stroke-${index}`} d={stroke} />
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
  )
}

function CopybookSheet({
  hanziList,
  cellSizeMm,
  exampleLines,
  exampleCells,
  linesPerHanzi,
  useStrokeOrder,
  maxExamples,
  gridStyle,
}: CopybookSheetProps) {
  const layout = useMemo(() => {
    const usableWidth = pageWidthMm - pageMarginMm * 2
    const usableHeight = pageHeightMm - pageMarginMm * 2
    const columns = clamp(Math.floor(usableWidth / cellSizeMm), 1)
    const maxRowsPerSection = clamp(
      Math.floor((usableHeight - headerHeightMm - headerGapMm) / cellSizeMm),
      1,
    )
    const requestedRows =
      linesPerHanzi === 'full' ? maxRowsPerSection : linesPerHanzi
    const rowsPerSection = Math.min(maxRowsPerSection, requestedRows)
    const sectionHeightMm =
      headerHeightMm + headerGapMm + rowsPerSection * cellSizeMm
    const sectionsPerPage = clamp(
      Math.floor((usableHeight + sectionGapMm) / (sectionHeightMm + sectionGapMm)),
      1,
    )
    return { columns, rowsPerSection, sectionsPerPage }
  }, [cellSizeMm, linesPerHanzi])

  const pages = useMemo(() => {
    const result: string[][] = []
    for (let index = 0; index < hanziList.length; index += layout.sectionsPerPage) {
      result.push(hanziList.slice(index, index + layout.sectionsPerPage))
    }
    return result
  }, [hanziList, layout.sectionsPerPage])

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
    <>
      {pages.map((page, pageIndex) => (
        <Box
          key={`sheet-${pageIndex}`}
          className="copybook-page"
          sx={{ px: 0, py: 0 }}
          style={styleVars}
        >
          <Box className="copybook-page-inner">
            {page.map((hanzi, sectionIndex) => (
              <CopybookSection
                key={`sheet-${pageIndex}-${sectionIndex}-${hanzi}`}
                hanzi={hanzi}
                columns={layout.columns}
                rows={layout.rowsPerSection}
                showLink={sectionIndex === 0}
                exampleLines={exampleLines}
                exampleCells={exampleCells}
                useStrokeOrder={useStrokeOrder}
                maxExamples={maxExamples}
                gridStyle={gridStyle}
              />
            ))}
          </Box>
        </Box>
      ))}
    </>
  )
}

export default CopybookSheet
