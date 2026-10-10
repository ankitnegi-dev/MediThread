import React, { useMemo, useState } from 'react'
import { LabChart, TimelineItem } from '../components/ui.jsx'
import { checkInteractions, checkExistingCombo, findRecentSameTest } from '../utils/medSafety.js'
import { validateFile, isImage, isPdf, pdfPreview, extractText, parseDocument, acceptAttr, SHARE_ATTACHMENT_LIMIT } from '../utils/extract.js'
import { putFile, getFileDataUrl } from '../utils/blobStore.js'
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

const emptyForm = () => ({
  type: 'lab',
  date: new Date().toISOString().slice(0, 10),
  provider: '',
  title: '',
  notes: '',
  fileName: ''
})

function UploadTab({ state, update }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [meds, setMeds] = useState([])
  const [dupWarn, setDupWarn] = useState(null)
  const [medWarn, setMedWarn] = useState([])
  const [toast, setToast] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = React.useRef(null)

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  const acceptFile = async (f) => {
    setError('')
    const v = validateFile(f)
    if (!v.ok) { setError(v.error); setFile(null); return }
    setFile(f)
    setDraft(null)
    setDupWarn(null)
    setMedWarn([])
    setForm({ ...emptyForm(), fileName: f.name, provider: form.provider })
    setPreview(isImage(f) ? URL.createObjectURL(f) : null)
    if (isPdf(f)) {
      const data = await pdfPreview(f)
      setPreview(data)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) acceptFile(f)
  }

  const runExtract = async () => {
    if (!file) return
    setError('')
    setBusy({ status: 'starting', progress: 0 })
    const out = await extractText(file, (status, progress) => setBusy({ status, progress }))
    setBusy(null)

    if (out.error) {
      setError(out.error)
      setDraft(null)
      setForm((f) => ({ ...f, notes: '' }))
      return
    }

    const parsed = parseDocument(out.text, file.name)
    setDraft({ ...parsed, method: out.method, confidence: out.confidence, raw: out.text })
    setMeds(parsed.meds)
    setForm((f) => ({
      ...f,
      type: parsed.type,
      date: parsed.date,
      provider: parsed.provider || f.provider,
      title: parsed.title,
      notes: parsed.ok ? `Extracted from ${file.name} (${out.method === 'ocr' ? 'OCR' : 'PDF text layer'}).` : ''
    }))

    if (!parsed.ok) {
      setError('We could not read any values out of that file. Fill the form in yourself — everything below is editable.')
    }
    checkDuplicates(parsed.labs, parsed.date)
  }

  const checkDuplicates = (labs, date) => {
    const hits = []
    for (const test of Object.keys(labs || {})) {
      const res = findRecentSameTest(state.records, test, date)
      if (res.candidates.length) hits.push({ test, ...res })
    }
    setDupWarn(hits.length ? hits : null)
  }

  const onSave = async () => {
    if (!form.title.trim()) { setError('Give the record a title before saving.'); return }
    setError('')

    let fileMeta = null
    if (file) {
      try {
        fileMeta = await putFile(file)
      } catch (e) {
        setError('The file could not be stored in this browser, so it was not saved. ' + (e.message || ''))
        return
      }
    }

    const labs = Object.fromEntries(
      Object.entries(draft?.labs || {}).filter(([, v]) => String(v).trim() !== '')
    )

    const rec = {
      id: uid('rec'),
      type: form.type,
      date: form.date,
      provider: form.provider || 'Added by patient',
      title: form.title.trim(),
      conditions: [],
      labs: Object.keys(labs).length ? labs : undefined,
      meds: meds.length ? meds : undefined,
      notes: form.notes,
      source: file ? `File: ${file.name}` : 'Typed in by patient',
      fileId: fileMeta?.id,
      fileName: fileMeta?.name || file?.name,
      fileSize: fileMeta?.size
    }

    const next = { ...state, records: [rec, ...state.records] }
    addAudit(next, `Added record: ${rec.title} (${rec.type}, ${rec.date})`)
    update(next)

    setFile(null); setPreview(null); setDraft(null); setMeds([]); setDupWarn(null); setMedWarn([])
    setForm(emptyForm())
    flash('Saved to your timeline')
  }

  const resetAll = () => {
    setFile(null); setPreview(null); setDraft(null); setMeds([]); setError('')
    setDupWarn(null); setMedWarn([]); setForm(emptyForm())
    if (inputRef.current) inputRef.current.value = ''
  }

  const fmtSize = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`)

  return (
    <div className="stack split">
      <section className="panel">
        <div className="panel-head">
          <h2>Add a record</h2>
          <span className="hint">pdf or photo</span>
        </div>
        <div className="panel-pad">
          {!file ? (
            <div
              className={`dropzone ${dragging ? 'over' : ''}`}
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
            >
              <input
                ref={inputRef}
                type="file"
                accept={acceptAttr}
                className="dropzone-input"
                onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
                aria-label="Choose a PDF, JPG, PNG or WEBP file"
              />
              <p className="dropzone-title">Drop a file here, or choose one</p>
              <p className="fineprint" style={{ marginTop: 6 }}>
                PDF, JPG, PNG or WEBP. Up to 10 MB. The file stays on this device — nothing is uploaded to a server.
              </p>
            </div>
          ) : (
            <div className="filepick">
              {preview ? <img src={preview} alt="" className="filepick-thumb" /> : <div className="filepick-thumb placeholder" aria-hidden="true" />}
              <div className="filepick-meta">
                <p className="filepick-name">{file.name}</p>
                <p className="mono-hint">{fmtSize(file.size)}{draft?.method ? ` · read via ${draft.method === 'ocr' ? 'OCR' : 'PDF text'}` : ''}</p>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  {!draft && (
                    <button className="btn small" onClick={runExtract} disabled={!!busy}>
                      {busy ? 'Reading…' : 'Read this document'}
                    </button>
                  )}
                  <button className="btn quiet small" onClick={resetAll}>Remove</button>
                </div>
              </div>
            </div>
          )}

          {busy && (
            <div className="progress" style={{ marginTop: 16 }}>
              <div className="progress-head">
                <span className="mono-hint">{busy.status}</span>
                <span className="mono-hint">{Math.round((busy.progress || 0) * 100)}%</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(4, (busy.progress || 0) * 100)}%` }} /></div>
              <p className="fineprint" style={{ marginTop: 8 }}>
                First run downloads the OCR language packs (English, हिन्दी, தமிழ்). After that it works offline.
              </p>
            </div>
          )}

          {error && (
            <div className="notice flag" style={{ marginTop: 16 }} role="alert">
              <span className="lead">{draft ? 'Could not read it' : 'Check the file'}</span>
              {error}
            </div>
          )}

          {draft && !error && (
            <div className="notice ok" style={{ marginTop: 16 }}>
              <span className="lead">Read the document</span>
              Found {draft.found} item{draft.found === 1 ? '' : 's'}.
              {draft.confidence != null && ` OCR confidence ${Math.round(draft.confidence)}%.`}
              {' '}Check it below and correct anything that looks wrong — nothing is saved until you confirm.
            </div>
          )}

          <h3 className="subhead" style={{ marginTop: 26 }}>Review before saving</h3>

          <div className="row">
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

          {draft && Object.keys(draft.labs).length > 0 && (
            <div className="field">
              <span className="field-label">Values found — edit any of them</span>
              <div className="labs">
                {Object.entries(draft.labs).map(([k, v]) => (
                  <div className="labs-row" key={k}>
                    <span className="k">{k}</span>
                    <input
                      className="labs-edit"
                      value={String(v)}
                      aria-label={`${k} value`}
                      onChange={(e) => setDraft({ ...draft, labs: { ...draft.labs, [k]: e.target.value } })}
                    />
                    <button
                      className="labs-del"
                      aria-label={`Remove ${k}`}
                      onClick={() => {
                        const nextLabs = { ...draft.labs }
                        delete nextLabs[k]
                        setDraft({ ...draft, labs: nextLabs })
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn quiet small" style={{ marginTop: 10 }} onClick={() => setDraft({ ...draft, labs: { ...draft.labs, '': '' } })}>
                Add a value
              </button>
            </div>
          )}

          {meds.length > 0 && (
            <div className="field">
              <span className="field-label">Medicines found in the document</span>
              <div className="meds">
                {meds.map((m) => <span key={m.name}>{m.name} <b>{m.dose}</b> · {m.freq}</span>)}
              </div>
              <p className="fineprint">
                Saved onto the record only. They are checked against your current list below — they are not
                added to your medicines until you do that yourself.
              </p>
            </div>
          )}

          {meds.length > 0 && (
            <div className="notice-stack">
              {(() => {
                const hits = meds.flatMap((m) => checkInteractions(state.patient.currentMeds, m.name).map((h) => `${m.name}: ${h.msg}`))
                if (!hits.length) return null
                const list = [...new Set(hits)]
                return (
                  <div className="notice crit">
                    <span className="lead">Check with your doctor</span>
                    {list.join(' ')}
                  </div>
                )
              })()}
            </div>
          )}

          <div className="field">
            <label htmlFor="f-notes">Notes</label>
            <textarea id="f-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Symptoms, advice, anything the doctor said." />
          </div>

          {dupWarn && (
            <div className="notice flag" style={{ marginTop: 18 }}>
              <span className="lead">You already have {dupWarn.length === 1 ? 'this test' : 'these tests'}</span>
              {dupWarn.map((d) => (
                <div key={d.test} style={{ marginTop: 4 }}>
                  <b>{d.test}</b> was done {d.candidates[0].diffDays} days ago ({d.candidates[0].record.date},
                  {' '}{d.candidates[0].record.provider}, result {d.candidates[0].record.labs[d.test]}).
                  The window for this test is {d.windowDays} days — sharing the earlier result is cheaper than repeating it.
                </div>
              ))}
            </div>
          )}

          <div className="btn-row">
            <button className="btn" onClick={onSave}>Save to timeline</button>
            {!file && <span className="fineprint" style={{ alignSelf: 'center', marginTop: 0 }}>Typed-in record, no file attached.</span>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>How the file is handled</h2></div>
        <div className="panel-pad">
          <dl className="deflist">
            <div>
              <dt>Stays on this device</dt>
              <dd>The file goes into your browser&rsquo;s IndexedDB. Nothing is sent anywhere.</dd>
            </div>
            <div>
              <dt>Read in the browser</dt>
              <dd>Text PDFs are read from their text layer. Photos and scanned PDFs go through OCR in English, हिन्दी and தமிழ்.</dd>
            </div>
            <div>
              <dt>You check the result</dt>
              <dd>Recognised values, dates and medicines are a draft. Nothing is saved until you confirm it.</dd>
            </div>
            <div>
              <dt>Checked against your chart</dt>
              <dd>On confirm, the duplicate-test guard and the interaction checker both run.</dd>
            </div>
            <div>
              <dt>Size matters when sharing</dt>
              <dd>A shared link carries the original file only if it is under {SHARE_ATTACHMENT_LIMIT / 1024} KB. Bigger files share the extracted values and say so.</dd>
            </div>
          </dl>
          <p className="fineprint">
            OCR is not perfect. Always check the recognised numbers against the document before saving.
          </p>
        </div>
      </section>

      {toast && <div className="toast" role="status">{toast}</div>}
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

  const create = async () => {
    if (!ids.length) { alert('Select at least one record.'); return }
    const share = {
      id: uid('share'),
      label: label || `Share ${new Date().toLocaleString()}`,
      recordIds: ids,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
      revoked: false, accesses: 0, purpose: label
    }

    // Attach the original only when it is small enough to keep the link usable.
    const picked = state.records.filter((r) => ids.includes(r.id))
    const chosen = await Promise.all(picked.map(async (r) => {
      if (!r.fileId) return r
      if ((r.fileSize || 0) > SHARE_ATTACHMENT_LIMIT) return { ...r, docOmitted: true }
      try {
        const dataUrl = await getFileDataUrl(r.fileId)
        if (!dataUrl) return { ...r, docOmitted: true }
        return { ...r, doc: { name: r.fileName, dataUrl } }
      } catch {
        return { ...r, docOmitted: true }
      }
    }))

    const omitted = chosen.filter((r) => r.docOmitted).length
    const token = makeShareToken({ share, patient: state.patient, records: chosen })
    const next = { ...state, shares: [share, ...state.shares] }
    addAudit(next, `Share created: ${share.label} (${ids.length} records, ${hours}h${omitted ? `, ${omitted} file(s) omitted` : ''})`)
    update(next)
    setLastToken({ token, omitted })
    setLabel('')
    flash('Link created')
  }

  const copyLink = async () => {
    const url = shareUrl(lastToken.token)
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

  const url = lastToken ? shareUrl(lastToken.token) : ''

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
                {lastToken.omitted > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {lastToken.omitted} attached file{lastToken.omitted === 1 ? ' was' : 's were'} over{' '}
                    {SHARE_ATTACHMENT_LIMIT / 1024} KB, so the extracted values are shared but the originals are not.
                  </div>
                )}
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