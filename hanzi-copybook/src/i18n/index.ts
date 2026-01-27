import en from './en'
import ru from './ru'
import zh from './zh'

export type Locale = 'en' | 'ru' | 'zh'
export type Translations = typeof en

const translations: Record<Locale, Translations> = {
  en,
  ru,
  zh,
}

const normalizeLanguage = (language?: string) => {
  if (!language) return 'en'
  return language.toLowerCase()
}

export const resolveLocale = (language?: string): Locale => {
  const normalized = normalizeLanguage(language)
  if (normalized.startsWith('ru')) return 'ru'
  if (normalized.startsWith('zh')) return 'zh'
  return 'en'
}

export const getTranslations = (language?: string): Translations => {
  const locale = resolveLocale(language)
  return translations[locale] ?? en
}

export const getBrowserTranslations = (): Translations => {
  if (typeof navigator === 'undefined') return en
  return getTranslations(navigator.language)
}
