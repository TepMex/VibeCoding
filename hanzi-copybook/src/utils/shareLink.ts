import type { CopybookState, LinesPerHanzi } from '../types/copybook'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const toBinaryString = (value: string) =>
  String.fromCharCode(...textEncoder.encode(value))

const fromBinaryString = (value: string) =>
  textDecoder.decode(
    Uint8Array.from(value, (char) => char.charCodeAt(0)),
  )

const base64UrlEncode = (value: string) =>
  btoa(toBinaryString(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  const padded =
    padding === 0 ? normalized : normalized + '='.repeat(4 - padding)
  return fromBinaryString(atob(padded))
}

const extractHashPayload = (hash: string) => {
  const trimmed = hash.replace(/^#/, '').trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data=')) {
    return trimmed.slice('data='.length) || null
  }
  return trimmed
}

export const encodeCopybookState = (state: CopybookState) =>
  base64UrlEncode(JSON.stringify(state))

export const decodeCopybookState = (
  hash: string,
  defaults: CopybookState,
): CopybookState | null => {
  const payload = extractHashPayload(hash)
  if (!payload) return null

  try {
    const decoded = base64UrlDecode(payload)
    const parsed = JSON.parse(decoded) as Partial<CopybookState> | null

    if (!parsed || typeof parsed !== 'object') return null

    const normalizeLinesPerHanzi = (
      value?: LinesPerHanzi,
    ): LinesPerHanzi => {
      if (value === 1 || value === 2 || value === 3 || value === 'full') {
        return value
      }
      return defaults.linesPerHanzi
    }

    const normalized: CopybookState = {
      ...defaults,
      ...parsed,
      hanziList: Array.isArray(parsed.hanziList)
        ? parsed.hanziList.filter((item) => typeof item === 'string')
        : defaults.hanziList,
      cellSizeMm:
        typeof parsed.cellSizeMm === 'number'
          ? parsed.cellSizeMm
          : defaults.cellSizeMm,
      exampleLines:
        typeof parsed.exampleLines === 'number'
          ? parsed.exampleLines
          : defaults.exampleLines,
      exampleCells:
        typeof parsed.exampleCells === 'number'
          ? parsed.exampleCells
          : defaults.exampleCells,
      linesPerHanzi: normalizeLinesPerHanzi(parsed.linesPerHanzi),
      useStrokeOrder:
        typeof parsed.useStrokeOrder === 'boolean'
          ? parsed.useStrokeOrder
          : defaults.useStrokeOrder,
      maxExamples:
        typeof parsed.maxExamples === 'number'
          ? parsed.maxExamples
          : defaults.maxExamples,
      gridStyle:
        parsed.gridStyle === 'tian' || parsed.gridStyle === 'mi'
          ? parsed.gridStyle
          : defaults.gridStyle,
    }

    return normalized
  } catch {
    return null
  }
}
