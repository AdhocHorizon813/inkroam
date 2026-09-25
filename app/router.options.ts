import type { RouterConfig } from '@nuxt/schema'
import { START_LOCATION } from 'vue-router'
import { resolveDestinationTop, scrollPageTo, scrollPageToWhenReady, scrollToHashWhenReady } from '~/utils/page-scroll'

export default {
  // Keep Nuxt's saved positions and anchor offsets; use the browser's eased scroll.
  get scrollBehaviorType() {
    return resolvedScrollBehavior()
  },

  /* Nuxt 默认把自己算好的位置交给 vue-router 去滚 window；桌面把页面滚动搬进了
     .page-scroll（见 app/utils/page-scroll.ts），window 已经不会动，连它记录的
     "历史位置"也恒为 0。所以这里自己滚，结束后 resolve(false) 让 vue-router
     不要再动 window。锚点偏移沿用 Nuxt 的做法：交给目标元素的 scroll-margin-top。 */
  scrollBehavior(to, from, savedPosition) {
    const behavior = resolvedScrollBehavior()
    const samePath = to.path.replace(/\/$/, '') === from.path.replace(/\/$/, '')

    if (samePath) {
      if (from.hash && !to.hash) {
        scrollPageTo(0)
        return false as const
      }
      if (to.hash) return scrollToHashWhenReady(to.hash, behavior)
      return false as const
    }

    const scrollToTop = typeof to.meta.scrollToTop === 'function' ? to.meta.scrollToTop(to, from) : to.meta.scrollToTop
    if (scrollToTop === false) return false as const

    const go = () => {
      if (to.hash) {
        scrollToHashWhenReady(to.hash, behavior)
        return false as const
      }
      scrollPageToWhenReady(resolveDestinationTop(to.fullPath, savedPosition?.top))
      return false as const
    }
    if (from === START_LOCATION) return Promise.resolve(go())

    /* 等新页面渲染完再滚，否则目标位置会被旧内容的高度夹住。
       rAF 在后台标签或无帧环境（无头浏览器）里可能不触发，所以同时挂兜底定时器。 */
    const nuxtApp = useNuxtApp()
    return new Promise<false>((resolve) => {
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        go()
        resolve(false)
      }
      setTimeout(settle, 600)
      nuxtApp.hooks.hookOnce('page:loading:end', () => {
        requestAnimationFrame(settle)
        setTimeout(settle, 60)
      })
    })
  },
} satisfies RouterConfig

/* 浏览器原生平滑滚动；开启"减少动效"时退回即时滚动。
   Nuxt 的 scrollBehaviorType 只接受 'auto' | 'smooth'，这里用同一个窄类型。 */
function resolvedScrollBehavior(): 'auto' | 'smooth' {
  return import.meta.client && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'
}
