import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const REVISION = 'cd65957a64439458c7191f6f10933eec0f6c1354'
const BASE_URL = `https://raw.githubusercontent.com/TepMex/cjk-lists/${REVISION}/data/zh`
const OUTPUT_DIRECTORY = fileURLToPath(
  new URL('../src/data/cjk-lists/', import.meta.url),
)

const lists = [
  {
    output: 'hsk2-words.json',
    path: 'hsk2/words/all.json',
  },
  {
    output: 'hsk3-words.json',
    path: 'hsk3/words/all.json',
  },
  {
    output: 'subtlex-ch-words.json',
    path: 'subtlex-ch/words/top-10000.json',
  },
]

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

for (const list of lists) {
  const entries = await download(list.path)
  const words = [...new Set(entries.flatMap(normalizeEntry))]
  await writeFile(
    `${OUTPUT_DIRECTORY}${list.output}`,
    `${JSON.stringify(words, null, 2)}\n`,
  )
  console.log(`${list.output}: ${words.length} words`)
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
