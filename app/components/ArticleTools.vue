<script setup lang="ts">
import { vExperimentalGlass, vGlassPresence } from '~/utils/glass-surfaces'
import { articleMatches } from '~/utils/article-find'
import { pageScrollTop, scrollPageTo } from '~/utils/page-scroll'
import { animateArticleTool } from '~/utils/article-tool-motion'
import { copyTextOnGesture } from '~/utils/clipboard'
const props = defineProps<{ content: HTMLElement | null; title: string; encrypted?: boolean; encryptedDocument?: string }>()
const baseURL = useRuntimeConfig().app.baseURL
const exportConfirm = ref<HTMLDialogElement | null>(null)
const pendingExport = shallowRef<{ format: 'pdf' | 'png'; section: number } | null>(null)
const exportWarningLabel = ref('')
const exportStep = ref<'warning' | 'key'>('warning')
const exportKey = ref('')
const exportKeyField = ref<HTMLInputElement | null>(null)
const exportKeyError = ref('')
const verifyingExport = ref(false)
let exportAttempt = 0
let exportRequest: AbortController | undefined

function clearExportAuthorization() {
  exportAttempt++
  exportRequest?.abort()
  exportRequest = undefined
  exportKey.value = ''
  exportKeyError.value = ''
  verifyingExport.value = false
  pendingExport.value = null
}

function cancelExport() {
  clearExportAuthorization()
  exportConfirm.value?.close()
}

function requestExport(format: 'pdf' | 'png') {
  if (disposed || busy.value || !props.content) return
  if (!props.encrypted) { void exportArticle(format); return }
  clearExportAuthorization()
  exportStep.value = 'warning'
  pendingExport.value = { format, section: sectionIndex.value }
  exportWarningLabel.value = `${format === 'pdf' ? 'PDF' : sectionIndex.value < 0 ? 'PNG 长图' : 'PNG 小节图片'}${sectionIndex.value < 0 ? '（整篇正文）' : '（所选小节）'}`
  exportConfirm.value?.showModal()
}

async function confirmExport() {
  if (!pendingExport.value || verifyingExport.value || disposed) return
  const attempt = exportAttempt
  exportStep.value = 'key'
  exportKey.value = ''
  // Explicitly requested on this click only; never touch the clipboard on page load.
  const clipboard = copyTextOnGesture(' ').catch(() => {
    if (attempt === exportAttempt && !disposed) exportKeyError.value = '未能替换剪贴板内容，请手动输入密钥。'
  })
  await nextTick()
  if (attempt === exportAttempt && !disposed) exportKeyField.value?.focus()
  await clipboard
}

