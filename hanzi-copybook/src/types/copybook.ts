export type GridStyle = 'tian' | 'mi'

export type CopybookState = {
  hanziList: string[]
  cellSizeMm: number
  exampleLines: number
  useStrokeOrder: boolean
  maxExamples: number
  gridStyle: GridStyle
}
