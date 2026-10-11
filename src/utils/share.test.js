import { describe, it, expect } from 'vitest'
import {
  makeShareToken,
  decodeShareToken,
  validateShareToken,
  makeNoteCode,
  decodeNoteCode,
  TOKEN_VERSION
} from './share.js'

const patient = {
  id: 'p1',
  name: 'Meera Krishnan',
  age: 52,
  sex: 'Female',
  bloodGroup: 'B+',
  city: 'Bengaluru',
  conditions: ['Type 2 Diabetes'],
  allergies: ['Penicillin (rash)'],
  emergencyContact: 'Arun Krishnan',
  emergencyPin: '2481',
  currentMeds: [{ name: 'Metformin', dose: '500mg', freq: 'BD', since: '2023-04-12' }]
}

const records = [
  {
    id: 'rec-1',
    type: 'lab',
    date: '2026-09-28',
    provider: 'Apollo Labs, Bengaluru',
    title: 'HbA1c 6.8%',
    conditions: ['Type 2 Diabetes'],
    labs: { HbA1c: 6.8 },
    notes: 'Best control yet.',
    source: 'PDF report',
    // should be stripped from the token
    fileId: 'blob-xyz'
  }
]

const hoursFromNow = (h) => ({
  id: 'share-1',
  label: 'Dr. Iyer - review',
  purpose: 'review',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + h * 3600 * 1000).toISOString()
})

describe('encode / decode round trip', () => {
  it('round-trips a share token', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    const d = decodeShareToken(token)
    expect(d.ok).toBe(true)
    expect(d.payload.v).toBe(TOKEN_VERSION)
    expect(d.payload.sid).toBe('share-1')
    expect(d.payload.records).toHaveLength(1)
    expect(d.payload.records[0].title).toBe('HbA1c 6.8%')
    expect(d.payload.records[0].labs.HbA1c).toBe(6.8)
  })

  it('carries the patient summary so another device has context', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    const { payload } = decodeShareToken(token)
    expect(payload.patient.name).toBe('Meera Krishnan')
    expect(payload.patient.bloodGroup).toBe('B+')
    expect(payload.patient.allergies).toEqual(['Penicillin (rash)'])
    expect(payload.patient.currentMeds[0].name).toBe('Metformin')
  })

  it('never leaks the emergency PIN into a link', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    expect(token).not.toContain('2481')
    expect(decodeShareToken(token).payload.patient.emergencyPin).toBeUndefined()
  })

  it('strips local-only fields such as fileId', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    expect(decodeShareToken(token).payload.records[0].fileId).toBeUndefined()
  })

  it('produces a URL-safe token', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    expect(token).toMatch(/^[A-Za-z0-9+\-$._~!*'()]*$/)
  })
})

describe('validation works with no local registry (other device)', () => {
  it('opens a token that this browser has never seen', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    const v = validateShareToken(token, { shares: [] })
    expect(v.ok).toBe(true)
    expect(v.external).toBe(true)
    expect(v.records).toHaveLength(1)
    expect(v.patient.name).toBe('Meera Krishnan')
  })

  it('opens with no state argument at all', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    expect(validateShareToken(token).ok).toBe(true)
  })
})

describe('expiry', () => {
  it('rejects a token whose expiry has passed', () => {
    const share = {
      ...hoursFromNow(24),
      expiresAt: new Date(Date.now() - 1000).toISOString()
    }
    const token = makeShareToken({ share, patient, records })
    const v = validateShareToken(token, { shares: [] })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('expired')
    expect(v.message).toMatch(/expired/i)
  })

  it('still accepts a token that has not expired', () => {
    const token = makeShareToken({ share: hoursFromNow(1), patient, records })
    expect(validateShareToken(token, { shares: [] }).ok).toBe(true)
  })
})

describe('malformed input', () => {
  it.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['random text', 'this is definitely not a token'],
    ['truncated token', 'ABCDEF'],
    ['tampered payload', 'eyJ2IjoyfQ']
  ])('rejects %s with a readable message', (_label, bad) => {
    const v = validateShareToken(bad, { shares: [] })
    expect(v.ok).toBe(false)
    expect(typeof v.message).toBe('string')
    expect(v.message.length).toBeGreaterThan(10)
    expect(v.message).not.toMatch(/undefined|null|NaN/)
  })

  it('rejects null and undefined', () => {
    expect(validateShareToken(null).ok).toBe(false)
    expect(validateShareToken(undefined).ok).toBe(false)
  })

  it('detects an old v1 registry-dependent link and explains itself', () => {
    const legacy = btoa(JSON.stringify({ sid: 'share-1', exp: Date.now() + 10000, ids: ['rec-1'] }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const v = validateShareToken(legacy, { shares: [] })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('legacy')
    expect(v.message).toMatch(/older share link/i)
  })
})

describe('revocation (local only)', () => {
  it('rejects a revoked token when the issuing store is present', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    const state = { shares: [{ id: 'share-1', revoked: true, expiresAt: hoursFromNow(24).expiresAt }] }
    const v = validateShareToken(token, state)
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('revoked')
  })

  it('cannot detect revocation without the issuing store - that is the documented limit', () => {
    const token = makeShareToken({ share: hoursFromNow(24), patient, records })
    const v = validateShareToken(token, { shares: [] })
    expect(v.ok).toBe(true)
    expect(v.external).toBe(true)
  })
})

describe('note codes', () => {
  const note = {
    id: 'rec-new',
    type: 'prescription',
    date: '2026-10-10',
    title: 'Paracetamol 650mg SOS',
    notes: 'For fever. Review in 2 weeks.'
  }

  it('round-trips a note code', () => {
    const code = makeNoteCode(note, 'Fortis OPD - Dr. P. Iyer')
    const d = decodeNoteCode(code)
    expect(d.ok).toBe(true)
    expect(d.record.title).toBe('Paracetamol 650mg SOS')
    expect(d.record.provider).toBe('Fortis OPD - Dr. P. Iyer')
  })

  it('is marked with the mtn1 prefix so it is recognisable', () => {
    expect(makeNoteCode(note, 'x').startsWith('mtn1:')).toBe(true)
  })

  it.each([
    ['empty', ''],
    ['a share token pasted by mistake', 'K4TKLQIUlOIl'],
    ['garbage', 'mtn1:not-real-compressed-data'],
    ['truncated body', 'mtn1:']
  ])('rejects %s', (_l, bad) => {
    const d = decodeNoteCode(bad)
    expect(d.ok).toBe(false)
    expect(d.message.length).toBeGreaterThan(10)
  })
})