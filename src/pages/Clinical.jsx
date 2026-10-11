import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TimelineItem } from '../components/ui.jsx'
import { EmergencyCard } from '../components/EmergencyCard.jsx'
import { ClinicianSummary } from '../components/ClinicianSummary.jsx'
import { validateShareToken, makeNoteCode, REVOCATION_CAVEAT } from '../utils/share.js'
import { addAudit } from '../utils/store.js'
import { checkInteractions } from '../utils/medSafety.js'
import { useT } from '../i18n/index.jsx'
import { CardOnlyView } from '../components/CardOnlyView.jsx'
import { tryPrint, mobilePrintUnsupported } from '../utils/print.js'

export function Doctor({ state, setState }) {
  const t = useT()
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

    // Only count the open where this browser holds the issuing registry.
    if (!v.external) {
      const next = { ...state, shares: state.shares.map((s) => (s.id === v.share.id ? { ...s, accesses: s.accesses + 1 } : s)) }
      addAudit(next, `Doctor opened share: ${v.share.label}`)
      setState(next)
    }
    setResult(v)
  }

  const buildNote = () => {
    if (!newNote.title) { alert(t('err.titleRequired')); return }
    const rec = {
      id: `rec-${Math.random().toString(36).slice(2, 8)}`,
      type: newNote.type,
      date: new Date().toISOString().slice(0, 10),
      provider: 'Fortis OPD, Bengaluru - Dr. P. Iyer',
      title: newNote.title,
      conditions: [],
      notes: newNote.notes,
      source: 'Added by doctor through MediThread'
    }
    setNoteCode(makeNoteCode(rec, rec.provider))
    flash(t('toast.noteReady'))
  }

  const copyNote = async () => {
    try { await navigator.clipboard.writeText(noteCode); flash(t('toast.noteCopied')) }
    catch { flash(t('toast.copyFailed')) }
  }

  const liveShares = state.shares.filter((s) => !s.revoked && new Date(s.expiresAt) > new Date()).length
  const views = state.shares.reduce((n, s) => n + s.accesses, 0)

  return (
    <div>
      <header className="chart-head">
        <div>
          <p className="kicker">{t('doc.openHint')}</p>
          <h1>{t('nav.doctor')}</h1>
          <p className="meta">{t('share.readyBody')}</p>
        </div>
        <dl className="figures">
          <div><dt>{t('share.listTitle')}</dt><dd>{state.shares.length}</dd><p>{liveShares} {t('share.stLive').toLowerCase()}</p></div>
          <div><dt>{t('share.colViews')}</dt><dd>{views}</dd><p>{t('share.accessLog').toLowerCase()}</p></div>
        </dl>
      </header>

      <div style={{ marginTop: 30 }}>
        <section className="panel">
          <div className="panel-head">
            <h2>{t('doc.open')}</h2>
            <span className="hint">{t('doc.openHint')}</span>
          </div>
          <div className="panel-pad">
            <div className="row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('common.pasteLink')}
                aria-label={t('doc.openHint')}
              />
              <button className="btn" style={{ flex: '0 0 auto' }} onClick={open} disabled={!code.trim()}>{t('doc.openBtn')}</button>
            </div>

            {result && !result.ok && (
              <div className="notice crit" style={{ marginTop: 16 }} role="alert">
                <span className="lead">{t('doc.cannotOpen')}</span>
                {result.message}
              </div>
            )}

            <p className="fineprint">{t('doc.demoHint')}</p>
          </div>
        </section>

        {result?.ok && (
          <div style={{ marginTop: 30 }}>
            <div className={`notice ${result.external ? 'flag' : 'ok'}`} style={{ marginBottom: 26 }}>
              <span className="lead">{result.external ? t('doc.external') : t('doc.verified')}</span>
              <b>{result.share.label}</b> -{' '}
              {result.external
                ? t('doc.externalBody')
                : t('doc.verifiedBody', { n: result.records.length, when: new Date(result.share.expiresAt).toLocaleString() })}
            </div>

            <ClinicianSummary patient={result.patient} records={result.records} />

            <h2 className="sec-title" style={{ marginTop: 30 }}>
              {t('doc.whatShared')}
              <span className="hint">{t('common.newestFirst')}</span>
            </h2>
            <div className="spine">
              {result.records.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => (
                <TimelineItem key={r.id} r={r} />
              ))}
            </div>

            <section className="panel" style={{ marginTop: 30 }}>
              <div className="panel-head">
                <h2>{t('doc.writeBack')}</h2>
                <span className="hint">{t('doc.writeBackHint')}</span>
              </div>
              <div className="panel-pad">
                <p className="fineprint" style={{ marginTop: 0 }}>{t('doc.writeBackBody')}</p>

                <div className="row">
                  <div>
                    <label htmlFor="d-type">{t('upload.type')}</label>
                    <select id="d-type" value={newNote.type} onChange={(e) => setNewNote({ ...newNote, type: e.target.value })}>
                      <option value="prescription">{t('type.prescription')}</option>
                      <option value="lab">{t('type.lab')}</option>
                      <option value="note">{t('type.note')}</option>
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label htmlFor="d-title">{t('doc.noteTitle')}</label>
                    <input id="d-title" value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} placeholder="Paracetamol 650mg SOS" />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="d-notes">{t('upload.notes')}</label>
                  <textarea id="d-notes" value={newNote.notes} onChange={(e) => setNewNote({ ...newNote, notes: e.target.value })} />
                </div>

                {newNote.title && (() => {
                  const hits = checkInteractions(result.patient.currentMeds || [], newNote.title.split(' ')[0])
                  return hits.length ? (
                    <div className="notice crit" style={{ marginTop: 16 }}>
                      <span className="lead">{t('doc.interaction')}</span>
                      {hits.map((h) => h.msg).join(' ')}
                    </div>
                  ) : (
                    <div className="notice ok" style={{ marginTop: 16 }}>
                      <span className="lead">{t('doc.clear')}</span>
                      {t('doc.clearBody')}
                    </div>
                  )
                })()}

                <div className="btn-row">
                  <button className="btn" onClick={buildNote} disabled={!newNote.title}>{t('doc.buildNote')}</button>
                </div>

                {noteCode && (
                  <div className="notice ok" style={{ marginTop: 18 }}>
                    <span className="lead">{t('doc.noteReady')}</span>
                    <span className="mono-hint wordwrap" style={{ display: 'block', color: 'var(--ink-80)', marginTop: 8 }}>{noteCode}</span>
                    <div className="btn-row" style={{ marginTop: 12 }}>
                      <button className="btn quiet small" onClick={copyNote}>{t('doc.copyNote')}</button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {!result && (
          <section className="panel" style={{ marginTop: 30 }}>
            <div className="panel-head"><h2>{t('doc.consentTitle')}</h2></div>
            <div className="panel-pad">
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-80)', marginBottom: 18 }}>{t('doc.consentBody')}</p>
              <ClinicianSummary patient={state.patient} records={state.records} />
              <div className="btn-row">
                <button className="btn quiet" onClick={() => nav('/')}>{t('doc.backToChart')}</button>
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
  const t = useT()
  const p = patient
  return (
    <div className="panel">
      <div className="panel-head"><h2>{t('doc.summary')}</h2></div>
      <div className="panel-pad">
        <dl className="deflist">
          <div>
            <dt>{t('doc.patient')}</dt>
            <dd><b>{p.name}</b>, {p.age}, {p.sex}. {t('chart.blood', { group: p.bloodGroup })}. {p.city}. {p.conditions.join(', ')}.</dd>
          </div>
          <div>
            <dt>{t('er.allergies')}</dt>
            <dd><b>{p.allergies.join(', ')}</b></dd>
          </div>
          <div>
            <dt>{t('doc.medsNow')}</dt>
            <dd className="medline-plain">
              {p.currentMeds.map((m) => (
                <div key={m.name}>{m.name} {m.dose} <span className="mono-hint">{m.freq}</span></div>
              ))}
            </dd>
          </div>
          <div>
            <dt>{t('doc.emergencyContact')}</dt>
            <dd>{p.emergencyContact}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export function Shared({ state, setState }) {
  const t = useT()
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
        <p className="kicker">{t('doc.open')}</p>
        <h1 style={{ font: '600 32px/1.1 var(--serif)', marginBottom: 18 }}>{t('doc.doesNotOpen')}</h1>
        <div className="notice crit" role="alert">
          <span className="lead">{t('doc.reason')}</span>
          {v.message}
        </div>
        <div className="notice flag" style={{ marginTop: 10 }}>
          <span className="lead">{t('share.revokeTitle')}</span>
          {REVOCATION_CAVEAT}
        </div>
        <div className="btn-row"><a className="btn quiet" href="#/">{t('doc.goToApp')}</a></div>
      </div>
    )
  }

  return (
    <div>
      <header className="chart-head">
        <div>
          <p className="kicker">{t('doc.sharedBy', { name: v.patient.name })}</p>
          <h1>{v.share.label}</h1>
          <p className="meta">
            {v.records.length} · {new Date(v.share.expiresAt).toLocaleString()} · {t('common.readOnly')}
          </p>
        </div>
      </header>

      <div style={{ marginTop: 30 }}>
        {v.external && (
          <div className="notice flag" style={{ marginBottom: 22 }}>
            <span className="lead">{t('doc.external')}</span>
            {t('doc.externalBody')}
          </div>
        )}

        <ClinicianSummary patient={v.patient} records={v.records} />

        <h2 className="sec-title" style={{ marginTop: 30 }}>
          {t('doc.whatShared')}
          <span className="hint">{v.records.length}</span>
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
  const t = useT()
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [cardOnly, setCardOnly] = useState(false)
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
    setErr(n >= LOCKOUT_AT ? t('er.locked') : t('er.wrongPin', { n: LOCKOUT_AT - n }))
  }

  const locked = tries >= LOCKOUT_AT

  if (unlocked && cardOnly) return <CardOnlyView patient={p} />

  const unlockedCard = (
    <div>
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

      <h2 className="sec-title" style={{ marginTop: 34 }}>
        {t('er.recent')}
        <span className="hint">{t('common.readOnly')}</span>
      </h2>
      <div className="spine">
        {latest.map((r) => <TimelineItem key={r.id} r={r} />)}
      </div>

      <div className="btn-row"><a className="btn quiet" href="#/">{t('er.lock')}</a></div>
    </div>
  )

  if (unlocked) return unlockedCard

  return (
    <div className="pinwrap">
      <p className="kicker" style={{ color: 'var(--stamp)' }}>{t('er.forResponders')}</p>
      <h1 style={{ font: '600 32px/1.12 var(--serif)', marginBottom: 12 }}>{t('er.access')}</h1>
      <p className="meta" style={{ marginBottom: 24 }}>{t('er.accessBody')}</p>
      <label htmlFor="pin">{t('er.pinLabel')}</label>
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
          <span className="lead">{t('er.notUnlocked')}</span>{err}
        </div>
      )}
      <div className="btn-row">
        <button className="btn" onClick={tryUnlock} disabled={pin.length !== 4 || locked}>{t('er.unlock')}</button>
        <a className="btn quiet" href="#/">{t('er.goBack')}</a>
      </div>
      <p className="fineprint">{t('er.demoPin', { pin: p.emergencyPin })}</p>
    </div>
  )
}