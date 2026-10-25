<script setup lang="ts">
import { articleMatches } from '~/utils/article-find'
import { pageScrollTop, scrollPageTo } from '~/utils/page-scroll'
import { animateArticleTool } from '~/utils/article-tool-motion'
const props = defineProps<{ content: HTMLElement | null; title: string }>()
const root = ref<HTMLElement | null>(null)
const mode = ref<'find' | 'export' | null>(null)
const query = ref('')
const field = ref<HTMLInputElement | null>(null)
const count = ref(0), current = ref(-1)
const status = ref(''), busy = ref(false)
const sectionIndex = ref(-1)
const sections = ref<{ title: string; body: HTMLElement }[]>([])
let ranges: Range[] = [], timer: ReturnType<typeof setTimeout> | undefined
let observer: MutationObserver | undefined
let disposed = false
const urls = new Set<string>()
// Progressive enhancement: CSS Highlights preserves selection, links and Vue nodes.
type HighlightsWindow = Window & { Highlight?: new (...ranges: Range[]) => unknown; CSS?: { highlights?: Map<string, unknown> } }
function paint() {
  const api = window as HighlightsWindow
  const highlights = api.CSS?.highlights
  if (!highlights || !api.Highlight) return
  highlights.set('inkroam-find', new api.Highlight(...ranges))
  highlights.set('inkroam-find-current', new api.Highlight(...(ranges[current.value] ? [ranges[current.value]!] : [])))
}
function clearHighlights() {
  const api = window as HighlightsWindow
  api.CSS?.highlights?.delete('inkroam-find'); api.CSS?.highlights?.delete('inkroam-find-current')
}
function find(jump = true) {
  ranges = props.content ? articleMatches(props.content, query.value) : []
  count.value = ranges.length; current.value = ranges.length ? 0 : -1
  paint()
  if (jump && ranges.length) move(0)
}
function move(delta: number) {
  if (!ranges.length) return
  current.value = (current.value + delta + ranges.length) % ranges.length
  paint()
  const range = ranges[current.value]!
  const rect = range.getBoundingClientRect()
  const panel = root.value?.querySelector<HTMLElement>('.article-tools__panel')
  const controlsBottom = 78 + (root.value?.offsetHeight || 0) + 10 + (panel?.offsetHeight || 0) + 24
  scrollPageTo(pageScrollTop() + rect.top - Math.max(controlsBottom, innerHeight * .32), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth')
  const horizontal = range.startContainer.parentElement?.closest<HTMLElement>('pre, .katex-display, .article-table')
  if (horizontal) horizontal.scrollTo({ left: horizontal.scrollLeft + rect.left - horizontal.getBoundingClientRect().left - 24, behavior: 'auto' })
}
watch(query, () => { clearTimeout(timer); if (mode.value === 'find') timer = setTimeout(() => find(), 180) })
async function toggle(next: 'find' | 'export') {
  mode.value = mode.value === next ? null : next
  if (mode.value === 'find') { await nextTick(); find(false) }
  else { clearTimeout(timer); clearHighlights() }
  if (mode.value === 'export' && props.content) {
    const { articleSections } = await import('~/utils/article-export')
    sections.value = articleSections(props.content)
  }
}
function close() {
  const activeTrigger = mode.value === 'export' ? exportTrigger.value : trigger.value
  clearTimeout(timer); mode.value = null; clearHighlights(); activeTrigger?.focus({ preventScroll: true })
}
const trigger = ref<HTMLButtonElement | null>(null)
const exportTrigger = ref<HTMLButtonElement | null>(null)
// One sliding block, the same recipe as .nav-highlight: the row paints a single
// absolutely positioned span, so an inactive tool only brightens its text on
// hover and switching between the tools moves and resizes that block.
const actions = ref<HTMLElement | null>(null)
const indicator = reactive({ x: 0, width: 0, height: 0, ready: false, sliding: false })
let actionsResize: ResizeObserver | undefined
function currentTrigger() {
  return mode.value === 'find' ? trigger.value : mode.value === 'export' ? exportTrigger.value : null
}
async function positionIndicator() {
  await nextTick()
  const bar = actions.value, active = currentTrigger()
  if (!bar || !active) return
  // Integer layout offsets, not getBoundingClientRect: rects are fractional while
  // absolutely positioned children sit on the padding box, so a fractional x left
  // a 1px anti-aliasing seam along the block's left edge.
  indicator.x = active.offsetLeft
  indicator.width = active.offsetWidth
  indicator.height = active.offsetHeight
  indicator.ready = true
  // The first placement must not animate from 0px/left edge: enable the slide
  // only after that frame has been painted, so later switches glide.
  if (!indicator.sliding) requestAnimationFrame(() => requestAnimationFrame(() => { indicator.sliding = true }))
}
watch(mode, positionIndicator)
const transitions = new Map<Element, () => void>()

function cancelPanel(element: Element) { transitions.get(element)?.(); transitions.delete(element) }
function panelMotion(element: Element, done: () => void, entering: boolean) {
  cancelPanel(element)
  let completed = false
  const cancel = animateArticleTool(element as HTMLElement, entering, () => { completed = true; transitions.delete(element); done() })
  if (!completed) transitions.set(element, cancel)
}
function enterPanel(element: Element, done: () => void) { panelMotion(element, done, true) }
function leavePanel(element: Element, done: () => void) { panelMotion(element, done, false) }
function beforeLeave(element: Element) { (element as HTMLElement).inert = true }
function afterEnter() { if (mode.value === 'find') field.value?.focus({ preventScroll: true }) }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape' && mode.value) { event.preventDefault(); close() } }
function outside(event: PointerEvent) {
  if (mode.value && event.target instanceof Node && !root.value?.contains(event.target)) {
    clearTimeout(timer); mode.value = null; clearHighlights()
  }
}
onMounted(() => {
  document.addEventListener('keydown', keydown)
  document.addEventListener('pointerdown', outside)
  positionIndicator()
  actionsResize = new ResizeObserver(() => positionIndicator())
  if (actions.value) actionsResize.observe(actions.value)
  for (const element of [trigger.value, exportTrigger.value]) if (element) actionsResize.observe(element)
  window.addEventListener('resize', positionIndicator, { passive: true })
})
watch(() => props.content, content => {
  observer?.disconnect()
  if (!content) return
  observer = new MutationObserver(() => { if (mode.value === 'find') { clearTimeout(timer); timer = setTimeout(() => find(false), 180) } })
  observer.observe(content, { childList: true, subtree: true, characterData: true })
}, { flush: 'post' })
onBeforeUnmount(() => {
  disposed = true; clearTimeout(timer); observer?.disconnect(); clearHighlights()
  transitions.forEach(cancel => cancel()); transitions.clear()
  document.removeEventListener('keydown', keydown)
  document.removeEventListener('pointerdown', outside)
  actionsResize?.disconnect()
  window.removeEventListener('resize', positionIndicator)
  urls.forEach(url => URL.revokeObjectURL(url))
})
async function exportArticle(format: 'pdf' | 'png') {
  if (busy.value || !props.content) return
  busy.value = true; status.value = '正在准备正文…'
  let cleanup: (() => void) | undefined
  try {
    const { createExportFrame, exportFilename } = await import('~/utils/article-export')
    const section = sectionIndex.value >= 0 ? sections.value[sectionIndex.value] : undefined
    const title = section ? `${props.title} · ${section.title}` : props.title
    const { frame, content } = await createExportFrame(title, section?.body || props.content)
    cleanup = () => frame.remove()
    if (disposed) return
    if (format === 'pdf') {
      const win = frame.contentWindow!
      win.addEventListener('afterprint', () => frame.remove(), { once: true })
      win.focus(); win.print()
      // Some browsers return before printing completes; retain its document briefly.
      setTimeout(() => frame.remove(), 120000); cleanup = undefined
      status.value = '在打印窗口选择“另存为 PDF”。'
    } else {
      const pixelRatio = 2
      const height = Math.ceil(content.getBoundingClientRect().height)
      // html-to-image scales canvases above 16384px down; keep the full 2x resolution.
      if (height * pixelRatio > 16000) throw new Error('正文过长，高清 PNG 请按小节导出，或使用 PDF。')
      status.value = '正在生成 PNG…'
      const { toBlob } = await import('html-to-image')
      const blob = await toBlob(content, { pixelRatio, backgroundColor: '#ffffff', preferredFontFormat: 'woff2' })
      if (!blob) throw new Error('图片生成失败，请改用 PDF。')
      if (disposed) return
      const url = URL.createObjectURL(blob); urls.add(url)
      const link = document.createElement('a'); link.href = url; link.download = `${exportFilename(title)}.png`; link.click()
      setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url) }, 60000)
      status.value = 'PNG 已生成。'
    }
  } catch (error) {
    status.value = error instanceof Error ? error.message : '导出失败，请稍后重试。'
  } finally { cleanup?.(); busy.value = false }
}
</script>

