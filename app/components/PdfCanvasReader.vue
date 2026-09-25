<script setup lang="ts">
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

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
    task = null
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
      @keydown.left.prevent="go(-1)"
      @keydown.right.prevent="go(1)"
      @keydown.home.prevent="jumpToPage(1)"
      @keydown.end.prevent="jumpToPage(pageCount)"
    >
      <p v-if="status === 'loading'" class="pdf-reader__state">正在加载 PDF…</p>
      <canvas
        v-show="status === 'ready'"
        ref="canvas"
        class="pdf-reader__canvas"
        :aria-label="`第 ${pageNumber} 页，共 ${pageCount} 页`"
      />
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
      </span>
    </div>
    <div class="pdf-reader__notice" role="status" aria-live="polite">{{ notice }}</div>
  </div>
</template>

<style scoped>
.pdf-reader { display: grid; }
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
