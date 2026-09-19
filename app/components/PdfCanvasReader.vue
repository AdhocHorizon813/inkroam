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
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs.getDocument({ url: props.src }).promise
}

async function renderPage() {
  const target = canvas.value
  if (!pdf || !target) return
  const current = ++token
  busy.value = true
  try {
    const page = await pdf.getPage(pageNumber.value)
    if (current !== token) return
    const unscaled = page.getViewport({ scale: 1 })
    const available = Math.max(200, (frame.value?.clientWidth || 320) - 24)
    const fit = available / unscaled.width
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const viewport = page.getViewport({ scale: fit * zoom.value * ratio })
    task?.cancel()
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
  pageNumber.value = next
  renderPage()
}

function changeZoom(step: number) {
  const next = Math.min(4, Math.max(0.5, zoom.value * (step > 0 ? 1.25 : 0.8)))
  zoom.value = Math.round(next * 100) / 100
  renderPage()
}

function resetZoom() {
  if (zoom.value === 1) return
  zoom.value = 1
  renderPage()
}

/* 手机上没有整页缩放控件，横向滑动翻页是最自然的操作；纵向滚动留给页面本身。 */
let swipeStart: { x: number, y: number } | null = null
function onTouchStart(event: TouchEvent) {
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
    pageCount.value = pdf.numPages
    status.value = 'ready'
    await nextTick()
    await renderPage()
    lastWidth = frame.value?.clientWidth || 0
    observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 0
      if (status.value !== 'ready' || Math.abs(width - lastWidth) < 8) return
      lastWidth = width
      renderPage()
    })
    if (frame.value) observer.observe(frame.value)
  } catch {
    status.value = 'error'
    emit('failed')
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  task?.cancel()
  pdf?.destroy()
})
</script>

<template>
  <div class="pdf-reader" :aria-label="`${title || 'PDF'} 阅读器`">
    <div
      ref="frame"
      class="pdf-reader__frame"
      :class="{ 'is-busy': busy }"
      tabindex="0"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @keydown.left.prevent="go(-1)"
      @keydown.right.prevent="go(1)"
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
      <span class="pdf-reader__counter">{{ pageNumber }} / {{ pageCount }}</span>
      <button type="button" aria-label="下一页" :disabled="pageNumber >= pageCount" @click="go(1)">›</button>
      <span class="pdf-reader__zoom">
        <button type="button" aria-label="缩小" @click="changeZoom(-1)">−</button>
        <button type="button" aria-label="适应宽度" @click="resetZoom">{{ Math.round(zoom * 100) }}%</button>
        <button type="button" aria-label="放大" @click="changeZoom(1)">＋</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.pdf-reader { display: grid; }
.pdf-reader__frame {
  display: grid; justify-items: center; overflow: auto;
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
