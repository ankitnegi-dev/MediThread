// Tiny localStorage store - no backend needed, judges can use instantly.
import { DEMO_PATIENT, SEED_RECORDS } from '../data/seed.js'

const KEY = 'medithread:v1'

function freshState() {
  return {
    patient: DEMO_PATIENT,
    records: SEED_RECORDS,
    shares: [
      {
        id: 'share-demo-01',
        tokenPayload: null, // filled on load
        label: 'Dr. P. Iyer - thyroid review',
        recordIds: ['rec-009', 'rec-010', 'rec-008'],
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 43).toISOString(),
        revoked: false,
        accesses: 2,
        purpose: 'Second opinion on thyroid + diabetes control'
      }
    ],
    audit: [
      { at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), event: 'Share created for Dr. P. Iyer (3 records, 48h)' },
      { at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), event: 'Dr. P. Iyer viewed shared records' }
    ],
    seededAt: new Date().toISOString()
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const s = freshState()
      localStorage.setItem(KEY, JSON.stringify(s))
      return s
    }
    const parsed = JSON.parse(raw)
    if (!parsed.records || !parsed.patient) return freshState()
    return parsed
  } catch {
    return freshState()
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function resetDemo() {
  localStorage.removeItem(KEY)
  return loadState()
}

export function addAudit(state, event) {
  state.audit = [{ at: new Date().toISOString(), event }, ...(state.audit || [])].slice(0, 80)
}
