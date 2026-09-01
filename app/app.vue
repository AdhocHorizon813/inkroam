<script setup lang="ts">
const config = useRuntimeConfig()
const route = useRoute()
const routeFrame = ref<HTMLElement | null>(null)
let routeAnimations: Animation[] = []

watch(() => route.fullPath, async (_currentPath, previousPath) => {
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

useSeoMeta({
  ogSiteName: '纸上漫游',
  ogTitle: '纸上漫游',
  ogDescription: '写下那些不该被遗忘的想法。',
  ogImage: () => `${config.public.siteUrl}/og.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: '纸上漫游',
  twitterDescription: '写下那些不该被遗忘的想法。',
  twitterImage: () => `${config.public.siteUrl}/og.png`,
})
</script>

<template>
  <div class="ambient-backdrop" aria-hidden="true">
    <div class="ambient-source">
      <div class="ambient-image" />
      <div class="ambient-aurora" />
    </div>
    <div class="ambient-vignette" />
  </div>
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
      <span>在文字里，保存缓慢而清醒的思考。</span>
      <span>© {{ new Date().getFullYear() }} 纸上漫游</span>
    </footer>
  </div>
  <AppearancePanel />
</template>
