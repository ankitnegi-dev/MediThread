import React, { useState } from 'react'
import { useT, useLang, DICTIONARIES } from '../i18n/index.jsx'

const EN = DICTIONARIES.en

/**
 * The card a responder reads under pressure. In bilingual mode it repeats the
 * same content in the chosen language and English, so a responder who reads
 * only one of the two still gets the allergies and the medicines.
 */
export function EmergencyCard({ patient }) {
  const t = useT()
  const { lang } = useLang()
  const [both, setBoth] = useState(false)
  const p = patient
  const showEnglish = both && lang !== 'en'

  const rows = [
    ['er.conditions', p.conditions.join(', '), false],
    ['er.allergies', p.allergies.join(', '), true],
    ['er.contact', p.emergencyContact, false]
  ]

  const Block = ({ english }) => (
    <dl>
      {rows.map(([k, v, critical]) => (
        <div className={`rowline${critical ? ' critical' : ''}`} key={k}>
          <dt>
            {english ? EN[k] : t(k)}
            {!english && showEnglish && <span className="alt">{EN[k]}</span>}
          </dt>
          <dd><b>{v}</b></dd>
        </div>
      ))}
      <div className="rowline meds-row">
        <dt>
          {english ? EN['er.meds'] : t('er.meds')}
          {!english && showEnglish && <span className="alt">{EN['er.meds']}</span>}
        </dt>
        <dd>
          <ul className="medline">
            {p.currentMeds.map((m) => (
              <li key={m.name}><b>{m.name}</b> {m.dose} <span className="mono-hint">{m.freq}</span></li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  )

  return (
    <div className="ercard">
      <div className="ercard-head">
        <div>
          <p className="kicker" style={{ color: 'var(--stamp)' }}>{t('er.critical')}</p>
          <h2>{p.name}</h2>
          <p className="meta">{t('chart.age', { age: p.age, sex: p.sex })}. {p.city}.</p>
        </div>
        <div className="blood">
          <p className="big">{p.bloodGroup}</p>
          <p className="mono-hint">{t('er.bloodGroup')}</p>
        </div>
      </div>

      <Block english={false} />

      {showEnglish && (
        <div className="ercard-en">
          <p className="mono-hint">English</p>
          <Block english />
        </div>
      )}

      {lang !== 'en' && (
        <button className="btn quiet small ercard-toggle" aria-pressed={showEnglish} onClick={() => setBoth((b) => !b)}>
          {showEnglish ? 'English only' : t('er.bilingual')}
        </button>
      )}
    </div>
  )
}