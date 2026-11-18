// Offline trace inspection. All durations below are in milliseconds.
import { depthCaptures, phaseIntervals } from './lib/depth-captures.mjs'

const round = value => +value.toFixed(3)
function stats(durations) {
  durations.sort((a, b) => a - b)
  const n = durations.length
  return {
    n, sum: round(durations.reduce((total, value) => total + value, 0)),
    median: n ? round(durations[Math.floor(n / 2)]) : null,
    p95: n ? round(durations[Math.floor(n * .95)]) : null,
    max: n ? round(durations.at(-1)) : null,
  }
}

for (const { file, data, events, frames, pid, tid, url } of depthCaptures(process.argv.slice(2))) {
  const scrolls = events.filter(event => event.pid === pid && event.tid === tid &&
    event.name === 'EventDispatch' && event.args?.data?.type === 'scroll').sort((a, b) => a.ts - b.ts)
  if (!scrolls.length) throw new Error(`No scroll events for ${url}: ${file}`)
  const groups = []
  for (const event of scrolls) {
    const last = groups.at(-1)
    if (last && event.ts - last.end <= 500_000) {
      last.end = event.ts
      last.count++
    } else {
      groups.push({ start: event.ts, end: event.ts, count: 1 })
    }
  }
  // Include the settling animation after each burst. Overlap counts once,
  // attributed to the first matching burst as in the original report.
  const groupAt = time => groups.find(group => time >= group.start && time < group.end + 1_500_000)
  const measures = {}
  const names = ['RunTask', 'FunctionCall', 'FireAnimationFrame', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'RasterTask', 'GPUTask']
  for (const name of names) {
    const samples = events.filter(event => {
      if (event.ph !== 'X' || event.name !== name || !groupAt(event.ts)) return false
      if (name === 'GPUTask') return event.args?.data?.renderer_pid === pid
      return event.pid === pid && (name === 'RasterTask' || event.tid === tid)
    })
    measures[name] = stats(samples.map(event => event.dur / 1000))
  }
  const phases = {}, phaseBins = {}
  for (const name of ['SendBeginMainFrameToCommit', 'SubmitCompositorFrameToPresentationCompositorFrame', 'ReceiveCompositorFrameToStartDraw', 'StartDrawToSwapStart', 'SwapEndToPresentationCompositorFrame']) {
    const durations = [], bins = [[], [], []]
    for (const [start, end] of phaseIntervals(events, pid, name)) {
      const group = groupAt(start)
      if (!group) continue
      const duration = (end - start) / 1000
      const elapsed = (start - group.start) / 1000
      durations.push(duration)
      bins[elapsed < 440 ? 0 : elapsed < 1000 ? 1 : 2].push(duration)
    }
    phases[name] = stats(durations)
    phaseBins[name] = bins.map(stats)
  }
  const animationWarnings = events.filter(event => event.pid === pid && event.name === 'Animation' &&
    event.ph === 'n' && Object.keys(event.args?.data ?? {}).some(key => key !== 'state')).slice(0, 12)
  const origin = scrolls[0].ts
  const scrollGroups = groups.map(group => ({
    start: round((group.start - origin) / 1e6), span: round((group.end - group.start) / 1e6), count: group.count,
  }))
  console.log(JSON.stringify({
    file, start: data.metadata?.startTime, dpr: data.metadata?.hostDPR, pid, frames, scrollGroups, measures, phases, phaseBins, animationWarnings,
  }, null, 2))
}
