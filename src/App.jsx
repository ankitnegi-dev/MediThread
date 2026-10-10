import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Patient from './pages/Patient.jsx'
import { Doctor, Shared, Emergency } from './pages/Clinical.jsx'
import { loadState, saveState, resetDemo } from './utils/store.js'
import { I18nProvider, useT, useLang, LANGUAGES } from './i18n/index.jsx'

const VIEWS = [
  { key: 'patient', path: '/', labelKey: 'nav.patient', hintKey: 'nav.patientHint' },
  { key: 'doctor', path: '/doctor', labelKey: 'nav.doctor', hintKey: 'nav.doctorHint' },
  { key: 'emergency', path: '/emergency', labelKey: 'nav.emergency', hintKey: 'nav.emergencyHint' }
]

function Shell() {
  const t = useT()
  const { lang, setLang } = useLang()
  const [state, setState] = useState(() => loadState())
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => { saveState(state) }, [state])

  const active = loc.pathname.startsWith('/doctor') ? 'doctor'
    : loc.pathname.startsWith('/emergency') ? 'emergency' : 'patient'

  const reset = () => {
    if (confirm(t('app.resetConfirm'))) {
      setState(resetDemo())
      nav('/')
    }
  }

  return (
    <>
      <header className="binder">
        <div className="binder-inner">
          <div className="binder-bar">
            <button className="mark" onClick={() => nav('/')} aria-label="MediThread — home">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M4.5 4.5 12 12l7.5 7.5" />
                <path d="M19.5 4.5 12 12l-7.5 7.5" />
              </svg>
              <span className="wordmark">Medi<b>Thread</b></span>
            </button>
            <p className="binder-note">{t('app.tagline')}</p>

            <div className="binder-actions">
              <div className="langpick">
                <label htmlFor="lang" className="sr-only">{t('app.language')}</label>
                <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.native}</option>
                  ))}
                </select>
              </div>
              <span className="binder-id">{t('app.patientId', { name: state.patient.name, age: state.patient.age })}</span>
              <button className="btn quiet small" onClick={reset}>{t('app.reset')}</button>
            </div>
          </div>

          <nav className="tabs" aria-label="Views">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                aria-current={active === v.key ? 'page' : undefined}
                className="tab"
                onClick={() => nav(v.path)}
              >
                {t(v.labelKey)}
                <small>{active === v.key ? t(v.hintKey) : '\u00A0'}</small>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="desk">
        <div className="sheet">
          <Routes>
            <Route path="/" element={<Patient state={state} setState={setState} />} />
            <Route path="/doctor" element={<Doctor state={state} setState={setState} />} />
            <Route path="/shared/:token" element={<Shared state={state} setState={setState} />} />
            <Route path="/emergency" element={<Emergency state={state} setState={setState} />} />
            <Route path="*" element={<Patient state={state} setState={setState} />} />
          </Routes>
          <p className="colophon">{t('app.colophon')}</p>
        </div>
      </main>
    </>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </I18nProvider>
  )
}