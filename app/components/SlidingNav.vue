<script setup lang="ts">
const route = useRoute()

const items = [
  { label: '文章', to: '/' },
  { label: '归档', to: '/archive' },
  { label: '关于', to: '/about' },
  { label: '搜索', to: '/search', icon: 'search' },
]

const navElement = ref<HTMLElement | null>(null)
const linkElements = ref<HTMLElement[]>([])
const indicator = reactive({ x: 0, width: 0, ready: false })
let resizeObserver: ResizeObserver | undefined

function setLinkElement(element: unknown, index: number) {
  const candidate = element && typeof element === 'object' && '$el' in element
    ? (element as { $el?: unknown }).$el
    : element
  if (candidate instanceof HTMLElement) linkElements.value[index] = candidate
}

function getActiveIndex(path: string) {
  if (path.startsWith('/archive')) return 1
  if (path.startsWith('/about')) return 2
  if (path.startsWith('/search')) return 3
  return 0
}

async function updateIndicator() {
  await nextTick()
  const nav = navElement.value
  const link = linkElements.value[getActiveIndex(route.path)]
  if (!nav || !link) return

  const navBox = nav.getBoundingClientRect()
  const linkBox = link.getBoundingClientRect()
  indicator.x = linkBox.left - navBox.left
  indicator.width = linkBox.width
  indicator.ready = true
}

watch(() => route.path, updateIndicator)

onMounted(() => {
  updateIndicator()
  resizeObserver = new ResizeObserver(updateIndicator)
  if (navElement.value) resizeObserver.observe(navElement.value)
  linkElements.value.forEach(element => resizeObserver?.observe(element))
  window.addEventListener('resize', updateIndicator, { passive: true })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', updateIndicator)
})
</script>

<template>
  <nav ref="navElement" class="main-nav" aria-label="主导航">
    <span
      class="nav-highlight"
      :class="{ 'is-ready': indicator.ready }"
      :style="{
        '--nav-indicator-x': `${indicator.x}px`,
        '--nav-indicator-width': `${indicator.width}px`,
      }"
      aria-hidden="true"
    />
    <NuxtLink
      v-for="(item, index) in items"
      :key="item.to"
      :ref="element => setLinkElement(element, index)"
      :to="item.to"
      :class="{ 'nav-search': item.icon === 'search' }"
      :aria-label="item.icon === 'search' ? item.label : undefined"
      :title="item.icon === 'search' ? item.label : undefined"
    >
      <svg v-if="item.icon === 'search'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <template v-else>{{ item.label }}</template>
    </NuxtLink>
    <ThemeToggle />
  </nav>
</template>
