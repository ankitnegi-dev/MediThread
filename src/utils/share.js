// Share-link tokens: self-contained, expirable, revocable.
// Token = base64url(JSON { sid, exp, ids }) — validated against local share registry.
export function b64urlEncode(obj) {
  const s = JSON.stringify(obj)
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(token) {
  try {
    let b = token.replace(/-/g, '+').replace(/_/g, '/')
    while (b.length % 4) b += '='
    return JSON.parse(decodeURIComponent(escape(atob(b))))
  } catch {
    return null
  }
}

export function makeShareToken(share) {
  return b64urlEncode({
    sid: share.id,
    exp: new Date(share.expiresAt).getTime(),
    ids: share.recordIds
  })
}

export function validateShareToken(token, state) {
  const payload = b64urlDecode(token)
  if (!payload || !payload.sid) return { ok: false, reason: 'Invalid share code. Ask the patient for a fresh link.' }
  const share = (state.shares || []).find((s) => s.id === payload.sid)
  if (!share) return { ok: false, reason: 'Share not found. It may have been deleted.' }
  if (share.revoked) return { ok: false, reason: 'This link was revoked by the patient. Request a new one.' }
  if (Date.now() > new Date(share.expiresAt).getTime()) return { ok: false, reason: 'This link has expired. Request a new one.' }
  const records = (state.records || []).filter((r) => share.recordIds.includes(r.id))
  return { ok: true, share, records, payload }
}

export function expiryOptions() {
  return [
    { label: '1 hour (ER visit)', hours: 1 },
    { label: '24 hours (OPD)', hours: 24 },
    { label: '7 days (second opinion)', hours: 168 }
  ]
}
