import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Language = 'ru' | 'uz'

type LanguageContextValue = {
  language: Language
  locale: 'ru-RU' | 'uz-UZ'
  setLanguage: (language: Language) => void
  tr: (ru: string, uz: string) => string
}

const STORAGE_KEY = 'argo:language'
const LanguageContext = createContext<LanguageContextValue | null>(null)

// Ключ языка читается ровно здесь: тем же чтением пользуется корневая граница ошибок,
// которая стоит выше провайдера и до контекста дотянуться не может. localStorage умеет
// бросать (приватный режим), а фолбэк границы падать не имеет права — отсюда catch.
export function readStoredLanguage(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'uz' ? 'uz' : 'ru'
  } catch {
    return 'ru'
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(readStoredLanguage)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language === 'uz' ? 'uz' : 'ru'
    document.title = language === 'uz' ? 'ARGO · Uskunalar hisobi' : 'ARGO · Учёт оборудования'
  }, [language])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: language === 'uz' ? 'uz-UZ' : 'ru-RU',
    setLanguage,
    tr: (ru, uz) => language === 'uz' ? uz : ru,
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()

  return (
    <div className={`language-switch ${compact ? 'language-switch--compact' : ''}`} role="group" aria-label={language === 'uz' ? 'Interfeys tili' : 'Язык интерфейса'}>
      <button className={language === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')} type="button" aria-pressed={language === 'ru'}>RU</button>
      <button className={language === 'uz' ? 'active' : ''} onClick={() => setLanguage('uz')} type="button" aria-pressed={language === 'uz'}>UZ</button>
    </div>
  )
}
