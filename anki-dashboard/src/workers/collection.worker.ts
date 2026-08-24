/// <reference lib="webworker" />

import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import iPlusOneLists from '../data/cjk-lists/i-plus-one-lists.json'
import type {
  CollectionMetadata,
  DashboardData,
  DayCount,
  DeckSummary,
  IPlusOneSource,
  IPlusOneWord,
  LeechCard,
} from '../types'

let db: Database | null = null
let decks = new Map<number, string>()
let fieldsByModel = new Map<number, string[]>()
let collectionCreated = 0
let revlogHasType = false

const DAY_MS = 86_400_000
const FIELD_SEPARATOR = '\u001f'
const I_PLUS_ONE_LISTS: ReadonlyArray<{
  source: IPlusOneSource
  words: readonly string[]
}> = iPlusOneLists.map(({ source, words }) => ({
  source: source as IPlusOneSource,
  words,
}))

function extractHanziWords(value: unknown) {
  return String(value ?? '').match(/\p{Script=Han}+/gu) ?? []
}

function buildIPlusOneWords(
  wellKnownHanzi: Set<string>,
  collectionWords: Set<string>,
): IPlusOneWord[] {
  const candidates = new Map<string, IPlusOneWord>()

  for (const { source, words } of I_PLUS_ONE_LISTS) {
    for (const word of words) {
      if (
        collectionWords.has(word) ||
        ![...word].every((character) => wellKnownHanzi.has(character))
      ) {
        continue
      }

      const existing = candidates.get(word)
      if (existing) {
        existing.sources.push(source)
      } else {
        candidates.set(word, { word, sources: [source] })
      }
    }
  }

  return [...candidates.values()]
}

function rows(sql: string): SqlValue[][] {
  if (!db) throw new Error('Collection is not loaded')
  const result = db.exec(sql)
  return result[0]?.values ?? []
}

function scalar(sql: string): number {
  return Number(rows(sql)[0]?.[0] ?? 0)
}

function tableExists(name: string) {
  return scalar(
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${name}'`,
  ) > 0
}

function columnExists(table: string, column: string) {
  return rows(`PRAGMA table_info(${table})`).some((row) => row[1] === column)
}

function humanizeDeckName(value: unknown) {
  return String(value ?? '').replaceAll(FIELD_SEPARATOR, '::')
}

function loadDecks() {
  decks = new Map()
  if (tableExists('decks')) {
    for (const [id, name] of rows('SELECT id, name COLLATE BINARY FROM decks')) {
      decks.set(Number(id), humanizeDeckName(name))
    }
  }
  if (decks.size) return

  const raw = String(rows('SELECT decks FROM col WHERE id = 1')[0]?.[0] ?? '{}')
  const legacy = JSON.parse(raw) as Record<string, { name?: string }>
  for (const [id, deck] of Object.entries(legacy)) {
    decks.set(Number(id), humanizeDeckName(deck.name))
  }
}

function loadFields() {
  fieldsByModel = new Map()
  if (tableExists('fields')) {
    for (const [modelId, ordinal, name] of rows(
      'SELECT ntid, ord, name COLLATE BINARY FROM fields ORDER BY ntid, ord',
    )) {
      const id = Number(modelId)
      const names = fieldsByModel.get(id) ?? []
      names[Number(ordinal)] = String(name)
      fieldsByModel.set(id, names)
    }
  }
  if (fieldsByModel.size) return

  const raw = String(rows('SELECT models FROM col WHERE id = 1')[0]?.[0] ?? '{}')
  const models = JSON.parse(raw) as Record<
    string,
    { flds?: Array<{ name?: string }> }
  >
  for (const [id, model] of Object.entries(models)) {
    fieldsByModel.set(
      Number(id),
      (model.flds ?? []).map((field) => field.name ?? '').filter(Boolean),
    )
  }
}

