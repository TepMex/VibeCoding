export type DayCount = [date: string, count: number]

export interface DeckSummary {
  id: number
  name: string
  cardCount: number
}

export interface CollectionMetadata {
  schemaVersion: number | null
  cardCount: number
  decks: DeckSummary[]
}

export interface LeechCard {
  id: number
  deckName: string
  fields: Record<string, string>
  reviewCount: number
}

export type IPlusOneSource = 'HSK 2.0' | 'HSK 3.0' | 'SUBTLEX-CH'

export interface IPlusOneWord {
  word: string
  sources: IPlusOneSource[]
}

export interface DashboardData {
  totalCards: number
  memorized: number
  reviewScore: number
  totalHours: number
  longMemory: number
  debt: number
  wordsLearned: DayCount[]
  mistakes: DayCount[]
  reviews: DayCount[]
  debtHistory: DayCount[]
  newVocabulary: DayCount[]
  reviewHeatmap: DayCount[]
  mistakeHeatmap: DayCount[]
  leeches: LeechCard[]
  fieldOptions: Record<string, string[]>
  wellKnownHanzi: string[]
  iPlusOneWords: IPlusOneWord[]
}

export interface SyncStatus {
  hasCollection: boolean
  connected: boolean
  username: string
  endpoint: string
  syncedAt: number | null
  collectionUri?: string
}

export interface SyncProgress {
  phase: 'login' | 'meta' | 'download' | 'saving'
  received?: number
  total?: number
}
