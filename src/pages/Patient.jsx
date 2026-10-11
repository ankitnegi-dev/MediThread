import React, { useMemo, useState } from 'react'
import { LabChart, TimelineItem } from '../components/ui.jsx'
import { checkInteractions, checkExistingCombo, findRecentSameTest } from '../utils/medSafety.js'
import { validateFile, isImage, isPdf, pdfPreview, extractText, parseDocument, acceptAttr, SHARE_ATTACHMENT_LIMIT } from '../utils/extract.js'
import { putFile, getFileDataUrl } from '../utils/blobStore.js'
import { addAudit } from '../utils/store.js'
import { expiryOptions, makeShareToken, decodeNoteCode, REVOCATION_CAVEAT } from '../utils/share.js'
import { QRCodeSVG } from 'qrcode.react'
import { useT, useLang } from '../i18n/index.jsx'
import { EmergencyCard } from '../components/EmergencyCard.jsx'
import { ClinicianSummary } from '../components/ClinicianSummary.jsx'
import { CardOnlyView } from '../components/CardOnlyView.jsx'
import { tryPrint, mobilePrintUnsupported } from '../utils/print.js'

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`

const SECTIONS = [
  { key: 'timeline', labelKey: 'tab.timeline' },
  { key: 'meds', labelKey: 'tab.meds' },
  { key: 'share', labelKey: 'tab.share' },
  { key: 'emergency', labelKey: 'tab.emergency' },
  { key: 'upload', labelKey: 'tab.upload' }
]

export default function Patient({ state, setState }) {
  const t = useT()
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
          <p className="kicker">{t('chart.kicker')}</p>
          <h1>{p.name}</h1>
          <p className="meta">
            {t('chart.age', { age: p.age, sex: p.sex })}. {t('chart.blood', { group: p.bloodGroup })}. {p.city}.<br />
            {p.conditions.join(', ')}.
          </p>
        </div>

        <dl className="figures">
          <div>
            <dt>{t('chart.records')}</dt>
            <dd>{state.records.length}</dd>
            <p>{t('chart.recordsSub', { n: providers })}</p>
          </div>
          <div>
            <dt>{t('chart.medicines')}</dt>
            <dd>{p.currentMeds.length}</dd>
            <p>{t('chart.medicinesSub', { n: p.conditions.length })}</p>
          </div>
          <div>
            <dt>{t('chart.shares')}</dt>
            <dd>{liveShares}</dd>
            <p>{t('chart.sharesSub')}</p>
          </div>
        </dl>
      </header>

      <nav className="filters" style={{ marginTop: 30 }} role="tablist" aria-label={t('chart.kicker')}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            role="tab"
            id={`tab-${s.key}`}
            aria-selected={tab === s.key}
            aria-controls={`panel-${s.key}`}
            onClick={() => setTab(s.key)}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 34 }}>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'timeline' && (
          <div className="stack split">
            <div>
              {selected && (
                <section className="panel" style={{ marginBottom: 26 }}>
                  <div className="panel-head">
                    <h3>{selected.title}</h3>
                    <button className="btn quiet small" onClick={() => setSelected(null)}>{t('common.close')}</button>
                  </div>
                  <div className="panel-pad">
                    <p className="mono-hint">{selected.date} - {selected.provider}</p>
                    <p className="notes" style={{ marginTop: 12 }}>{selected.notes}</p>
                  </div>
                </section>
              )}

              <div className="row" style={{ marginBottom: 22 }}>
                <input
                  placeholder={t('timeline.searchPh')}
                  aria-label={t('timeline.searchLabel')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="filters" style={{ marginBottom: 8 }}>
                {['all', 'lab', 'prescription', 'scan', 'discharge'].map((x) => (
                  <button key={x} aria-pressed={typeFilter === x} onClick={() => setTypeFilter(x)}>
                    {x === 'all' ? t('typeFilter.all') : t(`type.${x}`)}
                  </button>
                ))}
              </div>

              <h2 className="sec-title" style={{ marginTop: 22 }}>
                {t('timeline.title')}
                <span className="hint">{t('timeline.count', { shown: filtered.length, total: state.records.length })}</span>
              </h2>

              {filtered.length === 0 ? (
                <div className="notice flag">
                  <span className="lead">{t('timeline.emptyTitle')}</span>
                  {t('timeline.emptyBody')}
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
                  <h2>{t('labs.title')}</h2>
                  <span className="hint">{t('labs.hint')}</span>
                </div>
                <div className="panel-pad">
                  <LabChart records={state.records} test="HbA1c" target={7} unit="%" />
                  <div style={{ marginTop: 24 }}>
                    <LabChart records={state.records} test="Creatinine" target={1.2} unit="mg/dL" />
                  </div>
                </div>
              </section>

              <section>
                <div className="btn-row" style={{ marginTop: 0 }}>
                  <button className="btn quiet small" onClick={() => window.print()}>{t('summary.printBtn')}</button>
                </div>
                <ClinicianSummary patient={p} records={state.records} />
              </section>

              <section className="panel">
                <div className="panel-head"><h2>{t('demo.title')}</h2></div>
                <div className="panel-pad">
                  <dl className="deflist">
                    <div><dt>{t('demo.lost')}</dt><dd>{t('demo.lostBody')}</dd></div>
                    <div><dt>{t('demo.recall')}</dt><dd>{t('demo.recallBody')}</dd></div>
                    <div><dt>{t('demo.repeats')}</dt><dd>{t('demo.repeatsBody')}</dd></div>
                    <div><dt>{t('demo.insecure')}</dt><dd>{t('demo.insecureBody')}</dd></div>
                  </dl>
                  <p className="fineprint">{t('demo.note')}</p>
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
  const t = useT()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [meds, setMeds] = useState([])
  const [dupWarn, setDupWarn] = useState(null)
  const [toast, setToast] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = React.useRef(null)

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  const acceptFile = async (f) => {
    setError('')
    const v = validateFile(f)
    if (!v.ok) { setError(v.error); setFile(null); return }
    setFile(f); setDraft(null); setDupWarn(null)
    setForm((cur) => ({ ...emptyForm(), fileName: f.name, provider: cur.provider }))
    setPreview(isImage(f) ? URL.createObjectURL(f) : null)
    if (isPdf(f)) setPreview(await pdfPreview(f))
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) acceptFile(f)
  }

  const checkDuplicates = (labs, date) => {
    const hits = []
    for (const test of Object.keys(labs || {})) {
      if (!String(labs[test]).trim()) continue
      const res = findRecentSameTest(state.records, test, date)
      if (res.candidates.length) hits.push({ test, ...res })
    }
    setDupWarn(hits.length ? hits : null)
  }

  const runExtract = async () => {
    if (!file) return
    setError('')
    setBusy({ status: 'starting', progress: 0 })
    const out = await extractText(file, (status, progress) => setBusy({ status, progress }))
    setBusy(null)

    if (out.error) { setError(out.error); setDraft(null); return }

    const parsed = parseDocument(out.text, file.name)
    setDraft({ ...parsed, method: out.method, confidence: out.confidence })
    setMeds(parsed.meds)
    setForm((cur) => ({
      ...cur,
      type: parsed.type,
      date: parsed.date,
      provider: parsed.provider || cur.provider,
      title: parsed.title,
      notes: parsed.ok ? `Extracted from ${file.name} (${out.method === 'ocr' ? 'OCR' : 'PDF text layer'}).` : ''
    }))
    if (!parsed.ok) setError(t('upload.errNoValues'))
    checkDuplicates(parsed.labs, parsed.date)
  }

  const onSave = async () => {
    if (!form.title.trim()) { setError(t('upload.needTitle')); return }
    setError('')

    let fileMeta = null
    if (file) {
      try {
        fileMeta = await putFile(file)
      } catch (e) {
        setError(`${t('upload.errStore')} ${e.message || ''}`)
        return
      }
    }

    const labs = Object.fromEntries(Object.entries(draft?.labs || {}).filter(([, v]) => String(v).trim() !== ''))

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

    setFile(null); setPreview(null); setDraft(null); setMeds([]); setDupWarn([]); setError('')
    setForm(emptyForm())
    if (inputRef.current) inputRef.current.value = ''
    flash(t('toast.saved'))
  }

  const resetAll = () => {
    setFile(null); setPreview(null); setDraft(null); setMeds([]); setError(''); setDupWarn(null)
    setForm(emptyForm())
    if (inputRef.current) inputRef.current.value = ''
  }

  const fmtSize = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`)

  const medHits = meds.flatMap((m) => checkInteractions(state.patient.currentMeds, m.name).map((h) => `${m.name}: ${h.msg}`))

  return (
    <div className="stack split">
      <section className="panel">
        <div className="panel-head">
          <h2>{t('upload.title')}</h2>
          <span className="hint">{t('upload.hint')}</span>
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
                aria-label={t('upload.drop')}
              />
              <p className="dropzone-title">{t('upload.drop')}</p>
              <p className="fineprint" style={{ marginTop: 6 }}>{t('upload.dropBody')}</p>
            </div>
          ) : (
            <div className="filepick">
              {preview
                ? <img src={preview} alt="" className="filepick-thumb" />
                : <div className="filepick-thumb placeholder" aria-hidden="true" />}
              <div className="filepick-meta">
                <p className="filepick-name">{file.name}</p>
                <p className="mono-hint">
                  {fmtSize(file.size)}{draft?.method ? ` · ${draft.method === 'ocr' ? 'OCR' : 'PDF text'}` : ''}
                </p>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  {!draft && (
                    <button className="btn small" onClick={runExtract} disabled={!!busy}>
                      {busy ? t('upload.reading') : t('upload.read')}
                    </button>
                  )}
                  <button className="btn quiet small" onClick={resetAll}>{t('upload.remove')}</button>
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
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.max(4, (busy.progress || 0) * 100)}%` }} />
              </div>
              <p className="fineprint" style={{ marginTop: 8 }}>{t('upload.progressNote')}</p>
            </div>
          )}

          {error && (
            <div className="notice flag" style={{ marginTop: 16 }} role="alert">
              <span className="lead">{draft ? t('upload.cantRead') : t('upload.checkFile')}</span>
              {error}
            </div>
          )}

          {draft && !error && (
            <div className="notice ok" style={{ marginTop: 16 }}>
              <span className="lead">{t('upload.readOk')}</span>
              {t('upload.readOkBody', { n: draft.found })}
            </div>
          )}

          <h3 className="subhead" style={{ marginTop: 26 }}>{t('upload.review')}</h3>

          <div className="row">
            <div>
              <label htmlFor="f-type">{t('upload.type')}</label>
              <select id="f-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="lab">{t('type.lab')}</option>
                <option value="prescription">{t('type.prescription')}</option>
                <option value="scan">{t('type.scan')}</option>
                <option value="discharge">{t('type.discharge')}</option>
                <option value="note">{t('type.note')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-date">{t('upload.date')}</label>
              <input id="f-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-provider">{t('upload.provider')}</label>
            <input id="f-provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Apollo Labs, Bengaluru" />
          </div>

          <div className="field">
            <label htmlFor="f-title">{t('upload.titleF')}</label>
            <input id="f-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="HbA1c 6.9% - routine" />
          </div>

          {draft && Object.keys(draft.labs).length > 0 && (
            <div className="field">
              <span className="field-label">{t('upload.values')}</span>
              <div className="labs">
                {Object.entries(draft.labs).map(([k, v]) => (
                  <div className="labs-row" key={k}>
                    <span className="k">{k || '-'}</span>
                    <input
                      className="labs-edit"
                      value={String(v)}
                      aria-label={`${k} value`}
                      onChange={(e) => setDraft({ ...draft, labs: { ...draft.labs, [k]: e.target.value } })}
                    />
                    <button
                      className="labs-del"
                      aria-label={`Remove ${k || 'value'}`}
                      onClick={() => {
                        const nextLabs = { ...draft.labs }
                        delete nextLabs[k]
                        setDraft({ ...draft, labs: nextLabs })
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
              <button className="btn quiet small" style={{ marginTop: 10 }} onClick={() => setDraft({ ...draft, labs: { ...draft.labs, '': '' } })}>
                {t('upload.addValue')}
              </button>
            </div>
          )}

          {meds.length > 0 && (
            <div className="field">
              <span className="field-label">{t('upload.medsFoundLbl')}</span>
              <div className="meds">
                {meds.map((m) => <span key={m.name}>{m.name} <b>{m.dose}</b> · {m.freq}</span>)}
              </div>
              <p className="fineprint">{t('upload.medsFoundBody')}</p>
            </div>
          )}

          {medHits.length > 0 && (
            <div className="notice crit" style={{ marginTop: 16 }}>
              <span className="lead">{t('upload.checkDoctor')}</span>
              {[...new Set(medHits)].join(' ')}
            </div>
          )}

          <div className="field">
            <label htmlFor="f-notes">{t('upload.notes')}</label>
            <textarea id="f-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {dupWarn && (
            <div className="notice flag" style={{ marginTop: 18 }}>
              <span className="lead">
                {t('upload.dupTitle', { what: t(dupWarn.length === 1 ? 'upload.dupOne' : 'upload.dupMany') })}
              </span>
              {dupWarn.map((d) => (
                <div key={d.test} style={{ marginTop: 4 }}>
                  {t('upload.dupBody', {
                    test: d.test,
                    days: d.candidates[0].diffDays,
                    date: d.candidates[0].record.date,
                    provider: d.candidates[0].record.provider,
                    value: d.candidates[0].record.labs[d.test],
                    window: d.windowDays
                  })}
                </div>
              ))}
            </div>
          )}

          <div className="btn-row">
            <button className="btn" onClick={onSave}>{t('upload.save')}</button>
            {!file && <span className="fineprint" style={{ alignSelf: 'center', marginTop: 0 }}>{t('upload.typed')}</span>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>{t('upload.handleTitle')}</h2></div>
        <div className="panel-pad">
          <dl className="deflist">
            <div><dt>{t('upload.h1')}</dt><dd>{t('upload.h1b')}</dd></div>
            <div><dt>{t('upload.h2')}</dt><dd>{t('upload.h2b')}</dd></div>
            <div><dt>{t('upload.h3')}</dt><dd>{t('upload.h3b')}</dd></div>
            <div><dt>{t('upload.h4')}</dt><dd>{t('upload.h4b')}</dd></div>
            <div><dt>{t('upload.h5')}</dt><dd>{t('upload.h5b', { kb: SHARE_ATTACHMENT_LIMIT / 1024 })}</dd></div>
          </dl>
          <p className="fineprint">{t('upload.ocrCaveat')}</p>
        </div>
      </section>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function MedsTab({ state, update }) {
  const t = useT()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const existing = checkExistingCombo(state.patient.currentMeds)
  const previewHits = name ? checkInteractions(state.patient.currentMeds, name) : []

  const add = () => {
    if (!name.trim()) return
    const hits = checkInteractions(state.patient.currentMeds, name)
    if (hits.some((h) => h.level === 'high')) {
      if (!confirm(`${hits.map((h) => h.msg).join('\n\n')}\n\nAdd it anyway?`)) return
    }
    const next = {
      ...state,
      patient: {
        ...state.patient,
        currentMeds: [...state.patient.currentMeds, { name: name.trim(), dose: dose || '-', freq: 'as advised', since: new Date().toISOString().slice(0, 10) }]
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
          <h2>{t('meds.title')}</h2>
          <span className="hint">{t('meds.hint')}</span>
        </div>
        <div className="panel-pad">
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th>{t('meds.col1')}</th><th>{t('meds.col2')}</th><th>{t('meds.col3')}</th><th></th></tr>
              </thead>
              <tbody>
                {state.patient.currentMeds.map((m) => (
                  <tr key={m.name}>
                    <td><b>{m.name}</b><div className="sub">{m.freq}</div></td>
                    <td className="num">{m.dose}</td>
                    <td className="num">{m.since}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn quiet small" onClick={() => remove(m.name)}>{t('meds.stop')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {existing.length > 0 && (
            <div className="notice crit" style={{ marginTop: 18 }}>
              <span className="lead">{t('meds.conflict')}</span>
              {existing.map((e) => e.msg).join(' ')}
            </div>
          )}

          <div className="field" style={{ marginTop: 24, paddingTop: 22, borderTop: '1px solid var(--rule)' }}>
            <label htmlFor="m-name">{t('meds.checkAdd')}</label>
            <p className="fineprint" style={{ marginTop: 0 }}>{t('meds.tryIbuprofen')}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ibuprofen" aria-label={t('meds.nameLabel')} />
              <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="400mg" aria-label={t('meds.doseLabel')} />
            </div>

            {previewHits.length > 0 && (
              <div className="notice crit" style={{ marginTop: 14 }}>
                <span className="lead">{t('meds.wouldInteract')}</span>
                {previewHits.map((h) => h.msg).join(' ')}
              </div>
            )}
            {name && previewHits.length === 0 && (
              <div className="notice ok" style={{ marginTop: 14 }}>
                <span className="lead">{t('meds.clear')}</span>
                {t('meds.clearBody')}
              </div>
            )}

            <div className="btn-row">
              <button className="btn" onClick={add} disabled={!name.trim()}>{t('meds.add')}</button>
            </div>
          </div>

          <p className="fineprint">{t('meds.allergies', { list: state.patient.allergies.join(', ') })}</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>{t('meds.prevention')}</h2></div>
        <div className="panel-pad">
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-80)' }}>{t('meds.preventionBody')}</p>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-80)', marginTop: 14 }}>{t('meds.windows')}</p>
          <div className="notice flag" style={{ marginTop: 18 }}>
            <span className="lead">{t('meds.scope')}</span>
            {t('meds.scopeBody')}
          </div>
        </div>
      </section>
    </div>
  )
}

function ShareTab({ state, update }) {
  const t = useT()
  const [label, setLabel] = useState('')
  const [hours, setHours] = useState(24)
  const [ids, setIds] = useState(state.records.slice(0, 3).map((r) => r.id))
  const [lastToken, setLastToken] = useState(null)
  const [noteCode, setNoteCode] = useState('')
  const [noteMsg, setNoteMsg] = useState(null)
  const [toast, setToast] = useState('')

  const toggle = (id) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }
  const copy = async (text, okMsg) => {
    try { await navigator.clipboard.writeText(text); flash(t(okMsg)) }
    catch { flash(t('toast.copyFailed')) }
  }

  const create = async () => {
    if (!ids.length) { alert(t('err.selectOne')); return }
    const share = {
      id: uid('share'),
      label: label || `Share ${new Date().toLocaleString()}`,
      recordIds: ids,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
      revoked: false, accesses: 0, purpose: label
    }

    const picked = state.records.filter((r) => ids.includes(r.id))
    const chosen = await Promise.all(picked.map(async (r) => {
      if (!r.fileId) return r
      if ((r.fileSize || 0) > SHARE_ATTACHMENT_LIMIT) return { ...r, docOmitted: true }
      try {
        const dataUrl = await getFileDataUrl(r.fileId)
        return dataUrl ? { ...r, doc: { name: r.fileName, dataUrl } } : { ...r, docOmitted: true }
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
    flash(t('toast.linkCreated'))
  }

  const revoke = (id) => {
    const next = { ...state, shares: state.shares.map((s) => (s.id === id ? { ...s, revoked: true } : s)) }
    addAudit(next, `Share revoked: ${id}`)
    update(next)
    flash(t('toast.revoked'))
  }

  const importNote = () => {
    const d = decodeNoteCode(noteCode)
    if (!d.ok) { setNoteMsg({ ok: false, text: d.message }); return }
    if (state.records.some((r) => r.id === d.record.id)) {
      setNoteMsg({ ok: false, text: t('share.noteAddedBody', { title: d.record.title, provider: d.record.provider }) })
      return
    }
    const rec = { ...d.record, conditions: d.record.conditions || [] }
    const next = { ...state, records: [rec, ...state.records] }
    addAudit(next, `Imported note from doctor: ${rec.title}`)
    update(next)
    setNoteCode('')
    setNoteMsg({ ok: true, text: t('share.noteAddedBody', { title: rec.title, provider: rec.provider }) })
    flash(t('toast.noteAdded'))
  }

  const url = lastToken ? shareUrl(lastToken.token) : ''

  return (
    <div className="stack split">
      <div className="stack-tight">
        <section className="panel">
          <div className="panel-head">
            <h2>{t('share.title')}</h2>
            <span className="hint">{t('share.hint')}</span>
          </div>
          <div className="panel-pad">
            <div className="field">
              <label htmlFor="s-label">{t('share.who')}</label>
              <input id="s-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('share.whoPh')} />
            </div>

            <div className="field">
              <label htmlFor="s-exp">{t('share.expires')}</label>
              <select id="s-exp" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {expiryOptions().map((o) => <option key={o.hours} value={o.hours}>{t(`share.expiry${o.hours}`)}</option>)}
              </select>
            </div>

            <div className="field">
              <span className="field-label">{t('share.records', { n: ids.length })}</span>
              <div className="picker">
                {[...state.records].sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => (
                  <label key={r.id} className="checkline">
                    <input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} />
                    <span><b>{r.date}</b> - {r.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="btn-row">
              <button className="btn" onClick={create}>{t('share.create')}</button>
            </div>

            {lastToken && (
              <div className="notice ok" style={{ marginTop: 18 }}>
                <span className="lead">{t('share.ready')}</span>
                {t('share.readyBody')}
                {lastToken.omitted > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {t('share.omitted', { n: lastToken.omitted, kb: SHARE_ATTACHMENT_LIMIT / 1024 })}
                  </div>
                )}
                <span className="mono-hint wordwrap" style={{ display: 'block', color: 'var(--ink-80)', marginTop: 8 }}>{url}</span>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn quiet small" onClick={() => copy(url, 'toast.linkCopied')}>{t('share.copy')}</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('share.receive')}</h2>
            <span className="hint">{t('share.receiveHint')}</span>
          </div>
          <div className="panel-pad">
            <p className="fineprint" style={{ marginTop: 0 }}>{t('share.receiveBody')}</p>
            <div className="field">
              <label htmlFor="s-note">{t('share.noteLabel')}</label>
              <textarea id="s-note" value={noteCode} onChange={(e) => { setNoteCode(e.target.value); setNoteMsg(null) }} placeholder="mtn1:…" />
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn quiet" onClick={importNote} disabled={!noteCode.trim()}>{t('share.noteAdd')}</button>
            </div>
            {noteMsg && (
              <div className={`notice ${noteMsg.ok ? 'ok' : 'crit'}`} style={{ marginTop: 14 }}>
                <span className="lead">{t(noteMsg.ok ? 'share.noteAdded' : 'share.cannotImport')}</span>
                {noteMsg.text}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="stack-tight">
        <section className="panel">
          <div className="panel-head"><h2>{t('share.listTitle')}</h2></div>
          <div className="panel-pad">
            {state.shares.length === 0 ? (
              <p className="fineprint" style={{ marginTop: 0 }}>{t('share.noShares')}</p>
            ) : (
              <div className="scroll-x">
                <table>
                  <thead><tr><th>{t('share.colPurpose')}</th><th>{t('share.colStatus')}</th><th>{t('share.colViews')}</th><th></th></tr></thead>
                  <tbody>
                    {state.shares.map((s) => {
                      const expired = new Date(s.expiresAt) < new Date()
                      return (
                        <tr key={s.id}>
                          <td><b>{s.label}</b><div className="sub">{s.recordIds.length}</div></td>
                          <td>
                            <span className={`st ${s.revoked ? 'killed' : expired ? 'dead' : 'live'}`}>
                              {t(s.revoked ? 'share.stRevoked' : expired ? 'share.stExpired' : 'share.stLive')}
                            </span>
                            <div className="sub num">{new Date(s.expiresAt).toLocaleString()}</div>
                          </td>
                          <td className="num">{s.accesses}</td>
                          <td style={{ textAlign: 'right' }}>
                            {!s.revoked && <button className="btn quiet small" onClick={() => revoke(s.id)}>{t('share.revoke')}</button>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="notice flag" style={{ marginTop: 18 }}>
              <span className="lead">{t('share.revokeTitle')}</span>
              {t('share.revokeBody')}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>{t('share.accessLog')}</h2><span className="hint">{state.audit.length}</span></div>
          <div className="panel-pad">
            {state.audit.length === 0 ? (
              <p className="fineprint" style={{ marginTop: 0 }}>{t('share.noAccess')}</p>
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

function EmergencyTab({ state, update }) {
  const t = useT()
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')
  const [cardOnly, setCardOnly] = useState(false)
  const importRef = React.useRef(null)
  const erUrl = `${location.origin}${location.pathname}#/emergency`
  const p = state.patient

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ patient: p, records: state.records }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'medithread-chart.json'
    a.click()
    flash(t('toast.exported'))
  }

  const importJson = (file) => {
    setErr('')
    const fr = new FileReader()
    fr.onload = () => {
      try {
        const data = JSON.parse(fr.result)
        if (!data || !data.patient || !Array.isArray(data.records)) throw new Error(t('err.badJson'))
        const merged = [...data.records, ...state.records]
        const seen = new Set()
        const deduped = merged.filter((r) => {
          if (!r || !r.id || seen.has(r.id)) return false
          seen.add(r.id)
          return true
        })
        const next = { ...state, patient: data.patient, records: deduped }
        addAudit(next, `Imported chart from file: ${deduped.length} records`)
        update(next)
        flash(t('toast.imported'))
      } catch (e) {
        setErr(e.message === t('err.badJson') ? t('err.badJson') : t('err.importFailed', { reason: e.message }))
      }
    }
    fr.onerror = () => setErr(t('err.importFailed', { reason: fr.error?.name || 'read error' }))
    fr.readAsText(file)
  }

  if (cardOnly) return <CardOnlyView patient={p} />

  return (
    <div className="stack split">
      <section>
        <EmergencyCard patient={p} />

        <div className="btn-row">
          <button className="btn quiet" onClick={() => tryPrint()}>{t('er.printCard')}</button>
          <button className="btn quiet" onClick={() => setCardOnly(true)}>{t('cardonly.open')}</button>
        </div>

        {mobilePrintUnsupported() && (
          <div className="notice flag" style={{ marginTop: 14 }}>
            <span className="lead">{t('cardonly.hintTitle')}</span>
            {t('cardonly.iosHint')}
          </div>
        )}

        <div className="btn-row">
          <button className="btn quiet" onClick={exportJson}>{t('er.export')}</button>
          <button className="btn quiet" onClick={() => importRef.current?.click()}>{t('er.import')}</button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label={t('er.import')}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }}
          />
        </div>

        {err && (
          <div className="notice crit" style={{ marginTop: 14 }} role="alert">
            <span className="lead">{t('err.importFailed', { reason: '' })}</span>{err}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('er.carry')}</h2>
          <span className="hint">{t('er.carryHint')}</span>
        </div>
        <div className="panel-pad">
          <div className="qrbox">
            <QRCodeSVG value={erUrl} size={186} bgColor="#FCFCF9" fgColor="#151A17" />
          </div>
          <p className="fineprint wordwrap">{erUrl}</p>
          <p className="fineprint">{t('er.scanBody', { pin: p.emergencyPin })}</p>
        </div>
      </section>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

