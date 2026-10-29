import type { GlassController } from '../vendor/liquidglass/liquid-glass.js'
import { currentGlassQuality } from './glass-quality-dom'
import { onPageScroll } from './page-scroll'

export const GLASS_CONTENT_SELECTOR = '.hero, .latest-section, .manifesto, .standard-page, .article-page'

// Pure geometry shared with regression checks. A 30,000px article still needs
// only one viewport-sized optical tile; interior scroll does not change its map.
export function contentGlassSlice(top: number, height: number, viewport: number) {
  const extent = Math.min(height, Math.max(1, viewport) + 192)
  const y = Math.max(0, Math.min(Math.max(0, height - extent), -top - 96))
  return { y, height: extent, bleedTop: y > 0 ? 64 : 0,
    bleedBottom: y + extent < height - .5 ? 64 : 0,
    visible: top < viewport && top + height > 0 }
}

export function attachGlassContent(host: HTMLElement, engine: typeof import('../vendor/liquidglass/liquid-glass.js')) {
  const frame = document.createElement('div'), lens = document.createElement('div')
  frame.className = 'experimental-content-glass'
  lens.className = 'experimental-content-glass__lens'
  frame.setAttribute('aria-hidden', 'true')
  frame.appendChild(lens)
  const original = ['position', 'z-index'].map(name => [name, host.style.getPropertyValue(name), host.style.getPropertyPriority(name)] as const)
  const style = getComputedStyle(host)
  if (style.position === 'static') host.style.position = 'relative'
  if (style.zIndex === 'auto') host.style.zIndex = '0'
  host.appendChild(frame)
  let controller: GlassController | undefined, disposed = false, raf = 0
  let radius = parseFloat(style.borderTopLeftRadius) || 0
  // Hand the tint over in a single frame. This is the exact moment the card's
  // background flips from the preview tint to transparent, and background-color
  // is transitioned by the material recipes: left alone, the old tint fades out
  // over ~215ms *below* an already-tinted lens, so the panel briefly
  // double-tints (tint + tint) and flashes brighter right after a route change.
  // Suppressing the property for this one assignment keeps the swap atomic and
  // leaves every other transition (theme, material, route motion) untouched.
  function commit() {
    const previous = host.style.transition
    host.style.transition = 'none'
    host.setAttribute('data-liquid-glass-content', '')
    void host.offsetWidth // flush the pending style change without a transition
    requestAnimationFrame(() => {
      if (disposed) return
      if (previous) host.style.transition = previous
      else host.style.removeProperty('transition')
    })
  }
  const decoded = new MutationObserver(() => {
    if (disposed || !lens.style.backdropFilter.includes('url(')) return
    commit()
    decoded.disconnect()
  })
  decoded.observe(lens, { attributes: true, attributeFilter: ['style'] })

  function measure() {
    raf = 0
    if (disposed) return
    const box = host.getBoundingClientRect()
    const slice = contentGlassSlice(box.top + host.clientTop, host.clientHeight, window.innerHeight)
    lens.style.height = `${slice.height}px`
    lens.style.transform = `translateY(${slice.y}px)`
    lens.style.visibility = slice.visible ? '' : 'hidden'
    // Only the true top/bottom of the card has rounded corners. The moving tile
    // is rectangular in the middle; the stationary frame clips the real card.
    lens.style.borderRadius = `${slice.bleedTop ? 0 : radius}px ${slice.bleedTop ? 0 : radius}px ${slice.bleedBottom ? 0 : radius}px ${slice.bleedBottom ? 0 : radius}px`
    controller?.update({ radius, bleedTop: slice.bleedTop, bleedBottom: slice.bleedBottom,
      hidden: !slice.visible, ...currentGlassQuality(host.clientWidth, slice.height + slice.bleedTop + slice.bleedBottom, undefined, host) })
  }
  function schedule() { if (!raf && !disposed) raf = requestAnimationFrame(measure) }
  const resize = new ResizeObserver(() => { radius = parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0; schedule() })
  resize.observe(host)
  const stopScroll = onPageScroll(schedule)
  window.addEventListener('resize', schedule, { passive: true })
  function destroy() {
    if (disposed) return
    disposed = true
    if (raf) cancelAnimationFrame(raf)
    stopScroll(); window.removeEventListener('resize', schedule)
    resize.disconnect(); decoded.disconnect(); controller?.destroy(); frame.remove()
    host.removeAttribute('data-liquid-glass-content')
    for (const [name, value, priority] of original) {
      if (value) host.style.setProperty(name, value, priority)
      else host.style.removeProperty(name)
    }
  }
  try {
    measure()
    controller = engine.createGlass(lens, { mode: 'backdrop', fit: true, hidden: true,
      refraction: 14, bezel: .3, curvature: 4, chroma: 0, specularWidth: 1, radius,
      ...currentGlassQuality(host.clientWidth, Math.min(host.clientHeight, window.innerHeight + 192), undefined, host) })
    measure()
  } catch (error) { destroy(); throw error }
  return { destroy, refreshQuality: schedule }
}
