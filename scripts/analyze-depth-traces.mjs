// Read-only Chrome trace comparison. Usage: node scripts/analyze-depth-traces.mjs file.json.gz ...
import { depthCaptures, phaseIntervals } from './lib/depth-captures.mjs'
const stats = values => {
  values.sort((a, b) => a - b)
  const round = n => n == null ? null : +n.toFixed(3)
  return { count: values.length, medianMs: round(values[Math.floor(values.length * .5)]),
    p95Ms: round(values[Math.floor(values.length * .95)]), maxMs: round(values.at(-1)) }
}
for (const { file, data, events, pid, tid, url } of depthCaptures(process.argv.slice(2))) {
  const scrolls = events.filter(e => e.pid === pid && e.tid === tid && e.name === 'EventDispatch' && ['scroll', 'wheel'].includes(e.args?.data?.type))
  if (!scrolls.length) throw new Error(`No scroll events: ${file}`)
  const start = scrolls.reduce((first, event) => Math.min(first, event.ts), Infinity)
  const end = scrolls.reduce((last, event) => Math.max(last, event.ts), -Infinity) + 1_000_000
  const phases = {}
  for (const name of ['SubmitCompositorFrameToPresentationCompositorFrame', 'StartDrawToSwapStart', 'SwapEndToPresentationCompositorFrame']) {
    const durations = []
    for (const [begin, finish] of phaseIntervals(events, pid, name)) {
      if (begin >= start && begin <= end) durations.push((finish - begin) / 1000)
    }
    phases[name] = stats(durations)
  }
  const gpu = events.find(e => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrGpuMain')
  const gpuTasks = events.filter(e => e.ph === 'X' && e.name === 'RunTask' && e.pid === gpu?.pid && e.tid === gpu?.tid)
  console.log(JSON.stringify({ file, url, pid, hostDPR: data.metadata?.hostDPR, interactionWindowSeconds: (end - start) / 1e6,
    phases, gpuProcessTasksWholeCapture: stats(gpuTasks.map(e => e.dur / 1000)),
    caveat: 'Async phase timings are wall time, not shader execution time. Captures differ in duration/input; no FPS inferred.' }, null, 2))
}