async function verifyAndExport() {
  const pending = pendingExport.value
  if (!pending || exportStep.value !== 'key' || disposed || busy.value || verifyingExport.value || !props.content || !props.encryptedDocument) return
  const attempt = ++exportAttempt
  let key = exportKey.value.trim()
  exportKey.value = ''
  exportKeyError.value = ''
  verifyingExport.value = true
  const request = new AbortController()
  exportRequest = request
  try {
    const { decryptNote, loadEncryptedNote } = await import('~/utils/encrypted-note')
    if (attempt !== exportAttempt || disposed) return
    const envelope = await loadEncryptedNote(baseURL, props.encryptedDocument, request.signal)
    // Authenticate with the freshly supplied key; do not reuse the original unlock key.
    await decryptNote(envelope, key, props.encryptedDocument)
    if (attempt !== exportAttempt || disposed || !props.content) return
    sectionIndex.value = pending.section
    cancelExport()
    void exportArticle(pending.format)
  } catch {
    if (attempt === exportAttempt && !disposed) exportKeyError.value = '验证失败，请确认密钥完整、正确且文件可访问。'
  } finally {
    key = ''
    if (attempt === exportAttempt) verifyingExport.value = false
  }
}
const root = ref<HTMLElement | null>(null)
const mode = ref<'find' | 'export' | null>(null)
const pointerType = ref('')
// Touch can leave :hover on the drag's original trigger. Remember the actual
// input until mouse movement resumes, including on hybrid touch/mouse devices.
function rememberPointer(event: PointerEvent) {
  if (event.pointerType) pointerType.value = event.pointerType
}
const query = ref('')
const field = ref<HTMLInputElement | null>(null)
const count = ref(0), current = ref(-1)
const status = ref(''), busy = ref(false)
const sectionIndex = ref(-1)
const sections = ref<{ title: string; body: HTMLElement }[]>([])
let ranges: Range[] = [], timer: ReturnType<typeof setTimeout> | undefined
let observer: MutationObserver | undefined
let disposed = false
const exportLifetime = new AbortController()
const exportCleanups = new Set<() => void>()
function retainExportResource(dispose: () => void, timeout?: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const release = () => {
    if (!exportCleanups.delete(release)) return
    clearTimeout(timer)
    dispose()
  }
  exportCleanups.add(release)
  if (timeout !== undefined) timer = setTimeout(release, timeout)
  return release
}
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
// Collapse parity: while docked the row is sticky, so dropping `--open` would
// re-anchor it mid-animation and eat the fold. Keep the docked anchor for as
// long as the panel's own leave motion (180ms) runs, then release. A timer is
// used instead of a Transition hook so the release can never be lost.
const closing = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
function beginClose() {
  if (mode.value === null) return
  closing.value = true
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => { closing.value = false }, 200)
}
function endClose() { clearTimeout(closeTimer); closing.value = false }
async function toggle(next: 'find' | 'export') {
  if (mode.value === next) beginClose()
  else endClose()
  mode.value = mode.value === next ? null : next
  if (mode.value === 'find') {
    await nextTick()
    if (!disposed && mode.value === 'find') find(false)
    return
  }
  clearTimeout(timer)
  clearHighlights()
  if (mode.value === 'export' && props.content) {
    const body = props.content
    const { articleSections } = await import('~/utils/article-export')
    if (!disposed && mode.value === 'export' && props.content === body) sections.value = articleSections(body)
  }
}
function close() {
  const activeTrigger = mode.value === 'export' ? exportTrigger.value : trigger.value
  beginClose()
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
  // Prime the indicator geometry before a tool opens. The dormant control
  // stays transparent, but its lens can decode while the article is idle.
  const bar = actions.value, active = currentTrigger() ?? trigger.value
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
  if (mode.value !== null && !indicator.sliding) requestAnimationFrame(() => requestAnimationFrame(() => { indicator.sliding = true }))
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
function keydown(event: KeyboardEvent) { if (!exportConfirm.value?.open && event.key === 'Escape' && mode.value) { event.preventDefault(); close() } }
function outside(event: PointerEvent) {
  if (exportConfirm.value?.open) return
  if (mode.value && event.target instanceof Node && !root.value?.contains(event.target)) {
    clearTimeout(timer); beginClose(); mode.value = null; clearHighlights()
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
  cancelExport()
  disposed = true; clearTimeout(timer); clearTimeout(closeTimer); observer?.disconnect(); clearHighlights()
  transitions.forEach(cancel => cancel()); transitions.clear()
  document.removeEventListener('keydown', keydown)
  document.removeEventListener('pointerdown', outside)
  actionsResize?.disconnect()
  window.removeEventListener('resize', positionIndicator)
  exportLifetime.abort()
  exportCleanups.forEach(release => release())
  sections.value = []; ranges = []; query.value = ''
})
async function exportArticle(format: 'pdf' | 'png') {
  if (busy.value || !props.content) return
  busy.value = true; status.value = '正在准备正文…'
  let cleanup: (() => void) | undefined
  try {
    const { createExportFrame, exportFilename } = await import('~/utils/article-export')
    if (disposed) return
    const section = sectionIndex.value >= 0 ? sections.value[sectionIndex.value] : undefined
    const title = section ? `${props.title} · ${section.title}` : props.title
    const { frame, content } = await createExportFrame(title, section?.body || props.content, exportLifetime.signal)
    if (disposed) { frame.remove(); return }
    if (format === 'pdf') {
      const win = frame.contentWindow!
      const removeFrame = retainExportResource(() => {
        win.removeEventListener('afterprint', removeFrame)
        frame.remove()
      }, 120000)
      cleanup = removeFrame
      win.addEventListener('afterprint', removeFrame, { once: true })
      win.focus(); win.print()
      // Some browsers return before printing completes; retain its document briefly.
      cleanup = undefined
      status.value = '在打印窗口选择“另存为 PDF”。'
    } else {
      cleanup = retainExportResource(() => frame.remove())
      const pixelRatio = 2
      const height = Math.ceil(content.getBoundingClientRect().height)
      // html-to-image scales canvases above 16384px down; keep the full 2x resolution.
      if (height * pixelRatio > 16000) throw new Error('正文过长，高清 PNG 请按小节导出，或使用 PDF。')
      status.value = '正在生成 PNG…'
      const { toBlob } = await import('html-to-image')
      if (disposed) return
      const blob = await toBlob(content, { pixelRatio, backgroundColor: '#ffffff', preferredFontFormat: 'woff2' })
      if (!blob) throw new Error('图片生成失败，请改用 PDF。')
      if (disposed) return
      const url = URL.createObjectURL(blob)
      retainExportResource(() => URL.revokeObjectURL(url), 60000)
      const link = document.createElement('a'); link.href = url; link.download = `${exportFilename(title)}.png`; link.click()
      status.value = 'PNG 已生成。'
    }
  } catch (error) {
    if (!disposed) status.value = error instanceof Error ? error.message : '导出失败，请稍后重试。'
  } finally { cleanup?.(); busy.value = false }
}
</script>

<template>
  <div ref="root" class="article-tools" :class="{ 'article-tools--open': mode !== null || closing }" :data-pointer-type="pointerType || undefined" @pointerdown.capture="rememberPointer" @pointermove.capture="rememberPointer" @keydown.esc.stop.prevent="close">
    <div ref="actions" v-experimental-glass="mode !== null" data-glass-module="tools-track" class="article-tools__actions" :class="{ 'dropdown-surface': mode !== null }" role="group" aria-label="正文工具">
      <span v-experimental-glass="indicator.ready" data-glass-module="indicator" class="article-tools__indicator" :class="{ 'is-ready': indicator.ready && mode !== null, 'is-sliding': indicator.sliding }" :style="{ '--article-indicator-x': `${indicator.x}px`, '--article-indicator-width': `${indicator.width}px`, '--article-indicator-height': `${indicator.height}px` }" aria-hidden="true" />

      <button ref="trigger" class="article-action" data-radial-action="find" type="button" :aria-expanded="mode === 'find'" aria-controls="article-find-panel" @click="toggle('find')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><span>页内查找</span></button>
      <button ref="exportTrigger" class="article-action" data-radial-action="export" type="button" :aria-expanded="mode === 'export'" aria-controls="article-export-panel" @click="toggle('export')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></svg><span>导出正文</span></button>
      <CopyArticleLink radial-action="copy" feedback class="copy-article-link--inline" />
      <slot name="actions" />
    </div>
    <Transition :css="false" mode="out-in" @enter="enterPanel" @leave="leavePanel" @enter-cancelled="cancelPanel" @leave-cancelled="cancelPanel" @before-leave="beforeLeave" @after-enter="afterEnter">
      <div v-if="mode === 'find'" key="find" class="article-tools__reveal">
      <div class="article-tools__clip">
      <div id="article-find-panel" v-glass-presence="mode === 'find'" v-experimental-glass="mode === 'find'" data-glass-module="tools" class="article-tools__panel dropdown-surface" role="search" aria-label="当前正文查找" :inert="mode !== 'find'">
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
      <div id="article-export-panel" v-glass-presence="mode === 'export'" v-experimental-glass="mode === 'export'" data-glass-module="tools" class="article-tools__panel article-tools__panel--export dropdown-surface" :inert="mode !== 'export'">
        <SearchFilterSelect class="article-tools__scope" label="导出范围" :model-value="String(sectionIndex)" :options="[{value:'-1', label:'整篇正文'}, ...sections.map((section,index) => ({value:String(index),label:section.title}))]" :enabled="mode === 'export'" :disabled="busy" @update:model-value="sectionIndex = Number($event)" />
        <button type="button" :disabled="busy" @click="requestExport('pdf')">PDF</button>
        <button type="button" :disabled="busy" @click="requestExport('png')">PNG {{ sectionIndex < 0 ? '长图' : '小节' }}</button>
        <button type="button" @click="close">关闭</button>
        <p class="article-tools__status" role="status">{{ status || '导出阅读版正文；PDF 附件与交互内容请在原页面查看。' }}</p>
      </div>
      </div>
      </div>
    </Transition>
    <Teleport to="body">
      <dialog
        ref="exportConfirm"
        v-experimental-glass="pendingExport !== null"
        data-glass-module="confirm"
        class="appearance-confirm"
        aria-labelledby="private-export-title"
        aria-describedby="private-export-description private-export-detail"
        @cancel.prevent="cancelExport"
        @close="clearExportAuthorization"
        @keydown.esc.stop
      >
        <div class="appearance-confirm__symbol" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="m10.3 4.8-7.4 13A2 2 0 0 0 4.6 21h14.8a2 2 0 0 0 1.7-3.2l-7.4-13a2 2 0 0 0-3.4 0ZM12 9v5m0 3v.2" /></svg>
        </div>
        <h2 id="private-export-title">{{ exportStep === 'warning' ? '导出未加密的副本？' : '再次输入文档密钥' }}</h2>
        <p id="private-export-description">{{ exportStep === 'warning' ? `即将导出 ${exportWarningLabel}。导出的文件不再受文档密钥保护，任何获得文件的人都可以阅读。` : `验证通过后，将导出 ${exportWarningLabel}。` }}</p>
        <p id="private-export-detail" class="appearance-confirm__detail">{{ exportStep === 'warning' ? '请确认内容允许保存或分享，并妥善保管。重新锁定文档不会撤回已导出的副本。' : '请重新输入密钥，本次验证仅用于此次导出。' }}</p>
        <form v-if="exportStep === 'key'" autocomplete="off" @submit.prevent="verifyAndExport">
          <label class="visually-hidden" for="private-export-key">文档密钥</label>
          <input id="private-export-key" ref="exportKeyField" v-model="exportKey" class="private-export-key" type="password" autocomplete="off" autocapitalize="off" :spellcheck="false" :disabled="verifyingExport" required placeholder="重新输入文档密钥" aria-describedby="private-export-key-error" />
          <p id="private-export-key-error" class="appearance-confirm__detail" role="status">{{ exportKeyError }}</p>
          <div class="appearance-confirm__actions">
            <button type="button" class="appearance-confirm__accent" @click="cancelExport">取消</button>
            <button type="submit" class="appearance-confirm__neutral" :disabled="verifyingExport || !exportKey.trim()">{{ verifyingExport ? '正在验证…' : '验证并导出' }}</button>
          </div>
        </form>
        <div v-else class="appearance-confirm__actions">
          <button type="button" class="appearance-confirm__accent" autofocus @click="cancelExport">取消</button>
          <button type="button" class="appearance-confirm__neutral" @click="confirmExport">仍要导出</button>
        </div>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
/* Tool control resets must not override the shared Teleported confirmation dialog. */
.private-export-key { box-sizing: border-box; width: 100%; margin-top: 18px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: color-mix(in srgb, var(--ink) 4%, transparent); color: var(--ink); font: inherit; }
.private-export-key:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.appearance-confirm button:disabled { opacity: .5; cursor: default; }
.article-tools { position: relative; z-index: 8; margin: 24px 0; font: 13px/1.6 var(--sans); color: var(--ink); }
.article-tools__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; width: fit-content; max-width: 100%; border: 1px solid transparent; border-radius: 12px; }
/* Keep controls reachable after jumping down a long article, including switching
   from find to export. Closed tools retain their normal place in the article. */
