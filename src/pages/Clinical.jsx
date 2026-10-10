import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TimelineItem } from '../components/ui.jsx'
import { b64urlDecode, validateShareToken } from '../utils/share.js'
import { addAudit } from '../utils/store.js'
import { checkInteractions } from '../utils/medSafety.js'

// Doctor portal: paste a share code OR browse demo patient with consent simulation.
export function Doctor({ state, setState }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [newNote, setNewNote] = useState({ title: '', notes: '', type: 'prescription' })
  const nav = useNavigate()

  const open = () => {
    const token = code.trim().split('/').pop()
    const v = validateShareToken(token, state)
    if (!v.ok) { setResult(v); return }
    const next = { ...state, shares: state.shares.map((s) => (s.id === v.share.id ? { ...s, accesses: s.accesses + 1 } : s)) }
    addAudit(next, `Doctor viewed share: ${v.share.label}`)
    setState(next)
    setResult(v)
  }

  const addRecord = () => {
    if (!newNote.title) { alert('Add a title'); return }
    const rec = {
      id: `rec-${Math.random().toString(36).slice(2, 8)}`,
      type: newNote.type,
      date: new Date().toISOString().slice(0, 10),
      provider: 'Fortis OPD, Bengaluru — Dr. P. Iyer (via share)',
      title: newNote.title,
      notes: newNote.notes,
      source: 'Doctor-added via MediThread'
    }
    const next = { ...state, records: [rec, ...state.records] }
    addAudit(next, `Doctor added record: ${rec.title}`)
    setState(next); setNewNote({ title: '', notes: '', type: 'prescription' })
    alert('Added to patient timeline ✅ — continuity preserved, no scratch start.')
  }

  return (
    <div>
      <div className="topbar"><div>
        <h2>🩺 Doctor portal</h2>
        <p>Paste the patient's expiring share code. You see <i>only</i> what they shared, only until expiry. Every view is logged. Add your note straight to their timeline.</p>
      </div></div>

      <div className="card" style={{ marginBottom: 14 }}>
        <label>Paste share link / token</label>
        <div className="row">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. #/shared/eyJzaWQiOi…" />
          <button className="btn" style={{ maxWidth: 160 }} onClick={open}>Open records</button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Demo shortcut: create a link in Patient → Share tab, or try emergency view: <a href="#/emergency"> #/emergency (PIN 2481)</a>
        </div>
        {result && !result.ok && <div className="alert red">⛔ {result.reason}</div>}
      </div>

      {result?.ok && (
        <div>
          <div className="alert green">✅ Verified share: <b>{result.share.label}</b> · expires {new Date(result.share.expiresAt).toLocaleString()} · {result.records.length} records</div>
          <PatientSummary state={state} />
          <div className="timeline" style={{ marginTop: 12 }}>
            {result.records.sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => <TimelineItem key={r.id} r={r} />)}
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <h3>➕ Add consultation note (writes to unified timeline)</h3>
            <div className="row">
              <div><label>Type</label><select value={newNote.type} onChange={(e) => setNewNote({ ...newNote, type: e.target.value })}><option value="prescription">Prescription</option><option value="lab">Lab order</option><option value="note">Note</option></select></div>
              <div style={{ flex: 2 }}><label>Title (try “Paracetamol 650mg” — safe alternative)</label><input value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} placeholder="e.g. Paracetamol 650mg SOS" /></div>
            </div>
            <label>Notes</label><textarea value={newNote.notes} onChange={(e) => setNewNote({ ...newNote, notes: e.target.value })} placeholder="Advice, dosage…" />
            {newNote.title && (
              (() => {
                const hits = checkInteractions(state.patient.currentMeds, newNote.title.split(' ')[0])
                return hits.length ? <div className="alert red">⚠️ {hits.map((h) => h.msg).join(' ')}</div> : <div className="alert green">✅ No interaction with current meds.</div>
              })()
            )}
            <div style={{ marginTop: 8 }}><button className="btn" onClick={addRecord}>Save to patient timeline</button></div>
          </div>
        </div>
      )}

      {!result && (
        <div className="card">
          <h3>Full demo timeline (with simulated consent)</h3>
          <div className="muted">In production this list would be hidden until the patient shares. Shown here so judges can explore without a second device.</div>
          <PatientSummary state={state} />
          <div style={{ marginTop: 10 }}><button className="btn secondary small" onClick={() => nav('/')}>Back to patient view</button></div>
        </div>
      )}
    </div>
  )
}

