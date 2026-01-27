const en = {
  appTitle: 'Hanzi Copybook',
  hanziListLabel: 'Hanzi list',
  hanziListPlaceholder: 'Example: 我,你,他 or 我你他',
  cellSizeLabel: 'Cell size (mm)',
  exampleLinesLabel: (count: number) =>
    count === 1 ? 'example line' : 'example lines',
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
    gridLabel,
  }: {
    cellSizeMm: number
    exampleLines: number
    gridLabel: string
  }) =>
    `${cellSizeMm}mm · ${exampleLines} ${en.exampleLinesLabel(
      exampleLines,
    )} · ${gridLabel}`,
}

export default en
