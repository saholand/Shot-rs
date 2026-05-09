import { useSyncExternalStore, useCallback } from 'react'
import { t, getLanguage, setLanguage, subscribe } from '../../shared/i18n'
import type { Language } from '../../shared/i18n'

export function useTranslation() {
  const language = useSyncExternalStore(
    subscribe,
    getLanguage,
    getLanguage
  )

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang)
  }, [])

  return { t, language, setLanguage: changeLanguage }
}
