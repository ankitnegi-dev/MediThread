/**
 * Printing behaves differently on phones.
 *
 * Android Chrome honours window.print(). iPhone/iPad Safari does not - the
 * call resolves to nothing and the user just sees a button that does nothing.
 * There is no way to open the iOS print sheet from JavaScript, so there we
 * offer a card-only view the user can screenshot or print from the browser
 * menu instead.
 */
export function mobilePrintUnsupported() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iOS
}

/** window.print() where it works; returns whether it was even worth trying. */
export function tryPrint() {
  if (mobilePrintUnsupported()) return false
  try {
    window.print()
    return true
  } catch {
    return false
  }
}