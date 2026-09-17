import type { RouterConfig } from '@nuxt/schema'

export default {
  // Keep Nuxt's saved positions and anchor offsets; use the browser's eased scroll.
  get scrollBehaviorType() {
    return import.meta.client && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'smooth' as const
      : 'auto' as const
  },
} satisfies RouterConfig
