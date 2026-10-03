let queue: Promise<unknown> = Promise.resolve()
let sequence = 0

/** Mermaid configuration is global: serialize initialization and rendering. */
export function renderDiagram(source: string, dark: boolean, fontFamily: string) {
  const task = queue.then(async () => {
    // Author prose, not executable diagram directives or externally linked content.
    if (source.length > 20000 || /%%\{|^\s*---/m.test(source)) throw new Error('Unsupported diagram configuration')
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
      theme: dark ? 'dark' : 'neutral', fontFamily,
      flowchart: { htmlLabels: false, useMaxWidth: false },
    })
    const result = await mermaid.render(`inkroam-diagram-${++sequence}`, source)
    return result.svg
  })
  queue = task.catch(() => {})
  return task
}
