<script setup lang="ts">
import { onPageScroll } from '~/utils/page-scroll'
import { visibleSurface, type SurfaceBox } from '~/utils/depth-receivers'

// One paint-only overlay, inside the same shell as the sticky navigation.
// It does not touch material pseudo-elements, focus, hit targets or layout.
const route = useRoute()
const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
const nearId = `depth-near-${uid}`
const farId = `depth-far-${uid}`
const enabled = ref(false)
const viewport = shallowRef({ width: 0, height: 0 })
const header = shallowRef<SurfaceBox | null>(null)
const surfaces = shallowRef<SurfaceBox[]>([])
const selector = '.hero, .latest-section, .manifesto, .standard-page, .article-page'
let targets: HTMLElement[] = []
let nav: HTMLElement | null = null
let resize: ResizeObserver | undefined
let settings: MutationObserver | undefined
let stopScroll: (() => void) | undefined
let frame = 0
let alive = false

function measureBox(element: HTMLElement): SurfaceBox {
  const box = element.getBoundingClientRect()
  return { x: box.left, y: box.top, width: box.width, height: box.height, radius: parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0 }
}
function measure() {
  frame = 0
  if (!enabled.value) return
  const width = document.documentElement.clientWidth
  const height = window.innerHeight
  viewport.value = { width, height }
  header.value = nav ? visibleSurface(measureBox(nav), width, height) : null
  surfaces.value = targets.flatMap(element => {
    const box = visibleSurface(measureBox(element), width, height)
    return box ? [box] : []
  })
  // Disable only the old broad band after this replacement has valid geometry.
  // No JS/unsupported observers => the existing CSS remains the fallback.
  if (header.value && surfaces.value.length) document.documentElement.dataset.depthReceivers = 'true'
  else delete document.documentElement.dataset.depthReceivers
}
function schedule() {
  if (enabled.value && !frame) frame = requestAnimationFrame(measure)
}
function bindTargets() {
  resize?.disconnect()
  nav = document.querySelector<HTMLElement>('.site-header')
  // Avoid double-counting any nested reading surface.
  targets = [...document.querySelectorAll<HTMLElement>(selector)]
    .filter(element => !element.parentElement?.closest(selector))
  if (nav) resize?.observe(nav)
  targets.forEach(element => resize?.observe(element))
  schedule()
}
function syncSettings() {
  const root = document.documentElement
  const active = root.dataset.visual === 'modern'
    && ['soft', 'defined'].includes(root.dataset.depth || '')
  if (active === enabled.value) { schedule(); return }
  enabled.value = active
  if (active) {
    bindTargets()
    stopScroll = onPageScroll(schedule)
    window.addEventListener('resize', schedule, { passive: true })
  } else {
    stopScroll?.(); stopScroll = undefined
    window.removeEventListener('resize', schedule)
    resize?.disconnect()
    cancelAnimationFrame(frame); frame = 0
    header.value = null
    surfaces.value = []
    delete root.dataset.depthReceivers
  }
}
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return
  alive = true
  resize = new ResizeObserver(schedule)
  settings = new MutationObserver(syncSettings)
  settings.observe(document.documentElement, { attributes: true, attributeFilter: ['data-depth', 'data-visual', 'data-display-mode', 'data-color-mode'] })
  syncSettings()
})
watch(() => route.path, async () => {
  await nextTick()
  if (alive && enabled.value) bindTargets()
})
onBeforeUnmount(() => {
  alive = false
  stopScroll?.()
  resize?.disconnect()
  settings?.disconnect()
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', schedule)
  delete document.documentElement.dataset.depthReceivers
})
</script>

<template>
  <svg v-if="enabled && surfaces.length" class="depth-receivers" aria-hidden="true" focusable="false"
    :width="viewport.width" :height="viewport.height" :viewBox="`0 0 ${viewport.width} ${viewport.height}`">
    <defs>
      <mask :id="nearId" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" :width="viewport.width" :height="viewport.height" style="mask-type: luminance">
        <rect v-for="(box, index) in surfaces" :key="index" v-bind="{ x: box.x, y: box.y, width: box.width, height: box.height, rx: box.radius }" fill="white" />
        <rect v-if="header" v-bind="{ x: header.x, y: header.y, width: header.width, height: header.height, rx: header.radius }" fill="black" />
      </mask>
      <mask :id="farId" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" :width="viewport.width" :height="viewport.height" style="mask-type: luminance">
        <rect width="100%" height="100%" fill="white" />
        <rect v-for="(box, index) in surfaces" :key="index" v-bind="{ x: box.x, y: box.y, width: box.width, height: box.height, rx: box.radius }" fill="black" />
        <rect v-if="header" v-bind="{ x: header.x, y: header.y, width: header.width, height: header.height, rx: header.radius }" fill="black" />
      </mask>
    </defs>
    <!-- Card elevation moved to a static box-shadow in depth.css: a card's cast shadow is
         fixed geometry, so it scrolls with the card and needs no measurement at all. -->
    <g v-if="header" class="depth-receivers__cast">
      <g :mask="`url(#${farId})`">
        <rect class="depth-receivers__far" v-bind="{ x: header.x, y: header.y, width: header.width, height: header.height, rx: header.radius }" />
      </g>
      <g :mask="`url(#${nearId})`">
        <rect class="depth-receivers__near" v-bind="{ x: header.x, y: header.y, width: header.width, height: header.height, rx: header.radius }" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.depth-receivers { position: fixed; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
.depth-receivers__cast { transition: opacity 520ms cubic-bezier(.4, 0, .2, 1); }
:global(:root[data-scrolled='true'] .depth-receivers__cast) { opacity: .58; transition: opacity 320ms cubic-bezier(.22, .8, .3, 1); }
.depth-receivers__near { fill: var(--depth-glass-light); filter: blur(10px); transform: translateY(8px); }
.depth-receivers__far { fill: var(--depth-glass-light); opacity: .55; filter: blur(24px); transform: translateY(28px); }
/* Card elevation is a plain static box-shadow on the reading surfaces (depth.css), because
   the old SVG elevation had to re-measure every card on every scroll frame: that ghosted,
   janked and unrolled the whole layer mid-scroll. Only the navigation's near/far projection
   stays on the SVG, since that one is genuinely viewport-anchored. */
@media (max-width: 767.98px) {
  .depth-receivers__near { filter: blur(8px); transform: translateY(6px); }
  .depth-receivers__far { filter: blur(18px); transform: translateY(22px); }
}
@media (prefers-reduced-motion: reduce) {
  .depth-receivers__cast { transition: none !important; }
}
</style>
