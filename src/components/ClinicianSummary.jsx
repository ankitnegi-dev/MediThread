import React from 'react'
import { LabChart } from './ui.jsx'
import { labNumber } from '../utils/extract.js'
import { useT } from '../i18n/index.jsx'

// Rough adult reference ceilings. Only used to flag what is worth a second look.
const CEILING = {
  HbA1c: 7,
  FastingGlucose: 130,
  LDL: 100,
  Creatinine: 1.2,
  TSH: 5,
  Urea: 45,
  VitaminD: 30,
  Hb: 12
}

/**
 * One page a clinician can read in ten seconds, and print.
 * Used by the Doctor view and the Shared view.
 */
export function ClinicianSummary({ patient, records = [] }) {
  const t = useT()
  const p = patient

  const labs = records
    .filter((r) => r.labs && Object.keys(r.labs).length)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const recent = labs.slice(0, 4)

  const abnormal = labs
    .flatMap((r) =>
      Object.entries(r.labs || {})
        .map(([test, raw]) => {
          const v = labNumber(raw)
          const ceil = CEILING[test]
          if (v === null || !ceil || v <= ceil) return null
          return { test, value: raw, date: r.date, ceiling: ceil }
        })
        .filter(Boolean)
    )
    .slice(0, 6)

  return (
    <div className="summary">
      <div className="summary-head">
        <div>
          <h2>{p.name}</h2>
          <p className="meta">
            {p.age} · {p.sex} · {t('chart.blood', { group: p.bloodGroup })} · {p.city}
          </p>
        </div>
        <span className="st dead">{new Date().toLocaleDateString()}</span>
      </div>

      <div className="summary-alert">
        <span className="mono-hint">{t('er.allergies')}</span>
        <p>{p.allergies.join(' · ')}</p>
      </div>

      <div className="summary-grid">
        <section>
          <h3>{t('er.conditions')}</h3>
          <p>{p.conditions.join(', ')}</p>
        </section>
        <section>
          <h3>{t('doc.emergencyContact')}</h3>
          <p>{p.emergencyContact}</p>
        </section>
      </div>

      <h3 className="summary-h">{t('doc.medsNow')}</h3>
      <ul className="medline summary-meds">
        {p.currentMeds.map((m) => (
          <li key={m.name}><b>{m.name}</b> {m.dose} <span className="mono-hint">{m.freq} · {m.since}</span></li>
        ))}
      </ul>

      <h3 className="summary-h">{t('summary.abnormal')}</h3>
      {abnormal.length === 0 ? (
        <p className="muted-line">{t('summary.abnormalNone')}</p>
      ) : (
        <ul className="abn-list">
          {abnormal.map((a, i) => (
            <li key={i}><b>{a.test}</b> {a.value} <span className="mono-hint">{a.date} · ref &lt;{a.ceiling}</span></li>
          ))}
        </ul>
      )}

      <h3 className="summary-h">{t('summary.trend', { test: 'HbA1c' })}</h3>
      <LabChart records={records} test="HbA1c" target={7} unit="%" />

      {recent.length > 0 && (
        <>
          <h3 className="summary-h">{t('summary.lastResults')}</h3>
          <table className="summary-table">
            <thead><tr><th>{t('upload.date')}</th><th>{t('upload.titleF')}</th><th>{t('upload.values')}</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.date}</td>
                  <td>{r.title}</td>
                  <td className="num">{Object.entries(r.labs).map(([k, v]) => `${k} ${v}`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}