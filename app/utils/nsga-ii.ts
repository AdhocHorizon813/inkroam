/** Teaching implementation: unconstrained minimization, finite objective values. */
export interface Individual { id: string; f: number[]; source?: 'P_t' | 'Q_t' }
export const examplePopulation: Individual[] = [
  { id: 'A', f: [1, 5], source: 'P_t' }, { id: 'B', f: [3, 3], source: 'Q_t' },
  { id: 'C', f: [5, 1], source: 'Q_t' }, { id: 'D', f: [2, 8], source: 'P_t' },
  { id: 'E', f: [3, 6], source: 'Q_t' }, { id: 'F', f: [4, 5], source: 'P_t' },
  { id: 'G', f: [6, 4], source: 'Q_t' }, { id: 'H', f: [8, 2], source: 'P_t' },
  { id: 'I', f: [4, 8], source: 'Q_t' }, { id: 'J', f: [6, 6], source: 'P_t' },
  { id: 'K', f: [7, 5], source: 'Q_t' }, { id: 'L', f: [9, 4], source: 'P_t' },
]

export function dominates(p: Individual, q: Individual): boolean {
  return p.f.every((value, m) => value <= q.f[m]!) && p.f.some((value, m) => value < q.f[m]!)
}

export function fastNonDominatedSort(population: Individual[]) {
  const S_p: Record<string, string[]> = {}
  const n_p: Record<string, number> = {}
  const rank: Record<string, number> = {}
  for (const p of population) {
    S_p[p.id] = []
    n_p[p.id] = 0
    for (const q of population) {
      if (dominates(p, q)) S_p[p.id]!.push(q.id)
      else if (dominates(q, p)) n_p[p.id]!++
    }
  }
  const remaining = { ...n_p }
  const snapshots = [{ ...remaining }]
  const fronts: Individual[][] = []
  let front = population.filter(p => remaining[p.id] === 0)
  while (front.length) {
    fronts.push(front)
    const next = new Set<string>()
    for (const p of front) {
      rank[p.id] = fronts.length
      for (const q of S_p[p.id]!) {
        remaining[q]!--
        if (remaining[q] === 0) next.add(q)
      }
    }
    snapshots.push({ ...remaining })
    front = population.filter(p => next.has(p.id))
  }
  return { fronts, S_p, n_p, rank, snapshots }
}

export interface DistanceTerm {
  m: number; previous?: Individual; next?: Individual; range: number; value: number; boundary: boolean
}
export function crowdingDistanceAssignment(I: Individual[]) {
  const distance: Record<string, number> = Object.fromEntries(I.map(p => [p.id, 0]))
  const terms: Record<string, DistanceTerm[]> = Object.fromEntries(I.map(p => [p.id, []]))
  if (!I.length) return { distance, terms }
  for (let m = 0; m < I[0]!.f.length; m++) {
    const sorted = [...I].sort((p, q) => p.f[m]! - q.f[m]! || p.id.localeCompare(q.id))
    const range = sorted.at(-1)!.f[m]! - sorted[0]!.f[m]!
    sorted.forEach((p, i) => {
      // Constant objectives carry no spacing information. One/two-member fronts keep their boundaries.
      const boundary = I.length <= 2 || (range > 0 && (i === 0 || i === I.length - 1))
      const previous = sorted[i - 1], next = sorted[i + 1]
      const value = boundary ? Infinity : range === 0 ? 0 : (next!.f[m]! - previous!.f[m]!) / range
      distance[p.id]! += value
      terms[p.id]!.push({ m, previous, next, range, value, boundary })
    })
  }
  return { distance, terms }
}

export function environmentalSelection(population: Individual[], N: number) {
  if (!Number.isInteger(N) || N < 0 || N > population.length) throw new RangeError('Invalid N')
  const sorting = fastNonDominatedSort(population)
  const selected: Individual[] = []
  const distance: Record<string, number> = {}
  let splitFront = 0
  for (const [index, front] of sorting.fronts.entries()) {
    Object.assign(distance, crowdingDistanceAssignment(front).distance)
    if (selected.length >= N) continue
    if (selected.length + front.length <= N) selected.push(...front)
    else {
      splitFront = index + 1
      const ordered = [...front].sort((p, q) => distance[p.id] === distance[q.id]
        ? p.id.localeCompare(q.id) : distance[p.id]! > distance[q.id]! ? -1 : 1)
      selected.push(...ordered.slice(0, N - selected.length))
    }
  }
  return { ...sorting, selected, distance, splitFront }
}
