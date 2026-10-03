<script setup lang="ts">
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { findPdfMatches, type PdfMatch } from '~/utils/pdf-search'

const props = defineProps<{ src: string; title?: string }>()
const emit = defineEmits<{ failed: [] }>()

const frame = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const pageCount = ref(0)
const pageNumber = ref(1)
const zoom = ref(1)
const busy = ref(false)
const pageInput = ref('1')
const rotation = ref(0)
const notice = ref('')
const searchOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const searchButton = ref<HTMLButtonElement | null>(null)
const query = ref('')
const matches = ref<PdfMatch[]>([])
const selectedMatch = ref(-1)
const searchedPages = ref(0)
const searching = ref(false)
const searchNotice = ref('')
const textHost = ref<HTMLElement | null>(null)
let searchToken = 0
let textLayer: import('pdfjs-dist').TextLayer | null = null
let layerPage = 0
let revealMatch = false
const textCache = new Map<number, Awaited<ReturnType<import('pdfjs-dist').PDFPageProxy['getTextContent']>>>()

async function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    await nextTick()
    searchInput.value?.focus()
  } else {
    searchToken++
    searching.value = false
    matches.value = []
    selectedMatch.value = -1
    query.value = ''
    searchNotice.value = ''
    textLayer?.cancel()
    textLayer = null
    textHost.value?.replaceChildren()
    textCache.clear()
    searchButton.value?.focus()
  }
}

async function searchDocument() {
  const current = ++searchToken
  matches.value = []
  selectedMatch.value = -1
  searchedPages.value = 0
  searchNotice.value = ''
  paintMatches()
  const value = query.value.trim()
  searching.value = !!value && !!pdf
  if (!value || !pdf) return
  let failures = 0
  for (let number = 1; number <= pdf.numPages; number++) {
    if (disposed || current !== searchToken) return
    try {
      let content = textCache.get(number)
      if (!content) content = await (await pdf.getPage(number)).getTextContent()
      if (disposed || current !== searchToken) return
      textCache.set(number, content)
      const items = content.items.filter((item): item is import('pdfjs-dist/types/src/display/api').TextItem => 'str' in item)
      matches.value.push(...findPdfMatches(items, value, number))
      if (selectedMatch.value === -1 && matches.value.length) selectMatch(0)
    } catch { failures++ }
    if (disposed || current !== searchToken) return
    searchedPages.value = number
    // Let typing, scrolling and rendering proceed between pages.
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  if (disposed || current !== searchToken) return
  searching.value = false
  searchNotice.value = failures ? `${failures} 页文字未能读取，结果可能不完整。` : matches.value.length ? '' : '未找到匹配；扫描图片或特殊编码文字可能无法搜索。'
  paintMatches()
}

function invalidateSearch() {
  searchToken++
  searching.value = false
  matches.value = []
  selectedMatch.value = -1
  searchNotice.value = ''
  paintMatches()
}

function selectMatch(index: number) {
  if (!matches.value.length) return
  selectedMatch.value = (index + matches.value.length) % matches.value.length
  const match = matches.value[selectedMatch.value]!
  revealMatch = true
  if (match.page !== pageNumber.value) jumpToPage(match.page)
  else if (textLayer && layerPage === match.page) paintMatches()
  else renderPage()
}

function paintMatches() {
  if (!textLayer) return
  const divisions = textLayer.textDivs
  divisions.forEach((div, index) => { div.textContent = textLayer!.textContentItemsStr[index] || '' })
  const pieces = new Map<number, { start: number; end: number; active: boolean }[]>()
  matches.value.forEach((match, index) => {
    if (match.page !== layerPage) return
    match.parts.forEach(part => {
      const list = pieces.get(part.item) || []
      list.push({ ...part, active: index === selectedMatch.value })
      pieces.set(part.item, list)
    })
  })
  let active: HTMLElement | undefined
  pieces.forEach((parts, item) => {
    const div = divisions[item]
    if (!div) return
    const text = textLayer!.textContentItemsStr[item] || ''
    div.replaceChildren()
    let end = 0
    parts.forEach(part => {
      div.append(document.createTextNode(text.slice(end, part.start)))
      const mark = document.createElement('mark')
      mark.className = part.active ? 'is-current' : ''
      mark.textContent = text.slice(part.start, part.end)
      div.append(mark)
      if (part.active && !active) active = mark
      end = part.end
    })
    div.append(document.createTextNode(text.slice(end)))
  })
  if (revealMatch && active && frame.value && layerPage === pageNumber.value) {
    const bounds = active.getBoundingClientRect()
    const box = frame.value.getBoundingClientRect()
    frame.value.scrollTo({ top: frame.value.scrollTop + bounds.top - box.top - box.height / 2, left: frame.value.scrollLeft + bounds.left - box.left - box.width / 2, behavior: 'instant' })
    revealMatch = false
  }
}
let disposed = false
let loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask | null = null
const storageKey = computed(() => `inkroam-pdf-position:${props.src}`)

function savePosition() {
  try { localStorage.setItem(storageKey.value, JSON.stringify({ page: pageNumber.value, zoom: zoom.value, rotation: rotation.value })) } catch {}
}

function jumpToPage(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > pageCount.value) {
    pageInput.value = String(pageNumber.value)
    notice.value = `请输入 1 到 ${pageCount.value} 之间的页码。`
    return
  }
  notice.value = ''
  pageNumber.value = value
  pageInput.value = String(value)
  frame.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  savePosition()
  renderPage()
}

