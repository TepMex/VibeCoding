export type HanziStrokeData = {
  character: string
  strokes: string[]
}

const strokeCache = new Map<string, Promise<HanziStrokeData | null>>()

const buildDataUrl = (character: string) => {
  const codepoint = character.codePointAt(0)
  if (codepoint === undefined) return null
  const hex = codepoint.toString(16).toUpperCase()
  return `${import.meta.env.BASE_URL}hanzi-data/u${hex}.json`
}

export const loadHanziStrokeData = (character: string) => {
  const url = buildDataUrl(character)
  if (!url) return Promise.resolve(null)

  const existing = strokeCache.get(url)
  if (existing) return existing

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) return null
      return response.json() as Promise<HanziStrokeData>
    })
    .catch(() => null)

  strokeCache.set(url, request)
  return request
}
