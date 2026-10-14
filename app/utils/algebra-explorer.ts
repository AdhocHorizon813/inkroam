export type Point = { x: number; y: number }

export function transformPoint(a: number, b: number, c: number, d: number, p: Point): Point {
  return { x: a * p.x + b * p.y, y: c * p.x + d * p.y }
}

export function matrixFacts(a: number, b: number, c: number, d: number) {
  const determinant = a * d - b * c
  return { determinant, rank: determinant !== 0 ? 2 : [a, b, c, d].some(value => value !== 0) ? 1 : 0 }
}

// Columns of the rotation are orthonormal eigenvectors, largest eigenvalue first.
export function symmetricSpectrum(a: number, b: number, d: number) {
  const radius = Math.hypot((a - d) / 2, b)
  const angle = Math.atan2(2 * b, a - d) / 2
  const vectors: [Point, Point] = [
    { x: Math.cos(angle), y: Math.sin(angle) },
    { x: -Math.sin(angle), y: Math.cos(angle) },
  ]
  const values = [(a + d) / 2 + radius, (a + d) / 2 - radius]
  const signs = values.map(value => Math.abs(value) < 1e-10 ? 0 : Math.sign(value))
  const classification = signs.every(value => value > 0) ? '正定'
    : signs.every(value => value < 0) ? '负定'
      : signs.includes(1) && signs.includes(-1) ? '不定'
        : signs.includes(1) ? '半正定（非正定）'
          : signs.includes(-1) ? '半负定（非负定）' : '零二次型'
  return { values, vectors, classification }
}

export function quadraticValue(a: number, b: number, d: number, p: Point) {
  return a * p.x * p.x + 2 * b * p.x * p.y + d * p.y * p.y
}

// Marching triangles: line segments approximate a level set in the fixed viewport.
// Subdividing each square avoids the ambiguous saddle case of marching squares.
export function quadraticContour(a: number, b: number, d: number, level: number, steps = 48) {
  const segments: [Point, Point][] = []
  const value = (p: Point) => quadraticValue(a, b, d, p) - level
  const triangle = (points: Point[]) => {
    const crossings: Point[] = []
    for (let index = 0; index < 3; index++) {
      const start = points[index]!, end = points[(index + 1) % 3]!
      const s = value(start), e = value(end)
      if ((s < 0) === (e < 0)) continue
      const ratio = s / (s - e)
      crossings.push({ x: start.x + ratio * (end.x - start.x), y: start.y + ratio * (end.y - start.y) })
    }
    if (crossings.length === 2) segments.push([crossings[0]!, crossings[1]!])
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const x = -4 + 8 * i / steps, y = -4 + 8 * j / steps, h = 8 / steps
      const p = { x, y }, r = { x: x + h, y }, s = { x: x + h, y: y + h }, t = { x, y: y + h }
      triangle([p, r, s]); triangle([p, s, t])
    }
  }
  return segments
}

export function polynomialValue(t: number, x: number) {
  return (x - 1) ** 2 * (x - t)
}

export function polynomialDerivative(t: number, x: number) {
  return (x - 1) * (3 * x - 2 * t - 1)
}

export function polynomialRootFacts(t: number) {
  return { repeatedRootMultiplicity: t === 1 ? 3 : 2, gcdDegree: t === 1 ? 2 : 1 }
}