<template>
  <div ref="root" class="article-tools" :class="{ 'article-tools--open': mode !== null }" @keydown.esc.stop.prevent="close">
    <div ref="actions" class="article-tools__actions" :class="{ 'dropdown-surface': mode !== null }" role="group" aria-label="正文工具">
      <span class="article-tools__indicator" :class="{ 'is-ready': indicator.ready && mode !== null, 'is-sliding': indicator.sliding }" :style="{ '--article-indicator-x': `${indicator.x}px`, '--article-indicator-width': `${indicator.width}px`, '--article-indicator-height': `${indicator.height}px` }" aria-hidden="true" />

      <button ref="trigger" class="article-action" type="button" :aria-expanded="mode === 'find'" aria-controls="article-find-panel" @click="toggle('find')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><span>页内查找</span></button>
      <button ref="exportTrigger" class="article-action" type="button" :aria-expanded="mode === 'export'" aria-controls="article-export-panel" @click="toggle('export')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></svg><span>导出正文</span></button>
      <CopyArticleLink feedback class="copy-article-link--inline" />
    </div>
    <Transition :css="false" mode="out-in" @enter="enterPanel" @leave="leavePanel" @enter-cancelled="cancelPanel" @leave-cancelled="cancelPanel" @before-leave="beforeLeave" @after-enter="afterEnter">
      <div v-if="mode === 'find'" key="find" class="article-tools__reveal">
      <div class="article-tools__clip">
      <div id="article-find-panel" class="article-tools__panel dropdown-surface" role="search" aria-label="当前正文查找" :inert="mode !== 'find'">
        <label class="visually-hidden" for="article-find-input">在当前正文中查找</label>
        <input id="article-find-input" ref="field" v-model="query" type="search" placeholder="在这篇正文中查找" @keydown.enter.prevent="move($event.shiftKey ? -1 : 1)">
        <span class="article-tools__count" role="status">{{ count ? `${current + 1} / ${count}` : query.trim() ? '无匹配' : '输入关键词' }}</span>
        <button type="button" :disabled="!count" @click="move(-1)">上一处</button>
        <button type="button" :disabled="!count" @click="move(1)">下一处</button>
        <button type="button" @click="close">关闭</button>
      </div>
      </div>
      </div>
      <div v-else-if="mode === 'export'" key="export" class="article-tools__reveal article-tools__reveal--export">
      <div class="article-tools__clip">
      <div id="article-export-panel" class="article-tools__panel article-tools__panel--export dropdown-surface" :inert="mode !== 'export'">
        <SearchFilterSelect class="article-tools__scope" label="导出范围" :model-value="String(sectionIndex)" :options="[{value:'-1', label:'整篇正文'}, ...sections.map((section,index) => ({value:String(index),label:section.title}))]" :enabled="mode === 'export'" :disabled="busy" @update:model-value="sectionIndex = Number($event)" />
        <button type="button" :disabled="busy" @click="exportArticle('pdf')">PDF</button>
        <button type="button" :disabled="busy" @click="exportArticle('png')">PNG {{ sectionIndex < 0 ? '长图' : '小节' }}</button>
        <button type="button" @click="close">关闭</button>
        <p class="article-tools__status" role="status">{{ status || '导出阅读版正文；PDF 附件与交互内容请在原页面查看。' }}</p>
      </div>
      </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.article-tools { position: relative; z-index: 8; margin: 24px 0; font: 13px/1.6 var(--sans); color: var(--ink); }
