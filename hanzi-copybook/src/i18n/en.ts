const en = {
  appTitle: 'Hanzi Copybook',
  hanziListLabel: 'Hanzi list',
  hanziListPlaceholder: 'Example: 我,你,他 or 我你他',
  cellSizeLabel: 'Cell size (mm)',
  exampleLinesLabel: (count: number) =>
    count === 1 ? 'example line' : 'example lines',
  exampleCellsLabel: (count: number) =>
    count === 1 ? 'example cell' : 'example cells',
  useStrokeOrderLabel: 'Use stroke order in example lines',
  maxExamplesLabel: 'Max number of examples',
  settingsToggleLabel: 'Toggle settings',
  generateCopybookButton: 'Generate copybook',
  backButton: 'Back',
  gridTian: 'Tian zi ge',
  gridMi: 'Mi zi ge',
  copyLink: 'Copy link',
  downloadPdf: 'Download PDF',
  generatingPdf: 'Generating PDF...',
  linkCopied: 'Link copied',
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
    `${cellSizeMm}mm · ${exampleLines} ${en.exampleLinesLabel(
      exampleLines,
    )} · ${exampleCells} ${en.exampleCellsLabel(exampleCells)} · ${gridLabel}`,
}

export default en
