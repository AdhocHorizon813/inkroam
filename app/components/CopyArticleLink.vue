<script setup lang="ts">
import { passageUrl, selectedPassage, type PassageSelection } from '~/utils/passage-link'
const status = ref('')
const manualLink = ref('')
const busy = ref(false)
const linkField = ref<HTMLInputElement | null>(null)
const selection = ref<PassageSelection | null>(null)
let captured: PassageSelection | null = null

function syncSelection() {
  selection.value = selectedPassage(document.querySelector('.article-content'), window.getSelection())
}
function captureSelection() {
  syncSelection()
  captured = selection.value
}
onMounted(() => {
  document.addEventListener('selectionchange', syncSelection)
  syncSelection()
})
onBeforeUnmount(() => document.removeEventListener('selectionchange', syncSelection))

async function copyLink() {
  if (busy.value) return
  busy.value = true
  status.value = ''
  manualLink.value = ''
  const chosen = captured ?? selection.value
  captured = null
  const url = passageUrl(window.location.href, chosen)
  try {
    await navigator.clipboard.writeText(url)
    status.value = chosen?.passage ? '选段链接已复制。' : chosen?.heading ? '已复制所在章节链接。' : '链接已复制。'
  } catch {
    manualLink.value = url
    status.value = '未能自动复制，请选择下方链接手动复制。'
    await nextTick()
    linkField.value?.focus()
    linkField.value?.select()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="copy-article-link">
    <button class="text-link" type="button" :disabled="busy" @pointerdown="captureSelection" @pointercancel="captured = null" @pointerleave="captured = null" @click="copyLink">{{ selection ? '复制选段链接' : '复制本文链接' }}</button>
    <div class="copy-status" role="status" aria-live="polite">{{ status }}</div>
    <label v-if="manualLink" class="copy-manual">
      <span class="visually-hidden">本文链接，可手动复制</span>
      <input ref="linkField" :value="manualLink" type="text" readonly @focus="linkField?.select()">
    </label>
  </div>
</template>

<style scoped>
.copy-article-link { margin-top: 12px; }
/* 下划线继续用 .text-link 的 border-bottom：classic 下显式取 var(--ink)，与同页其它
   .text-link 的线色、粗细完全一致；modern 主题的 :root[data-visual='modern'] .text-link
   优先级更高（0,3,0 > scoped 的 0,2,1），线色仍由那条规则决定——所以这里不能改用
   text-decoration 另画一条，否则会和它叠成两条线。
   旧写法靠 min-height: 44px 把文字在盒内垂直居中，border 因此落到文字下方约 16.5px
   （2026-10-02 浏览器实测）；改用 padding 定位：padding-top 维持文字原位，padding-bottom
   决定线距（与同页 .text-link 一致：classic 5px，modern 主题自带的 padding 生效时为 8px）。
   盒子不再有 44px，触控高度由 ::after 撑出，避免顺带改掉下方的间距。 */
.copy-article-link button { position: relative; margin-top: 0; padding: 14px 6px 5px; background: none; border: 0; border-bottom: 1px solid var(--ink); color: var(--ink); cursor: pointer; font: inherit; font-size: 13px; }
.copy-article-link button::after { content: ''; position: absolute; left: -8px; right: -8px; top: 50%; height: 44px; transform: translateY(-50%); }
.copy-article-link button:disabled { cursor: wait; }
.copy-article-link button:focus-visible,
.copy-manual input:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.copy-status { min-height: 1.8em; margin-top: 8px; color: var(--muted); font-size: 12px; line-height: 1.8; }
.copy-manual { display: block; max-width: 480px; margin: 8px auto 0; }
.copy-manual input { width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--line); border-radius: 0; background: transparent; color: var(--ink); font: 16px/1.5 var(--sans); }
</style>
