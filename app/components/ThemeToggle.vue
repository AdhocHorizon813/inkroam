<script setup lang="ts">
const isDark = ref(false)

// 深浅色与外观面板共用一份（colorMode / data-theme），避免两套开关互相覆盖。
function readColorMode(): 'dark' | 'light' {
  try {
    const saved = JSON.parse(localStorage.getItem('paper-trail-appearance-v5') || 'null')
    if (saved?.colorMode === 'dark' || saved?.colorMode === 'light') return saved.colorMode
  } catch {}
  const dom = document.documentElement.dataset.colorMode
  if (dom === 'dark' || dom === 'light') return dom
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme() {
  const mode = isDark.value ? 'dark' : 'light'
  const root = document.documentElement
  root.dataset.theme = mode
  root.dataset.colorMode = mode
}

function persistTheme(mode: 'dark' | 'light') {
  try {
    const saved = JSON.parse(localStorage.getItem('paper-trail-appearance-v5') || '{}')
    saved.colorMode = mode
    localStorage.setItem('paper-trail-appearance-v5', JSON.stringify(saved))
  } catch {}
}

onMounted(() => {
  isDark.value = readColorMode() === 'dark'
  applyTheme()
})

function toggleTheme() {
  isDark.value = !isDark.value
  const mode = isDark.value ? 'dark' : 'light'
  persistTheme(mode)
  applyTheme()
}
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
    :title="isDark ? '浅色模式' : '深色模式'"
    @click="toggleTheme"
  >
    {{ isDark ? '日' : '月' }}
  </button>
</template>
