import type { GlassPreference } from './glass-settings'
// Clarity is optical diffusion, not white opacity. Keep the tint independent.
export function glassQuality(clarity: number, antialias: boolean, width = 0, height = 0, light = false, dpr = 1) {
  const clear = Number.isFinite(clarity) ? Math.max(0, Math.min(100, clarity)) : 86
  return {
    blur: 24 * Math.pow(1 - clear / 100, 1.5),
    // Resolution follows DPR. AA only changes boundary coverage, never quadruples
    // the textures of every panel/control. Avoid the old sub-CSS-pixel maps.
    mapScale: Math.max(1, Math.min(Math.max(1, dpr), 2,
      Math.sqrt(1_500_000 / Math.max(1, width * height)))),
    edgeSoftness: antialias ? .8 : 0,
    rimGlow: 0,
    boundedBezel: true,
    specular: light ? .50 : .22,
    specularAmbient: light ? .08 : .85,
  }
}

export function componentGlassQuality(p: GlassPreference, width: number, height: number, light: boolean, dpr: number) {
  const quality = glassQuality(p.clarity, p.antialias, width, height, light, dpr)
  const sampling = (p.resolution || Math.min(2, Math.max(1, dpr))) * (p.antialias ? p.aaScale : 1)
  // A real per-surface area limit, including AA. Large surfaces may fall below
  // one map pixel/CSS pixel; this is an explicit user quality trade-off.
  quality.mapScale = Math.min(sampling, Math.sqrt(p.pixelBudget * 1_000_000 / Math.max(1, width * height)))
  return quality
}

