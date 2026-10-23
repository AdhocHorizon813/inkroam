/** Vue's JS transition hook: retain the element until the measured animation ends. */
export function animateArticleTool(element: HTMLElement, entering: boolean, done: () => void) {
  const view = element.ownerDocument.defaultView!
  if (view.matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) {
    done()
    return () => {}
  }
  const height = element.getBoundingClientRect().height
  const easing = view.getComputedStyle(element).getPropertyValue(entering ? '--ease-panel' : '--ease-exit').trim()
    || (entering ? 'cubic-bezier(.18,.9,.24,1)' : 'cubic-bezier(.4,0,.85,.25)')
  element.style.overflow = 'hidden'
  const animation = element.animate(entering
    ? [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }]
    : [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
  { duration: entering ? 440 : 220, easing, fill: 'both' })
  let cancelled = false
  animation.finished.then(() => {
    if (cancelled) return
    done() // Vue removes a leaving node here, only after its collapse completes.
    animation.cancel()
    element.style.removeProperty('overflow')
  }, () => {})
  return () => { cancelled = true; animation.cancel(); element.style.removeProperty('overflow') }
}
