import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Exercise the real rasterizer. An analytic corner normal must have no
// tangential displacement; merely checking that R/G channels exist misses this.
const { renderLensMap } = await import(pathToFileURL(resolve(
  process.argv.slice(2).find(arg => !arg.startsWith('--')) || 'app/vendor/liquidglass/liquid-glass.js')))
const previousDocument = globalThis.document
globalThis.document = { createElement(tag) {
  assert.equal(tag, 'canvas')
  const canvas = { width: 0, height: 0 }
  canvas.getContext = () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: image => { canvas.pixels = image.data },
  })
  return canvas
} }

try {
  const shapes = [
    { width: 28, height: 18, radius: 9, refractionHeight: 8.1 }, // slider at rest
    { width: 42, height: 28, radius: 14, refractionHeight: 12.6 }, // pressed slider
    { width: 80, height: 32, radius: 10, refractionHeight: 7.04 },
    { width: 106, height: 42, radius: 10, refractionHeight: 9.24 },
    { width: 173, height: 40, radius: 9, refractionHeight: 20 }, // bevel exceeds corner
    { width: 40, height: 40, radius: 20, refractionHeight: 18 },
  ]
  let checkedCorners = 0, checkedSides = 0
  for (const shape of shapes) for (const scale of [.25, 1, 2]) {
    const options = { ...shape, opticalProfile: 'circular', rimGlow: 0 }
    const { canvas, width: w, height: h } = renderLensMap(options, scale)
    const at = (x, y) => {
      const i = Math.max(0, Math.min(w - 1, Math.floor(x * w / shape.width)))
      const j = Math.max(0, Math.min(h - 1, Math.floor(y * h / shape.height)))
      const o = (j * w + i) * 4, px = canvas.pixels
      return { x: (i + .5) * shape.width / w, y: (j + .5) * shape.height / h,
        dx: px[o] - 128, dy: px[o + 1] - 128, alpha: px[o + 3] }
    }
    // Side midpoints exercise actual displacement on every part of the rim.
    for (const [x, y, nx, ny] of [
      [.5, shape.height / 2, 1, 0], [shape.width - .5, shape.height / 2, -1, 0],
      [shape.width / 2, .5, 0, 1], [shape.width / 2, shape.height - .5, 0, -1],
    ]) {
      const p = at(x, y)
      if (scale < 1) continue // a coarse pixel can straddle a tiny straight side
      assert(p.dx * nx + p.dy * ny > 0, 'Every side must bend towards the interior')
      // On a capsule/circle, an even-sized raster samples half a pixel away
      // from the exact axis; allow that small geometric tilt.
      assert(Math.abs(p.dx * ny - p.dy * nx) <= .1 * (p.dx * nx + p.dy * ny) + 1,
        'Near-axis displacement must remain predominantly inward')
      checkedSides++
    }
    // Trace each real quarter-circle, including the joins with straight sides.
    for (const signX of [-1, 1]) for (const signY of [-1, 1]) {
      const cx = signX < 0 ? shape.radius : shape.width - shape.radius
      const cy = signY < 0 ? shape.radius : shape.height - shape.radius
      for (const fraction of [.02, .15, .3, .5, .7, .85, .98]) {
        const angle = fraction * Math.PI / 2, inset = Math.min(1, shape.radius / 4)
        const p = at(cx + signX * (shape.radius - inset) * Math.cos(angle),
          cy + signY * (shape.radius - inset) * Math.sin(angle))
        const rx = p.x - cx, ry = p.y - cy, length = Math.hypot(rx, ry)
        if (rx * signX <= 0 || ry * signY <= 0 || !p.alpha) continue
        const nx = -rx / length, ny = -ry / length
        // Each 8-bit vector component rounds by at most 0.5; tangential
        // error is therefore bounded by sqrt(0.5), independent of angle.
        assert(Math.abs(p.dx * ny - p.dy * nx) <= Math.SQRT1_2 + 1e-6,
          `Bend leaves actual corner normal: ${JSON.stringify({ shape, scale, p, nx, ny })}`)
        checkedCorners++
      }
    }
    // Any ambiguous medial-axis normal must lie in the neutral interior.
    if (shape.refractionHeight > shape.radius && scale >= 1) {
      const p = at(shape.radius + 1, shape.radius + 2)
      assert.equal(p.dx, 0)
      assert.equal(p.dy, 0)
    }
    // Rotating a lens rotates the displacement field, including its corners.
    const rotated = renderLensMap({ ...options, width: shape.height, height: shape.width }, scale)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4, t = (i * h + j) * 4
      assert.equal(canvas.pixels[o], rotated.canvas.pixels[t + 1])
      assert.equal(canvas.pixels[o + 1], rotated.canvas.pixels[t])
      assert.equal(canvas.pixels[o + 3], rotated.canvas.pixels[t + 3])
    }
  }
  assert(checkedCorners > 200)
  console.log(`PASS: ${checkedCorners} rounded-boundary samples, ${checkedSides} side samples, rotation symmetry and neutral medial axis`)
} finally {
  globalThis.document = previousDocument
}
