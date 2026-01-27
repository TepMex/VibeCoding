const zh = {
  appTitle: '汉字字帖',
  hanziListLabel: '汉字列表',
  hanziListPlaceholder: '示例：我,你,他 或 我你他',
  cellSizeLabel: '格子大小（毫米）',
  linesPerHanziLabel: '每字行数',
  linesPerHanziOption: (count: number) => `${count}`,
  linesPerHanziOptionWholePage: '整页',
  exampleLinesLabel: () => '示范行',
  exampleCellsLabel: () => '示范格数',
  useStrokeOrderLabel: '示范行显示笔顺',
  maxExamplesLabel: '最大示例数量',
  settingsToggleLabel: '切换设置',
  generateCopybookButton: '生成字帖',
  backButton: '返回',
  gridTian: '田字格',
  gridMi: '米字格',
  copyLink: '复制链接',
  downloadPdf: '下载 PDF',
  generatingPdf: '正在生成 PDF...',
  linkCopied: '链接已复制',
  metaLine: ({
    cellSizeMm,
    exampleLines,
    exampleCells,
    gridLabel,
  }: {
    cellSizeMm: number
    exampleLines: number
    exampleCells: number
    gridLabel: string
  }) =>
    `${cellSizeMm}毫米 · ${exampleLines} ${zh.exampleLinesLabel()} · ${exampleCells} ${zh.exampleCellsLabel()} · ${gridLabel}`,
}

export default zh
