const ru = {
  appTitle: 'Hanzi Copybook',
  hanziListLabel: 'Список иероглифов',
  hanziListPlaceholder: 'Пример: 我,你,他 или 我你他',
  cellSizeLabel: 'Размер ячейки (мм)',
  exampleLinesLabel: (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) return 'кол-во строк примеров'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100))
      return 'кол-во строк примеров'
    return 'кол-во строк примеров'
  },
  useStrokeOrderLabel: 'Использовать порядок черт в примерах',
  maxExamplesLabel: 'Макс. число примеров',
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
    gridLabel,
  }: {
    cellSizeMm: number
    exampleLines: number
    gridLabel: string
  }) =>
    `${cellSizeMm}мм · ${exampleLines} ${ru.exampleLinesLabel(
      exampleLines,
    )} · ${gridLabel}`,
}

export default ru
