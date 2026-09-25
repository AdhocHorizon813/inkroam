/* 页面滚动容器与阅读位置。
   经典滚动条的槽位落在文档绘制区之外：fixed 图层、自绘轨道都盖不到它，那里只显示 canvas
   （body 的背景色），紧挨一张底图时就是右边缘那条白边。桌面因此把滚动从 html 搬到
   .page-scroll（见 main.css 的同一条媒体查询）：槽位进入绘制区后，透明轨道下面就是氛围层，
   和文章目录的滑条同一套机制。手机上滚动条是覆盖式的，不需要搬运，仍然是文档滚动——
   所以下面每个读写操作都要先问一次"现在是谁在滚"。
   这些函数都直接碰 DOM，只在客户端调用。 */

/* 必须与 main.css 里把滚动搬进 .page-scroll 的媒体查询保持一致。 */
export const PAGE_SCROLL_QUERY = '(hover: hover) and (pointer: fine)'
/* 滚动容器的状态属性：内容不够长时写 'false'，CSS 只把滑条透明度转到 0。
   元素、轨道、槽位全程都在（overflow-y: scroll），所以显隐不会挪动布局。
   名字同时出现在 main.css 与 scripts/check-page-scroll.mjs 里。 */
export const PAGE_SCROLLABLE_ATTRIBUTE = 'data-scrollable'
/* 「这次显隐要不要等一会儿」的开关：'false' 是挂载后的第一帧（立刻到位），
   两帧之后翻成 'true'，之后的每次变更才带淡出延迟。
   只有首帧不带延迟——短页面不该先画出一条滑条再等 300ms 收起来。 */
export const PAGE_SCROLLABLE_SETTLED_ATTRIBUTE = 'data-scrollable-settled'
const POSITION_KEY = 'paper-trail-scroll-positions'
/* 刷新/回退时要还原的位置。vue-router 自带的记录读的是 window 的滚动量，
   搬进容器后恒为 0，所以自己按 fullPath 记一份。 */
const POSITION_LIMIT = 60

type Positions = Record<string, number>

let positions: Positions | undefined

function readPositions(): Positions {
  if (positions) return positions
  try {
    const stored = sessionStorage.getItem(POSITION_KEY)
    positions = stored ? JSON.parse(stored) as Positions : {}
  } catch {
    /* 隐私模式读不出来就当没记过，回到顶部即可。 */
    positions = {}
  }
  return positions
}

export function rememberScrollPosition(key: string) {
  const saved = readPositions()
  delete saved[key]
  saved[key] = pageScrollTop()
  const keys = Object.keys(saved)
  while (keys.length > POSITION_LIMIT) delete saved[keys.shift()!]
  try {
    sessionStorage.setItem(POSITION_KEY, JSON.stringify(saved))
  } catch {
    /* 写不进去也不影响本次会话内的回退。 */
  }
}

export function savedScrollTop(key: string): number | undefined {
  const value = readPositions()[key]
  return typeof value === 'number' && value > 0 ? value : undefined
}

/* 本页锚点 > 自己记的阅读位置 > vue-router 给的历史位置 > 顶部。 */
export function resolveDestinationTop(fullPath: string, savedPositionTop?: number | null): number {
  return savedScrollTop(fullPath) ?? savedPositionTop ?? 0
}

/* route.hash 是百分号编码形式，而 Markdown 标题锚点在 HTML 属性里是未编码的
   （`#收件人是下一个我`），两种写法都要试一次。 */
export function findHashTarget(hash: string): HTMLElement | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  for (const id of [raw, decodeHash(raw)]) {
    const element = id ? document.getElementById(id) : null
    if (element) return element
  }
  return null
}

function decodeHash(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function resolvePageScroller(): HTMLElement {
  const root = (document.scrollingElement as HTMLElement | null) ?? document.documentElement
  const wrapper = document.querySelector<HTMLElement>('.page-scroll')
  return wrapper && window.matchMedia(PAGE_SCROLL_QUERY).matches ? wrapper : root
}

export function pageScrollTop(): number {
  return resolvePageScroller().scrollTop
}

export function pageMaxScroll(): number {
  const scroller = resolvePageScroller()
  return Math.max(0, scroller.scrollHeight - scroller.clientHeight)
}

/* 还滚不滚得动：留 1px 容差，子像素舍入不该让滑条闪一下。 */
export function pageNeedsScroll(scroller: { scrollHeight: number; clientHeight: number }): boolean {
  return scroller.scrollHeight - scroller.clientHeight > 1
}

export function scrollPageTo(top: number, behavior: ScrollBehavior = 'auto') {
  const scroller = resolvePageScroller()
  /* 文档滚动统一走 window：Safari 上直接写 documentElement.scrollTop 不生效。 */
  if (scroller === document.scrollingElement) window.scrollTo({ top, behavior })
  else scroller.scrollTo({ top, behavior })
}

/* scroll 事件不冒泡，只有捕获阶段才能在 window 上收到滚动容器内部的滚动。 */
export function onPageScroll(handler: () => void) {
  window.addEventListener('scroll', handler, { passive: true, capture: true })
  return () => window.removeEventListener('scroll', handler, { capture: true })
}

/* 内容还在流式渲染时，目标位置会被当下高度夹住，等它能滚到为止（最多 1.2s）。
   只用于即时滚动：平滑滚动进行中反复重试会把动画打断。 */
export function scrollPageToWhenReady(top: number, timeout = 1200) {
  const startedAt = Date.now()
  const attempt = () => {
    scrollPageTo(top)
    if (top - pageScrollTop() <= 2 || Date.now() - startedAt > timeout) return
    requestAnimationFrame(attempt)
  }
  attempt()
}

/* 跨页跳 #hash 时目标元素可能还没渲染出来，等到它出现为止（最多 1.2s）。 */
export function scrollToHashWhenReady(hash: string, behavior: ScrollBehavior, timeout = 1200) {
  const startedAt = Date.now()
  const attempt = (): void => {
    const target = findHashTarget(hash)
    if (target) {
      target.scrollIntoView({ block: 'start', behavior })
      return
    }
    if (Date.now() - startedAt > timeout) return
    requestAnimationFrame(attempt)
  }
  attempt()
}
