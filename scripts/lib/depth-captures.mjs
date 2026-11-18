import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

export function* depthCaptures(args) {
  const files = []
  let url = 'http://localhost:3000/'
  for (const arg of args) {
    if (arg.startsWith('--url=')) url = new URL(arg.slice(6)).href
    else if (arg.startsWith('--')) throw new Error(`Unknown trace option: ${arg}`)
    else files.push(arg)
  }
  if (!files.length) throw new Error('Provide at least one .json.gz trace and optionally --url=<page URL>')

  for (const file of files) {
    const data = JSON.parse(gunzipSync(readFileSync(file)))
    const events = data.traceEvents
    const frames = []
    for (const event of events) {
      if (event.name === 'TracingStartedInBrowser') frames.push(...(event.args?.data?.frames ?? []))
      if (event.name === 'FrameCommittedInBrowser' && event.args?.data) frames.push(event.args.data)
    }
    const top = frames.filter(frame => frame.isOutermostMainFrame ?? !frame.parent)
    const targets = top.filter(frame => frame.url === url)
    const pids = new Set(targets.map(frame => frame.processId))
    const ids = new Set(targets.map(frame => frame.frame))
    const [pid] = pids
    if (pids.size !== 1 || !Number.isInteger(pid) || ids.size !== 1 || !targets[0]?.frame ||
        top.some(frame => frame.processId === pid && (frame.frame !== targets[0].frame || frame.url !== url))) {
      throw new Error(`${file}: cannot attribute this trace to a unique main frame and process for ${url}`)
    }
    const threads = new Set(events.filter(event => event.pid === pid && event.ph === 'M' &&
      event.name === 'thread_name' && event.args?.name === 'CrRendererMain').map(event => event.tid))
    if (threads.size !== 1) throw new Error(`${file}: ambiguous or missing renderer main thread for PID ${pid}`)
    const [tid] = threads
    yield { file, data, events, frames, pid, tid, url }
  }
}

export function* phaseIntervals(events, pid, name) {
  const pending = new Map()
  const phase = events.filter(event => event.pid === pid && event.name === name &&
    (event.ph === 'b' || event.ph === 'e')).sort((a, b) => a.ts - b.ts)
  for (const event of phase) {
    const id = event.id2 ?? event.id
    if (id == null) continue
    const key = JSON.stringify([event.cat, event.scope, id])
    if (event.ph === 'b') {
      const stack = pending.get(key) ?? []
      stack.push(event.ts)
      pending.set(key, stack)
    } else {
      const stack = pending.get(key)
      if (!stack?.length) continue
      const start = stack.pop()
      if (!stack.length) pending.delete(key)
      if (event.ts >= start) yield [start, event.ts]
    }
  }
}
