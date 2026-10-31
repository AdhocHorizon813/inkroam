import type { GlassGlobalOverride, GlassPreferences } from './glass-settings'

// User-tuned in Edge on 2026-10-29. Exact capture is archived in docs.
// Factories return independent objects; applying defaults must not mutate them.
const COMPONENT_DEFAULTS: Omit<GlassPreferences, 'tools-track'> = {
  "navbar": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 100,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 1,
    "settleDelay": 0
  },
  "content": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 100,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 2048,
    "pixelBudget": 1.5,
    "resolution": 0.5,
    "settleDelay": 0
  },
  "appearance": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 50,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0.5,
    "settleDelay": 0
  },
  "music": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 50,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0.5,
    "settleDelay": 0
  },
  "tools": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 75,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0,
    "settleDelay": 0
  },
  "dropdown": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 100,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0,
    "settleDelay": 0
  },
  "confirm": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 50,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0.5,
    "settleDelay": 0
  },
  "toolbar": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 75,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0,
    "settleDelay": 0
  },
  "button": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 100,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0,
    "settleDelay": 0
  },
  "dock": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 100,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0,
    "settleDelay": 0
  },
  "indicator": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 100,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0,
    "settleDelay": 0
  },
  "thumb": {
    "aaScale": 1,
    "antialias": true,
    "clarity": 100,
    "deform": true,
    "enabled": true,
    "maxFps": 0,
    "maxSide": 4096,
    "pixelBudget": 1.5,
    "resolution": 0,
    "settleDelay": 0
  }
}
const GLOBAL_DEFAULTS = {
  "aaScale": 1,
  "antialias": true,
  "clarity": 100,
  "deform": true,
  "enabled": true,
  "maxFps": 60,
  "maxSide": 1024,
  "pixelBudget": 1.5,
  "resolution": 0.5,
  "settleDelay": 80
}

export function createDefaultGlassPreferences(): GlassPreferences {
  const components = Object.fromEntries(Object.entries(COMPONENT_DEFAULTS).map(([id, value]) => [id, { ...value }])) as Omit<GlassPreferences, 'tools-track'>
  // Start the new track item at the existing toolbar's captured parameters.
  return { ...components, 'tools-track': { ...components.tools } }
}

export function createDefaultGlassGlobal(): GlassGlobalOverride {
  // The captured override was on; new visitors still explicitly opt into it.
  return { enabled: false, settings: { ...GLOBAL_DEFAULTS } }
}