.article-tools__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; width: fit-content; max-width: 100%; border: 1px solid transparent; border-radius: 12px; }
/* Keep controls reachable after jumping down a long article, including switching
   from find to export. Closed tools retain their normal place in the article. */
.article-tools--open { position: sticky; top: 78px; z-index: 24; }
.article-tools--open .article-tools__actions { border-color: var(--line); background: var(--paper); }
button { position: relative; min-height: 36px; padding: 6px 0; border: 0; border-bottom: 1px solid var(--line); background: transparent; font: inherit; color: inherit; cursor: pointer; }
button:hover { color: var(--accent); }button:disabled { opacity: .45; cursor: default; }
button { transition: color 220ms var(--ease-fluid), border-color 220ms var(--ease-fluid), transform 160ms var(--ease-settle); }
button:active:not(:disabled) { transform: translateY(1px); }
.article-tools__reveal { position: absolute; top: calc(100% + 10px); left: 0; z-index: 1; width: min(760px, 100%); display: grid; grid-template-rows: 1fr; }
.article-tools__reveal--export { width: max-content; max-width: 100%; }
.article-tools__clip { min-width: 0; min-height: 0; overflow: hidden; border-radius: 12px; }
.article-tools__panel { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; max-height: min(480px, 60dvh); overflow-y: auto; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }
/* Material and blur come from main.css's shared dropdown-surface channel.
   The tools and their nested picker intentionally omit its decorative lighting.
   Entire selectors stay inside :global to avoid the scoped root-leak bug. */
