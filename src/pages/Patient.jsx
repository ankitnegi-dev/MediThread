import React, { useMemo, useState } from 'react'
import { LabChart, TimelineItem } from '../components/ui.jsx'
import { checkInteractions, checkExistingCombo, findRecentSameTest, simulateParse } from '../utils/medSafety.js'
import { addAudit } from '../utils/store.js'
import { expiryOptions, makeShareToken, decodeNoteCode, REVOCATION_CAVEAT } from '../utils/share.js'
import { QRCodeSVG } from 'qrcode.react'

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`

const SECTIONS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'meds', label: 'Medicines' },
  { key: 'share', label: 'Sharing' },
  { key: 'emergency', label: 'Emergency card' },
  { key: 'upload', label: 'Add record' }
]

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

  const update = (patch) => setState({ ...state, ...patch })
  const p = state.patient
  const providers = new Set(state.records.map((r) => r.provider)).size
  const liveShares = state.shares.filter((s) => !s.revoked && new Date(s.expiresAt) > new Date()).length

  return (
    <div>
      <header className="chart-head">
        <div>
          <p className="kicker">Patient chart</p>
          <h1>{p.name}</h1>
          <p className="meta">
            {p.age} years, {p.sex}. Blood {p.bloodGroup}. {p.city}.<br />
            {p.conditions.join(', ')}.
          </p>
        </div>

        <dl className="figures">
          <div>
            <dt>Records</dt>
            <dd>{state.records.length}</dd>
            <p>{providers} providers, one chart</p>
          </div>
          <div>
            <dt>Medicines</dt>
            <dd>{p.currentMeds.length}</dd>
            <p>{p.conditions.length} conditions tracked</p>
          </div>
          <div>
            <dt>Live shares</dt>
            <dd>{liveShares}</dd>
            <p>Expiring, revocable, logged</p>
          </div>
        </dl>
      </header>

      <nav className="filters" style={{ marginTop: 30 }} aria-label="Chart sections">
        {SECTIONS.map((s) => (
          <button key={s.key} aria-pressed={tab === s.key} onClick={() => setTab(s.key)}>
            {s.label}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 34 }}>
        {tab === 'timeline' && (
          <div className="stack split">
            <div>
              {selected && (
                <section className="panel" style={{ marginBottom: 26 }}>
                  <div className="panel-head">
                    <h3>{selected.title}</h3>
                    <button className="btn quiet small" onClick={() => setSelected(null)}>Close</button>
                  </div>
                  <div className="panel-pad">
                    <p className="mono-hint">{selected.date} — {selected.provider}</p>
                    <p className="notes" style={{ marginTop: 12 }}>{selected.notes}</p>
                  </div>
                </section>
              )}

              <div className="row" style={{ marginBottom: 22 }}>
                <input
                  placeholder="Search the chart — diagnoses, providers, notes"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search the chart"
                />
              </div>

              <div className="filters" style={{ marginBottom: 8 }}>
                {['all', 'lab', 'prescription', 'scan', 'discharge'].map((t) => (
                  <button key={t} aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>
                    {t === 'all' ? 'Everything' : t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <h2 className="sec-title" style={{ marginTop: 22 }}>
                The thread
                <span className="hint">{filtered.length} of {state.records.length} records</span>
              </h2>

              {filtered.length === 0 ? (
                <div className="notice flag">
                  <span className="lead">Nothing matches</span>
                  No record matches that search. Clear the search or switch the type filter.
                </div>
              ) : (
                <div className="spine">
                  {filtered.map((r) => (
                    <TimelineItem key={r.id} r={r} onView={setSelected} />
                  ))}
                </div>
              )}
            </div>

            <div className="stack-tight">
              <section className="panel">
                <div className="panel-head">
                  <h2>Lab trends</h2>
                  <span className="hint">no repeat needed</span>
                </div>
                <div className="panel-pad">
                  <LabChart records={state.records} test="HbA1c" target={7} unit="%" />
                  <div style={{ marginTop: 24 }}>
                    <LabChart records={state.records} test="Creatinine" target={1.2} unit="mg/dL" />
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h2>What this demo shows</h2></div>
                <div className="panel-pad">
                  <dl className="deflist">
                    <div>
                      <dt>Lost in transit</dt>
                      <dd>Paper slips, PDFs and photos from ten different providers end up in one searchable chart.</dd>
                    </div>
                    <div>
                      <dt>Recall failure</dt>
                      <dd>A medicine list and an emergency card are generated from the chart, not from memory.</dd>
                    </div>
                    <div>
                      <dt>Repeated tests</dt>
                      <dd>A per-test window flags a result you already have before it is ordered again.</dd>
                    </div>
                    <div>
                      <dt>Insecure forwarding</dt>
                      <dd>Shares expire, can be revoked, and every view is written to the audit trail.</dd>
                    </div>
                  </dl>
                  <p className="fineprint">
                    Built for the IIITDM HealthTech brief, &ldquo;Lost in Transit&rdquo;.
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === 'upload' && <UploadTab state={state} update={update} />}
        {tab === 'meds' && <MedsTab state={state} update={update} />}
        {tab === 'share' && <ShareTab state={state} update={update} />}
        {tab === 'emergency' && <EmergencyTab state={state} />}
      </div>
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
    const known = ['HbA1c', 'Creatinine', 'LDL', 'TSH', 'FastingGlucose']
    const hit = known.find((k) => (form.title + form.notes).toLowerCase().includes(k.toLowerCase()))
    if (hit) {
      const res = findRecentSameTest(state.records, hit, form.date)
      if (res.candidates.length) setDupWarn({ test: hit, ...res })
      else setDupWarn(null)
    }
  }

  const save = () => {
    if (!form.title || !form.date) { alert('Add at least a title and a date.'); return }
    const rec = {
      id: uid('rec'),
      type: form.type,
      date: form.date,
      provider: form.provider || 'Added by patient',
      title: form.title,
      conditions: [],
      notes: form.notes || (parsed ? `AI parse: ${parsed.extracted} (confidence ${(parsed.confidence * 100).toFixed(0)}%)` : 'Manual entry'),
      source: form.fileName ? `File: ${form.fileName}` : 'Manual entry'
    }
    const next = { ...state, records: [rec, ...state.records] }
    addAudit(next, `Added record: ${rec.title} (${rec.type}, ${rec.date})`)
    update(next)
    setForm({ type: 'lab', date: new Date().toISOString().slice(0, 10), provider: '', title: '', notes: '', fileName: '' })
    setParsed(null); setDupWarn(null)
    alert('Saved to your chart.')
  }

  return (
    <div className="stack split">
      <section className="panel">
        <div className="panel-head">
          <h2>Add a record</h2>
          <span className="hint">photo, PDF or typed</span>
        </div>
        <div className="panel-pad">
          <p className="fineprint" style={{ marginTop: 0 }}>
            The brief rules out hospital integrations, so extraction is simulated. Everything you add
            lands in the same chart as everything else.
          </p>

          <div className="field">
            <label htmlFor="f-file">File name</label>
            <input id="f-file" value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="lab-hba1c-october.pdf" />
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <div>
              <label htmlFor="f-type">Type</label>
              <select id="f-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="lab">Lab report</option>
                <option value="prescription">Prescription</option>
                <option value="scan">Scan</option>
                <option value="discharge">Discharge summary</option>
                <option value="note">Note</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-date">Date</label>
              <input id="f-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-provider">Provider</label>
            <input id="f-provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Apollo Labs, Bengaluru" />
          </div>

          <div className="field">
            <label htmlFor="f-title">Title</label>
            <input id="f-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="HbA1c 6.9% — routine" />
          </div>

          <div className="field">
            <label htmlFor="f-notes">Notes</label>
            <textarea id="f-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Symptoms, dosage, advice given." />
          </div>

          <div className="btn-row">
            <button className="btn quiet" onClick={preview}>Simulate AI parse</button>
            <button className="btn" onClick={save}>Save to chart</button>
          </div>

          {parsed && (
            <div className="notice" style={{ marginTop: 18 }}>
              <span className="lead">Extracted (simulated)</span>
              Read as <b>{parsed.type}</b>. {parsed.extracted}. Confidence {(parsed.confidence * 100).toFixed(0)}%.
            </div>
          )}

          {dupWarn && (
            <div className="notice flag" style={{ marginTop: 10 }}>
              <span className="lead">You already have this test</span>
              {dupWarn.test} was done <b>{dupWarn.candidates[0].diffDays} days ago</b> ({dupWarn.candidates[0].record.date},
              {' '}{dupWarn.candidates[0].record.provider}, result {dupWarn.candidates[0].record.labs[dupWarn.test]}).
              The window for this test is {dupWarn.windowDays} days — share the earlier result instead.
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>What happens when you save</h2></div>
        <div className="panel-pad">
          <dl className="deflist">
            <div>
              <dt>Normalise</dt>
              <dd>Date, provider and type are set so the entry sorts with the rest.</dd>
            </div>
            <div>
              <dt>Plot</dt>
              <dd>Any lab values feed the trend charts automatically.</dd>
            </div>
            <div>
              <dt>Check for repeats</dt>
              <dd>The duplicate-test rule runs against the whole chart.</dd>
            </div>
            <div>
              <dt>Check medicines</dt>
              <dd>New medicines are run through the interaction checker.</dd>
            </div>
            <div>
              <dt>Log it</dt>
              <dd>The action is written to the audit trail.</dd>
            </div>
          </dl>
          <p className="fineprint">
            This demo keeps everything in your browser. Use the emergency card to export a JSON copy
            before you move cities.
          </p>
        </div>
      </section>
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
      if (!confirm(`High-risk interaction:\n\n${hits.map((h) => h.msg).join('\n\n')}\n\nAdd it anyway?`)) return
    }
    const next = {
      ...state,
      patient: {
        ...state.patient,
        currentMeds: [...state.patient.currentMeds, { name: name.trim(), dose: dose || '—', freq: 'as advised', since: new Date().toISOString().slice(0, 10) }]
      }
    }
    addAudit(next, `Medication added: ${name} ${dose}${hits.length ? ` (${hits.length} interaction flag)` : ''}`)
    update(next); setName(''); setDose('')
  }

  const remove = (n) => {
    const next = { ...state, patient: { ...state.patient, currentMeds: state.patient.currentMeds.filter((m) => m.name !== n) } }
    addAudit(next, `Medication stopped: ${n}`)
    update(next)
  }

  return (
    <div className="stack split">
      <section className="panel">
        <div className="panel-head">
          <h2>Current medicines</h2>
          <span className="hint">the list an ER needs</span>
        </div>
        <div className="panel-pad">
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th>Medicine</th><th>Dose</th><th>Started</th><th></th></tr>
              </thead>
              <tbody>
                {state.patient.currentMeds.map((m) => (
                  <tr key={m.name}>
                    <td><b>{m.name}</b><div className="sub">{m.freq}</div></td>
                    <td className="num">{m.dose}</td>
                    <td className="num">{m.since}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn quiet small" onClick={() => remove(m.name)}>Stop</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {existing.length > 0 && (
            <div className="notice crit" style={{ marginTop: 18 }}>
              <span className="lead">Conflict already on this list</span>
              {existing.map((e) => e.msg).join(' ')}
            </div>
          )}

          <div className="field" style={{ marginTop: 24, paddingTop: 22, borderTop: '1px solid var(--rule)' }}>
            <label htmlFor="m-name">Check and add a medicine</label>
            <p className="fineprint" style={{ marginTop: 0 }}>Try &ldquo;Ibuprofen&rdquo; to see the conflict the chart catches.</p>
            <div className="row" style={{ marginTop: 12 }}>
              <input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ibuprofen" />
              <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose, e.g. 400mg" aria-label="Dose" />
            </div>

            {previewHits.length > 0 && (
              <div className="notice crit" style={{ marginTop: 14 }}>
                <span className="lead">Would interact</span>
                {previewHits.map((h) => h.msg).join(' ')}
              </div>
            )}
            {name && previewHits.length === 0 && (
              <div className="notice ok" style={{ marginTop: 14 }}>
                <span className="lead">No conflict found</span>
                No known interaction with the current list in the demo rules.
              </div>
            )}

            <div className="btn-row">
              <button className="btn" onClick={add} disabled={!name.trim()}>Add medicine</button>
            </div>
          </div>

          <p className="fineprint">
            Allergies on file: <b>{state.patient.allergies.join(', ')}</b>. Shown to every doctor
            and on the emergency card.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>How this prevents harm</h2></div>
        <div className="panel-pad">
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-80)' }}>
            In August 2023, CityCare Clinic treated a fever with Ibuprofen. Nobody there knew about
            the Telmisartan started five months earlier, because that prescription was a photo on a
            different phone. This chart flags the pair before it is taken.
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-80)', marginTop: 14 }}>
            Duplicate tests are checked against per-test windows — HbA1c 90 days, creatinine 60,
            LDL 120. A doctor who orders an HbA1c three weeks after one already exists gets a nudge
            to open the existing result.
          </p>
          <div className="notice flag" style={{ marginTop: 18 }}>
            <span className="lead">Scope</span>
            The rule set here is illustrative. A real deployment would check against an approved
            drug database and clinical decision support rules.
          </div>
        </div>
      </section>
    </div>
  )
}

function ShareTab({ state, update }) {
  const [label, setLabel] = useState('')
  const [hours, setHours] = useState(24)
  const [ids, setIds] = useState(state.records.slice(0, 3).map((r) => r.id))
  const [lastToken, setLastToken] = useState('')
  const [noteCode, setNoteCode] = useState('')
  const [noteMsg, setNoteMsg] = useState(null)
  const [toast, setToast] = useState('')

  const toggle = (id) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

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
    const chosen = state.records.filter((r) => ids.includes(r.id))
    const token = makeShareToken({ share, patient: state.patient, records: chosen })
    const next = { ...state, shares: [share, ...state.shares] }
    addAudit(next, `Share created: ${share.label} (${ids.length} records, ${hours}h)`)
    update(next); setLastToken(token); setLabel('')
    flash('Link created')
  }

  const copyLink = async () => {
    const url = shareUrl(lastToken)
    try {
      await navigator.clipboard.writeText(url)
      flash('Link copied')
    } catch {
      flash('Copy failed — select the link and copy it manually')
    }
  }

  const revoke = (id) => {
    const next = { ...state, shares: state.shares.map((s) => (s.id === id ? { ...s, revoked: true } : s)) }
    addAudit(next, `Share revoked: ${id}`)
    update(next)
    flash('Access revoked')
  }

  const importNote = () => {
    const d = decodeNoteCode(noteCode)
    if (!d.ok) { setNoteMsg({ ok: false, text: d.message }); return }
    if (state.records.some((r) => r.id === d.record.id)) {
      setNoteMsg({ ok: false, text: 'That note is already in your timeline.' }); return
    }
    const rec = { ...d.record, conditions: d.record.conditions || [] }
    const next = { ...state, records: [rec, ...state.records] }
    addAudit(next, `Imported note from doctor: ${rec.title}`)
    update(next)
    setNoteCode('')
    setNoteMsg({ ok: true, text: `Added "${rec.title}" to your timeline from ${rec.provider}.` })
    flash('Note added')
  }

  const url = lastToken ? shareUrl(lastToken) : ''

  return (
    <div className="stack split">
      <div className="stack-tight">
        <section className="panel">
          <div className="panel-head">
            <h2>Create a share</h2>
            <span className="hint">works on any device</span>
          </div>
          <div className="panel-pad">
            <div className="field">
              <label htmlFor="s-label">Who it is for</label>
              <input id="s-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Dr. Iyer, diabetes review" />
            </div>

            <div className="field">
              <label htmlFor="s-exp">Expires after</label>
              <select id="s-exp" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {expiryOptions().map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
              </select>
            </div>

            <div className="field">
              <span className="field-label">Records to include — {ids.length} selected</span>
              <div className="picker">
                {[...state.records].sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => (
                  <label key={r.id} className="checkline">
                    <input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} />
                    <span><b>{r.date}</b> — {r.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="btn-row">
              <button className="btn" onClick={create}>Create expiring link</button>
            </div>

            {lastToken && (
              <div className="notice ok" style={{ marginTop: 18 }}>
                <span className="lead">Link ready</span>
                The records travel inside the link itself, so it opens on a phone or another laptop even
                if that device has never seen MediThread.
                <span className="mono-hint wordwrap" style={{ display: 'block', color: 'var(--ink-80)', marginTop: 8 }}>{url}</span>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn quiet small" onClick={copyLink}>Copy link</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Receive a note from a doctor</h2>
            <span className="hint">paste a note code</span>
          </div>
          <div className="panel-pad">
            <p className="fineprint" style={{ marginTop: 0 }}>
              MediThread has no server, so a doctor cannot write into your chart directly. They send you
              a note code instead — paste it here and it joins your timeline.
            </p>
            <div className="field">
              <label htmlFor="s-note">Note code</label>
              <textarea
                id="s-note"
                value={noteCode}
                onChange={(e) => { setNoteCode(e.target.value); setNoteMsg(null) }}
                placeholder="mtn1:..."
              />
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn quiet" onClick={importNote} disabled={!noteCode.trim()}>Add to my timeline</button>
            </div>
            {noteMsg && (
              <div className={`notice ${noteMsg.ok ? 'ok' : 'crit'}`} style={{ marginTop: 14 }}>
                <span className="lead">{noteMsg.ok ? 'Added' : 'Cannot import'}</span>
                {noteMsg.text}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="stack-tight">
        <section className="panel">
          <div className="panel-head"><h2>Shares</h2></div>
          <div className="panel-pad">
            {state.shares.length === 0 ? (
              <p className="fineprint" style={{ marginTop: 0 }}>No shares yet. Create one to hand a doctor exactly what they need.</p>
            ) : (
              <div className="scroll-x">
                <table>
                  <thead><tr><th>Purpose</th><th>Status</th><th>Views</th><th></th></tr></thead>
                  <tbody>
                    {state.shares.map((s) => {
                      const expired = new Date(s.expiresAt) < new Date()
                      return (
                        <tr key={s.id}>
                          <td><b>{s.label}</b><div className="sub">{s.recordIds.length} records</div></td>
                          <td>
                            <span className={`st ${s.revoked ? 'killed' : expired ? 'dead' : 'live'}`}>
                              {s.revoked ? 'Revoked' : expired ? 'Expired' : 'Live'}
                            </span>
                            <div className="sub num">{new Date(s.expiresAt).toLocaleString()}</div>
                          </td>
                          <td className="num">{s.accesses}</td>
                          <td style={{ textAlign: 'right' }}>
                            {!s.revoked && <button className="btn quiet small" onClick={() => revoke(s.id)}>Revoke</button>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="notice flag" style={{ marginTop: 18 }}>
              <span className="lead">About revoking</span>
              {REVOCATION_CAVEAT} Until the link expires on its own, revoking blocks it in this browser only.
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Access log</h2><span className="hint">{state.audit.length} entries</span></div>
          <div className="panel-pad">
            {state.audit.length === 0 ? (
              <p className="fineprint" style={{ marginTop: 0 }}>Nothing has been opened or changed yet.</p>
            ) : (
              <div style={{ maxHeight: 240, overflow: 'auto' }}>
                {state.audit.map((a, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--rule-2)' }}>
                    <span className="mono-hint">{new Date(a.at).toLocaleString()}</span>
                    <div style={{ marginTop: 3, fontSize: 13 }}>{a.event}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function shareUrl(token) {
  return `${location.origin}${location.pathname}#/shared/${token}`
}

