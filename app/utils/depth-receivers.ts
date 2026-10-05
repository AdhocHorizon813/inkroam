export type SurfaceBox = { x: number; y: number; width: number; height: number; radius: number }

/** Crop only beyond a generous blur margin, never at the viewport edge.
 * This bounds raster size for very long lessons without a fake visible top edge. */
export function visibleSurface(box: SurfaceBox, width: number, height: number, reach = 96): SurfaceBox | null {
  if (![box.x, box.y, box.width, box.height, box.radius, width, height].every(Number.isFinite)
    || box.width <= 0 || box.height <= 0 || width <= 0 || height <= 0
    || box.x + box.width < -reach || box.x > width + reach
    || box.y + box.height < -reach || box.y > height + reach) return null
  const x = Math.max(-reach, box.x)
  const y = Math.max(-reach, box.y)
  const right = Math.min(width + reach, box.x + box.width)
  const bottom = Math.min(height + reach, box.y + box.height)
  return { x, y, width: right - x, height: bottom - y, radius: Math.max(0, Math.min(box.radius, box.width / 2, box.height / 2)) }
}
