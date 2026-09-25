import {
  PAGE_SCROLLABLE_ATTRIBUTE, PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, PAGE_SCROLL_QUERY, pageNeedsScroll,
} from '~/utils/page-scroll'

/* 页面滑条只在「还滚得动」的时候露面：内容不够长就淡出，够长再淡入。
   按约定只改透明度——元素、轨道、槽位一律留着（overflow-y: scroll），所以显隐
   不会让布局位移。内容高度会变的地方都要盯：子元素尺寸变化、子元素被换掉、窗口尺寸。
   手机是覆盖式滚动条，容器本身也不滚，直接把标记摘掉（CSS 的基线是可见的）。

   淡出前那 300ms 延迟（main.css 与 docs/scrollbar.md「参考规则」）对首次测量是反效果：
   短页面会先画出一条滑条，再等半秒才收起来。所以第一帧先写 settled='false'，
   等这次绘制过去（两帧）再翻成 'true'，之后每次变更才带延迟。 */
export function usePageScrollable(scroller: Ref<HTMLElement | null>) {
  let resizeObserver: ResizeObserver | undefined
  let mutationObserver: MutationObserver | undefined

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
    /* 先关掉延迟开关，下面第一次 measure 写状态时才是立刻到位。 */
    element.setAttribute(PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, 'false')
    watchChildren()
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    window.removeEventListener('resize', measure)
  })
}