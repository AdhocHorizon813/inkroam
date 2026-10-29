import type { ObjectDirective } from 'vue'
import { afterGlassMotion } from './glass-motion'

// Explicit component ownership avoids watching every text/DOM mutation on a page.
export const glassSurfaces = new Set<HTMLElement>()
export const GLASS_SURFACES_CHANGED = 'inkroam:glass-surfaces-changed'
const closing = new WeakMap<HTMLElement, () => void>()
const presence = new WeakMap<HTMLElement, () => void>()
const notify = () => window.dispatchEvent(new Event(GLASS_SURFACES_CHANGED))

function release(el: HTMLElement) {
  closing.get(el)?.()
  closing.delete(el)
  if (glassSurfaces.delete(el)) notify()
}
function update(el: HTMLElement, open: boolean) {
  closing.get(el)?.()
  closing.delete(el)
  if (open) {
    if (!glassSurfaces.has(el)) { glassSurfaces.add(el); notify() }
  } else if (glassSurfaces.has(el)) {
    closing.set(el, afterGlassMotion(el, () => release(el), true))
  }
}
export const vExperimentalGlass: ObjectDirective<HTMLElement, boolean> = {
  mounted: (el, binding) => update(el, binding.value),
  updated: (el, binding) => {
    if (binding.value !== binding.oldValue) update(el, binding.value)
  },
  // Vue retains leaving DOM after beforeUnmount. Its actual ancestor motion,
  // rather than the business flag or unmount hook, owns the final optical frame.
  beforeUnmount: el => update(el, false),
  unmounted: el => { if (!el.isConnected) release(el) },
}

/** Interaction may end immediately (inert); optical presence ends after motion.
 * Put this on the animated owner, including wrappers outside the glass host. */
function setPresence(el: HTMLElement, open: boolean, initial = false) {
  presence.get(el)?.()
  presence.delete(el)
  el.dataset.glassPresence = initial ? (open ? 'open' : 'closed') : (open ? 'opening' : 'closing')
  notify()
  if (!initial) presence.set(el, afterGlassMotion(el, () => {
    presence.delete(el)
    el.dataset.glassPresence = open ? 'open' : 'closed'
    notify()
  }))
}
export const vGlassPresence: ObjectDirective<HTMLElement, boolean> = {
  mounted: (el, binding) => setPresence(el, binding.value, true),
  updated: (el, binding) => {
    if (binding.value !== binding.oldValue) setPresence(el, binding.value)
  },
  beforeUnmount: el => { presence.get(el)?.(); presence.delete(el) },
}
