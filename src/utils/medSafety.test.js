import { describe, it, expect } from 'vitest'
import { checkInteractions, checkExistingCombo, findRecentSameTest } from './medSafety.js'

const meds = (...names) => names.map((name) => ({ name, dose: '500mg', freq: 'BD' }))

describe('checkInteractions', () => {
  it('flags the original NSAID + ARB pair', () => {
    const hits = checkInteractions(meds('Telmisartan'), 'Ibuprofen')
    expect(hits).toHaveLength(1)
    expect(hits[0].level).toBe('high')
  })

  it('does not fire when only one half of the pair is present', () => {
    expect(checkInteractions(meds('Metformin'), 'Ibuprofen')).toHaveLength(0)
  })

  it('stays quiet for a safe medicine', () => {
    expect(checkInteractions(meds('Telmisartan'), 'Paracetamol')).toHaveLength(0)
  })

  it('returns nothing for an empty name', () => {
    expect(checkInteractions(meds('Telmisartan'), '')).toHaveLength(0)
  })

  it('matches metformin + iodinated contrast written three different ways', () => {
    for (const name of ['contrast', 'Iodinated contrast', 'Contrast media', 'Iodinated contrast dye']) {
      const hits = checkInteractions(meds('Metformin'), name)
      expect(hits.length, name).toBeGreaterThan(0)
    }
  })

  it('matches calcium carbonate against the levothyroxine timing rule', () => {
    const hits = checkInteractions(meds('Levothyroxine'), 'Calcium carbonate')
    expect(hits.some((h) => /levothyroxine/i.test(h.msg))).toBe(true)
  })

  it('flags ACE inhibitor/ARB + potassium-sparing diuretic', () => {
    const hits = checkInteractions(meds('Telmisartan'), 'Spironolactone')
    expect(hits.some((h) => /potassium/i.test(h.msg))).toBe(true)
  })

  it('fires when the new drug is listed first and the other is already on file', () => {
    const hits = checkInteractions(meds('Ibuprofen'), 'Telmisartan')
    expect(hits).toHaveLength(1)
  })

  it('is case insensitive', () => {
    expect(checkInteractions(meds('TELMISARTAN'), 'ibuprofen')).toHaveLength(1)
  })
})

describe('checkExistingCombo', () => {
  it('finds a conflict already on the current list', () => {
    expect(checkExistingCombo(meds('Telmisartan', 'Ibuprofen')).length).toBeGreaterThan(0)
  })

  it('reports nothing for a clean list', () => {
    expect(checkExistingCombo(meds('Metformin', 'Telmisartan', 'Atorvastatin'))).toHaveLength(0)
  })

  it('sees through a synonym', () => {
    expect(checkExistingCombo(meds('Levothyroxine', 'Calcium carbonate')).length).toBeGreaterThan(0)
  })
})

describe('findRecentSameTest', () => {
  const records = [
    { id: '1', type: 'lab', date: '2026-09-28', labs: { HbA1c: 6.8 } },
    { id: '2', type: 'lab', date: '2025-05-18', labs: { HbA1c: 7.0 } },
    { id: '3', type: 'lab', date: '2023-04-12', labs: { HbA1c: 8.1 } },
    { id: '4', type: 'lab', date: '2026-09-28', labs: { 'HbA1c %': '7.2 %' } }
  ]

  it('finds a result inside the window', () => {
    const res = findRecentSameTest(records, 'HbA1c', '2026-10-01')
    expect(res.windowDays).toBe(90)
    expect(res.candidates.length).toBeGreaterThan(0)
  })

  it('ignores results older than the window', () => {
    const res = findRecentSameTest(records, 'HbA1c', '2024-01-01')
    expect(res.candidates).toHaveLength(0)
  })

  it('ignores results dated after the reference date', () => {
    const res = findRecentSameTest([{ id: '9', type: 'lab', date: '2027-01-01', labs: { HbA1c: 6 } }], 'HbA1c', '2026-01-01')
    expect(res.candidates).toHaveLength(0)
  })

  it('handles a value stored with its unit', () => {
    const res = findRecentSameTest(records, 'HbA1c %', '2026-10-01')
    expect(res.candidates).toHaveLength(1)
    expect(res.candidates[0].record.labs['HbA1c %']).toBe('7.2 %')
  })

  it('ignores non-lab records even if they carry labs', () => {
    const res = findRecentSameTest([{ id: 'x', type: 'note', date: '2026-09-29', labs: { HbA1c: 9 } }], 'HbA1c', '2026-09-30')
    expect(res.candidates).toHaveLength(0)
  })

  it('falls back to a default window for an unknown test', () => {
    expect(findRecentSameTest(records, 'VitaminD', '2026-10-01').windowDays).toBe(45)
  })
})