export type GridStyle = 'tian' | 'mi'
export type LinesPerHanzi = 1 | 2 | 3 | 'full'

export type HanziRow = {
  hanzi: string
  pinyin: string
}

export type CopybookState = {
  hanziList: string[]
  cellSizeMm: number
  exampleLines: number
  exampleCells: number
  linesPerHanzi: LinesPerHanzi
  useStrokeOrder: boolean
  maxExamples: number
  gridStyle: GridStyle
}
