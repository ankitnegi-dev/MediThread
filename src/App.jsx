import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Patient from './pages/Patient.jsx'
import { Doctor, Shared, Emergency } from './pages/Clinical.jsx'
import { loadState, saveState, resetDemo } from './utils/store.js'

function Shell() {
  const [state, setState] = useState(() => loadState())
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => { saveState(state) }, [state])

  const active = loc.pathname.startsWith('/doctor') ? 'doctor'
    : loc.pathname.startsWith('/shared') ? 'shared'
    : loc.pathname.startsWith('/emergency') ? 'emergency' : 'patient'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">🧵</div>
          <h1>MediThread<small>own your health history</small></h1>
        </div>
        <div className="nav">
          <button className={active === 'patient' ? 'active' : ''} onClick={() => nav('/')}>📜 Patient <span className="role-pill">Meera</span></button>
          <button className={active === 'doctor' ? 'active' : ''} onClick={() => nav('/doctor')}>🩺 Doctor <span className="role-pill">view</span></button>
          <button className={active === 'emergency' ? 'active' : ''} onClick={() => nav('/emergency')}>🚨 Emergency <span className="role-pill">PIN</span></button>
          <button onClick={() => { if (confirm('Reset demo data?')) setState(resetDemo()) }}>↺ Reset demo</button>
        </div>
        <div className="sidebar-foot">
          HealthTech · Lost in Transit<br />
          Fragmented records → 1 timeline.<br />
          Expiring shares · interaction guard · ER QR.<br /><br />
          <span className="mono" style={{ fontSize: 11 }}>local-first · no login · deployable static</span>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Patient state={state} setState={setState} />} />
          <Route path="/doctor" element={<Doctor state={state} setState={setState} />} />
          <Route path="/shared/:token" element={<Shared state={state} setState={setState} />} />
          <Route path="/emergency" element={<Emergency state={state} />} />
          <Route path="*" element={<Patient state={state} setState={setState} />} />
        </Routes>
        <div className="foot-note">
          MediThread · IIITDM Hackathon HealthTech · demo data is simulated (per brief) · rule engine is illustrative, not medical advice
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
