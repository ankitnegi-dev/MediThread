import React, { useId, useState } from 'react'
import { getFileDataUrl } from '../utils/blobStore.js'
import { labNumber } from '../utils/extract.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TYPE_META = {
  prescription: { label: 'Prescription', k: 'k-prescription' },
  lab: { label: 'Lab result', k: 'k-lab' },
  scan: { label: 'Scan', k: 'k-scan' },
  discharge: { label: 'Discharge', k: 'k-discharge' },
  note: { label: 'Note', k: 'k-note' }
}

function typeMeta(type) {
  return TYPE_META[type] || { label: type, k: 'k-note' }
}

/** Shows the attached original when it is on this device or carried in the link. */
export function DocumentButton({ record }) {
  const [url, setUrl] = useState(record.doc?.dataUrl || null)
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const hasLocal = !!record.fileId
  const hasInline = !!record.doc?.dataUrl
  if (!hasLocal && !hasInline && !record.docOmitted) return null

  const view = async () => {
    setErr('')
    if (url) { setOpen((o) => !o); return }
    if (!hasLocal) return
    setBusy(true)
    try {
      const d = await getFileDataUrl(record.fileId)
      if (!d) { setErr('That file is no longer stored in this browser.'); return }
      setUrl(d)
      setOpen(true)
    } catch {
      setErr('That file could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  const name = record.fileName || record.doc?.name || ''
  const isPdfFile = /\.pdf$/i.test(name)

  return (
    <div className="entry-actions">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn quiet small" onClick={view} disabled={busy}>
          {busy ? 'Opening…' : open ? 'Hide document' : 'View document'}
        </button>
        {url && (
          <a className="btn quiet small" href={url} download={name || 'document'}>Download</a>
        )}
      </div>
      {record.docOmitted && !hasInline && (
        <p className="fineprint" style={{ marginTop: 8 }}>Original file not included — the extracted values were shared instead.</p>
      )}
      {err && <p className="fineprint" style={{ marginTop: 8, color: 'var(--stamp)' }}>{err}</p>}
      {open && url && (
        <div className="docview" style={{ marginTop: 12 }}>
          {isPdfFile
            ? <iframe src={url} title={name || 'Document'} />
            : <img src={url} alt={record.title ? `Document for ${record.title}` : 'Document'} />}
        </div>
      )}
    </div>
  )
}

export function TimelineItem({ r, onView }) {
  const t = typeMeta(r.type)
  const [, m, d] = (r.date || '').split('-')

  return (
    <article className={`entry ${t.k}`}>
      <div className="entry-date">
        <span className="d">{d}</span>
        <span className="m">{MONTHS[Number(m) - 1]} {r.date.slice(0, 4)}</span>
      </div>

      <div className="entry-body">
        <div className="entry-top">
          <span className="ink"><i />{t.label}</span>
          <span className="mono-hint">{r.source || 'Digital'}</span>
          {(r.conditions || []).map((c) => <span key={c} className="tag">{c}</span>)}
        </div>

        <h4>{r.title}</h4>
        <p className="prov">{r.provider}</p>

        {r.labs && Object.keys(r.labs).length > 0 && (
          <div className="labs">
            {Object.entries(r.labs).map(([k, v]) => (
              <div className="labs-row" key={k}>
                <span className="k">{k}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
        )}

        {r.meds && r.meds.length > 0 && (
          <div className="meds">
            {r.meds.map((m2) => (
              <span key={m2.name}>{m2.name} <b>{m2.dose || ''}</b></span>
            ))}
          </div>
        )}

        {r.notes && <p className="notes">{r.notes}</p>}

        {r.flag && (
          <div className="notice crit" style={{ marginTop: 14 }}>
            <span className="lead">Flag</span>{r.flag}
          </div>
        )}

        <DocumentButton record={r} />

        {onView && (
          <div className="entry-actions">
            <button className="btn quiet small" onClick={() => onView(r)}>Open record</button>
          </div>
        )}
      </div>
    </article>
  )
}

/* Lab trend plotted on graph paper — the chart you would actually
   find in the file, with the target line drawn in. */
export function LabChart({ records, test = 'HbA1c', target = null, unit = '' }) {
  const gid = useId().replace(/:/g, '')
  const pts = records
    .filter((r) => r.labs && labNumber(r.labs[test]) !== null)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (pts.length < 2) {
    return (
      <p className="fineprint" style={{ marginTop: 0 }}>
        One {test} result on file. A trend needs two or more.
      </p>
    )
  }

  const W = 560, H = 210, P = 38, PT = 30
  const vals = pts.map((p) => labNumber(p.labs[test]))
  const lo = Math.min(...vals, target ?? Infinity)
  const hi = Math.max(...vals, target ?? -Infinity)
  const pad = Math.max((hi - lo) * 0.25, 0.4)
  const min = lo - pad
  const span = Math.max(hi + pad - min, 0.1)

  const x = (i) => P + (i * (W - 2 * P)) / Math.max(pts.length - 1, 1)
  const y = (v) => H - P - ((v - min) / span) * (H - P - PT)
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(vals[i])}`).join(' ')
  const improving = vals[vals.length - 1] < vals[0]

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--sheet-2)', border: '1px solid var(--rule)' }}
        role="img"
        aria-label={`${test} trend across ${pts.length} results, from ${vals[0]} to ${vals[vals.length - 1]} ${unit}`}
      >
        <defs>
          <pattern id={`g${gid}`} width="15" height="15" patternUnits="userSpaceOnUse">
            <path d="M15 0H0V15" fill="none" stroke="var(--rule-2)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={`url(#g${gid})`} />

        {target !== null && (
          <g>
            <line x1={P} x2={W - P} y1={y(target)} y2={y(target)} stroke="var(--flag)" strokeWidth="1.5" strokeDasharray="6 4" />
            <text
              x={P + 4}
              y={y(target) - 7}
              fontFamily="var(--mono)"
              fontSize="10.5"
              fill="var(--flag)"
            >
              target {target}{unit}
            </text>
          </g>
        )}

        <path d={d} fill="none" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <g key={p.id}>
            <rect x={x(i) - 3.5} y={y(vals[i]) - 3.5} width="7" height="7" fill="var(--pen)" />
            {/* label every value that changed, so flat runs don't stack text */}
            {(i === 0 || String(p.labs[test]) !== String(pts[i - 1].labs[test])) && (
              <text
                x={x(i)}
                y={y(vals[i]) - 13}
                textAnchor="middle"
                fontFamily="var(--mono)"
                fontSize="11.5"
                fontWeight="600"
                fill="var(--ink)"
              >
                {p.labs[test]}
              </text>
            )}
            <text x={x(i)} y={H - 12} textAnchor="middle" fontFamily="var(--mono)" fontSize="10" fill="var(--ink-40)">
              {p.date.slice(2)}
            </text>
          </g>
        ))}
      </svg>

      <p className="fineprint">
        {pts.length} results, {vals[0]} to {vals[vals.length - 1]} {unit}.{' '}
        {improving
          ? 'Trending down since the first result — share this instead of repeating the test.'
          : 'Share this trend with your next doctor rather than repeating the test.'}
      </p>
    </div>
  )
}