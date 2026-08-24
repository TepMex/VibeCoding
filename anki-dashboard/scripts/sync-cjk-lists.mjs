import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const REVISION = 'cd65957a64439458c7191f6f10933eec0f6c1354'
const BASE_URL = `https://raw.githubusercontent.com/TepMex/cjk-lists/${REVISION}/data/zh`
const OUTPUT_DIRECTORY = fileURLToPath(
  new URL('../src/data/cjk-lists/', import.meta.url),
)

const hskLists = [
  ...Array.from({ length: 6 }, (_, index) => ({
    source: `HSK ${index + 1} (2.0)`,
    path: `hsk2/words/${index + 1}.json`,
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    source: `HSK ${index + 1} (3.0)`,
    path: `hsk3/words/${index + 1}.json`,
  })),
  {
    source: 'HSK 7–9 (3.0)',
    path: 'hsk3/words/7-9.json',
  },
]
const SUBTLEX_PATH = 'subtlex-ch/words/top-10000.json'
const SUBTLEX_BAND_SIZE = 1_000

function normalizeEntry(entry) {
  return entry
    .split('|')
    .map((surface) =>
      surface
        .replaceAll(/（[^）]*）/gu, '')
        .replaceAll(/[0-9]+$/gu, '')
        .trim(),
    )
    .filter((surface) => /^\p{Script=Han}+$/u.test(surface))
}

async function download(path) {
  const response = await fetch(`${BASE_URL}/${path}`)
  if (!response.ok) {
    throw new Error(`Could not download ${path}: HTTP ${response.status}`)
  }
  const value = await response.json()
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`Unexpected data in ${path}`)
  }
  return value
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true })

const lists = []
for (const list of hskLists) {
  const entries = await download(list.path)
  const words = [...new Set(entries.flatMap(normalizeEntry))]
  lists.push({ source: list.source, words })
}

const subtlexEntries = await download(SUBTLEX_PATH)
for (let start = 0; start < subtlexEntries.length; start += SUBTLEX_BAND_SIZE) {
  const end = Math.min(start + SUBTLEX_BAND_SIZE, subtlexEntries.length)
  const words = [
    ...new Set(subtlexEntries.slice(start, end).flatMap(normalizeEntry)),
  ]
  lists.push({
    source: `SUBTLEX-CH ${start + 1}–${end}`,
    words,
  })
}

await writeFile(
  `${OUTPUT_DIRECTORY}i-plus-one-lists.json`,
  `${JSON.stringify(lists, null, 2)}\n`,
)
for (const list of lists) {
  console.log(`${list.source}: ${list.words.length} words`)
}

await writeFile(
  `${OUTPUT_DIRECTORY}metadata.json`,
  `${JSON.stringify(
    {
      repository: 'https://github.com/TepMex/cjk-lists',
      revision: REVISION,
      subtlexCitation:
        'Cai, Q., & Brysbaert, M. (2010). SUBTLEX-CH. PLOS ONE, 5(6), e10729.',
    },
    null,
    2,
  )}\n`,
)
