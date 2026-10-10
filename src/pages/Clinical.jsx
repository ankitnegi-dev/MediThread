import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TimelineItem } from '../components/ui.jsx'
import { validateShareToken, makeNoteCode, REVOCATION_CAVEAT } from '../utils/share.js'
import { addAudit } from '../utils/store.js'
import { checkInteractions } from '../utils/medSafety.js'

export function Doctor({ state, setState }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [newNote, setNewNote] = useState({ title: '', notes: '', type: 'prescription' })
  const [noteCode, setNoteCode] = useState('')
  const [toast, setToast] = useState('')
  const nav = useNavigate()

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  const open = () => {
    const token = code.trim().split('#').pop().split('/').filter(Boolean).pop()
    const v = validateShareToken(token, state)
    if (!v.ok) { setResult(v); setNoteCode(''); return }

    // Count the open only when this browser holds the issuing registry.
    if (!v.external) {
      const next = { ...state, shares: state.shares.map((s) => (s.id === v.share.id ? { ...s, accesses: s.accesses + 1 } : s)) }
      addAudit(next, `Doctor opened share: ${v.share.label}`)
      setState(next)
    }
    setResult(v)
  }

  const buildNote = () => {
    if (!newNote.title) { alert('Add a title.'); return }
    const rec = {
      id: `rec-${Math.random().toString(36).slice(2, 8)}`,
      type: newNote.type,
      date: new Date().toISOString().slice(0, 10),
      provider: 'Fortis OPD, Bengaluru — Dr. P. Iyer',
      title: newNote.title,
      conditions: [],
      notes: newNote.notes,
      source: 'Added by doctor through MediThread'
    }
    setNoteCode(makeNoteCode(rec, rec.provider))
    flash('Note code ready')
  }

  const copyNote = async () => {
    try { await navigator.clipboard.writeText(noteCode); flash('Note code copied') }
    catch { flash('Copy failed — select the code and copy it manually') }
  }

  return (
    <div>
      <header className="chart-head">
        <div>
          <p className="kicker">Clinician access</p>
          <h1>Doctor</h1>
          <p className="meta">
            Paste a share link to open exactly the records the patient chose, until the link expires.
            The records travel inside the link, so this works on a clinic machine that has never
            seen MediThread.
          </p>
        </div>
        <dl className="figures">
          <div>
            <dt>Shares given</dt>
            <dd>{state.shares.length}</dd>
            <p>{state.shares.filter((s) => !s.revoked && new Date(s.expiresAt) > new Date()).length} still live</p>
          </div>
          <div>
            <dt>Views logged</dt>
            <dd>{state.shares.reduce((n, s) => n + s.accesses, 0)}</dd>
            <p>counted per share</p>
          </div>
        </dl>
      </header>

      <div style={{ marginTop: 30 }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Open a share</h2>
            <span className="hint">paste link or code</span>
          </div>
          <div className="panel-pad">
            <div className="row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste the patient&rsquo;s share link"
                aria-label="Share link or token"
              />
              <button className="btn" style={{ flex: '0 0 auto' }} onClick={open} disabled={!code.trim()}>Open records</button>
            </div>

            {result && !result.ok && (
              <div className="notice crit" style={{ marginTop: 16 }}>
                <span className="lead">Cannot open</span>
                {result.message}
              </div>
            )}

            <p className="fineprint">
              For the demo: create a link in the Patient tab and paste it here. The emergency view at{' '}
              <a href="#/emergency">#/emergency</a> is PIN-gated and needs no share.
            </p>
          </div>
        </section>

        {result?.ok && (
          <div style={{ marginTop: 30 }}>
            <div className={`notice ${result.external ? 'flag' : 'ok'}`} style={{ marginBottom: 26 }}>
              <span className="lead">{result.external ? 'Opened from another device' : 'Share verified'}</span>
              <b>{result.share.label}</b> — {result.records.length} records, expires{' '}
              {new Date(result.share.expiresAt).toLocaleString()}.
              {result.external
                ? ' This device has no copy of the patient’s share list, so a revocation cannot be checked here.'
                : ' The open has been logged on the patient’s chart.'}
            </div>

            <PatientSummary patient={result.patient} />

            <h2 className="sec-title" style={{ marginTop: 30 }}>
              Shared records
              <span className="hint">newest first</span>
            </h2>
            <div className="spine">
              {result.records.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => (
                <TimelineItem key={r.id} r={r} />
              ))}
            </div>

            <section className="panel" style={{ marginTop: 30 }}>
              <div className="panel-head">
                <h2>Write back to the patient</h2>
                <span className="hint">produces a note code</span>
              </div>
              <div className="panel-pad">
                <p className="fineprint" style={{ marginTop: 0 }}>
                  MediThread has no server, so a note cannot be pushed into the patient&rsquo;s chart
                  from here. Build the note, then send the patient the code — they paste it into
                  Patient &rsaquo; Sharing &rsaquo; Receive a note.
                </p>

                <div className="row">
                  <div>
                    <label htmlFor="d-type">Type</label>
                    <select id="d-type" value={newNote.type} onChange={(e) => setNewNote({ ...newNote, type: e.target.value })}>
                      <option value="prescription">Prescription</option>
                      <option value="lab">Lab order</option>
                      <option value="note">Note</option>
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label htmlFor="d-title">Title</label>
                    <input id="d-title" value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} placeholder="Paracetamol 650mg SOS" />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="d-notes">Notes</label>
                  <textarea id="d-notes" value={newNote.notes} onChange={(e) => setNewNote({ ...newNote, notes: e.target.value })} placeholder="Advice, dosage, follow-up." />
                </div>

                {newNote.title && (() => {
                  const hits = checkInteractions(result.patient.currentMeds || [], newNote.title.split(' ')[0])
                  return hits.length ? (
                    <div className="notice crit" style={{ marginTop: 16 }}>
                      <span className="lead">Interaction with their current medicines</span>
                      {hits.map((h) => h.msg).join(' ')}
                    </div>
                  ) : (
                    <div className="notice ok" style={{ marginTop: 16 }}>
                      <span className="lead">Clear</span>
                      No known interaction with their current medicines.
                    </div>
                  )
                })()}

                <div className="btn-row">
                  <button className="btn" onClick={buildNote} disabled={!newNote.title}>Build note code</button>
                </div>

                {noteCode && (
                  <div className="notice ok" style={{ marginTop: 18 }}>
                    <span className="lead">Send this to the patient</span>
                    <span className="mono-hint wordwrap" style={{ display: 'block', color: 'var(--ink-80)', marginTop: 8 }}>{noteCode}</span>
                    <div className="btn-row" style={{ marginTop: 12 }}>
                      <button className="btn quiet small" onClick={copyNote}>Copy note code</button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {!result && (
          <section className="panel" style={{ marginTop: 30 }}>
            <div className="panel-head"><h2>Consent simulation</h2></div>
            <div className="panel-pad">
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-80)' }}>
                In production this screen shows nothing until a patient shares. It is visible here so a
                judge can walk the whole flow from one browser.
              </p>
              <PatientSummary patient={state.patient} />
              <div className="btn-row">
                <button className="btn quiet" onClick={() => nav('/')}>Back to the patient chart</button>
              </div>
            </div>
          </section>
        )}
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export function PatientSummary({ patient }) {
  const p = patient
  return (
    <div className="panel">
      <div className="panel-head"><h2>Before you start</h2></div>
      <div className="panel-pad">
        <dl className="deflist">
          <div>
            <dt>Patient</dt>
            <dd><b>{p.name}</b>, {p.age}, {p.sex}. Blood {p.bloodGroup}. {p.city}. {p.conditions.join(', ')}.</dd>
          </div>
          <div>
            <dt>Allergies</dt>
            <dd><b>{p.allergies.join(', ')}</b></dd>
          </div>
          <div>
            <dt>Current medicines</dt>
            <dd>{p.currentMeds.map((m) => `${m.name} ${m.dose}, ${m.freq}`).join(' · ')}</dd>
          </div>
          <div>
            <dt>Emergency contact</dt>
            <dd>{p.emergencyContact}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export function Shared({ state, setState }) {
  const { token } = useParams()
  const v = validateShareToken(token, state)

  React.useEffect(() => {
    if (!v.ok || v.external) return
    const k = `viewed:${v.share.id}`
    if (sessionStorage.getItem(k)) return
    sessionStorage.setItem(k, '1')
    const next = { ...state, shares: state.shares.map((s) => (s.id === v.share.id ? { ...s, accesses: s.accesses + 1 } : s)) }
    addAudit(next, `Share opened: ${v.share.label}`)
    setState(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (!v.ok) {
    return (
      <div style={{ maxWidth: 560, margin: '56px auto' }}>
        <p className="kicker">Shared records</p>
        <h1 style={{ font: '600 32px/1.1 var(--serif)', marginBottom: 18 }}>This link does not open</h1>
        <div className="notice crit">
          <span className="lead">Reason</span>
          {v.message}
        </div>
        <div className="notice flag" style={{ marginTop: 10 }}>
          <span className="lead">About revocation</span>
          {REVOCATION_CAVEAT}
        </div>
        <div className="btn-row"><a className="btn quiet" href="#/">Go to MediThread</a></div>
      </div>
    )
  }

  return (
    <div>
      <header className="chart-head">
        <div>
          <p className="kicker">Shared by {v.patient.name}</p>
          <h1>{v.share.label}</h1>
          <p className="meta">
            {v.records.length} records. Expires {new Date(v.share.expiresAt).toLocaleString()}.
            Read only.
          </p>
        </div>
      </header>

      <div style={{ marginTop: 30 }}>
        {v.external && (
          <div className="notice flag" style={{ marginBottom: 22 }}>
            <span className="lead">Opened on a device with no MediThread data</span>
            The records came from inside the link itself. {REVOCATION_CAVEAT}
          </div>
        )}

        <PatientSummary patient={v.patient} />

        <h2 className="sec-title" style={{ marginTop: 30 }}>
          What was shared
          <span className="hint">{v.records.length} records</span>
        </h2>
        <div className="spine">
          {v.records.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => (
            <TimelineItem key={r.id} r={r} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function Emergency({ state, setState }) {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [tries, setTries] = useState(0)
  const [err, setErr] = useState('')
  const p = state.patient
  const latest = [...state.records].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
  const LOCKOUT_AT = 5

  const tryUnlock = () => {
    if (tries >= LOCKOUT_AT) return
    if (pin.trim() === p.emergencyPin) {
      const next = { ...state }
      addAudit(next, 'Emergency card opened (PIN verified)')
      setState(next)
      setUnlocked(true)
      return
    }
    const n = tries + 1
    setTries(n)
    setPin('')
    setErr(
      n >= LOCKOUT_AT
        ? `That PIN does not match. ${LOCKOUT_AT} failed attempts — reload the page to try again.`
        : `That PIN does not match. ${LOCKOUT_AT - n} attempt${LOCKOUT_AT - n === 1 ? '' : 's'} left before this device is locked out.`
    )
  }

  const locked = tries >= LOCKOUT_AT

  if (!unlocked) {
    return (
      <div className="pinwrap">
        <p className="kicker" style={{ color: 'var(--stamp)' }}>For first responders</p>
        <h1 style={{ font: '600 32px/1.12 var(--serif)', marginBottom: 12 }}>Emergency access</h1>
        <p className="meta" style={{ marginBottom: 24 }}>
          Enter the four-digit PIN on the patient&rsquo;s card. No login, read only.
        </p>
        <label htmlFor="pin">Patient PIN</label>
        <input
          id="pin"
          className="pininput"
          value={pin}
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          disabled={locked}
          placeholder="· · · ·"
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setErr('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock() }}
        />
        {err && (
          <div className="notice crit" style={{ marginTop: 14 }} role="alert">
            <span className="lead">Not unlocked</span>{err}
          </div>
        )}
        <div className="btn-row">
          <button className="btn" onClick={tryUnlock} disabled={pin.length !== 4 || locked}>Unlock</button>
          <a className="btn quiet" href="#/">Go back</a>
        </div>
        <p className="fineprint">The demo PIN is <code className="inline">{p.emergencyPin}</code>.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="ercard">
        <p className="kicker" style={{ color: 'var(--stamp)' }}>Critical information</p>
        <h2>{p.name}</h2>
        <p className="meta">{p.age} years, {p.sex}. {p.city}.</p>
        <p className="big">{p.bloodGroup}</p>
        <p className="mono-hint">blood group</p>
        <dl>
          <div className="rowline"><dt>Conditions</dt><dd>{p.conditions.join(', ')}</dd></div>
          <div className="rowline"><dt>Allergies</dt><dd><b>{p.allergies.join(', ')}</b></dd></div>
          <div className="rowline"><dt>Medicines</dt><dd>{p.currentMeds.map((m) => `${m.name} ${m.dose} (${m.freq})`).join(' · ')}</dd></div>
          <div className="rowline"><dt>Contact</dt><dd>{p.emergencyContact}</dd></div>
        </dl>
      </div>

      <h2 className="sec-title" style={{ marginTop: 34 }}>
        Recent history
        <span className="hint">read only</span>
      </h2>
      <div className="spine">
        {latest.map((r) => <TimelineItem key={r.id} r={r} />)}
      </div>

      <div className="btn-row"><a className="btn quiet" href="#/">Lock and leave</a></div>
    </div>
  )
}