import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Patient from './pages/Patient.jsx'
import { Doctor, Shared, Emergency } from './pages/Clinical.jsx'
import { loadState, saveState, resetDemo } from './utils/store.js'

const VIEWS = [
  { key: 'patient', label: 'Patient', hint: 'the chart', to: '/' },
  { key: 'doctor', label: 'Doctor', hint: 'consent view', to: '/doctor' },
  { key: 'emergency', label: 'Emergency', hint: 'PIN gated', to: '/emergency' }
]

function Shell() {
  const [state, setState] = useState(() => loadState())
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => { saveState(state) }, [state])

  const active = loc.pathname.startsWith('/doctor') ? 'doctor'
    : loc.pathname.startsWith('/emergency') ? 'emergency' : 'patient'

  const reset = () => {
    if (confirm('Reset the demo back to its starting data?')) {
      setState(resetDemo())
      nav('/')
    }
  }

  return (
    <>
      <header className="binder">
        <div className="binder-inner">
          <div className="binder-bar">
            <button className="mark" onClick={() => nav('/')} aria-label="MediThread, go to the chart">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M4.5 4.5 12 12l7.5 7.5" />
                <path d="M19.5 4.5 12 12l-7.5 7.5" />
              </svg>
              <span className="wordmark">Medi<b>Thread</b></span>
            </button>
            <p className="binder-note">One chart, carried between clinics.</p>
            <div className="binder-actions">
              <span className="idchip">{state.patient.name}, {state.patient.age}</span>
              <button className="btn quiet small" onClick={reset}>Reset demo</button>
            </div>
          </div>

          <nav className="tabs" aria-label="Views">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                aria-current={active === v.key ? 'page' : undefined}
                className="tab"
                onClick={() => nav(v.to)}
              >
                {v.label}
                <small>{active === v.key ? v.hint : '\u00A0'}</small>
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
            <Route path="/emergency" element={<Emergency state={state} />} />
            <Route path="*" element={<Patient state={state} setState={setState} />} />
          </Routes>
          <p className="colophon">
            MediThread — IIITDM HealthTech, &ldquo;Lost in Transit&rdquo;. Sample data only.
            The interaction and duplicate-test rules are illustrative and are not medical advice.
          </p>
        </div>
      </main>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}