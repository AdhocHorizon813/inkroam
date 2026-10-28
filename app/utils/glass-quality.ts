// Clarity is optical diffusion, not white opacity. Keep the tint independent.
export function glassQuality(clarity: number, antialias: boolean, width = 0, height = 0, light = false) {
  const clear = Number.isFinite(clarity) ? Math.max(0, Math.min(100, clarity)) : 86
  return {
    blur: 24 * Math.pow(1 - clear / 100, 1.5),
    // Supersample small lenses; cap large surfaces to bound texture memory.
    mapScale: Math.min(antialias ? 2 : 1, (antialias ? 2048 : 1024) / Math.max(1, width, height)),
    edgeSoftness: antialias ? 1.25 : 0,
    specular: light ? .50 : .22,
    specularAmbient: light ? .08 : .85,
  }
}

export function currentGlassQuality(width = 0, height = 0) {
  const data = document.documentElement.dataset
  return glassQuality(data.glassClarity === undefined ? 86 : Number(data.glassClarity), data.glassAntialias === 'on', width, height, data.colorMode === 'light')
}
