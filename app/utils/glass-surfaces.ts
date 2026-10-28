import type { ObjectDirective } from 'vue'

// Explicit component ownership avoids watching every text/DOM mutation on a page.
export const glassSurfaces = new Set<HTMLElement>()
export const GLASS_SURFACES_CHANGED = 'inkroam:glass-surfaces-changed'
const closing = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()
const notify = () => window.dispatchEvent(new Event(GLASS_SURFACES_CHANGED))

function release(el: HTMLElement) {
  clearTimeout(closing.get(el))
  closing.delete(el)
  if (glassSurfaces.delete(el)) notify()
}

function update(el: HTMLElement, open: boolean) {
  clearTimeout(closing.get(el))
  closing.delete(el)
  if (open) {
    glassSurfaces.add(el)
    notify()
  } else if (glassSurfaces.has(el)) {
    // Keep the same material through the existing 160/180ms closing motion.
    closing.set(el, setTimeout(() => release(el), 300))
  }
}

export const vExperimentalGlass: ObjectDirective<HTMLElement, boolean> = {
  mounted: (el, binding) => update(el, binding.value),
  updated: (el, binding) => {
    if (binding.value !== binding.oldValue) update(el, binding.value)
  },
  // Vue can start unmounting while the outer Transition still shows this DOM.
  // Retain the filter for that final 180ms reveal animation; then release it.
  beforeUnmount: el => update(el, false),
}
