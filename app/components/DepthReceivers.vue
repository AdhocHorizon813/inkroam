<script setup lang="ts">
import { onPageScroll, pageScrollTop } from '~/utils/page-scroll'
import { visibleSurface, type SurfaceBox } from '~/utils/depth-receivers'

// One paint-only overlay, inside the same shell as the sticky navigation.
// It does not touch material pseudo-elements, focus, hit targets or layout.
const route = useRoute()
const nuxt = useNuxtApp()
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
let scrollOnly = false
let alive = false
let layoutDirty = true
let cachedSurfaces: SurfaceBox[] = []
let lastScroll = NaN
let navRadius = 0
let stopPageFinish: (() => void) | undefined

function measureBox(element: HTMLElement): SurfaceBox {
  const box = element.getBoundingClientRect()
  return { x: box.left, y: box.top, width: box.width, height: box.height, radius: parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0 }
}
function sameBox(a: SurfaceBox | null, b: SurfaceBox | null) {
  return a === b || !!(a && b && a.x === b.x && a.y === b.y && a.width === b.width
    && a.height === b.height && a.radius === b.radius)
}
function measure() {
  frame = 0
  if (!enabled.value) return
  const scroll = pageScrollTop()
  // Captured nested scroll events may leave the page stationary. Check here,
  // not in the event handler where earlier listeners may have dirtied styles.
  if (scrollOnly && !layoutDirty && scroll === lastScroll) return
  scrollOnly = false
  const width = document.documentElement.clientWidth
  const navBox = nav?.getBoundingClientRect()
  if (navBox && navBox.height !== header.value?.height) layoutDirty = true
  if (layoutDirty) {
    // Normal-flow receivers are stored in scroll-content coordinates. Their
    // layout changes on resize/content replacement, not on ordinary scrolling.
    cachedSurfaces = targets.map(element => {
      const box = measureBox(element)
      return { ...box, y: box.y + scroll }
    })
    navRadius = nav ? parseFloat(getComputedStyle(nav).borderTopLeftRadius) || 0 : 0
    layoutDirty = false
  }
  // Keep the one moving source live: sticky positioning and navbar width
  // transitions must not be inferred from a cached scroll position.
  const nextHeader = navBox ? visibleSurface({ x: navBox.left, y: navBox.top,
    width: navBox.width, height: navBox.height, radius: navRadius }, width, window.innerHeight) : null
  if (!sameBox(header.value, nextHeader)) header.value = nextHeader
  // Leave six sigma beyond the far source. Gaussian tails are not literally
  // zero; this deliberately conservative clip avoids a visible cut at 3 sigma.
  const mobile = width <= 767.98
  const height = header.value ? Math.min(window.innerHeight,
    Math.ceil(header.value.y + header.value.height + (mobile ? 22 + 6 * 18 : 28 + 6 * 24))) : 0
  if (viewport.value.width !== width || viewport.value.height !== height) viewport.value = { width, height }
  const nextSurfaces = cachedSurfaces.flatMap(cached => {
    const box = visibleSurface({ ...cached, y: cached.y - scroll }, width, height)
    return box ? [box] : []
  })
  if (nextSurfaces.length !== surfaces.value.length
    || nextSurfaces.some((box, index) => !sameBox(box, surfaces.value[index] ?? null))) surfaces.value = nextSurfaces
  lastScroll = scroll
  // Disable only the old broad band after this replacement has valid geometry.
  // No JS/unsupported observers => the existing CSS remains the fallback.
  // A gap between cards is still a valid far receiver, never a CSS fallback.
  if (header.value) {
    if (document.documentElement.dataset.depthReceivers !== 'true') document.documentElement.dataset.depthReceivers = 'true'
  }
  else delete document.documentElement.dataset.depthReceivers
}
function schedule(onlyScroll = false) {
  if (!enabled.value) return
  if (frame) {
    // A settings/layout update must upgrade a queued scroll-only measurement.
    if (!onlyScroll) scrollOnly = false
    return
  }
  scrollOnly = onlyScroll
  frame = requestAnimationFrame(measure)
}
function invalidateLayout() {
  layoutDirty = true
  schedule()
}
function onResize(entries: ResizeObserverEntry[]) {
  if (!enabled.value) return
  if (entries.some(entry => entry.target !== nav)) layoutDirty = true
  // ResizeObserver already runs after layout. Enqueuing another rAF here makes
  // the receiver trail the CSS width animation by one rendering opportunity.
  // Only fixed SVG geometry is written; none of the observed boxes is resized.
  // Consume a queued scroll update too, rather than measuring twice.
  cancelAnimationFrame(frame)
  scrollOnly = false
  measure()
}
function onScroll() {
  // No geometry reads in the event handler; coalesce them into the frame.
  schedule(true)
}
function bindTargets() {
  resize?.disconnect()
  nav = document.querySelector<HTMLElement>('.site-header')
  // Avoid double-counting any nested reading surface.
  targets = [...document.querySelectorAll<HTMLElement>(selector)]
    .filter(element => !element.parentElement?.closest(selector))
  if (nav) resize?.observe(nav)
  targets.forEach(element => resize?.observe(element))
  const shell = document.querySelector<HTMLElement>('.site-shell')
  if (shell) resize?.observe(shell)
  invalidateLayout()
}
function syncSettings() {
  const root = document.documentElement
  const active = root.dataset.visual === 'modern'
    && ['soft', 'defined'].includes(root.dataset.depth || '')
  if (active === enabled.value) { invalidateLayout(); return }
  enabled.value = active
  if (active) {
    bindTargets()
    stopScroll = onPageScroll(onScroll)
    window.addEventListener('resize', invalidateLayout, { passive: true })
  } else {
    stopScroll?.(); stopScroll = undefined
    window.removeEventListener('resize', invalidateLayout)
    resize?.disconnect()
    cancelAnimationFrame(frame); frame = 0
    header.value = null
    surfaces.value = []
    cachedSurfaces = []
    lastScroll = NaN
    delete root.dataset.depthReceivers
  }
}
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return
  alive = true
  resize = new ResizeObserver(onResize)
  settings = new MutationObserver(syncSettings)
  settings.observe(document.documentElement, { attributes: true, attributeFilter: ['data-depth', 'data-visual', 'data-display-mode', 'data-color-mode'] })
  syncSettings()
  // A route watcher can run before an async page has replaced the old DOM.
  stopPageFinish = nuxt.hook('page:finish', () => {
    if (alive && enabled.value) bindTargets()
  })
})
watch(() => route.path, async () => {
  await nextTick()
  if (alive && enabled.value) bindTargets()
})
onBeforeUnmount(() => {
  alive = false
  stopScroll?.()
  stopPageFinish?.()
  resize?.disconnect()
  settings?.disconnect()
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', invalidateLayout)
  delete document.documentElement.dataset.depthReceivers
})
</script>

<template>
  <svg v-if="enabled" class="depth-receivers" aria-hidden="true" focusable="false"
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
.depth-receivers__cast { transition: opacity 520ms cubic-bezier(.4, 0, .2, 1) var(--depth-light-delay, 0ms); }
:global(:root[data-scrolled='true'] .depth-receivers__cast) { opacity: .58; transition: opacity 480ms cubic-bezier(.22, .8, .3, 1) var(--depth-light-delay, 0ms); }
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
