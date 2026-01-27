const ru = {
  appTitle: 'Hanzi Copybook',
  hanziListLabel: 'Список иероглифов',
  hanziListPlaceholder: 'Пример: 我,你,他 или 我你他',
  cellSizeLabel: 'Размер ячейки (мм)',
  linesPerHanziLabel: 'Строк на иероглиф',
  linesPerHanziOption: (count: number) => `${count}`,
  linesPerHanziOptionWholePage: 'Вся страница',
  exampleLinesLabel: (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) return 'кол-во строк примеров'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100))
      return 'кол-во строк примеров'
    return 'кол-во строк примеров'
  },
  exampleCellsLabel: (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) return 'кол-во ячеек примеров'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100))
      return 'кол-во ячеек примеров'
    return 'кол-во ячеек примеров'
  },
  useStrokeOrderLabel: 'Использовать порядок черт в примерах',
  maxExamplesLabel: 'Макс. число примеров',
  settingsToggleLabel: 'Переключить настройки',
  generateCopybookButton: 'Создать прописи',
  backButton: 'Назад',
  gridTian: 'Тянь-цзы-гэ',
  gridMi: 'Ми-цзы-гэ',
  copyLink: 'Скопировать ссылку',
  downloadPdf: 'Скачать PDF',
  generatingPdf: 'Генерация PDF...',
  linkCopied: 'Ссылка скопирована',
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
    `${cellSizeMm}мм · ${exampleLines} ${ru.exampleLinesLabel(
      exampleLines,
    )} · ${exampleCells} ${ru.exampleCellsLabel(exampleCells)} · ${gridLabel}`,
}

export default ru
