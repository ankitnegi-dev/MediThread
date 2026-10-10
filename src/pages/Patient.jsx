import React, { useMemo, useState } from 'react'
import { LabChart, TimelineItem } from '../components/ui.jsx'
import { checkInteractions, checkExistingCombo, findRecentSameTest, simulateParse } from '../utils/medSafety.js'
import { addAudit } from '../utils/store.js'
import { b64urlEncode, expiryOptions, makeShareToken } from '../utils/share.js'
import { QRCodeSVG } from 'qrcode.react'

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`

export default function Patient({ state, setState }) {
  const [tab, setTab] = useState('timeline')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => {
    let list = [...state.records].sort((a, b) => new Date(b.date) - new Date(a.date))
    if (typeFilter !== 'all') list = list.filter((r) => r.type === typeFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((r) =>
        [r.title, r.provider, r.notes, (r.conditions || []).join(' ')].join(' ').toLowerCase().includes(q)
      )
    }
    return list
  }, [state.records, query, typeFilter])

  const update = (patch) => {
    const next = { ...state, ...patch }
    setState(next)
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h2>Namaste, {state.patient.name.split(' ')[0]} 👋</h2>
          <p>
            One timeline for your entire history — across clinics, labs and cities.
            Upload once, carry everywhere, share safely. No more folders, no more repeats.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn small ${tab === 'timeline' ? '' : 'secondary'}`} onClick={() => setTab('timeline')}>Timeline</button>
          <button className={`btn small ${tab === 'upload' ? '' : 'secondary'}`} onClick={() => setTab('upload')}>+ Add</button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card"><div className="muted">Records unified</div><div className="kpi">{state.records.length}</div><div className="kpi-sub">{new Set(state.records.map((r) => r.provider)).size} providers → 1 timeline</div></div>
        <div className="card"><div className="muted">Active meds</div><div className="kpi">{state.patient.currentMeds.length}</div><div className="kpi-sub">{state.patient.conditions.join(' · ')}</div></div>
        <div className="card"><div className="muted">Active shares</div><div className="kpi">{state.shares.filter((s) => !s.revoked && new Date(s.expiresAt) > new Date()).length}</div><div className="kpi-sub">revocable · expiring · logged</div></div>
      </div>

      <div className="chips" style={{ marginTop: 14 }}>
        {['timeline', 'meds', 'share', 'emergency', 'upload'].map((t) => (
          <button key={t} className={`chip ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'timeline' ? '📜 Timeline' : t === 'meds' ? '💊 Meds & Safety' : t === 'share' ? '🔗 Share' : t === 'emergency' ? '🚨 Emergency card' : '📤 Upload'}
          </button>
        ))}
      </div>

      {tab === 'timeline' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="row">
                <input placeholder="Search diagnoses, providers, notes… e.g. HbA1c" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ maxWidth: 170 }}>
                  <option value="all">All types</option>
                  <option value="prescription">Prescriptions</option>
                  <option value="lab">Labs</option>
                  <option value="scan">Scans</option>
                  <option value="discharge">Discharge</option>
                </select>
              </div>
              <div className="muted" style={{ marginTop: 8 }}>{filtered.length} records · newest first · scattered → sorted</div>
            </div>
            <div className="timeline">
              {filtered.map((r) => (
                <TimelineItem key={r.id} r={r} onView={setSelected} />
              ))}
            </div>
            {selected && (
              <div className="card" style={{ marginTop: 8, borderColor: '#0e7c7b' }}>
                <h3>{selected.title}</h3>
                <div className="muted">{selected.date} · {selected.provider}</div>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>{selected.notes}</p>
                {selected.labs && <div className="mono">Labs: {JSON.stringify(selected.labs)}</div>}
                <div style={{ marginTop: 10 }}><button className="btn secondary small" onClick={() => setSelected(null)}>Close</button></div>
              </div>
            )}
          </div>
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <h3>📉 Lab trends — proof you don't need a repeat test</h3>
              <LabChart records={state.records} test="HbA1c" />
              <div style={{ marginTop: 12 }}><LabChart records={state.records} test="Creatinine" /></div>
            </div>
            <div className="card">
              <h3>🧠 Why this fixes “Lost in Transit”</h3>
              <div className="muted" style={{ lineHeight: 1.6 }}>
                Scattered PDFs + photos → single searchable timeline.<br />
                Unreliable recall → auto emergency card + med list.<br />
                Repeats/conflicts → duplicate-test + interaction alerts.<br />
                Insecure forwarding → expiring revocable links + audit.<br />
                Broken continuity → new doctor starts with full history, not scratch.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'upload' && <UploadTab state={state} update={update} />}
      {tab === 'meds' && <MedsTab state={state} update={update} />}
      {tab === 'share' && <ShareTab state={state} update={update} />}
      {tab === 'emergency' && <EmergencyTab state={state} />}
    </div>
  )
}

function UploadTab({ state, update }) {
  const [form, setForm] = useState({ type: 'lab', date: new Date().toISOString().slice(0, 10), provider: '', title: '', notes: '', fileName: '' })
  const [parsed, setParsed] = useState(null)
  const [dupWarn, setDupWarn] = useState(null)

  const preview = () => {
    const p = simulateParse(form.fileName || form.title, form.provider)
    setParsed(p)
    setForm({ ...form, type: p.type })
    // duplicate check if lab-like title mentions a known test
    const known = ['HbA1c', 'Creatinine', 'LDL', 'TSH', 'FastingGlucose']
    const hit = known.find((k) => (form.title + form.notes).toLowerCase().includes(k.toLowerCase()))
    if (hit) {
      const res = findRecentSameTest(state.records, hit, form.date)
      if (res.candidates.length) setDupWarn({ test: hit, ...res })
      else setDupWarn(null)
    }
  }

  const save = () => {
    if (!form.title || !form.date) { alert('Add at least a title and date.'); return }
    const rec = {
      id: uid('rec'),
      type: form.type,
      date: form.date,
      provider: form.provider || 'Uploaded by patient',
      title: form.title,
      conditions: [],
      notes: form.notes || (parsed ? `AI-parse: ${parsed.extracted} (conf ${(parsed.confidence * 100).toFixed(0)}%)` : 'Manual entry'),
      source: form.fileName ? `File: ${form.fileName}` : 'Manual entry'
    }
    const next = { ...state, records: [rec, ...state.records] }
    addAudit(next, `Added record: ${rec.title} (${rec.type}, ${rec.date})`)
    update(next)
    setForm({ type: 'lab', date: new Date().toISOString().slice(0, 10), provider: '', title: '', notes: '', fileName: '' })
    setParsed(null); setDupWarn(null)
    alert('Saved to your unified timeline ✅')
  }

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h3>📤 Add a record — photo, PDF or manual</h3>
        <div className="muted">Demo simulates AI extraction (no hospital integration needed per brief).</div>
        <label>File name (simulate upload, e.g. hba1c-oct.pdf)</label>
        <input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="prescription-aug.jpg / lab-hba1c.pdf" />
        <div className="row">
          <div><label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="lab">Lab report</option><option value="prescription">Prescription</option>
              <option value="scan">Scan</option><option value="discharge">Discharge summary</option><option value="note">Note</option>
            </select>
          </div>
          <div><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        </div>
        <label>Provider / hospital</label>
        <input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="e.g. Apollo Labs, Bengaluru" />
        <label>Title</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. HbA1c 6.9% — routine" />
        <label>Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Symptoms, dosage, doctor advice…" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn secondary" onClick={preview}>✨ Simulate AI parse</button>
          <button className="btn" onClick={save}>Save to timeline</button>
        </div>
        {parsed && <div className="alert blue">🤖 Extracted: <b>{parsed.type}</b> · {parsed.extracted} · confidence {(parsed.confidence * 100).toFixed(0)}% (simulated)</div>}
        {dupWarn && (
          <div className="alert amber">
            ⏳ <b>Duplicate-test guard:</b> {dupWarn.test} was already done <b>{dupWarn.candidates[0].diffDays} days ago</b> ({dupWarn.candidates[0].record.date} — {dupWarn.candidates[0].record.provider}, value {dupWarn.candidates[0].record.labs[dupWarn.test]}).
            Valid window: {dupWarn.windowDays} days. Consider sharing the old report instead of repeating. Saves ₹ + time.
          </div>
        )}
      </div>
      <div className="card">
        <h3>What happens on save</h3>
        <div className="muted" style={{ lineHeight: 1.7 }}>
          1. Record is normalized (date, provider, type) and merged into the single timeline.<br />
          2. Lab values feed the trend charts automatically.<br />
          3. Duplicate-test check runs against history.<br />
          4. New meds (if any) run through the interaction checker.<br />
          5. Everything stays on-device (localStorage) for this demo — export JSON anytime from Emergency tab.
        </div>
      </div>
    </div>
  )
}

function MedsTab({ state, update }) {
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const existing = checkExistingCombo(state.patient.currentMeds)
  const previewHits = name ? checkInteractions(state.patient.currentMeds, name) : []

  const add = () => {
    if (!name.trim()) return
    const hits = checkInteractions(state.patient.currentMeds, name)
    if (hits.some((h) => h.level === 'high')) {
      if (!confirm(`⚠️ HIGH-RISK interaction:\n\n${hits.map((h) => h.msg).join('\n\n')}\n\nAdd anyway?`)) return
    }
    const next = { ...state, patient: { ...state.patient, currentMeds: [...state.patient.currentMeds, { name: name.trim(), dose: dose || '—', freq: 'as advised', since: new Date().toISOString().slice(0, 10) }] } }
    addAudit(next, `Medication added: ${name} ${dose} ${hits.length ? `(⚠️ ${hits.length} interaction flag)` : ''}`)
    update(next); setName(''); setDose('')
  }

  const remove = (n) => {
    const next = { ...state, patient: { ...state.patient, currentMeds: state.patient.currentMeds.filter((m) => m.name !== n) } }
    addAudit(next, `Medication stopped: ${n}`)
    update(next)
  }

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h3>💊 Current medicines — never rely on memory again</h3>
        <table><thead><tr><th>Medicine</th><th>Dose / since</th><th></th></tr></thead>
          <tbody>{state.patient.currentMeds.map((m) => (
            <tr key={m.name}><td><b>{m.name}</b><div className="muted">{m.freq}</div></td><td>{m.dose}<div className="muted">{m.since}</div></td>
              <td><button className="btn secondary small" onClick={() => remove(m.name)}>Stop</button></td></tr>
          ))}</tbody></table>
        {existing.length > 0 && (
          <div className="alert red">⚠️ Existing combo risk: {existing.map((e) => e.msg).join(' ')}</div>
        )}
        <div className="inline-form">
          <label>Check + add a new medicine (try “Ibuprofen” to trigger the demo conflict)</label>
          <div className="row"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ibuprofen" /><input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="dose e.g. 400mg" /></div>
          {previewHits.length > 0 && (
            <div className="alert red">⛔ Would interact: {previewHits.map((h) => h.msg).join(' ')}</div>
          )}
          {name && previewHits.length === 0 && <div className="alert green">✅ No known interaction with current list (curated demo DB).</div>}
          <div style={{ marginTop: 8 }}><button className="btn" onClick={add}>Add medication</button></div>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>Allergies on file: <b>{state.patient.allergies.join(', ')}</b> — shown to every doctor + ER.</div>
      </div>
      <div className="card">
        <h3>🛡️ How this prevents harm</h3>
        <div className="muted" style={{ lineHeight: 1.7 }}>
          The 2023 CityCare fever visit is the cautionary tale: Ibuprofen was prescribed without knowing about Telmisartan.
          MediThread flags that pair <i>before</i> you take it.<br /><br />
          Duplicate-test logic uses per-test windows (HbA1c 90d, Creatinine 60d, LDL 120d…) so a doctor who orders “HbA1c again after 3 weeks” gets a nudge to view the prior result instead.
        </div>
        <div className="alert amber">Demo rule engine is illustrative, not medical advice. Real deployment would use an approved drug DB (e.g. DrugBank / CDS hooks).</div>
      </div>
    </div>
  )
}

function ShareTab({ state, update }) {
  const [label, setLabel] = useState('')
  const [hours, setHours] = useState(24)
  const [ids, setIds] = useState(state.records.slice(0, 3).map((r) => r.id))
  const [lastToken, setLastToken] = useState('')

  const toggle = (id) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const create = () => {
    if (!ids.length) { alert('Select at least one record.'); return }
    const share = {
      id: uid('share'),
      label: label || `Share ${new Date().toLocaleString()}`,
      recordIds: ids,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
      revoked: false, accesses: 0, purpose: label
    }
    const token = makeShareToken(share)
    const next = { ...state, shares: [share, ...state.shares] }
    addAudit(next, `Share created: ${share.label} (${ids.length} records, ${hours}h)`)
    update(next); setLastToken(token); setLabel('')
  }

  const revoke = (id) => {
    const next = { ...state, shares: state.shares.map((s) => (s.id === id ? { ...s, revoked: true } : s)) }
    addAudit(next, `Share revoked: ${id}`)
    update(next)
  }

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h3>🔗 Create a secure share — no more WhatsApp forwards</h3>
        <label>Purpose / doctor</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Dr. Iyer — diabetes review" />
        <label>Expiry</label>
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {expiryOptions().map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
        </select>
        <label>Records to include ({ids.length} selected)</label>
        <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 8 }}>
          {[...state.records].sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => (
            <label key={r.id} style={{ display: 'flex', gap: 8, fontWeight: 500, margin: '6px 0' }}>
              <input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} style={{ width: 16 }} />
              <span style={{ fontSize: 13 }}>{r.date} · {r.title}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 10 }}><button className="btn" onClick={create}>Generate expiring link</button></div>
        {lastToken && (
          <div className="alert green">
            ✅ Link ready (copy it):<br />
            <span className="mono">{`${location.origin}${location.pathname}#/shared/${lastToken}`}</span><br />
            <span className="muted">Token expires in {hours}h · revocable anytime · every view is logged.</span>
          </div>
        )}
      </div>
      <div className="card">
        <h3>📋 Active & past shares + audit log</h3>
        <table><thead><tr><th>Label</th><th>Expiry</th><th>Views</th><th></th></tr></thead><tbody>
          {state.shares.map((s) => {
            const exp = new Date(s.expiresAt) < new Date() || s.revoked
            return (
              <tr key={s.id}>
                <td><b>{s.label}</b><div className="muted">{s.recordIds.length} records</div></td>
                <td><span className={`badge ${exp ? 'red' : 'green'}`}>{s.revoked ? 'revoked' : new Date(s.expiresAt) < new Date() ? 'expired' : 'active'}</span><div className="muted mono">{new Date(s.expiresAt).toLocaleString()}</div></td>
                <td>{s.accesses}</td>
                <td>{!s.revoked && <button className="btn secondary small" onClick={() => revoke(s.id)}>Revoke</button>}</td>
              </tr>
            )
          })}
        </tbody></table>
        <h3 style={{ marginTop: 14 }}>🕵️ Audit trail</h3>
        <div className="muted" style={{ maxHeight: 180, overflow: 'auto' }}>
          {state.audit.map((a, i) => <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid #eef4f6' }}><span className="mono">{new Date(a.at).toLocaleString()}</span> — {a.event}</div>)}
        </div>
      </div>
    </div>
  )
}

function EmergencyTab({ state }) {
  const erUrl = `${location.origin}${location.pathname}#/emergency`
  const summary = b64urlEncode({ n: state.patient.name, b: state.patient.bloodGroup, a: state.patient.allergies, m: state.patient.currentMeds.map((m) => `${m.name} ${m.dose}`), e: state.patient.emergencyContact })
  void summary
  return (
    <div className="er-grid">
      <div className="card">
        <h3>🚨 Emergency card — when the patient can't speak</h3>
        <div className="alert red"><b>{state.patient.name}</b> · {state.patient.age}F · {state.patient.bloodGroup} · {state.patient.city}<br />Conditions: {state.patient.conditions.join(', ')}<br />Allergies: <b>{state.patient.allergies.join(', ')}</b><br />Meds: {state.patient.currentMeds.map((m) => `${m.name} ${m.dose}`).join(', ')}<br />Contact: {state.patient.emergencyContact}</div>
        <div className="muted">ER PIN: <code className="inline">{state.patient.emergencyPin}</code> · Full ER view at <code className="inline">#/emergency</code> — no login, PIN-gated, read-only.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn secondary" onClick={() => {
            const blob = new Blob([JSON.stringify({ patient: state.patient, records: state.records }, null, 2)], { type: 'application/json' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'medithread-export.json'; a.click()
          }}>⬇ Export JSON (carry when moving cities)</button>
          <button className="btn ghost" onClick={() => window.print()}>🖨 Print summary</button>
        </div>
      </div>
      <div className="card">
        <h3>📱 ER QR — stick on phone / wallet</h3>
        <div className="qr-box"><QRCodeSVG value={erUrl} size={190} /></div>
        <div className="muted mono" style={{ marginTop: 8, wordBreak: 'break-all' }}>{erUrl}</div>
        <div className="muted" style={{ marginTop: 6 }}>Scanning opens the PIN-gated emergency view. Demo PIN is 2481.</div>
      </div>
    </div>
  )
}