function rotatePage() {
  rotation.value = (rotation.value + 90) % 360
  savePosition()
  renderPage()
}

let pdf: PDFDocumentProxy | null = null
let task: RenderTask | null = null
let observer: ResizeObserver | null = null
let token = 0
let lastWidth = 0

/* pdfjs-dist 只在真的要页内阅读时才下载：桌面浏览器走原生查看器，这个组件的分块和
   worker 都不会进首屏。worker 用 `?url` 交给打包器处理，BASE_PATH 部署也不会丢。 */
async function openDocument() {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  if (disposed) return null
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  loadingTask = pdfjs.getDocument({ url: props.src })
  return loadingTask.promise
}

async function renderPage() {
  const target = canvas.value
  if (!pdf || !target || disposed) return
  const current = ++token
  busy.value = true
  textLayer?.cancel()
  textLayer = null
  textHost.value?.replaceChildren()
  try {
    const page = await pdf.getPage(pageNumber.value)
    if (current !== token) return
    const angle = (page.rotate + rotation.value) % 360
    const unscaled = page.getViewport({ scale: 1, rotation: angle })
    const available = Math.max(200, (frame.value?.clientWidth || 320) - 24)
    const fit = available / unscaled.width
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const viewport = page.getViewport({ scale: fit * zoom.value * ratio, rotation: angle })
    const previousTask = task
    previousTask?.cancel()
    if (previousTask) { try { await previousTask.promise } catch {} }
    if (current !== token || disposed) return
    target.width = Math.max(1, Math.floor(viewport.width))
    target.height = Math.max(1, Math.floor(viewport.height))
    target.style.width = `${Math.round(viewport.width / ratio)}px`
    target.style.height = `${Math.round(viewport.height / ratio)}px`
    // pdfjs v5 推荐传 canvas 本身（canvasContext 仅作向后兼容）。
    task = page.render({ canvas: target, viewport })
    await task.promise
    if (current !== token || disposed) return
    task = null
    if (searchOpen.value && query.value.trim() && textHost.value) {
      try {
        const content = textCache.get(pageNumber.value) || await page.getTextContent()
        const { TextLayer } = await import('pdfjs-dist')
        if (current !== token || disposed || !searchOpen.value) return
        const cssViewport = page.getViewport({ scale: fit * zoom.value, rotation: angle })
        textHost.value.style.setProperty('--total-scale-factor', String(cssViewport.scale))
        const layer = new TextLayer({ textContentSource: content, container: textHost.value, viewport: cssViewport })
        textLayer = layer
        layerPage = pageNumber.value
        await layer.render()
        if (current === token && !disposed && textLayer === layer) paintMatches()
      } catch {
        if (current === token && searchOpen.value) searchNotice.value = '本页文字高亮暂不可用，仍可翻页阅读。'
      }
    }
  } catch (error) {
    // 翻页太快会取消上一次渲染，这不是错误。
    if ((error as { name?: string }).name !== 'RenderingCancelledException' && current === token) {
      status.value = 'error'
      emit('failed')
    }
  } finally {
    if (current === token) busy.value = false
  }
}

