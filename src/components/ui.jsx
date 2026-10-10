import React from 'react'

export function TypeBadge({ type }) {
  const map = {
    prescription: ['℞', 'Prescription', ''],
    lab: ['🧪', 'Lab', 'blue'],
    scan: ['🩻', 'Scan', ''],
    discharge: ['🏥', 'Discharge', 'amber'],
    note: ['📝', 'Note', 'grey']
  }
  const [icon, label, cls] = map[type] || ['📄', type, 'grey']
  return <span className={`badge ${cls}`}>{icon} {label}</span>
}

export function TimelineItem({ r, onView }) {
  return (
    <div className="t-item">
      <div className="t-dot">●</div>
      <div className="card t-card" style={{ padding: '14px 15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <TypeBadge type={r.type} />
              <span className="muted mono">{r.date}</span>
              {(r.conditions || []).map((c) => (
                <span key={c} className="badge grey">{c}</span>
              ))}
            </div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>{r.title}</div>
            <div className="muted" style={{ marginTop: 2 }}>{r.provider} · {r.source || 'Digital'}</div>
            {r.labs && (
              <div className="mono" style={{ marginTop: 8, background: '#f8fafc', padding: '7px 9px', borderRadius: 8 }}>
                {Object.entries(r.labs).map(([k, v]) => `${k}: ${v}`).join('  ·  ')}
              </div>
            )}
            {r.meds && r.meds.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                💊 {r.meds.map((m) => `${m.name} ${m.dose || ''}`).join(', ')}
              </div>
            )}
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{r.notes}</div>
            {r.flag && <div className="alert amber" style={{ marginBottom: 0 }}>⚠️ {r.flag}</div>}
          </div>
          {onView && (
            <button className="btn secondary small" onClick={() => onView(r)}>Open</button>
          )}
        </div>
      </div>
    </div>
  )
}

// Minimal SVG trend chart — zero dependencies, looks deliberate in demo.
export function LabChart({ records, test = 'HbA1c' }) {
  const pts = records
    .filter((r) => r.labs && r.labs[test] !== undefined)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  if (pts.length < 2) return <div className="muted">Need 2+ {test} results to draw a trend. Upload another lab.</div>
  const W = 520, H = 170, P = 32
  const vals = pts.map((p) => Number(p.labs[test]))
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = Math.max(max - min, 0.5)
  const x = (i) => P + (i * (W - 2 * P)) / Math.max(pts.length - 1, 1)
  const y = (v) => H - P - ((v - min) / span) * (H - 2 * P)
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(Number(p.labs[test]))}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: '#f8fbfb', borderRadius: 12, border: '1px solid #dce8ec' }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="#dce8ec" strokeDasharray="4 4" />
        ))}
        <path d={d} fill="none" stroke="#0e7c7b" strokeWidth="3" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(Number(p.labs[test]))} r="6" fill="#0e7c7b" stroke="#fff" strokeWidth="2" />
            <text x={x(i)} y={y(Number(p.labs[test])) - 12} textAnchor="middle" fontSize="12" fontWeight="800" fill="#0a5e5d">{p.labs[test]}</text>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#5b7280">{p.date.slice(2)}</text>
          </g>
        ))}
        <text x={10} y={18} fontSize="12" fontWeight="800" fill="#0a5e5d">{test} trend ({min} → {max})</text>
      </svg>
      <div className="muted" style={{ marginTop: 6 }}>
        {test === 'HbA1c' && max <= 7 ? '✅ Improving control — target ≤7 for most adults with diabetes.' : 'ℹ️ Share this trend instead of repeating the test.'}
      </div>
    </div>
  )
}
