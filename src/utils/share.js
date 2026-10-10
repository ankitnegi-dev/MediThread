// Share tokens: self-contained, expirable, revocable-within-the-issuing-browser.
//
// v2 token = lz-string(deflate) over JSON, carrying the patient summary and the
// actual record payloads. That means a link opened on a phone with no local
// storage still renders the shared records — no server registry required.
//
// Revocation is the honest limitation: with no backend there is no central
// list to consult, so a revocation only takes effect in the browser that
// issued the link. Everywhere else the token remains valid until it expires.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

export const TOKEN_VERSION = 2
export const NOTE_PREFIX = 'mtn1'

/** Honest limitation surfaced in the UI and the README. */
export const REVOCATION_CAVEAT =
  'Revocation is enforced locally in this demo. Production uses a server-side consent registry.'

const RECORD_FIELDS = ['id', 'type', 'date', 'provider', 'title', 'conditions', 'labs', 'meds', 'notes', 'source', 'flag', 'doc', 'docOmitted']

export function sanitizeRecord(r) {
  const out = {}
  for (const f of RECORD_FIELDS) if (r[f] !== undefined) out[f] = r[f]
  return out
}

export function patientSummary(p) {
  return {
    name: p.name,
    age: p.age,
    sex: p.sex,
    bloodGroup: p.bloodGroup,
    city: p.city,
    conditions: p.conditions,
    allergies: p.allergies,
    emergencyContact: p.emergencyContact,
    // the PIN is deliberately never put in a share link
    currentMeds: (p.currentMeds || []).map((m) => ({ name: m.name, dose: m.dose, freq: m.freq, since: m.since }))
  }
}

/**
 * Build a share link token. `records` are embedded in full (minus anything
 * oversized), so the link works with an empty localStorage.
 */
export function makeShareToken({ share, patient, records }) {
  const payload = {
    v: TOKEN_VERSION,
    sid: share.id,
    label: share.label,
    purpose: share.purpose || '',
    exp: new Date(share.expiresAt).getTime(),
    iat: new Date(share.createdAt || Date.now()).getTime(),
    patient: patientSummary(patient),
    records: (records || []).map(sanitizeRecord)
  }
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

/** Decode any token. Returns a discriminated result rather than throwing. */
export function decodeShareToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'empty', message: 'No share code was provided.' }
  }
  const t = token.trim()

  // v1 links were registry-dependent base64url JSON — they cannot work off-device.
  if (/^[A-Za-z0-9_-]{20,}$/.test(t) && !/[+@$!%]/.test(t)) {
    try {
      const legacy = JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/')))))
      if (legacy && legacy.sid && !legacy.v) {
        return {
          ok: false,
          reason: 'legacy',
          message: 'This is an older share link that only worked on the device that made it. Ask for a fresh link.'
        }
      }
    } catch { /* fall through to the generic malformed message */ }
  }

  let json
  try {
    json = decompressFromEncodedURIComponent(t)
  } catch {
    return { ok: false, reason: 'malformed', message: 'This share code is damaged. Ask the patient for a new link.' }
  }
  if (!json) {
    return { ok: false, reason: 'malformed', message: 'This share code is damaged. Ask the patient for a new link.' }
  }

  let payload
  try {
    payload = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'malformed', message: 'This share code could not be read. Ask the patient for a new link.' }
  }

  if (payload.v !== TOKEN_VERSION) {
    return { ok: false, reason: 'version', message: 'This share code was made by a different version of MediThread.' }
  }
  if (!payload.sid || typeof payload.exp !== 'number' || !payload.patient || !Array.isArray(payload.records)) {
    return { ok: false, reason: 'malformed', message: 'This share code is missing part of its contents. Ask for a new link.' }
  }
  return { ok: true, payload }
}

/**
 * Validate a token for display.
 *
 * `state` is optional — omit it (or pass an empty store) when opening a link on
 * a device that never issued it. In that case revocation cannot be checked, and
 * `external` is true so the UI can say so.
 */
export function validateShareToken(token, state) {
  const d = decodeShareToken(token)
  if (!d.ok) return d

  const { payload } = d

  if (Date.now() > payload.exp) {
    return {
      ok: false,
      reason: 'expired',
      message: 'This link expired on ' + new Date(payload.exp).toLocaleString() + '. Ask for a new one.',
      payload
    }
  }

  const local = (state?.shares || []).find((s) => s.id === payload.sid)
  if (local?.revoked) {
    return {
      ok: false,
      reason: 'revoked',
      message: 'The patient revoked this link. It no longer opens anywhere.',
      payload
    }
  }

  const share = local
    ? { ...local, recordIds: payload.records.map((r) => r.id) }
    : {
        id: payload.sid,
        label: payload.label,
        purpose: payload.purpose,
        recordIds: payload.records.map((r) => r.id),
        createdAt: new Date(payload.iat).toISOString(),
        expiresAt: new Date(payload.exp).toISOString(),
        revoked: false,
        accesses: 0
      }

  return {
    ok: true,
    share,
    records: payload.records,
    patient: payload.patient,
    payload,
    // true when this browser has no registry entry — revocation is unknowable here
    external: !local
  }
}

/* ------------------------------------------------------------------
   Note codes — the honest way a doctor gives something back.
   There is no server, so the doctor cannot write to the patient's
   timeline. They hand the patient a code instead.
   ------------------------------------------------------------------ */

export function makeNoteCode(record, provider) {
  const payload = {
    v: 1,
    rec: sanitizeRecord(record),
    provider,
    at: new Date().toISOString()
  }
  return `${NOTE_PREFIX}:${compressToEncodedURIComponent(JSON.stringify(payload))}`
}

export function decodeNoteCode(code) {
  if (typeof code !== 'string') return { ok: false, reason: 'empty', message: 'Paste a note code first.' }
  const raw = code.trim()
  if (!raw.toLowerCase().startsWith(NOTE_PREFIX + ':')) {
    return { ok: false, reason: 'malformed', message: 'That does not look like a MediThread note code. It starts with "mtn1:".' }
  }
  let json
  try {
    json = decompressFromEncodedURIComponent(raw.slice(NOTE_PREFIX.length + 1))
  } catch {
    return { ok: false, reason: 'malformed', message: 'This note code is damaged. Ask the doctor to send it again.' }
  }
  if (!json) return { ok: false, reason: 'malformed', message: 'This note code is damaged. Ask the doctor to send it again.' }
  let payload
  try {
    payload = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'malformed', message: 'This note code could not be read. Ask the doctor to send it again.' }
  }
  if (payload?.v !== 1 || !payload.rec?.title) {
    return { ok: false, reason: 'malformed', message: 'This note code is incomplete. Ask the doctor to send it again.' }
  }
  return { ok: true, record: { ...payload.rec, provider: payload.provider || payload.rec.provider }, at: payload.at }
}

export function expiryOptions() {
  return [
    { label: '1 hour — emergency or ER visit', hours: 1 },
    { label: '24 hours — one OPD consultation', hours: 24 },
    { label: '7 days — second opinion', hours: 168 }
  ]
}