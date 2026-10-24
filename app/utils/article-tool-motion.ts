/** Reveal the floating panel through a grid clip, like the search dropdowns.
 * Keep opacity/transform off its ancestors so the glass can sample the page
 * throughout the transition, rather than changing backdrop roots mid-animation.
 */
export function animateArticleTool(element: HTMLElement, entering: boolean, done: () => void) {
  const view = element.ownerDocument.defaultView!
  if (view.matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) {
    done()
    return () => {}
  }
  const easing = view.getComputedStyle(element).getPropertyValue(entering ? '--ease-settle' : '--ease-exit').trim()
    || (entering ? 'cubic-bezier(.2,.82,.22,1)' : 'cubic-bezier(.4,0,.85,.25)')
  const animation = element.animate(entering
    ? [{ gridTemplateRows: '0fr' }, { gridTemplateRows: '1fr' }]
    : [{ gridTemplateRows: '1fr' }, { gridTemplateRows: '0fr' }],
  { duration: entering ? 360 : 180, easing, fill: 'both' })
  let cancelled = false
  animation.finished.then(() => {
    if (cancelled) return
    done() // Retain the surface until its clipping window has fully closed.
    animation.cancel()
  }, () => {})
  return () => { cancelled = true; animation.cancel() }
}