function go(delta: number) {
  const next = pageNumber.value + delta
  if (next < 1 || next > pageCount.value) return
  jumpToPage(next)
}

function onReaderKeydown(event: KeyboardEvent) {
  // Browser/OS shortcuts (especially Alt+Left/Right history) keep their default action.
  if (status.value !== 'ready' || event.defaultPrevented || event.isComposing
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (event.target !== event.currentTarget) return
  switch (event.key) {
    case 'ArrowLeft': case 'PageUp': event.preventDefault(); go(-1); break
    case 'ArrowRight': case 'PageDown': event.preventDefault(); go(1); break
    case 'Home': event.preventDefault(); jumpToPage(1); break
    case 'End': event.preventDefault(); jumpToPage(pageCount.value); break
  }
}

function changeZoom(step: number) {
  const next = Math.min(4, Math.max(0.5, zoom.value * (step > 0 ? 1.25 : 0.8)))
  zoom.value = Math.round(next * 100) / 100
  savePosition()
  renderPage()
}

function resetZoom() {
  if (zoom.value === 1) return
  zoom.value = 1
  savePosition()
  renderPage()
}

/* 手机上没有整页缩放控件，横向滑动翻页是最自然的操作；纵向滚动留给页面本身。 */
let swipeStart: { x: number, y: number } | null = null
function onTouchStart(event: TouchEvent) {
  swipeStart = null
  if (event.touches.length !== 1 || zoom.value > 1) return
  const touch = event.touches[0]
  if (touch) swipeStart = { x: touch.clientX, y: touch.clientY }
}

function onTouchEnd(event: TouchEvent) {
  const start = swipeStart
  swipeStart = null
  const touch = event.changedTouches[0]
  if (!start || !touch) return
  const dx = touch.clientX - start.x
  const dy = touch.clientY - start.y
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1)
}

onMounted(async () => {
  try {
    pdf = await openDocument()
    if (!pdf || disposed) return
    pageCount.value = pdf.numPages
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey.value) || 'null')
      if (saved) {
        if (Number.isInteger(saved.page)) pageNumber.value = Math.max(1, Math.min(pageCount.value, saved.page))
        if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) zoom.value = Math.max(.5, Math.min(4, saved.zoom))
        if ([0, 90, 180, 270].includes(saved.rotation)) rotation.value = saved.rotation
        pageInput.value = String(pageNumber.value)
        if (pageNumber.value > 1) notice.value = `已恢复到第 ${pageNumber.value} 页。`
      }
    } catch {}
    status.value = 'ready'
    await nextTick()
    await renderPage()
    if (disposed) return
    lastWidth = frame.value?.clientWidth || 0
    observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 0
      if (status.value !== 'ready' || Math.abs(width - lastWidth) < 8) return
      lastWidth = width
      renderPage()
    })
    if (frame.value) observer.observe(frame.value)
  } catch {
    if (disposed) return
    status.value = 'error'
    emit('failed')
  }
})

onBeforeUnmount(() => {
  disposed = true
  searchToken++
  textLayer?.cancel()
  textCache.clear()
  token++
  observer?.disconnect()
  task?.cancel()
  loadingTask?.destroy()
})
</script>

