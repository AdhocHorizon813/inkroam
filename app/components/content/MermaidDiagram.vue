<script setup lang="ts">
import { renderDiagram } from '~/utils/mermaid'

const props = defineProps<{ source: string }>()
const host = ref<HTMLElement | null>(null)
const svg = ref('')
const failed = ref(false)
/* 源码区沿用高级搜索（SearchAdvanced.vue 的 .advanced-panel）那套展开：grid-template-rows
   0fr↔1fr，展开 440ms / 收起 260ms，同一组缓动变量，同一枚旋转的 chevron。
   默认收起：图是滚到跟前才画的，若先展开、画完再收起来，人眼先看到的是一闪而过的源码。
   只有图没画出来（draw 的失败分支）才强制展开 —— 那时源码是唯一的说明。 */
const sourceOpen = ref(false)
const sourceSettled = ref(false)
const sourceId = useId()
let sourceTouched = false
let settleTimer: ReturnType<typeof setTimeout> | undefined
watch(sourceOpen, () => {
  sourceSettled.value = false
  clearTimeout(settleTimer)
  // 过渡被取消（或动效被关掉）时不能把源码永远关在裁剪里。
  if (sourceOpen.value) settleTimer = setTimeout(() => { sourceSettled.value = sourceOpen.value }, 480)
})
onBeforeUnmount(() => clearTimeout(settleTimer))
function finishExpansion(event: TransitionEvent) {
  if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') sourceSettled.value = sourceOpen.value
}
function toggleSource() { sourceTouched = true; sourceOpen.value = !sourceOpen.value }
let active = false
let disposed = false
let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
let visibility: IntersectionObserver | undefined
let appearance: MutationObserver | undefined
let signature = ''

/* mermaid 量标签用的量法与实际排版能差几个百分点（它在 document.body 里量，标签却继承正文的
   字体度量），量窄的那一侧会把字切在 foreignObject 边界上，节点框也跟着偏小 —— 与栏宽无关，
   任何窗口都在切。渲染完按真实排版把每个标签盒、它所在的节点框和整张画布都修一次：只放大，不缩小。 */
function fitDiagram() {
  const root = host.value?.querySelector<SVGSVGElement>('.article-diagram__image svg')
  if (!root || typeof root.getBBox !== 'function') return
  const view = root.viewBox.baseVal
  const drawn = root.getBoundingClientRect()
  if (!view.width || !drawn.width) return
  const scale = drawn.width / view.width
  const num = (el: Element, name: string) => Number(el.getAttribute(name) ?? 0)
  for (const fo of root.querySelectorAll('foreignObject')) {
    const fr = fo.getBoundingClientRect()
    if (!fr.width) continue
    let left = fr.left
    let right = fr.right
    let top = fr.top
    let bottom = fr.bottom
    for (const inner of fo.children) {
      const ir = inner.getBoundingClientRect()
      if (!ir.width) continue
      left = Math.min(left, ir.left); right = Math.max(right, ir.right)
      top = Math.min(top, ir.top); bottom = Math.max(bottom, ir.bottom)
    }
    const growLeft = (fr.left - left) / scale
    const growRight = (right - fr.right) / scale
    const growTop = (fr.top - top) / scale
    const growBottom = (bottom - fr.bottom) / scale
    if (growLeft + growRight <= 0.4 && growTop + growBottom <= 0.4) continue
    // 标签盒与节点背景框按同样的增量长大，保持原来的居中关系。
    for (const el of [fo, fo.closest('.node')?.querySelector('rect')]) {
      if (!el) continue
      el.setAttribute('x', String(num(el, 'x') - growLeft))
      el.setAttribute('y', String(num(el, 'y') - growTop))
      el.setAttribute('width', String(num(el, 'width') + growLeft + growRight))
      el.setAttribute('height', String(num(el, 'height') + growTop + growBottom))
    }
  }
  let box: DOMRect
  try { box = root.getBBox() } catch { return }
  if (!box.width || !box.height) return
  const pad = 2
  const x = Math.min(view.x, box.x - pad)
  const y = Math.min(view.y, box.y - pad)
  const right = Math.max(view.x + view.width, box.x + box.width + pad)
  const bottom = Math.max(view.y + view.height, box.y + box.height + pad)
  const width = right - x
  const height = bottom - y
  if (x !== view.x || y !== view.y || width !== view.width || height !== view.height) {
    root.setAttribute('viewBox', `${x} ${y} ${width} ${height}`)
    root.setAttribute('width', String(width))
    root.setAttribute('height', String(height))
  }
  /* 显示宽度 = 原生尺寸 × --diagram-scale（阅读设置的「图表尺寸」，出厂 75%）。
     写成变量 + calc 而不是像素：滑条拖动时由 CSS 直接重算，页面上每张图不用重画一遍；
     高度是 auto，比例不变，缩到比栏窄时仍由 margin-inline: auto 居中。 */
  root.style.width = `calc(${width}px * var(--diagram-scale, 1))`
}