.article-tools--open { position: sticky; top: 78px; z-index: 24; }
.article-tools--open .article-tools__actions { border-color: var(--line); background: var(--paper); }
:where(.article-tools) button { position: relative; min-height: 36px; padding: 6px 0; border: 0; border-bottom: 1px solid var(--line); background: transparent; font: inherit; color: inherit; cursor: pointer; }
:where(.article-tools) button:disabled { opacity: .45; cursor: default; }
@media(hover:hover) and (pointer:fine) {
  :where(.article-tools:not([data-pointer-type='touch'])) button:not(.article-action, .article-copy-action):hover { color: var(--accent); }
}
:where(.article-tools) button { transition: color 220ms var(--ease-fluid), border-color 220ms var(--ease-fluid), transform 160ms var(--ease-settle); }
:where(.article-tools) button:active:not(:disabled) { transform: translateY(1px); }
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
:where(.article-tools) input,:where(.article-tools) select { min-width: 0; max-width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--ink); font: inherit; }
:where(.article-tools) input { flex: 1 1 210px; font-size: 16px; }:where(.article-tools) select { flex: 1 1 180px; }:where(.article-tools) option { background: var(--paper); color: var(--ink); }
.article-tools__scope { flex: 0 1 380px; min-width: 0; width: 100%; }
.article-tools__count { color: var(--muted); font-variant-numeric: tabular-nums; }.article-tools__status { flex-basis: 100%; margin: 0; color: var(--muted); font-size: 12px; }
:where(.article-tools) :is(button,input,select):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
@media(max-width:767.98px) { .article-tools__panel { gap: 10px; }:where(.article-tools) button { min-height:44px; } }
@media(max-width:599.98px) { .article-tools__panel--export { display: flex; }.article-tools__scope { flex-basis: 100%; } }
@media(prefers-reduced-motion:reduce) { :where(.article-tools) button { transition-duration:.01ms; } }
</style>