<template>
  <div class="pdf-reader" :aria-label="`${title || 'PDF'} 阅读器`">
    <div
      ref="frame"
      class="pdf-reader__frame"
      :class="{ 'is-busy': busy }"
      :aria-busy="busy"
      :style="{ touchAction: zoom > 1 ? 'pan-x pan-y' : 'pan-y' }"
      tabindex="0"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @touchcancel="swipeStart = null"
      @keydown="onReaderKeydown"
    >
      <p v-if="status === 'loading'" class="pdf-reader__state">正在加载 PDF…</p>
      <div v-show="status === 'ready'" class="pdf-reader__page">
      <canvas
        v-show="status === 'ready'"
        ref="canvas"
        class="pdf-reader__canvas"
        :aria-label="`第 ${pageNumber} 页，共 ${pageCount} 页`"
      />
      <div ref="textHost" class="pdf-reader__text" aria-hidden="true" />
      </div>
    </div>
    <div v-if="status === 'ready'" class="pdf-reader__bar">
      <button type="button" aria-label="上一页" :disabled="pageNumber <= 1" @click="go(-1)">‹</button>
      <form class="pdf-reader__counter" @submit.prevent="jumpToPage(Number(pageInput))">
        <input v-model="pageInput" type="number" min="1" :max="pageCount" aria-label="页码，按回车跳转" @change="jumpToPage(Number(pageInput))">
        <span>/ {{ pageCount }}</span>
      </form>
      <button type="button" aria-label="下一页" :disabled="pageNumber >= pageCount" @click="go(1)">›</button>
      <span class="pdf-reader__zoom">
        <button type="button" aria-label="缩小" :disabled="zoom <= .5" @click="changeZoom(-1)">−</button>
        <button type="button" aria-label="适应宽度" @click="resetZoom">{{ Math.round(zoom * 100) }}%</button>
        <button type="button" aria-label="放大" :disabled="zoom >= 4" @click="changeZoom(1)">＋</button>
        <button type="button" aria-label="顺时针旋转九十度" @click="rotatePage">旋转</button>
        <button ref="searchButton" type="button" aria-label="搜索此 PDF" :aria-expanded="searchOpen" @click="toggleSearch"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button>
      </span>
    </div>
    <div class="pdf-reader__search" :class="{ 'is-open': searchOpen }" :inert="!searchOpen">
      <div class="pdf-reader__search-inner">
        <form class="pdf-reader__bar pdf-reader__find" role="search" aria-label="在当前 PDF 中搜索" @submit.prevent="searchDocument" @keydown.esc.stop.prevent="toggleSearch">
          <input ref="searchInput" v-model="query" type="search" placeholder="搜索此 PDF" aria-label="PDF 搜索关键词" @input="invalidateSearch">
          <button type="submit">查找</button>
          <button type="button" aria-label="上一个匹配" :disabled="!matches.length" @click="selectMatch(selectedMatch - 1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>
          <button type="button" aria-label="下一个匹配" :disabled="!matches.length" @click="selectMatch(selectedMatch + 1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg></button>
          <button type="button" @click="toggleSearch">关闭</button>
          <span class="pdf-reader__results" role="status">{{ matches.length ? `${selectedMatch + 1} / ${matches.length} 处` : '' }}{{ searching ? ` · 已搜索 ${searchedPages} / ${pageCount} 页` : '' }}{{ searchNotice }}</span>
        </form>
      </div>
    </div>
    <div class="pdf-reader__notice" role="status" aria-live="polite">{{ notice }}</div>
  </div>
</template>

