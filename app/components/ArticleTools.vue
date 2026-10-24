<script setup lang="ts">
import { articleMatches } from '~/utils/article-find'
import { pageScrollTop, scrollPageTo } from '~/utils/page-scroll'
import { animateArticleTool } from '~/utils/article-tool-motion'
const props = defineProps<{ content: HTMLElement | null; title: string }>()
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
  scrollPageTo(pageScrollTop() + rect.top - Math.max(180, innerHeight * .32), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth')
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
function close() { clearTimeout(timer); mode.value = null; clearHighlights(); trigger.value?.focus({ preventScroll: true }) }
const trigger = ref<HTMLButtonElement | null>(null)
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
onMounted(() => {
  document.addEventListener('keydown', keydown)
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
      const height = Math.ceil(content.getBoundingClientRect().height)
      if (height > 14000) throw new Error('正文过长，请选择一个小节导出，或使用 PDF。')
      status.value = '正在生成 PNG…'
      const { toBlob } = await import('html-to-image')
      const blob = await toBlob(content, { pixelRatio: 1, backgroundColor: '#ffffff', preferredFontFormat: 'woff2' })
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
  <div class="article-tools" @keydown.esc.stop.prevent="close">
    <div class="article-tools__actions">
      <button ref="trigger" type="button" :aria-expanded="mode === 'find'" aria-controls="article-find-panel" @click="toggle('find')">页内查找</button>
      <button type="button" :aria-expanded="mode === 'export'" aria-controls="article-export-panel" @click="toggle('export')">导出正文</button>
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
      <div v-else-if="mode === 'export'" key="export" class="article-tools__reveal">
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
.article-tools__actions { display: flex; gap: 20px; }
button { position: relative; min-height: 36px; padding: 6px 0; border: 0; border-bottom: 1px solid var(--line); background: transparent; font: inherit; color: inherit; cursor: pointer; }
button:hover { color: var(--accent); }button:disabled { opacity: .45; cursor: default; }
button { transition: color 220ms var(--ease-fluid), border-color 220ms var(--ease-fluid), transform 160ms var(--ease-settle); }
button:active:not(:disabled) { transform: translateY(1px); }
.article-tools__actions button[aria-expanded='true'] { color: var(--accent); border-color: currentColor; }
.article-tools__reveal { display: grid; grid-template-rows: 1fr; opacity: 1; }
.article-tools__clip { min-height: 0; overflow: hidden; }
.article-tools__panel { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 10px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }
/* Material and blur come from main.css's shared dropdown-surface channel.
   The tools and their nested picker intentionally omit its decorative lighting.
   Entire selectors stay inside :global to avoid the scoped root-leak bug. */
:global(:root[data-visual='modern'][data-dropdown-material='liquid'] .article-tools .dropdown-surface::before) { content: none; background: none; }
:global(:root[data-visual='modern'][data-dropdown-material='liquid'] .article-tools .dropdown-surface) { box-shadow: none; border-color: var(--line); }
/* depth.css also paints radial highlights directly on dropdown backgrounds.
   Override that layer for every depth/material mode, not just liquid's ::before.
   The extra data-depth selector outranks the shared depth rule in any load order. */
:global(:root[data-visual='modern'][data-depth] .article-tools .dropdown-surface) { background-image: none; }
.article-tools__panel--export { align-items: flex-end; }
input,select { min-width: 0; max-width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--ink); font: inherit; }
input { flex: 1 1 210px; font-size: 16px; }select { flex: 1 1 180px; }option { background: var(--paper); color: var(--ink); }
.article-tools__scope { flex: 0 1 380px; min-width: 0; width: 100%; }
.article-tools__count { color: var(--muted); font-variant-numeric: tabular-nums; }.article-tools__status { flex-basis: 100%; margin: 0; color: var(--muted); font-size: 12px; }
:is(button,input,select):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
@media(max-width:767.98px) { .article-tools__panel { gap: 10px; }button { min-height:44px; } }
@media(prefers-reduced-motion:reduce) { button { transition-duration:.01ms; } }
</style>

<style>
::highlight(inkroam-find) { background: #e9c55a80; color: inherit; }
::highlight(inkroam-find-current) { background: #efb44c; color: #1d211c; }
</style>