function EmergencyTab({ state }) {
  const erUrl = `${location.origin}${location.pathname}#/emergency`
  const p = state.patient

  return (
    <div className="stack split">
      <section>
        <div className="ercard">
          <p className="kicker" style={{ color: 'var(--stamp)' }}>Emergency card</p>
          <h2>{p.name}</h2>
          <p className="meta">{p.age} years, {p.sex}. {p.city}.</p>
          <p className="big">{p.bloodGroup}</p>
          <p className="mono-hint">blood group</p>

          <dl>
            <div className="rowline">
              <dt>Conditions</dt>
              <dd>{p.conditions.join(', ')}</dd>
            </div>
            <div className="rowline">
              <dt>Allergies</dt>
              <dd><b>{p.allergies.join(', ')}</b></dd>
            </div>
            <div className="rowline">
              <dt>Medicines</dt>
              <dd>{p.currentMeds.map((m) => `${m.name} ${m.dose}, ${m.freq}`).join(' · ')}</dd>
            </div>
            <div className="rowline">
              <dt>Contact</dt>
              <dd>{p.emergencyContact}</dd>
            </div>
            <div className="rowline">
              <dt>ER PIN</dt>
              <dd><code className="inline">{p.emergencyPin}</code></dd>
            </div>
          </dl>
        </div>

        <div className="btn-row">
          <button className="btn quiet" onClick={() => {
            const blob = new Blob([JSON.stringify({ patient: p, records: state.records }, null, 2)], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'medithread-chart.json'
            a.click()
          }}>Export the chart as JSON</button>
          <button className="btn quiet" onClick={() => window.print()}>Print this card</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Carry it on your phone</h2>
          <span className="hint">scan to open</span>
        </div>
        <div className="panel-pad">
          <div className="qrbox">
            <QRCodeSVG value={erUrl} size={186} bgColor="#FCFCF9" fgColor="#151A17" />
          </div>
          <p className="fineprint wordwrap">{erUrl}</p>
          <p className="fineprint">
            Scanning opens the PIN-gated emergency view. No login, read only, and every open is logged.
            Demo PIN is <code className="inline">{p.emergencyPin}</code>.
          </p>
        </div>
      </section>
    </div>
  )
}