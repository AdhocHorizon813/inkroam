/** Animate the floating panel without resizing it or reflowing the article. */
export function animateArticleTool(element: HTMLElement, entering: boolean, done: () => void) {
  const view = element.ownerDocument.defaultView!
  if (view.matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) {
    done()
    return () => {}
  }
  const easing = view.getComputedStyle(element).getPropertyValue(entering ? '--ease-panel' : '--ease-exit').trim()
    || (entering ? 'cubic-bezier(.18,.9,.24,1)' : 'cubic-bezier(.4,0,.85,.25)')
  const animation = element.animate(entering
    ? [{ transform: 'translateY(-6px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }]
    : [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-4px)', opacity: 0 }],
  { duration: entering ? 180 : 120, easing, fill: 'both' })
  let cancelled = false
  animation.finished.then(() => {
    if (cancelled) return
    done() // Vue removes a leaving node after the fade completes.
    animation.cancel()
  }, () => {})
  return () => { cancelled = true; animation.cancel() }
}
