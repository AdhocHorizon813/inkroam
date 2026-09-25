<script setup lang="ts">
import { usePageScrollable } from '~/composables/usePageScrollable'
import { onPageScroll, pageScrollTop, rememberScrollPosition } from '~/utils/page-scroll'

const config = useRuntimeConfig()
const route = useRoute()
const routeFrame = ref<HTMLElement | null>(null)
const pageScroll = ref<HTMLElement | null>(null)
usePageScrollable(pageScroll)
let routeAnimations: Animation[] = []
let stopScrollListener: (() => void) | undefined
let stopNavigationGuard: (() => void) | undefined

watch(() => route.path, async (_currentPath, previousPath) => {
  if (!import.meta.client || !previousPath) return
  await nextTick()

  const frame = routeFrame.value
  if (!frame || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  routeAnimations.forEach(animation => animation.cancel())
  routeAnimations = []

  const surfaces = frame.querySelectorAll<HTMLElement>(
    '.hero, .latest-section, .manifesto, .standard-page, .article-page',
  )
  const targets = Array.from(surfaces).flatMap(surface =>
    Array.from(surface.children).filter((element): element is HTMLElement => element instanceof HTMLElement),
  )

  targets.forEach(target => target.style.opacity = '0')
  requestAnimationFrame(() => requestAnimationFrame(() => {
    routeAnimations = targets.map((target, index) => {
      const animation = target.animate([
        { opacity: 0, transform: 'translate3d(0, 10px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ], {
        duration: 620,
        delay: Math.min(index * 18, 108),
        easing: 'cubic-bezier(.16, 1, .3, 1)',
        fill: 'both',
      })
      target.style.removeProperty('opacity')
      animation.onfinish = () => animation.cancel()
      return animation
    })
  }))
}, { flush: 'post' })

onBeforeUnmount(() => routeAnimations.forEach(animation => animation.cancel()))

/* Sticky header: when the page scrolls, the header expands into a full-bleed
   rail (driven by the CSS [data-scrolled] state) with a non-linear settle.
   滚动位置一律问 app/utils/page-scroll.ts：桌面在 .page-scroll 里滚，手机上仍滚文档，
   直接读 window 的滚动量只对后者有效。 */
function syncScrollState() {
  const root = document.documentElement
  if (pageScrollTop() > 8) {
    root.dataset.scrolled = 'true'
  } else {
    delete root.dataset.scrolled
  }
}
onMounted(() => {
  syncScrollState()
  stopScrollListener = onPageScroll(syncScrollState)
})
onBeforeUnmount(() => stopScrollListener?.())

/* Markdown 标题里的锚点是普通 `<a href="#id">`，不是 NuxtLink，因此绕开了路由：
   modern 主题把 scroll-behavior 设为 auto，点下去就是瞬跳；而用 NuxtLink 的文章
   目录反而是平滑滚动。这里统一交给路由，让页内锚点与目录走同一条
   `scrollBehaviorType: 'smooth'` 的路径。 */
const router = useRouter()

function isCurrentHash(hash: string) {
  /* route.hash 是百分号编码形式，普通锚点的 href 是原始形式，比较前先解码。 */
  try {
    return decodeURIComponent(route.hash) === hash
  } catch {
    return route.hash === hash
  }
}

function onDocumentClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.target
  if (!(target instanceof Element)) return

  const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]')
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return

  /* 只能用原始 href：中文 id 在 HTML 属性里是未编码的，而 anchor.hash 返回的是
     百分号编码形式，交给 router.push 会被二次编码（% 变成 %25），Nuxt 的
     scrollBehavior 随即找不到元素——表现就是「点了完全不动」。 */
  const hash = anchor.getAttribute('href') || ''
  const id = hash.slice(1)
  const destination = document.getElementById(id)
  if (!id || !destination) return

  event.preventDefault()
  if (isCurrentHash(hash)) {
    /* 同一个目标：路由会判为重复导航直接跳过，这里补一次滚动，
       避免「已经跳过去之后再点同一个标题没反应」。 */
    destination.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
    return
  }
  router.push({ hash })
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

/* 回退/前进与刷新后的阅读位置：每次导航前记下当前页滚到哪，交给
   app/router.options.ts 的 scrollBehavior 还原（vue-router 自带的记录只读 window）。 */
onMounted(() => {
  stopNavigationGuard = router.beforeEach((_to, from) => { rememberScrollPosition(from.fullPath) })
  const flush = () => rememberScrollPosition(route.fullPath)
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', onVisibilityChange)
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibilityChange))
})
onBeforeUnmount(() => stopNavigationGuard?.())

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') rememberScrollPosition(route.fullPath)
}

/* siteUrl 由 CI 通过 NUXT_PUBLIC_SITE_URL 注入（含 GitHub Pages 子路径），
   本地开发回落到 http://localhost:3000。去掉尾部斜杠，避免拼出 //。 */
const siteBase = computed(() => config.public.siteUrl.replace(/\/+$/, ''))

/* 静态站点的规范地址统一为目录形式（带尾斜杠），与 GitHub Pages 的解析一致。 */
const canonicalUrl = computed(() => {
  const path = route.path === '/' ? '/' : `${route.path.replace(/\/+$/, '')}/`
  return `${siteBase.value}${path}`
})

useSeoMeta({
  ogSiteName: '纸上漫游',
  ogTitle: '纸上漫游',
  ogDescription: '写下那些不该被遗忘的想法。',
  ogImage: () => `${siteBase.value}/og.png`,
  ogUrl: () => canonicalUrl.value,
  twitterCard: 'summary_large_image',
  twitterTitle: '纸上漫游',
  twitterDescription: '写下那些不该被遗忘的想法。',
  twitterImage: () => `${siteBase.value}/og.png`,
})

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
}))
</script>

<template>
  <div class="ambient-backdrop" aria-hidden="true">
    <div class="ambient-source">
      <div class="ambient-image" />
      <div class="ambient-aurora" />
    </div>
    <div class="ambient-vignette" />
  </div>
  <div ref="pageScroll" class="page-scroll">
    <div class="site-shell">
      <header class="site-header">
        <NuxtLink class="brand" to="/" aria-label="纸上漫游首页">
          <span class="brand-mark">纸</span>
          <span>纸上漫游</span>
        </NuxtLink>
        <SlidingNav />
      </header>
      <div ref="routeFrame" class="route-frame">
        <NuxtPage :transition="false" />
      </div>
      <footer class="site-footer">
        <span>一些想法，一些记录。</span>
        <span>© {{ new Date().getFullYear() }} 纸上漫游</span>
      </footer>
    </div>
  </div>
  <AppearancePanel />
</template>
