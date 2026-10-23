const exportCss = `
html,body{margin:0;background:#fff!important;color:#202124!important;color-scheme:light}
body{padding:32px;font:16px/1.9 system-ui,"Microsoft YaHei",sans-serif}
.export-content{width:760px;max-width:100%;margin:auto;padding:24px;box-sizing:border-box;overflow-wrap:anywhere}
h1{font-size:32px;line-height:1.4}h2{font-size:24px;margin-top:2em}h3{font-size:20px}
img,svg{max-width:100%;height:auto}a{color:#315c88}pre{white-space:pre-wrap!important;overflow-wrap:anywhere}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}
blockquote{border-left:2px solid #aaa;padding-left:16px;margin-left:0;color:#555}
.katex-mathml{position:absolute;clip:rect(1px,1px,1px,1px);width:1px;height:1px;overflow:hidden}
.article-code{background:#f5f5f3;border:1px solid #ddd;padding:12px;margin:1.5em 0}
.article-code pre{margin:0}.article-code span{color:var(--shiki-light,inherit)!important}
.article-table,.article-diagram__viewport{overflow:visible!important;max-height:none!important}
.article-diagram__svg svg{width:100%!important;min-width:0!important}
button,input,select,textarea,.article-code-actions,.article-diagram__toggle,.article-diagram__panel,.back-link{display:none!important}
pre,table,figure,img,svg{break-inside:avoid}h1,h2,h3{break-after:avoid}
.export-source{font-size:12px;color:#666;border-top:1px solid #ddd;margin-top:32px;padding-top:12px}
@page{size:A4;margin:16mm}@media print{body{padding:0}.export-content{width:auto}}
`

export function exportFilename(title: string) {
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim().slice(0, 90) || 'Inkroam'
}

// Only clone content: no live state, event handlers, scripts or site chrome.
export async function cloneArticleBody(body: HTMLElement) {
  const clone = body.cloneNode(true) as HTMLElement
  // Render from source even when the article's IntersectionObserver has not
  // loaded the figure. Use a light diagram for the white export surface.
  for (const diagram of clone.querySelectorAll('.article-diagram')) {
    const source = diagram.querySelector('.article-diagram__panel code')?.textContent
    if (!source) throw new Error('未能取得图表源码，无法完整导出。')
    const { renderDiagram } = await import('~/utils/mermaid')
    const image = document.createElement('div')
    image.className = 'article-diagram__image'
    image.innerHTML = await renderDiagram(source, false, 'Arial, Microsoft YaHei, sans-serif')
    diagram.replaceChildren(image)
  }
  clone.querySelectorAll('script,button,input,select,textarea,.article-code-actions,.article-diagram__toggle,.article-diagram__panel').forEach(node => node.remove())
  clone.querySelectorAll('style').forEach(node => { if (!node.closest('svg')) node.remove() })
  // Embedded PDFs have independent documents; export their download link, not a blank frame.
  clone.querySelectorAll('object,iframe,canvas').forEach(node => {
    const original = node.closest('.pdf-viewer')?.querySelector<HTMLAnchorElement>('a[href]')
    const note = document.createElement('p')
    note.textContent = 'PDF / 画布内容请在原页面查看。'
    if (original) { const link = original.cloneNode(true) as HTMLAnchorElement; link.href = original.href; note.append(' ', link) }
    node.replaceWith(note)
  })
  clone.querySelectorAll<HTMLImageElement>('img').forEach(image => { image.src = image.currentSrc || image.src; image.loading = 'eager'; image.removeAttribute('srcset') })
  clone.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => { link.href = link.href })
  // Preserve SVG IDs, styles and marker references (Mermaid uses all three).
  return clone
}

export async function createExportFrame(title: string, body: HTMLElement) {
  const clone = await cloneArticleBody(body)
  const frame = document.createElement('iframe')
  frame.title = '正文导出预览'
  frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:840px;height:1000px;border:0;pointer-events:none'
  frame.setAttribute('aria-hidden', 'true')
  document.body.append(frame)
  const doc = frame.contentDocument!
  const style = doc.createElement('style'); style.textContent = exportCss
  // Only KaTeX's font/layout rules are needed; site theme and wallpaper stay out.
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules).filter(rule => /katex|KaTeX/.test(rule.cssText)).map(rule => rule.cssText).join('\n')
      if (rules) { const fonts = doc.createElement('style'); fonts.textContent = rules.replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (_m, _q, url) => `url("${new URL(url, sheet.href || location.href).href}")`); doc.head.append(fonts) }
    } catch { /* Cross-origin sheets cannot be inspected. Local KaTeX CSS is bundled. */ }
  }
  doc.head.append(style)
  doc.title = title
  const content = doc.createElement('div'); content.className = 'export-content'
  const heading = doc.createElement('h1'); heading.textContent = title
  content.append(heading, doc.importNode(clone, true))
  const source = doc.createElement('p'); source.className = 'export-source'; source.textContent = `纸上漫游 · ${location.href.split('#')[0]}`
  content.append(source); doc.body.append(content)
  try {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        Promise.all([doc.fonts.ready, ...Array.from(doc.images).map(image => image.decode())]),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('图片或字体加载超时，请稍后重试。')), 20000) }),
      ])
    } finally { clearTimeout(timer) }
    return { frame, content }
  } catch (error) { frame.remove(); throw error }
}

export function articleSections(body: HTMLElement) {
  const result: { title: string; body: HTMLElement }[] = []
  let section = document.createElement('div')
  let title = '引言'
  // ContentRenderer may add an outer wrapper. Headings and paragraphs share its parent.
  const heading = body.querySelector('h2')
  const parent = heading?.parentElement || (body.children.length === 1 && body.firstElementChild?.tagName === 'DIV' ? body.firstElementChild : body)
  for (const node of Array.from(parent.childNodes)) {
    if (node instanceof HTMLElement && node.tagName === 'H2') {
      if (section.textContent?.trim() || section.querySelector('img,svg')) result.push({ title, body: section })
      section = document.createElement('div'); title = node.textContent || '小节'
    }
    section.append(node.cloneNode(true))
  }
  if (section.childNodes.length) result.push({ title, body: section })
  return result
}