<style scoped>
.pdf-reader { display: grid; }
.pdf-reader__page { position: relative; width: max-content; height: max-content; }
.pdf-reader__canvas { display: block; }
/* PDF.js TextLayer geometry, scoped to this reader; never import the full viewer UI. */
.pdf-reader__text { position: absolute; inset: 0; overflow: clip; line-height: 1; text-align: initial; text-size-adjust: none; transform-origin: 0 0; pointer-events: none; --min-font-size: 1; --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv: calc(1 / var(--min-font-size)); }
.pdf-reader__text :deep(span), .pdf-reader__text :deep(br) { color: transparent; position: absolute; white-space: pre; transform-origin: 0 0; }
.pdf-reader__text :deep(> span) { --font-height: 0; font-size: calc(var(--text-scale-factor) * var(--font-height)); --scale-x: 1; --rotate: 0deg; transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
.pdf-reader__text :deep(mark) { color: transparent; background: rgb(255 195 0 / .32); padding: 0; }
.pdf-reader__text :deep(mark.is-current) { background: rgb(255 125 0 / .5); }
.pdf-reader__text { --scale-round-x: 1px; --scale-round-y: 1px; }
.pdf-reader__text[data-main-rotation='90'] { transform: rotate(90deg) translateY(-100%); }
.pdf-reader__text[data-main-rotation='180'] { transform: rotate(180deg) translate(-100%, -100%); }
.pdf-reader__text[data-main-rotation='270'] { transform: rotate(270deg) translateX(-100%); }
.pdf-reader__search { display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows 280ms var(--ease-fluid), visibility 280ms; }
.pdf-reader__search.is-open { grid-template-rows: 1fr; visibility: visible; }
.pdf-reader__search-inner { min-height: 0; overflow: hidden; }
.pdf-reader__find input { flex: 1 1 160px; min-width: 0; padding: 8px 12px; border: 1px solid var(--line); border-radius: 999px; background: transparent; color: var(--ink); font: 16px var(--sans); }
.pdf-reader__find input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pdf-reader__results { flex-basis: 100%; color: var(--muted); font: 12px/1.6 var(--sans); }
.pdf-reader__results:empty { display: none; }
@media (prefers-reduced-motion: reduce) { .pdf-reader__search { transition: none; } }
.pdf-reader__frame {
  display: grid; justify-items: safe center; overflow: auto;
  max-height: clamp(340px, 68vh, 880px);
  padding: 12px; background: color-mix(in srgb, var(--ink) 6%, transparent);
  touch-action: pan-y;
}
.pdf-reader__frame:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.pdf-reader__frame.is-busy { opacity: .72; }
.pdf-reader__canvas { max-width: none; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, .22); }
.pdf-reader__state { margin: 48px 0; color: var(--muted); font-size: 13px; }
.pdf-reader__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--line); }
.pdf-reader__bar button {
  min-width: 40px; height: 34px; padding: 0 10px;
  border: 1px solid var(--line); border-radius: 999px;
  background: transparent; color: var(--ink);
  font: 14px var(--sans); cursor: pointer;
}
.pdf-reader__bar button:disabled { opacity: .4; cursor: default; }
.pdf-reader__bar button:hover:not(:disabled) { border-color: var(--accent); }
.pdf-reader__bar button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pdf-reader__counter { min-width: 62px; color: var(--muted); font: 13px var(--sans); text-align: center; }
.pdf-reader__counter { display: flex; align-items: center; gap: 6px; }
.pdf-reader__counter input { width: 56px; min-width: 0; padding: 6px; background: transparent; color: var(--ink); border: 1px solid var(--line); border-radius: 4px; font: 16px var(--sans); text-align: center; }
.pdf-reader__counter input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pdf-reader__notice { color: var(--muted); font: 12px/1.6 var(--sans); }
.pdf-reader__notice:not(:empty) { padding: 0 12px 10px; }
.pdf-reader__zoom { display: flex; align-items: center; gap: 6px; margin-left: auto; }
:root[data-visual='modern'] .pdf-reader__frame { background: rgba(255, 255, 255, .04); }
:root[data-visual='modern'] .pdf-reader__bar { border-color: var(--modern-line); }
:root[data-visual='modern'] .pdf-reader__bar button { border-color: var(--modern-line); color: var(--modern-ink); }
:root[data-visual='modern'] .pdf-reader__frame:focus-visible { outline-color: var(--modern-accent); }
:root[data-visual='modern'] .pdf-reader__bar button:hover:not(:disabled) { border-color: var(--modern-accent); }
@media (max-width: 540px) {
  .pdf-reader__bar { gap: 4px; padding: 8px 10px; }
  .pdf-reader__bar button { min-width: 36px; }
  .pdf-reader__counter { min-width: 54px; }
}
</style>
