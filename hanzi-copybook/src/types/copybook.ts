export type GridStyle = 'tian' | 'mi'

export type CopybookState = {
  hanziList: string[]
  cellSizeMm: number
  exampleLines: number
  exampleCells: number
  useStrokeOrder: boolean
  maxExamples: number
  gridStyle: GridStyle
}