async function draw() {
  if (!active || disposed || !host.value) return
  const root = document.documentElement
  const font = getComputedStyle(host.value).fontFamily
  const dark = root.dataset.colorMode === 'dark'
  const nextSignature = `${dark}:${font}:${props.source}`
  if (signature === nextSignature) return
  signature = nextSignature
  const current = ++generation
  failed.value = false
  try {
    await document.fonts.ready
    if (disposed || current !== generation) return
    const result = await renderDiagram(props.source, dark, font)
    if (!disposed && current === generation) {
      svg.value = result
      await nextTick()
      fitDiagram()
      // 画图失败时源码被强制展开，重渲染成功后收回默认态；用户自己点开过就不动。
      if (!sourceTouched) sourceOpen.value = false
    }
  } catch {
    if (!disposed && current === generation) { failed.value = true; svg.value = ''; sourceOpen.value = true }
  }
}
function schedule() {
  clearTimeout(timer)
  timer = setTimeout(draw, 100)
}
watch(() => props.source, () => { signature = ''; schedule() })
onMounted(() => {
  appearance = new MutationObserver(schedule)
  appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode', 'data-visual'] })
  if ('IntersectionObserver' in window) {
    visibility = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { active = true; visibility?.disconnect(); draw() }
    }, { rootMargin: '200px' })
    if (host.value) visibility.observe(host.value)
  } else { active = true; draw() }
})
onBeforeUnmount(() => {
  disposed = true; generation++
  clearTimeout(timer); visibility?.disconnect(); appearance?.disconnect()
})
</script>

<template>
  <figure ref="host" class="article-diagram">
    <div v-if="svg" class="article-diagram__image" role="img" aria-label="知识关系流程图，文字说明见正文及图表源码" tabindex="0" v-html="svg" />
    <p v-else-if="failed" role="status">图表暂时无法显示，可查看下方源码与正文说明。</p>
    <button type="button" class="article-diagram__toggle" :aria-expanded="sourceOpen" :aria-controls="sourceId" @click="toggleSource">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m10 7 5 5-5 5" /></svg>
      图表源码
    </button>
    <div :id="sourceId" class="article-diagram__panel" :class="{ expanded: sourceOpen, settled: sourceSettled }" :inert="!sourceOpen" :aria-hidden="!sourceOpen" @transitionend="finishExpansion">
      <div class="article-diagram__clip">
        <pre tabindex="0"><code>{{ source }}</code></pre>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.article-diagram { min-width: 0; max-width: 100%; margin: 2em 0; color: var(--ink); font-family: var(--sans); }
.article-diagram__image { overflow-x: auto; overscroll-behavior-x: contain; padding: 16px 0; }
/* 宽图按原生尺寸画（宽度由 fitDiagram 内联写成「原生 × --diagram-scale」），装不下时
   由本容器横向滚动，绝不自动等比缩小：原生 1391px 的流程图压进 608px 的栏只剩 44%，
   字被挤到看不清，而自动缩小是唯一能让「字看不清」和「横向裁切」同时成立的做法。
   尺寸交给阅读设置里的「图表尺寸」滑条自己定；滚动只发生在这个容器内部，页面本身不横滚。
   窄图保持原尺寸、不硬撑到栏宽。 */
.article-diagram__image :deep(svg) { display: block; width: auto; max-width: none; height: auto; margin-inline: auto; }
/* Mermaid embeds ID-scoped SVG styles; override only diagram colors with live theme tokens. */
.article-diagram__image :deep(.node rect), .article-diagram__image :deep(.node polygon), .article-diagram__image :deep(.node circle) { fill: color-mix(in srgb, var(--ink) 4%, transparent) !important; stroke: var(--line) !important; }
.article-diagram__image :deep(text) { fill: var(--ink) !important; }
.article-diagram__image :deep(.flowchart-link) { stroke: var(--muted) !important; }
.article-diagram__image :deep(marker path) { fill: var(--muted) !important; stroke: var(--muted) !important; }
/* 源码区：与高级搜索同一套展开（SearchAdvanced.vue 的 .advanced-panel）：grid-template-rows
   0fr↔1fr，展开 440ms / 收起 260ms，同一组缓动变量，同一枚 260ms 旋转的 chevron。 */
.article-diagram__toggle { display: inline-flex; align-items: center; gap: 6px; width: fit-content; padding: 4px 0; border: 0; background: none; color: var(--muted); font: 13px var(--sans); cursor: pointer; }
.article-diagram__toggle:hover { color: var(--ink); }
.article-diagram__toggle svg { flex: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform 260ms var(--ease-settle); }
.article-diagram__toggle[aria-expanded='true'] svg { transform: rotate(90deg); }
.article-diagram__panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 260ms var(--ease-exit); }
.article-diagram__panel.expanded { grid-template-rows: 1fr; transition-duration: 440ms; transition-timing-function: var(--ease-settle); }
.article-diagram__clip { min-height: 0; min-width: 0; overflow: hidden; }
/* min-width: 0 是这套展开动画能站住的前提。clip 是 grid item，min-width 默认 auto：
   在 overflow: hidden（展开途中）时它等于 0，落定后 overflow: visible 让它取内容的
   最小尺寸 —— 源码里最长那一行有多宽，卡片就有多宽。于是面板高度还在过渡的最后
   一帧，卡片宽度突然跳出去（实测 608px 的栏跳到 763px，右越界 155px，正文被顶出屏幕）。
   写死 0 之后轨道只按可用宽度算，长行交给 pre 自己横向滚。 */
.article-diagram__panel.expanded.settled > .article-diagram__clip { overflow: visible; }
/* 块级 pre 的盒子不会因为长行变宽（长行只是溢出盒子），落定态 clip 又是 overflow: visible，
   所以长行必须由 pre 自己滚，文字才不会越过正文栏右边界。 */
.article-diagram__clip > pre { overflow-x: auto; overscroll-behavior-x: contain; }
.article-diagram__image:focus-visible, .article-diagram__toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>
