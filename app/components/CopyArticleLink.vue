<script setup lang="ts">
const status = ref('')
const manualLink = ref('')
const busy = ref(false)
const linkField = ref<HTMLInputElement | null>(null)

async function copyLink() {
  if (busy.value) return
  busy.value = true
  status.value = ''
  manualLink.value = ''
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  try {
    await navigator.clipboard.writeText(url.href)
    status.value = '链接已复制。'
  } catch {
    manualLink.value = url.href
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
    <button class="text-link" type="button" :disabled="busy" @click="copyLink">复制本文链接</button>
    <div class="copy-status" role="status" aria-live="polite">{{ status }}</div>
    <label v-if="manualLink" class="copy-manual">
      <span class="visually-hidden">本文链接，可手动复制</span>
      <input ref="linkField" :value="manualLink" type="text" readonly @focus="linkField?.select()">
    </label>
  </div>
</template>

<style scoped>
.copy-article-link { margin-top: 12px; }
.copy-article-link button { min-height: 44px; margin-top: 0; background: none; border: 0; border-bottom: 1px solid var(--line); color: var(--ink); cursor: pointer; font: inherit; font-size: 13px; }
.copy-article-link button:disabled { cursor: wait; }
.copy-article-link button:focus-visible,
.copy-manual input:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.copy-status { min-height: 1.8em; margin-top: 8px; color: var(--muted); font-size: 12px; line-height: 1.8; }
.copy-manual { display: block; max-width: 480px; margin: 8px auto 0; }
.copy-manual input { width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--line); border-radius: 0; background: transparent; color: var(--ink); font: 16px/1.5 var(--sans); }
</style>