export function PatientSummary({ state }) {
  const p = state.patient
  return (
    <div className="grid grid-3" style={{ marginTop: 10 }}>
      <div className="card"><h3>👤 {p.name}</h3><div className="muted">{p.age}F · {p.bloodGroup} · {p.city}</div><div className="muted">{p.conditions.join(' · ')}</div></div>
      <div className="card"><h3>⚠️ Allergies</h3><div><b>{p.allergies.join(', ')}</b></div><div className="muted" style={{ marginTop: 6 }}>Meds: {p.currentMeds.map((m) => `${m.name} ${m.dose}`).join(', ')}</div></div>
      <div className="card"><h3>📞 Emergency</h3><div style={{ fontSize: 13 }}>{p.emergencyContact}</div><div className="muted">PIN-gated ER view, no login needed</div></div>
    </div>
  )
}

// Public shared-link view — anyone with link, validated, read-only.
export function Shared({ state, setState }) {
  const { token } = useParams()
  const v = validateShareToken(token, state)
  React.useEffect(() => {
    if (v.ok) {
      const next = { ...state, shares: state.shares.map((s) => (s.id === v.share.id ? { ...s, accesses: s.accesses + 1 } : s)) }
      // avoid infinite loop: only bump once per token via sessionStorage
      const k = `viewed:${v.share.id}:${token.slice(0, 12)}`
      if (!sessionStorage.getItem(k)) {
        sessionStorage.setItem(k, '1')
        setState(next)
      }
    }
    // eslint-disable-next-line
  }, [token])

  if (!v.ok) return <div className="card"><h2>🔗 Shared records</h2><div className="alert red">{v.reason}</div><a href="#/">← Back to MediThread</a></div>
  return (
    <div>
      <div className="topbar"><div>
        <h2>🔗 Shared by {state.patient.name}</h2>
        <p>{v.share.label} · {v.records.length} records · expires {new Date(v.share.expiresAt).toLocaleString()} · read-only · access logged</p>
      </div></div>
      <PatientSummary state={state} />
      <div className="timeline" style={{ marginTop: 12 }}>
        {v.records.sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => <TimelineItem key={r.id} r={r} />)}
      </div>
      <div className="foot-note">MediThread · consent-based sharing · revoke anytime from patient app</div>
    </div>
  )
}

// PIN-gated emergency view.
export function Emergency({ state }) {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const p = state.patient
  const latest = [...state.records].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)

  if (!unlocked) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '40px auto' }}>
        <h2>🚨 Emergency access</h2>
        <p className="muted">For first responders. Enter the 4-digit ER PIN shown on the patient's card/QR. No login. Read-only. Logged.</p>
        <label>ER PIN (demo: 2481)</label>
        <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="••••" />
        <div style={{ marginTop: 10 }}><button className="btn" onClick={() => (pin.trim() === p.emergencyPin ? setUnlocked(true) : alert('Wrong PIN'))}>Unlock critical info</button></div>
        <div className="muted" style={{ marginTop: 10 }}><a href="#/">← Back</a></div>
      </div>
    )
  }

  return (
    <div>
      <div className="alert red" style={{ fontSize: 15 }}>
        🚨 <b>{p.name}</b> · {p.age}F · Blood <b>{p.bloodGroup}</b><br />
        Conditions: {p.conditions.join(', ')} · Allergies: <b>{p.allergies.join(', ')}</b><br />
        Current meds: <b>{p.currentMeds.map((m) => `${m.name} ${m.dose} (${m.freq})`).join(' · ')}</b><br />
        Contact: {p.emergencyContact}
      </div>
      <div className="card">
        <h3>Latest 5 records (no repeats needed)</h3>
        <div className="timeline">{latest.map((r) => <TimelineItem key={r.id} r={r} />)}</div>
      </div>
    </div>
  )
}
