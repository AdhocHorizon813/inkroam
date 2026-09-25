import {
  PAGE_SCROLLABLE_ATTRIBUTE, PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, PAGE_SCROLL_QUERY,
  PAGE_SCROLLBAR_OFFSET_PROPERTY, PAGE_SCROLLBAR_SIZE_PROPERTY, onPageScroll, pageNeedsScroll,
} from '~/utils/page-scroll'

/* 页面滑条只在「还滚得动」的时候露面：内容不够长就淡出，够长再淡入。
   按约定只改透明度——元素、轨道、槽位一律留着（overflow-y: scroll），所以显隐
   不会让布局位移。内容高度会变的地方都要盯：子元素尺寸变化、子元素被换掉、窗口尺寸。
   手机是覆盖式滚动条，容器本身也不滚，直接把标记摘掉（CSS 的基线是可见的）。

   拇指是自绘的，所以除了显隐状态，这里还要算它的高度与位移（写进 CSS 变量）：
   原生拇指在容器不再可滚的那一瞬间就被浏览器撤掉，淡出根本来不及画（实测见
   docs/scrollbar.md），条子只能自己画。

   淡出前那 300ms 延迟对首次测量是反效果：短页面会先画出一条滑条，再等半秒才收起来。
   所以第一帧先写 settled='false'，等这次绘制过去（两帧）再翻成 'true'。 */

/* 拇指最小高度：再短就抓不住了，和原生滚动条的经验值一致。 */
const MIN_THUMB_SIZE = 40

export function usePageScrollable(scroller: Ref<HTMLElement | null>) {
  let resizeObserver: ResizeObserver | undefined
  let mutationObserver: MutationObserver | undefined
  let stopScrollListener: (() => void) | undefined
  let frame = 0

  function measure() {
    const element = scroller.value
    if (!element) return
    if (!window.matchMedia(PAGE_SCROLL_QUERY).matches) {
      element.removeAttribute(PAGE_SCROLLABLE_ATTRIBUTE)
      element.removeAttribute(PAGE_SCROLLABLE_SETTLED_ATTRIBUTE)
      return
    }
    element.setAttribute(PAGE_SCROLLABLE_ATTRIBUTE, pageNeedsScroll(element) ? 'true' : 'false')
    allowFadeDelay(element)
    syncThumb(element)
  }

  /* 滚动一帧最多算一次：一次手势里滚动事件会来好几次。 */
  function scheduleThumb() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (scroller.value) syncThumb(scroller.value)
    })
  }

  /* 高度按可视比例、位移按滚动比例。不能滚时给满高——此刻它已经淡到 0 了，
     但下一次「变长再淡回来」时尺寸得是对的。 */
  function syncThumb(element: HTMLElement) {
    const track = element.clientHeight
    const range = element.scrollHeight - track
    let size = track
    if (track > 0 && range > 1) {
      size = Math.min(track, Math.max(MIN_THUMB_SIZE, Math.round((track * track) / element.scrollHeight)))
      element.style.setProperty(PAGE_SCROLLBAR_OFFSET_PROPERTY, `${Math.round((element.scrollTop / range) * (track - size))}px`)
    } else {
      element.style.setProperty(PAGE_SCROLLBAR_OFFSET_PROPERTY, '0px')
    }
    element.style.setProperty(PAGE_SCROLLBAR_SIZE_PROPERTY, `${size}px`)
  }

  /* 首帧那次显隐不要延迟：一次 rAF 排的回调还在当前帧绘制之前，套两层才落在绘制之后。 */
  function allowFadeDelay(element: HTMLElement) {
    if (element.getAttribute(PAGE_SCROLLABLE_SETTLED_ATTRIBUTE) !== 'false') return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      element.setAttribute(PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, 'true')
    }))
  }

  function watchChildren() {
    const element = scroller.value
    if (!element) return
    resizeObserver?.disconnect()
    for (const child of element.children) resizeObserver?.observe(child)
    measure()
  }

  onMounted(() => {
    const element = scroller.value
    if (!element || typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(measure)
    /* 页面切换会换掉子元素，而 ResizeObserver 只认订阅时拿到的那几个节点。 */
    mutationObserver = new MutationObserver(watchChildren)
    mutationObserver.observe(element, { childList: true })
    window.addEventListener('resize', measure)
    /* 滚动位置一律经这个工具拿：桌面在容器里滚、手机仍是文档滚动。 */
    stopScrollListener = onPageScroll(scheduleThumb)
    /* 先关掉延迟开关，下面第一次 measure 写状态时才是立刻到位。 */
    element.setAttribute(PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, 'false')
    watchChildren()
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    stopScrollListener?.()
    window.removeEventListener('resize', measure)
  })
}