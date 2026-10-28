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

export function currentGlassQuality(width = 0, height = 0, colorMode?: string) {
  const data = document.documentElement.dataset
  return glassQuality(data.glassClarity === undefined ? 86 : Number(data.glassClarity), data.glassAntialias === 'on', width, height, (colorMode || data.colorMode) === 'light', window.devicePixelRatio || 1)
}
