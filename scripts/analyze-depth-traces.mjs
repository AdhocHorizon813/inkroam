// Read-only Chrome trace comparison. Usage: node scripts/analyze-depth-traces.mjs file.json.gz ...
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const stats = values => {
  values.sort((a, b) => a - b)
  const round = n => n == null ? null : +n.toFixed(3)
  return { count: values.length, medianMs: round(values[Math.floor(values.length * .5)]),
    p95Ms: round(values[Math.floor(values.length * .95)]), maxMs: round(values.at(-1)) }
}
for (const file of process.argv.slice(2)) {
  const data = JSON.parse(gunzipSync(readFileSync(file)))
  const events = data.traceEvents
  const renderer = events.find(e => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
  if (!renderer) throw new Error(`No renderer thread: ${file}`)
  const scrolls = events.filter(e => e.pid === renderer.pid && e.name === 'EventDispatch' && ['scroll', 'wheel'].includes(e.args?.data?.type))
  if (!scrolls.length) throw new Error(`No scroll events: ${file}`)
  const start = Math.min(...scrolls.map(e => e.ts))
  const end = Math.max(...scrolls.map(e => e.ts)) + 1_000_000
  const phases = {}
  for (const name of ['SubmitCompositorFrameToPresentationCompositorFrame', 'StartDrawToSwapStart', 'SwapEndToPresentationCompositorFrame']) {
    const pending = new Map(), durations = []
    for (const e of events.filter(e => e.pid === renderer.pid && e.name === name).sort((a, b) => a.ts - b.ts)) {
      const key = JSON.stringify(e.id2 ?? e.id)
      if (e.ph === 'b') pending.set(key, e.ts)
      else if (e.ph === 'e' && pending.has(key)) {
        const begin = pending.get(key)
        if (begin >= start && begin <= end && e.ts >= begin) durations.push((e.ts - begin) / 1000)
        pending.delete(key)
      }
    }
    phases[name] = stats(durations)
  }
  const gpu = events.find(e => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrGpuMain')
  const gpuTasks = events.filter(e => e.ph === 'X' && e.name === 'RunTask' && e.pid === gpu?.pid && e.tid === gpu?.tid)
  console.log(JSON.stringify({ file, hostDPR: data.metadata.hostDPR, interactionWindowSeconds: (end - start) / 1e6,
    phases, gpuProcessTasksWholeCapture: stats(gpuTasks.map(e => e.dur / 1000)),
    caveat: 'Async phase timings are wall time, not shader execution time. Captures differ in duration/input; no FPS inferred.' }, null, 2))
}
