import { tr } from './tr'
import { en } from './en'

export type Language = 'tr' | 'en'

const translations: Record<Language, Record<string, string>> = { tr, en }

let currentLanguage: Language = 'tr'
const listeners: Set<() => void> = new Set()

export function setLanguage(lang: Language): void {
  if (lang !== currentLanguage) {
    currentLanguage = lang
    listeners.forEach((fn) => fn())
  }
}

export function getLanguage(): Language {
  return currentLanguage
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Translate a key, optionally replacing {param} placeholders. */
export function t(key: string, params?: Record<string, string | number>): string {
  let text = translations[currentLanguage][key] || translations.tr[key] || key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}
