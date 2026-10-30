/** Wait for the browser's finite CSS/WAAPI motion, after Vue's two-frame
 * transition setup. The timeout is derived from live effect timing, never a
 * component-wide guessed exit duration. Cancellation invalidates all promises. */
export function afterGlassMotion(el: HTMLElement, done: () => void, ancestors = false) {
  let cancelled = false, frame = 0, timer = 0, revision = 0
  const nodes: HTMLElement[] = []
  for (let node: HTMLElement | null = el; node; node = ancestors ? node.parentElement : null) nodes.push(node)
  const animations = () => nodes.flatMap(node => node.getAnimations?.() ?? []).filter(animation => {
    const end = animation.effect?.getComputedTiming().endTime
    return animation.playState !== 'finished' && animation.playState !== 'idle'
      && typeof end === 'number' && Number.isFinite(end)
  })
  const clean = () => {
    cancelAnimationFrame(frame); clearTimeout(timer)
    for (const node of nodes) {
      node.removeEventListener('transitionrun', changed)
      node.removeEventListener('animationstart', changed)
    }
  }
  const finish = () => { if (!cancelled) { cancelled = true; clean(); done() } }
  const inspect = () => {
    if (cancelled) return
    const mine = ++revision
    clearTimeout(timer)
    if (!el.isConnected) { finish(); return }
    const pending = animations()
    if (!pending.length) { finish(); return }
    const remaining = Math.max(...pending.map(animation => {
      const end = Number(animation.effect!.getComputedTiming().endTime)
      return Math.max(0, (end - Number(animation.currentTime ?? 0)) / Math.abs(animation.playbackRate || 1))
    }))
    // Only a watchdog for a lost finished signal. Recheck rather than destroy a
    // still-visible animation (e.g. paused DevTools playback or a reversal).
    timer = window.setTimeout(inspect, Math.max(32, remaining + 34))
    void Promise.allSettled(pending.map(animation => animation.finished)).then(() => {
      if (!cancelled && mine === revision) frame = requestAnimationFrame(inspect)
    })
  }
  function changed(event: Event) {
    if (!nodes.includes(event.target as HTMLElement) || cancelled) return
    revision++
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(inspect)
  }
  for (const node of nodes) {
    node.addEventListener('transitionrun', changed)
    node.addEventListener('animationstart', changed)
  }
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(inspect) })
  })
  return () => { cancelled = true; revision++; clean() }
}