function deckSummaries(): DeckSummary[] {
  return [...decks.entries()]
    .map(([id, name]) => ({
      id,
      name,
      cardCount: scalar(`SELECT COUNT(*) FROM cards WHERE did = ${id}`),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function loadCollection(buffer: ArrayBuffer): Promise<CollectionMetadata> {
  const bytes = new Uint8Array(buffer)
  const signature = new TextDecoder('ascii').decode(bytes.slice(0, 16))
  if (!signature.startsWith('SQLite format 3')) {
    throw new Error('The selected file is not a valid collection.anki2 database')
  }
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  db?.close()
  db = new SQL.Database(bytes)

  if (!tableExists('col') || !tableExists('cards') || !tableExists('revlog')) {
    throw new Error('The database does not contain a supported Anki collection')
  }
  loadDecks()
  loadFields()
  collectionCreated = scalar('SELECT crt FROM col WHERE id = 1')
  revlogHasType = columnExists('revlog', 'type')

  return {
    schemaVersion: scalar('SELECT ver FROM col WHERE id = 1') || null,
    cardCount: scalar('SELECT COUNT(*) FROM cards'),
    decks: deckSummaries(),
  }
}

function resolveDeckIds(selected: string[]) {
  const ids = new Set<number>()
  for (const [id, name] of decks) {
    if (
      selected.some(
        (candidate) =>
          name.localeCompare(candidate, undefined, { sensitivity: 'accent' }) === 0 ||
          name.toLocaleLowerCase().startsWith(`${candidate.toLocaleLowerCase()}::`),
      )
    ) {
      ids.add(id)
    }
  }
  return [...ids]
}

function dayKey(milliseconds: number) {
  return new Date(milliseconds).toISOString().slice(0, 10)
}

function dayNumber(milliseconds: number) {
  return Math.floor(
    Date.UTC(
      new Date(milliseconds).getUTCFullYear(),
      new Date(milliseconds).getUTCMonth(),
      new Date(milliseconds).getUTCDate(),
    ) / DAY_MS,
  )
}

function dateRange(days: number) {
  const today = dayNumber(Date.now())
  return Array.from({ length: days + 1 }, (_, index) =>
    dayKey((today - days + index) * DAY_MS),
  )
}

function selectedDeckFor(actual: string, selected: string[]) {
  return (
    selected.find((name) => actual === name) ??
    selected.find((name) => actual.startsWith(`${name}::`)) ??
    actual
  )
}

interface Review {
  id: number
  ease: number
  time: number
  interval: number
  type: number
}

function buildDebtHistory(
  reviewsByCard: Map<number, Review[]>,
  days: string[],
): DayCount[] {
  if (!collectionCreated || !days.length) return []
  const startDay = dayNumber(Date.parse(days[0]))
  const endDay = dayNumber(Date.parse(days.at(-1)!))
  const diff = new Int32Array(days.length + 1)
  const now = Date.now()

  const dueAfter = (review: Review) => {
    if (review.type === 1) {
      const collectionDay = Math.floor(
        (review.id / 1000 - collectionCreated) / 86_400,
      )
      return (collectionCreated + (collectionDay + review.interval) * 86_400) * 1000
    }
    if (review.type === 0 || review.type === 2) {
      return review.id + Math.max(1, review.interval) * 60_000
    }
    return review.id + Math.max(0, review.interval) * DAY_MS
  }

  for (const cardReviews of reviewsByCard.values()) {
    for (let index = 0; index < cardReviews.length; index += 1) {
      const review = cardReviews[index]
      if (review.type === 3) continue
      const due = dueAfter(review)
      const next = cardReviews[index + 1]?.id ?? now
      if (due >= next) continue
      const from = Math.max(startDay, dayNumber(due))
      const through = Math.min(endDay, dayNumber(next))
      if (from > through) continue
      diff[from - startDay] += 1
      diff[through - startDay + 1] -= 1
    }
  }

  let current = 0
  return days.map((day, index) => {
    current += diff[index]
    return [day, current]
  })
}

function emptyDashboard(): DashboardData {
  return {
    totalCards: 0,
    memorized: 0,
    reviewScore: 0,
    totalHours: 0,
    longMemory: 0,
    debt: 0,
    wordsLearned: [],
    mistakes: [],
    reviews: [],
    debtHistory: [],
    newVocabulary: [],
    reviewHeatmap: [],
    mistakeHeatmap: [],
    leeches: [],
    fieldOptions: {},
    wellKnownHanzi: [],
    iPlusOneWords: [],
  }
}

function analyze(
  selectedDecks: string[],
  iPlusOneFields: Record<string, string> = {},
): DashboardData {
  if (!db) throw new Error('Collection is not loaded')
  const deckIds = resolveDeckIds(selectedDecks)
  if (!deckIds.length) return emptyDashboard()
  const idList = deckIds.join(',')

  const cardRows = rows(
    `SELECT id, did, ivl, queue, due, nid FROM cards WHERE did IN (${idList})`,
  )
  const totalCards = cardRows.length
  const cardIds = new Set(cardRows.map((row) => Number(row[0])))
  const memorized = cardRows.filter((row) => Number(row[2]) >= 7).length

  const nowSeconds = Math.floor(Date.now() / 1000)
  const today = Math.floor((nowSeconds - collectionCreated) / 86_400)
  const debt = cardRows.filter((row) => {
    const queue = Number(row[3])
    const due = Number(row[4])
    return queue === 2
      ? due <= today
      : (queue === 1 || queue === 3) && (due <= today || due <= nowSeconds)
  }).length

  const typeExpression = revlogHasType ? 'r.type' : '-1'
  const reviewRows = rows(`
    SELECT r.cid, r.id, r.ease, r.time, r.ivl, ${typeExpression}
    FROM revlog r
    JOIN cards c ON c.id = r.cid
    WHERE c.did IN (${idList})
    ORDER BY r.cid, r.id
  `)

  const reviewsByCard = new Map<number, Review[]>()
  const reviewDays = new Map<string, number>()
  const mistakeDays = new Map<string, number>()
  const firstReviewDays = new Map<string, number>()
  let recentReviewCount = 0
  let recentReviewSeconds = 0
  let totalReviewMilliseconds = 0
  const recentCutoff = Date.now() - 7 * DAY_MS

  for (const [cardIdValue, idValue, easeValue, timeValue, intervalValue, typeValue] of reviewRows) {
    const cardId = Number(cardIdValue)
    if (!cardIds.has(cardId)) continue
    const ease = Number(easeValue)
    const interval = Number(intervalValue)
    const inferredType = ease === 1 ? 2 : interval >= 1 && ease >= 2 ? 1 : 0
    const review: Review = {
      id: Number(idValue),
      ease,
      time: Number(timeValue),
      interval,
      type: Number(typeValue) >= 0 ? Number(typeValue) : inferredType,
    }
    const cardReviews = reviewsByCard.get(cardId) ?? []
    cardReviews.push(review)
    reviewsByCard.set(cardId, cardReviews)

    const day = dayKey(review.id)
    reviewDays.set(day, (reviewDays.get(day) ?? 0) + 1)
    if (ease === 1) mistakeDays.set(day, (mistakeDays.get(day) ?? 0) + 1)
    totalReviewMilliseconds += review.time
    if (review.id >= recentCutoff) {
      recentReviewCount += 1
      recentReviewSeconds += review.time / 1000
    }
  }

  for (const cardReviews of reviewsByCard.values()) {
    const first = dayKey(cardReviews[0].id)
    firstReviewDays.set(first, (firstReviewDays.get(first) ?? 0) + 1)
  }

  const plotDays = dateRange(730)
  let learned = [...firstReviewDays]
    .filter(([day]) => day < plotDays[0])
    .reduce((sum, [, count]) => sum + count, 0)
  const wordsLearned: DayCount[] = []
  const mistakes: DayCount[] = []
  const reviews: DayCount[] = []
  for (const day of plotDays) {
    wordsLearned.push([day, learned])
    mistakes.push([day, mistakeDays.get(day) ?? 0])
    reviews.push([day, reviewDays.get(day) ?? 0])
    learned += firstReviewDays.get(day) ?? 0
  }

  const monthly = new Map<string, number>()
  for (const [day, count] of firstReviewDays) {
    const month = day.slice(0, 7)
    monthly.set(month, (monthly.get(month) ?? 0) + count)
  }
  const newVocabulary = [...monthly.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )

  const longMemory = [...reviewsByCard.values()].filter(
    (cardReviews) => (cardReviews.at(-1)?.interval ?? 0) > 360,
  ).length
  const wellKnownNoteIds = new Set(
    cardRows
      .filter(
        (row) =>
          (reviewsByCard.get(Number(row[0]))?.at(-1)?.interval ?? 0) > 360,
      )
      .map((row) => Number(row[5])),
  )
  const fieldOptions: Record<string, string[]> = Object.fromEntries(
    selectedDecks.map((name) => [name, []]),
  )
  const noteRows = rows(`
    SELECT DISTINCT n.id, c.did, n.mid, n.flds
    FROM notes n
    JOIN cards c ON c.nid = n.id
    WHERE c.did IN (${idList})
  `)
  for (const [, deckIdValue, modelIdValue] of noteRows) {
    const deckName = selectedDeckFor(
      decks.get(Number(deckIdValue)) ?? '',
      selectedDecks,
    )
    const names = fieldsByModel.get(Number(modelIdValue)) ?? []
    fieldOptions[deckName] = [
      ...new Set([...(fieldOptions[deckName] ?? []), ...names]),
    ].sort()
  }

  const collectionWords = new Set<string>()
  const wellKnownHanziSet = new Set<string>()
  for (const [noteIdValue, deckIdValue, modelIdValue, fieldValues] of noteRows) {
    const deckName = selectedDeckFor(
      decks.get(Number(deckIdValue)) ?? '',
      selectedDecks,
    )
    const names = fieldsByModel.get(Number(modelIdValue)) ?? []
    const options = fieldOptions[deckName] ?? []
    const configuredField = iPlusOneFields[deckName]
    const fieldName = options.includes(configuredField)
      ? configuredField
      : options[0]
    const fieldIndex = names.indexOf(fieldName)
    if (fieldIndex < 0) continue

    const values = String(fieldValues ?? '').split(FIELD_SEPARATOR)
    const noteWords = extractHanziWords(values[fieldIndex])
    for (const word of noteWords) collectionWords.add(word)
    if (!wellKnownNoteIds.has(Number(noteIdValue))) continue
    for (const character of noteWords.flatMap((word) => [...word])) {
      wellKnownHanziSet.add(character)
    }
  }
  const wellKnownHanzi = [...wellKnownHanziSet].sort((a, b) =>
    a.localeCompare(b, 'zh-Hans'),
  )
  const iPlusOneWords = buildIPlusOneWords(
    wellKnownHanziSet,
    collectionWords,
  )

  const leeches: LeechCard[] = []
  const leechRows = rows(`
    SELECT c.id, c.did, n.mid, n.flds
    FROM cards c
    JOIN notes n ON n.id = c.nid
    WHERE c.did IN (${idList})
      AND (' ' || trim(n.tags) || ' ') LIKE '% leech %'
  `)
  for (const [cardIdValue, deckIdValue, modelIdValue, fieldValues] of leechRows) {
    const deckName = selectedDeckFor(
      decks.get(Number(deckIdValue)) ?? '',
      selectedDecks,
    )
    const names = fieldsByModel.get(Number(modelIdValue)) ?? []
    const values = String(fieldValues ?? '').split(FIELD_SEPARATOR)
    const fields = Object.fromEntries(
      names.map((name, index) => [name, values[index] ?? '']),
    )
    const id = Number(cardIdValue)
    leeches.push({
      id,
      deckName,
      fields,
      reviewCount: reviewsByCard.get(id)?.length ?? 0,
    })
  }

  const heatmapDays = dateRange(365)
  return {
    totalCards,
    memorized,
    reviewScore: recentReviewCount
      ? recentReviewSeconds / recentReviewCount
      : 0,
    totalHours: totalReviewMilliseconds / 3_600_000,
    longMemory,
    debt,
    wordsLearned,
    mistakes,
    reviews,
    debtHistory: buildDebtHistory(reviewsByCard, dateRange(90)),
    newVocabulary,
    reviewHeatmap: heatmapDays.map((day) => [day, reviewDays.get(day) ?? 0]),
    mistakeHeatmap: heatmapDays.map((day) => [day, mistakeDays.get(day) ?? 0]),
    leeches: leeches.sort((a, b) => b.reviewCount - a.reviewCount),
    fieldOptions,
    wellKnownHanzi,
    iPlusOneWords,
  }
}

const handlers = { loadCollection, analyze }

self.onmessage = async (
  event: MessageEvent<{
    id: number
    method: keyof typeof handlers
    args: never[]
  }>,
) => {
  const { id, method, args } = event.data
  try {
    const handler = handlers[method] as (...values: never[]) => unknown
    if (!handler) throw new Error(`Unknown collection method: ${method}`)
    self.postMessage({ id, result: await handler(...args) })
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
