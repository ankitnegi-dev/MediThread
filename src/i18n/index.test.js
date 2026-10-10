import { describe, it, expect } from 'vitest'
import { translate, DICTIONARIES, LANGUAGES } from './index.jsx'

const KEYS = Object.keys(DICTIONARIES.en)

describe('dictionaries', () => {
  it('ships the four required languages', () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual(['en', 'hi', 'kn', 'ta'])
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(['en', 'hi', 'kn', 'ta'])
  })

  it.each(['hi', 'ta', 'kn'])('%s has every English key translated', (code) => {
    const missing = KEYS.filter((k) => DICTIONARIES[code][k] === undefined)
    expect(missing).toEqual([])
  })

  it.each(['hi', 'ta', 'kn'])('%s has no extra keys that English lacks', (code) => {
    const extra = Object.keys(DICTIONARIES[code]).filter((k) => DICTIONARIES.en[k] === undefined)
    expect(extra).toEqual([])
  })

  it('leaves every placeholder in place in all languages', () => {
    for (const code of ['hi', 'ta', 'kn']) {
      const broken = KEYS.filter((k) => {
        const en = DICTIONARIES.en[k].match(/\{(\w+)\}/g)?.sort().join(',') || ''
        const tr = DICTIONARIES[code][k].match(/\{(\w+)\}/g)?.sort().join(',') || ''
        return en !== tr
      })
      expect(broken).toEqual([])
    }
  })

  it('never leaves a value empty', () => {
    for (const code of ['hi', 'ta', 'kn']) {
      const empty = KEYS.filter((k) => !String(DICTIONARIES[code][k]).trim())
      expect(empty).toEqual([])
    }
  })
})

describe('translate', () => {
  it('returns the string for the active language', () => {
    expect(translate('hi', 'nav.patient')).toBe('मरीज़')
    expect(translate('ta', 'nav.patient')).toBe('நோயாளி')
    expect(translate('kn', 'nav.patient')).toBe('ರೋಗಿ')
  })

  it('substitutes variables', () => {
    expect(translate('en', 'timeline.count', { shown: 3, total: 10 })).toBe('3 of 10 records')
    expect(translate('hi', 'timeline.count', { shown: 3, total: 10 })).toBe('10 में से 3 रिकॉर्ड')
  })

  it('leaves an unknown placeholder visible rather than printing undefined', () => {
    const out = translate('hi', 'timeline.count', { shown: 3 })
    expect(out).toContain('{total}')
    expect(out).not.toContain('undefined')
  })

  it('falls back to English for a key the language is missing', () => {
    expect(translate('zz', 'nav.patient')).toBe('Patient')
  })

  it('returns the key itself when nothing matches', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist')
  })
})

describe('clinical content stays in Latin script', () => {
  it('keeps drug names untranslated in the emergency card copy', () => {
    // the dictionaries must not translate medicine names — only the labels around them
    for (const code of ['hi', 'ta', 'kn']) {
      expect(DICTIONARIES[code]['er.meds']).not.toMatch(/Metformin|Telmisartan/)
    }
  })

  it('keeps lab test names out of translated strings', () => {
    for (const code of ['hi', 'ta', 'kn']) {
      expect(DICTIONARIES[code]['meds.windows']).toContain('HbA1c')
      expect(DICTIONARIES[code]['meds.windows']).toContain('creatinine')
    }
  })
})