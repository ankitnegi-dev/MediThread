import React, { useEffect, useState } from 'react'
import { EmergencyCard } from './EmergencyCard.jsx'
import { tryPrint, mobilePrintUnsupported } from '../utils/print.js'
import { useT } from '../i18n/index.jsx'

/**
 * The card on its own, with no app chrome.
 *
 * This is what makes printing work on a phone: iOS Safari ignores
 * window.print(), so the fallback is a bare card the user can screenshot,
 * or print from the browser's own menu with nothing else on the page.
 */
export function CardOnlyView({ patient }) {
  const t = useT()
  const iOS = mobilePrintUnsupported()
  const [hint, setHint] = useState('')

  // The binder header is sticky and would sit on top of the card.
  useEffect(() => {
    document.body.classList.add('cardonly-mode')
    window.scrollTo(0, 0)
    return () => document.body.classList.remove('cardonly-mode')
  }, [])

  const onPrint = () => {
    if (tryPrint()) return
    setHint(t('cardonly.iosHint'))
  }

  return (
    <div className="cardonly">
      <div className="cardonly-bar">
        <button className="btn quiet small" onClick={() => window.history.back()}>{t('cardonly.close')}</button>
        <div className="cardonly-actions">
          <button className="btn small" onClick={onPrint}>{t('common.print')}</button>
        </div>
      </div>

      {hint && (
        <div className="notice flag cardonly-hint" role="status">
          <span className="lead">{t('cardonly.hintTitle')}</span>
          {hint}
        </div>
      )}

      <EmergencyCard patient={patient} />

      <p className="cardonly-foot">{iOS ? t('cardonly.iosHint') : t('cardonly.hint')}</p>
    </div>
  )
}