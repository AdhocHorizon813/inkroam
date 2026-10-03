<script setup lang="ts">
const props = defineProps<{ code?: string; language?: string; filename?: string; class?: string }>()
const MermaidDiagram = defineAsyncComponent(() => import('./MermaidDiagram.vue'))
const mode = ref<'light' | 'dark'>()
const pre = ref<HTMLPreElement>()
const copyState = ref('复制代码')
let resetTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false
const languageLabel = computed(() => ({ c: 'C', cpp: 'C++', js: 'JavaScript', ts: 'TypeScript', python: 'Python', text: '纯文本' }[props.language || 'text'] || props.language))
function toggleTheme() {
  const current = mode.value || document.documentElement.dataset.colorMode || 'light'
  mode.value = current === 'dark' ? 'light' : 'dark'
}
async function copyCode() {
  clearTimeout(resetTimer)
  try {
    await navigator.clipboard.writeText(props.code ?? pre.value?.textContent ?? '')
    if (disposed) return
    copyState.value = '已复制'
  } catch {
    if (disposed) return
    if (pre.value) {
      const range = document.createRange()
      range.selectNodeContents(pre.value)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      pre.value.focus()
    }
    copyState.value = '请手动复制'
  }
  resetTimer = setTimeout(() => { copyState.value = '复制代码' }, 2400)
}
onBeforeUnmount(() => { disposed = true; clearTimeout(resetTimer) })
</script>

<template>
  <MermaidDiagram v-if="language === 'mermaid' && code" :source="code" />
  <div v-else class="article-code" :data-code-theme="mode">
    <div class="article-code-toolbar">
      <span class="article-code-language">{{ filename || languageLabel }}</span>
      <span v-if="filename" class="article-code-language">{{ languageLabel }}</span>
      <div class="article-code-actions">
        <button type="button" aria-label="切换此代码块的明暗" title="切换此代码块的明暗" @click="toggleTheme">
          <span class="article-code-theme-icon" aria-hidden="true">
            <svg class="article-code-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
            <svg class="article-code-moon" viewBox="0 0 24 24"><path d="M20 14a8.5 8.5 0 0 1-10-10A8.5 8.5 0 1 0 20 14Z" /></svg>
          </span>
        </button>
        <button type="button" :aria-label="copyState" :title="copyState" @click="copyCode">
          <span class="article-code-copy-icon" aria-hidden="true">
            <Transition name="code-icon" mode="out-in">
              <svg v-if="copyState === '已复制'" key="done" viewBox="0 0 24 24"><path class="article-code-check" d="m5 12 4 4L19 6" /></svg>
              <svg v-else key="copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
            </Transition>
          </span>
          <!-- 文字状态：宽度固定（放得下最长的「请手动复制」）、文字居中，
               所以「复制代码」↔「已复制」换字时按钮和图标都不动；两条文字在同一格里
               上下换位，旧的上移淡出、新的从下方顶上。 -->
          <span class="article-code-state" aria-live="polite">
            <Transition name="code-label">
              <span :key="copyState">{{ copyState }}</span>
            </Transition>
          </span>
        </button>
      </div>
    </div>
    <pre ref="pre" :class="$props.class" :data-language="language" tabindex="0" :aria-label="filename || `${language || '文本'}代码块`"><slot /></pre>
  </div>
</template>
