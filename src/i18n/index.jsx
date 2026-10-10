import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './en.json'
import hi from './hi.json'
import ta from './ta.json'
import kn from './kn.json'

export const DICTIONARIES = { en, hi, ta, kn }

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' }
]

const STORAGE_KEY = 'medithread:lang'
const DEFAULT = 'en'

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v && DICTIONARIES[v] ? v : DEFAULT
  } catch {
    return DEFAULT
  }
}

/** Substitute {placeholders}. Missing keys fall back to English, then the key. */
export function translate(lang, key, vars) {
  const dict = DICTIONARIES[lang] || DICTIONARIES[DEFAULT]
  let out = dict[key]
  if (out === undefined) out = DICTIONARIES[DEFAULT][key]
  if (out === undefined) return key
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (m, name) => (vars[name] === undefined ? m : String(vars[name])))
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(readStored)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* private mode */ }
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** useT() -> (key, vars) => string */
export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  return ctx.t
}

/** useLang() -> { lang, setLang } */
export function useLang() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useLang must be used inside <I18nProvider>')
  return { lang: ctx.lang, setLang: ctx.setLang }
}