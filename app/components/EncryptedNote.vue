<script setup lang="ts">
import { decryptNote, loadEncryptedNote } from '~/utils/encrypted-note'
import type { PrivateNoteMetadata } from '~/utils/private-note-metadata'

const props = defineProps<{ documentId: string }>()
const emit = defineEmits<{
  metadata: [value: PrivateNoteMetadata | null]
  toc: [value: { id: string; text: string; depth: number }[]]
  content: [value: HTMLElement | null]
}>()
const bodyElement = ref<HTMLElement | null>(null)
const baseURL = useRuntimeConfig().app.baseURL
const keyInput = ref('')
const html = shallowRef('')
const unlocked = ref(false)
const busy = ref(false)
const error = ref('')
let generation = 0
let request: AbortController | undefined

function lock() {
  generation++
  request?.abort()
  request = undefined
  keyInput.value = ''
  html.value = ''
  emit('metadata', null)
  emit('toc', [])
  emit('content', null)
  unlocked.value = false
  busy.value = false
  error.value = ''
}

async function unlock() {
  if (busy.value) return
  if (!window.isSecureContext || !window.crypto?.subtle) {
    error.value = '请通过 HTTPS 或 localhost 打开此页面。'
    return
  }
  const current = ++generation
  let secret = keyInput.value.trim()
  keyInput.value = ''
  busy.value = true
  error.value = ''
  request = new AbortController()
  try {
    if (!/^[A-Za-z0-9+/]{43}=$/.test(secret)) throw new Error('Invalid key')
    const envelope = await loadEncryptedNote(baseURL, props.documentId, request.signal)
    let plaintext = await decryptNote(envelope, secret, props.documentId)
    secret = ''
    try {
      const { renderPrivateMarkdown } = await import('~/utils/render-private-markdown')
      if (generation !== current) return
      const rendered = renderPrivateMarkdown(plaintext)
      html.value = rendered.html
      emit('metadata', rendered.metadata)
      emit('toc', rendered.toc)
      unlocked.value = true
      await nextTick()
      if (generation === current) emit('content', bodyElement.value)
    } finally {
      plaintext = ''
    }
  } catch {
    if (generation === current) error.value = '无法解锁。请确认密钥完整、文件可访问且未被修改。'
  } finally {
    secret = ''
    if (generation === current) busy.value = false
  }
}

onMounted(() => window.addEventListener('pagehide', lock))
onBeforeUnmount(() => {
  lock()
  window.removeEventListener('pagehide', lock)
})
watch(() => props.documentId, lock)
</script>

<template>
  <section class="encrypted-note" aria-label="加密文档">
    <form v-if="!unlocked" class="encrypted-note__gate" autocomplete="off" @submit.prevent="unlock">
      <svg class="encrypted-note__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg>
      <h2>输入密钥，继续阅读</h2>
      <p>文档在你的浏览器中解密，密钥不会上传或保存。</p>
      <label for="encrypted-note-key">文档密钥</label>
      <div class="encrypted-note__entry">
        <input id="encrypted-note-key" v-model="keyInput" type="password" autocomplete="off" autocapitalize="off" :spellcheck="false" placeholder="粘贴文档密钥" :disabled="busy" required aria-describedby="encrypted-note-message" />
        <button type="submit" class="text-link" :disabled="busy || !keyInput.trim()">{{ busy ? '正在解锁…' : '解锁文档' }}</button>
      </div>
      <p id="encrypted-note-message" role="status" aria-live="polite">{{ error }}</p>
      <noscript>此文档需要启用 JavaScript 后在本地解密。</noscript>
    </form>
    <template v-else>
      <div class="encrypted-note__status"><span>已在本机解锁</span><button class="text-link" type="button" @click="lock">锁定文档</button></div>
      <!-- Sanitized Markdown only. No Vue compilation, remote images or custom embeds. -->
      <div ref="bodyElement" class="encrypted-note__body" v-html="html" />
    </template>
  </section>
</template>

<style scoped>
.encrypted-note__gate { max-width: 38rem; margin: 2rem auto; padding: clamp(1rem, 3vw, 2rem); }
.encrypted-note__icon { width: 2rem; height: 2rem; opacity: .7; }
.encrypted-note__gate h2 { margin-top: 1rem; }
.encrypted-note__gate label { display: block; margin: 1.5rem 0 .5rem; font-size: .85rem; }
.encrypted-note__entry { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
.encrypted-note__entry input { flex: 1 1 12rem; min-width: 0; padding: .8rem 1rem; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 12px; background: color-mix(in srgb, currentColor 4%, transparent); color: inherit; font: inherit; }
.encrypted-note__entry input:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.encrypted-note button { font: inherit; cursor: pointer; }
.encrypted-note button:disabled { opacity: .5; cursor: default; }
.encrypted-note__status { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 2rem; font-size: .85rem; }
.encrypted-note__body { animation: private-note-enter 280ms cubic-bezier(.2, .82, .22, 1); }
.encrypted-note__body :deep(pre) { overflow-x: auto; padding: 1rem; border-radius: 12px; background: color-mix(in srgb, currentColor 5%, transparent); line-height: 1.65; }
.encrypted-note__body :deep(pre code) { font-size: .85rem; white-space: pre; }
.encrypted-note__body :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.encrypted-note__body :deep(th), .encrypted-note__body :deep(td) { padding: .6rem .8rem; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
.encrypted-note__body :deep(.katex-display) { overflow-x: auto; overflow-y: hidden; padding: .4rem 0; }
@keyframes private-note-enter { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .encrypted-note__body { animation: none; } }
</style>
