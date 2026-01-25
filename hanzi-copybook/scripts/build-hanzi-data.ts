import { createReadStream } from 'node:fs'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import path from 'node:path'

type MakeMeAHanziEntry = {
  character?: string
  strokes?: string[]
}

const sourcePath = process.argv[2] ?? 'data/make-me-a-hanzi/graphics.txt'
const outputDir = process.argv[3] ?? 'public/hanzi-data'

const toCodepointFilename = (character: string) => {
  const codepoint = character.codePointAt(0)
  if (codepoint === undefined) return null
  return `u${codepoint.toString(16).toUpperCase()}.json`
}

const run = async () => {
  await access(sourcePath)
  await mkdir(outputDir, { recursive: true })
  const input = createReadStream(sourcePath, { encoding: 'utf8' })
  const reader = createInterface({ input, crlfDelay: Infinity })
  let total = 0
  let written = 0
  let skipped = 0

  for await (const line of reader) {
    const trimmed = line.trim()
    if (!trimmed) continue
    total += 1
    try {
      const parsed = JSON.parse(trimmed) as MakeMeAHanziEntry
      if (!parsed.character || !Array.isArray(parsed.strokes)) {
        skipped += 1
        continue
      }
      const filename = toCodepointFilename(parsed.character)
      if (!filename) {
        skipped += 1
        continue
      }
      const payload = JSON.stringify({
        character: parsed.character,
        strokes: parsed.strokes,
      })
      await writeFile(path.join(outputDir, filename), payload)
      written += 1
    } catch {
      skipped += 1
    }
  }

  console.log(
    `Processed ${total} lines. Wrote ${written} files. Skipped ${skipped} lines.`,
  )
}

run().catch((error) => {
  console.error('Failed to build hanzi data:', error)
  process.exitCode = 1
})