:global(:root[data-visual='modern'][data-dropdown-material='liquid'] .article-tools .dropdown-surface::before) { content: none; background: none; }
:global(:root[data-visual='modern'][data-dropdown-material='liquid'] .article-tools .dropdown-surface) { box-shadow: none; border-color: var(--line); }
/* depth.css also paints radial highlights directly on dropdown backgrounds.
   Override that layer for every depth/material mode, not just liquid's ::before.
   The extra data-depth selector outranks the shared depth rule in any load order. */
:global(:root[data-visual='modern'][data-depth] .article-tools .dropdown-surface) { background-image: none; }
.article-tools__panel--export { display: grid; grid-template-columns: minmax(0, 380px) repeat(3, max-content); align-items: end; }
.article-tools__panel--export .article-tools__status { grid-column: 1 / -1; contain: inline-size; }
input,select { min-width: 0; max-width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--ink); font: inherit; }
input { flex: 1 1 210px; font-size: 16px; }select { flex: 1 1 180px; }option { background: var(--paper); color: var(--ink); }
.article-tools__scope { flex: 0 1 380px; min-width: 0; width: 100%; }
.article-tools__count { color: var(--muted); font-variant-numeric: tabular-nums; }.article-tools__status { flex-basis: 100%; margin: 0; color: var(--muted); font-size: 12px; }
:is(button,input,select):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
@media(max-width:767.98px) { .article-tools__panel { gap: 10px; }button { min-height:44px; } }
@media(max-width:599.98px) { .article-tools__panel--export { display: flex; }.article-tools__scope { flex-basis: 100%; } }
@media(prefers-reduced-motion:reduce) { button { transition-duration:.01ms; } }
</style>

<style>
/* Shared by the two local buttons and CopyArticleLink, scoped to this row.
   The row paints ONE sliding block (the .nav-highlight recipe) instead of giving
   every button its own background: hovering an inactive tool only brightens its
   text, and switching between the two tools moves/resizes the block on the same
   settle curve as the navbar. */
.article-tools__actions { position: relative; }
.article-tools__actions .article-action { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font: inherit; white-space: nowrap; text-decoration: none; transition: color 220ms var(--ease-fluid), transform 160ms var(--ease-settle); }
.article-tools__actions .article-action svg { flex: none; width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.article-tools__actions .article-tools__indicator { position: absolute; top: 50%; left: 0; z-index: 0; width: var(--article-indicator-width, 0px); height: var(--article-indicator-height, 40px); border-radius: 11px; background: var(--line); opacity: 0; transform: translate3d(var(--article-indicator-x, 0px), -50%, 0); transition: opacity 180ms var(--ease-fluid); pointer-events: none; }
.article-tools__actions .article-tools__indicator.is-sliding { transition: width 380ms var(--ease-settle), transform 380ms var(--ease-settle), opacity 180ms var(--ease-fluid); will-change: width, transform; }
.article-tools__actions .article-tools__indicator.is-ready { opacity: 1; }
.article-tools__actions .article-action[aria-expanded='true'] { color: var(--accent); }
.article-tools__actions .article-action:active:not(:disabled) { transform: translateY(1px); }
@media(hover:hover) and (pointer:fine) { .article-tools__actions .article-action:hover:not([aria-expanded='true']) { color: var(--ink); } }
@media(max-width:767.98px) { .article-tools__actions .article-action { min-height: 44px; padding-inline: 8px; gap: 5px; } }
@media(prefers-reduced-motion:reduce) { .article-tools__actions .article-action, .article-tools__actions .article-tools__indicator { transition-duration: .01ms; } }
::highlight(inkroam-find) { background: #e9c55a80; color: inherit; }
::highlight(inkroam-find-current) { background: #efb44c; color: #1d211c; }
</style>