<style>
/* Shared by the two local buttons and CopyArticleLink, scoped to this row.
   The row paints ONE sliding block (the .nav-highlight recipe) instead of giving
   every button its own background: hovering an inactive tool only brightens its
   text, and switching between the two tools moves/resizes the block on the same
   settle curve as the navbar. */
.article-tools__actions { position: relative; }
.article-tools__actions :is(.article-action, .article-copy-action) { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font: inherit; white-space: nowrap; text-decoration: none; transition: color 220ms var(--ease-fluid), transform 160ms var(--ease-settle); }
.article-tools__actions :is(.article-action, .article-copy-action) svg { flex: none; width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.article-tools__actions .article-tools__indicator { position: absolute; top: 50%; left: 0; z-index: 0; width: var(--article-indicator-width, 0px); height: var(--article-indicator-height, 40px); border-radius: 11px; background: var(--line); opacity: 0; transform: translate3d(var(--article-indicator-x, 0px), -50%, 0); transition: opacity 180ms var(--ease-fluid); pointer-events: none; }
.article-tools__actions .article-tools__indicator.is-sliding { transition: width 380ms var(--ease-settle), transform 380ms var(--ease-settle), opacity 180ms var(--ease-fluid); will-change: width, transform; }
.article-tools__actions .article-tools__indicator.is-ready { opacity: 1; }
.article-tools__actions .article-action[aria-expanded='true'] { color: var(--accent); }
.article-tools__actions .article-action:active:not(:disabled) { transform: translateY(1px); }
@media(hover:hover) and (pointer:fine) {
  :where(.article-tools:not([data-pointer-type='touch'])) .article-tools__actions .article-action:hover:not([aria-expanded='true']) { color: var(--ink); }
  :where(.article-tools:not([data-pointer-type='touch'])) .article-tools__actions .article-copy-action:hover:not(:disabled) { color: var(--ink); }
}
@media(max-width:767.98px) { .article-tools__actions :is(.article-action, .article-copy-action) { min-height: 44px; padding-inline: 8px; gap: 5px; } }
@media(prefers-reduced-motion:reduce) { .article-tools__actions :is(.article-action, .article-copy-action), .article-tools__actions .article-tools__indicator { transition-duration: .01ms; } }
::highlight(inkroam-find) { background: #e9c55a80; color: inherit; }
::highlight(inkroam-find-current) { background: #efb44c; color: #1d211c; }
</style>

