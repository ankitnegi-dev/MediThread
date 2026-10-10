import { describe, it, expect } from 'vitest'
import { parseDate, parseLabs, parseMedicines, detectType, detectProvider, parseDocument, validateFile } from './extract.js'

describe('parseDate', () => {
  it('reads ISO dates', () => {
    expect(parseDate('Report date 2026-09-28')).toBe('2026-09-28')
  })
  it('reads dd/mm/yyyy', () => {
    expect(parseDate('Dated 14/03/2026')).toBe('2026-03-14')
  })
  it('reads 14-Mar-2026', () => {
    expect(parseDate('14-Mar-2026 Dr Iyer')).toBe('2026-03-14')
  })
  it('reads 28 September 2026', () => {
    expect(parseDate('28 September 2026')).toBe('2026-09-28')
  })
  it('returns null when there is no date', () => {
    expect(parseDate('no dates here at all')).toBeNull()
  })
  it('rejects impossible calendar dates', () => {
    expect(parseDate('2026-13-45')).toBeNull()
  })
})

describe('parseLabs', () => {
  const lab = `
    TEST NAME            RESULT    UNIT      REFERENCE
    Haemoglobin (Hb)     11.2      g/dL      12.0 - 15.0
    Fasting Glucose      168       mg/dL     70 - 100
    HbA1c                8.1       %         < 7.0
    Creatinine           0.9       mg/dL     0.6 - 1.1
    LDL Cholesterol      142       mg/dL     < 100
  `

  it('picks up every named test with its value', () => {
    const l = parseLabs(lab)
    expect(l.Hb).toBe('11.2 g/dL')
    expect(l.FastingGlucose).toBe('168 mg/dL')
    expect(l.HbA1c).toBe('8.1 %')
    expect(l.Creatinine).toBe('0.9 mg/dL')
    expect(l.LDL).toBe('142 mg/dL')
  })

  it('handles a "<" prefix on the reference side', () => {
    expect(parseLabs('TSH 3.1 mIU/L ref 0.4 - 4.0').TSH).toBe('3.1 mIU/L')
  })

  it('does not invent values for absent tests', () => {
    expect(parseLabs(lab).VitaminD).toBeUndefined()
  })

  it('survives empty input', () => {
    expect(parseLabs('')).toEqual({})
  })
})

describe('parseMedicines', () => {
  const rx = `
    Tab. Metformin 500mg  BD after food
    Tab. Telmisartan 40mg  OD morning
    Tab. Ibuprofen 400mg  SOS for pain
  `

  it('finds the drug, dose and frequency', () => {
    const m = parseMedicines(rx)
    const met = m.find((x) => x.name === 'Metformin')
    expect(met).toMatchObject({ name: 'Metformin', dose: '500mg', freq: 'Twice daily' })
    const tel = m.find((x) => x.name === 'Telmisartan')
    expect(tel).toMatchObject({ dose: '40mg', freq: 'Once daily' })
    const ibu = m.find((x) => x.name === 'Ibuprofen')
    expect(ibu.freq).toBe('As needed')
  })

  it('does not repeat a drug mentioned twice', () => {
    expect(parseMedicines('Metformin 500mg\nMetformin again 500mg').filter((m) => m.name === 'Metformin')).toHaveLength(1)
  })

  it('leaves dose as a dash when the line has none', () => {
    expect(parseMedicines('Paracetamol')[0].dose).toBe('—')
  })
})

describe('detectType', () => {
  it('detects a lab report by its reference-range column', () => {
    expect(detectType('Test name Result Reference range ... HbA1c')).toBe('lab')
  })
  it('detects a prescription from Rx + mg', () => {
    expect(detectType('Rx\nTab. Metformin 500mg BD')).toBe('prescription')
  })
  it('detects a discharge summary', () => {
    expect(detectType('Discharge summary, patient stable')).toBe('discharge')
  })
  it('detects a scan report', () => {
    expect(detectType('USG Abdomen report, radiologist')).toBe('scan')
  })
  it('falls back to a note', () => {
    expect(detectType('remember to bring the reports')).toBe('note')
  })
})

describe('detectProvider', () => {
  it('picks the line that names an institution', () => {
    expect(detectProvider('PATIENT REPORT\nApollo Labs, Bengaluru\nHbA1c 6.8')).toBe('Apollo Labs, Bengaluru')
  })
  it('returns empty when nothing looks like a provider', () => {
    expect(detectProvider('just some words here')).toBe('')
  })
})

describe('parseDocument', () => {
  const full = `
    CityCare Diagnostics, Chennai
    Report date 28/09/2026
    HbA1c   6.8   %
    Creatinine 1.0 mg/dL
  `

  it('assembles a reviewable draft', () => {
    const d = parseDocument(full, 'lab-hba1c.pdf')
    expect(d.ok).toBe(true)
    expect(d.type).toBe('lab')
    expect(d.date).toBe('2026-09-28')
    expect(d.provider).toBe('CityCare Diagnostics, Chennai')
    expect(d.labs.HbA1c).toBe('6.8 %')
  })

  it('never invents a date — defaults to today instead', () => {
    const d = parseDocument('HbA1c 6.8 %', 'x.pdf')
    expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('reports failure when nothing was recognised', () => {
    const d = parseDocument('zzz qqq xxx', 'photo.jpg')
    expect(d.ok).toBe(false)
    expect(d.found).toBe(0)
  })
})

describe('validateFile', () => {
  const f = (name, type, size) => ({ name, type, size })

  it('accepts PDF, JPG, PNG and WEBP', () => {
    for (const [n, t] of [['a.pdf', 'application/pdf'], ['a.jpg', 'image/jpeg'], ['a.png', 'image/png'], ['a.webp', 'image/webp']]) {
      expect(validateFile(f(n, t, 1000)).ok).toBe(true)
    }
  })

  it('rejects an unsupported type with a clear message', () => {
    const r = validateFile(f('notes.docx', 'application/msword', 1000))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/PDF, JPG, PNG or WEBP/)
  })

  it('rejects over 10 MB with the size in the message', () => {
    const r = validateFile(f('big.pdf', 'application/pdf', 12 * 1024 * 1024))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/12\.0 MB/)
    expect(r.error).toMatch(/10 MB/)
  })

  it('rejects an empty file', () => {
    expect(validateFile(f('a.pdf', 'application/pdf', 0)).ok).toBe(false)
  })

  it('rejects nothing at all', () => {
    expect(validateFile(null).ok).toBe(false)
  })
})