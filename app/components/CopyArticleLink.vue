<script setup lang="ts">
import { passageUrl, selectedPassage, type PassageSelection } from '~/utils/passage-link'
import { copyTextOnGesture } from '~/utils/clipboard'
const props = defineProps<{ feedback?: boolean }>()
const copied = ref(false)
const status = ref('')
const manualLink = ref('')
const busy = ref(false)
const linkField = ref<HTMLInputElement | null>(null)
const selection = ref<PassageSelection | null>(null)
let captured: PassageSelection | null = null
let resetTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false

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
onBeforeUnmount(() => {
  disposed = true; clearTimeout(resetTimer)
  document.removeEventListener('selectionchange', syncSelection)
})

async function copyLink() {
  if (busy.value) return
  clearTimeout(resetTimer)
  busy.value = true
  status.value = ''
  manualLink.value = ''
  const chosen = captured ?? selection.value
  captured = null
  const url = passageUrl(window.location.href, chosen)
  try {
    await copyTextOnGesture(url)
    if (disposed) return
    status.value = chosen?.passage ? '选段链接已复制。' : chosen?.heading ? '已复制所在章节链接。' : '链接已复制。'
    if (props.feedback) {
      copied.value = true
      resetTimer = setTimeout(() => { copied.value = false }, 2400)
    }
  } catch {
    if (disposed) return
    copied.value = false
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
    <button :class="feedback ? 'article-action' : 'text-link'" type="button" :disabled="busy" @pointerdown="captureSelection" @pointercancel="captured = null" @pointerleave="captured = null" @click="copyLink">
      <span v-if="feedback" class="copy-icon" aria-hidden="true"><Transition name="code-label"><svg :key="copied ? 'done' : 'link'" viewBox="0 0 24 24"><path v-if="copied" d="m5 12 4 4L19 6" /><path v-else d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></svg></Transition></span>
      <span v-if="feedback" class="copy-label" aria-live="polite">
        <Transition name="code-label"><span :key="copied ? 'done' : selection ? 'selection' : 'article'">{{ copied ? '已复制' : selection ? '复制选段链接' : '复制本文链接' }}</span></Transition>
      </span>
      <template v-else>{{ selection ? '复制选段链接' : '复制本文链接' }}</template>
    </button>
    <div v-if="!feedback || manualLink" class="copy-status" role="status" aria-live="polite">{{ status }}</div>
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
.copy-article-link button { position: relative; cursor: pointer; }
.copy-article-link button.text-link { margin-top: 0; padding: 14px 6px 5px; background: none; border: 0; border-bottom: 1px solid var(--ink); color: var(--ink); font: inherit; font-size: 13px; }
.copy-article-link button.text-link::after { content: ''; position: absolute; left: -8px; right: -8px; top: 50%; height: 44px; transform: translateY(-50%); }
.copy-article-link button:disabled { cursor: wait; }
.copy-article-link button:focus-visible,
.copy-manual input:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.copy-status { min-height: 1.8em; margin-top: 8px; color: var(--muted); font-size: 12px; line-height: 1.8; }
.copy-manual { display: block; max-width: 480px; margin: 8px auto 0; }
.copy-manual input { width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--line); border-radius: 0; background: transparent; color: var(--ink); font: 16px/1.5 var(--sans); }
.copy-article-link .copy-label { display: inline-grid; justify-items: center; width: 6em; overflow: hidden; vertical-align: bottom; }
.copy-article-link .copy-label,
.copy-article-link .copy-label > span { margin: 0; color: inherit; }
.copy-label > span { grid-area: 1 / 1; }
.copy-icon { display: inline-grid; width: 15px; height: 15px; overflow: hidden; }
.copy-icon svg { grid-area: 1 / 1; }
/* The toolbar copy shares the action row; feedback and manual fallback wrap below it. */
.copy-article-link--inline { display: contents; }
.copy-article-link--inline .copy-status:empty { display: none; }
.copy-article-link--inline .copy-status,
.copy-article-link--inline .copy-manual { flex-basis: 100%; order: 1; margin: 0; }
</style>
