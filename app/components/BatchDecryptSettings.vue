<script setup lang="ts">
import { vExperimentalGlass } from '~/utils/glass-surfaces'
import { parseNoteKeys } from '~/utils/note-keys'
import { decryptNote, loadEncryptedNote } from '~/utils/encrypted-note'

const props = defineProps<{ active: boolean }>()
const session = useUnlockedNotes()
const baseURL = useRuntimeConfig().app.baseURL
const input = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
const fileCount = ref(0)
const importedKeys = shallowRef<string[]>([])
const dialog = ref<HTMLDialogElement | null>(null)
const pendingKeys = shallowRef<string[]>([])
const confirmCount = ref(0)
const busy = ref(false)
const readingFiles = ref(false)
const status = ref('')
const progress = ref('')
const unlocked = computed(() => Object.values(session.documents.value))
let controller: AbortController | undefined
let generation = 0

function dismiss() { pendingKeys.value = []; dialog.value?.close() }
function cancel() {
  generation++
  controller?.abort()
  controller = undefined
  dismiss()
  busy.value = false
  progress.value = ''
  readingFiles.value = false
  input.value = ''
  importedKeys.value = []
  fileCount.value = 0
  if (fileInput.value) fileInput.value.value = ''
  if (folderInput.value) folderInput.value.value = ''
}
function lockAll() { cancel(); session.lockAll(); status.value = '已锁定全部文档。'; progress.value = '' }

async function importFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const files = [...(target.files || [])]
  target.value = ''
  if (!files.length) return
  const current = generation
  readingFiles.value = true
  status.value = ''
  const request = new AbortController()
  controller = request
  try {
    const { importNoteKeyFiles } = await import('~/utils/import-note-keys')
    if (current !== generation) return
    const keys = new Set(importedKeys.value)
    const result = await importNoteKeyFiles(files, request.signal,
      found => { for (const key of found) keys.add(key) },
      count => { if (current === generation) progress.value = `已扫描 ${count} 个密钥文本文件` })
    if (current !== generation) return
    importedKeys.value = [...keys]
    fileCount.value += result.matched
    status.value = `已扫描 ${result.scanned} 个文本文件，识别 ${result.matched} 个密钥文件${result.failed ? `，${result.failed} 个文件或压缩包读取失败（可能损坏、不受支持或体积过大）` : ''}。`
  } catch (error) {
    if (current === generation) status.value = error instanceof Error ? error.message : '无法读取密钥文件。'
  } finally {
    if (current === generation) { readingFiles.value = false; progress.value = ''; controller = undefined }
  }
}

function requestDecrypt() {
  if (busy.value || readingFiles.value) return
  status.value = ''
  try {
    const keys = parseNoteKeys([input.value, ...importedKeys.value].join('\n'))
    pendingKeys.value = keys
    confirmCount.value = keys.length
    dialog.value?.showModal()
  } catch (error) { status.value = error instanceof Error ? error.message : '请检查密钥。' }
}

async function decryptBatch() {
  if (busy.value || !pendingKeys.value.length) return
  let keys = [...pendingKeys.value]
  dismiss()
  input.value = ''; importedKeys.value = []; fileCount.value = 0
  const current = ++generation
  const revision = session.revision()
  const request = new AbortController()
  controller = request
  busy.value = true
  status.value = ''
  let success = 0, failed = 0, unmatched = 0, skipped = 0
  const valid = () => current === generation && revision === session.revision() && !request.signal.aborted
  try {
    if (!window.isSecureContext || !crypto.subtle) throw new Error('请通过 HTTPS 或 localhost 打开此页面。')
    // Public stub fields only; ciphertexts are fetched after explicit confirmation.
    const entries = await queryCollection('posts').where('draft', '=', false).select('path', 'encryptedDocument').all()
    const notes = entries.filter(note => note.encryptedDocument)
    const { splitPrivateNote } = await import('~/utils/private-note-metadata')
    for (let index = 0; index < notes.length; index++) {
      if (!valid()) break
      const note = notes[index]!
      const id = note.encryptedDocument!
      progress.value = `正在处理 ${index + 1} / ${notes.length}`
      if (session.documents.value[id]) { skipped++; continue }
      try {
        const envelope = await loadEncryptedNote(baseURL, id, request.signal)
        let source: string | undefined
        for (const key of keys) {
          if (!valid()) break
          try { source = await decryptNote(envelope, key, id); break } catch { /* Try the next key without logging secrets. */ }
        }
        if (!valid()) break
        if (source === undefined) { unmatched++; continue }
        try { session.remember({ id, path: note.path, source, metadata: splitPrivateNote(source).metadata }); success++ }
        finally { source = undefined }
      } catch { if (valid()) failed++ }
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    if (valid()) status.value = `已解锁 ${success} 篇，已解锁跳过 ${skipped} 篇，未匹配密钥 ${unmatched} 篇，读取或处理失败 ${failed} 篇。`
  } catch (error) {
    if (valid()) status.value = error instanceof Error ? error.message : '批量解密未完成，请重试。'
  } finally {
    keys.fill(''); keys = []
    if (current === generation) { busy.value = false; controller = undefined; progress.value = '' }
  }
}
watch(() => props.active, active => { if (!active) cancel() })
onMounted(() => window.addEventListener('pagehide', cancel))
onBeforeUnmount(() => { cancel(); window.removeEventListener('pagehide', cancel) })
</script>

<template>
  <div class="batch-decrypt">
    <div class="setting-group">
      <label for="batch-note-keys" class="setting-label">文档密钥</label>
      <textarea id="batch-note-keys" v-model="input" rows="5" :disabled="busy || readingFiles" autocomplete="off" autocapitalize="off" :spellcheck="false" placeholder="粘贴多个密钥，每行一个；也支持逗号分隔或 JSON。" />
      <p class="setting-hint">在本机解密，刷新后重新锁定。密钥与文件不会上传。</p>
    </div>
    <div class="batch-decrypt__actions">
      <button type="button" :disabled="busy || readingFiles" @click="fileInput?.click()">导入文件 / ZIP</button>
      <button type="button" :disabled="busy || readingFiles" @click="folderInput?.click()">导入文件夹</button>
      <button type="button" :disabled="busy || readingFiles || (!input.trim() && !importedKeys.length)" @click="requestDecrypt">确定批量解密</button>
      <input ref="fileInput" class="visually-hidden" type="file" accept=".key,.txt,.json,.zip" multiple :disabled="busy || readingFiles" @change="importFiles" />
      <input ref="folderInput" class="visually-hidden" type="file" webkitdirectory multiple :disabled="busy || readingFiles" @change="importFiles" />
    </div>
    <p v-if="fileCount" class="setting-hint">已导入 {{ fileCount }} 个文件，识别 {{ importedKeys.length }} 个不同密钥。</p>
    <p v-if="status || progress" class="setting-hint" role="status" aria-live="polite">{{ progress || status }}</p>
    <div class="batch-decrypt__actions">
      <button v-if="busy || readingFiles" type="button" @click="cancel(); status = '已停止，已完成的解锁仍保留。'; progress = ''">停止处理</button>
      <button v-if="unlocked.length" type="button" @click="lockAll">全部锁定（{{ unlocked.length }}）</button>
    </div>
    <ul v-if="unlocked.length" class="batch-decrypt__list">
      <li v-for="note in unlocked" :key="note.id"><NuxtLink :to="note.path">{{ note.metadata.title || '已解锁笔记' }}</NuxtLink><button type="button" @click="session.lock(note.id)">锁定</button></li>
    </ul>
    <Teleport to="body">
      <dialog ref="dialog" v-experimental-glass="pendingKeys.length > 0" data-glass-module="confirm" class="appearance-confirm" aria-labelledby="batch-decrypt-title" aria-describedby="batch-decrypt-description" @cancel.prevent="dismiss" @close="pendingKeys = []" @keydown.esc.stop>
        <div class="appearance-confirm__symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0m-4 8v2" /></svg></div>
        <h2 id="batch-decrypt-title">继续批量解密？</h2>
        <p id="batch-decrypt-description">将使用 {{ confirmCount }} 个密钥尝试解锁站内加密文档，成功后显示正文与原始标题。</p>
        <p class="appearance-confirm__detail">解锁内容保留在当前标签页内存中，切换文章仍可阅读。刷新、关闭标签页或点击“全部锁定”后清除。</p>
        <div class="appearance-confirm__actions"><button type="button" class="appearance-confirm__accept" autofocus @click="dismiss">取消</button><button type="button" class="appearance-confirm__cancel" @click="decryptBatch">继续解密</button></div>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
textarea { display: block; box-sizing: border-box; width: 100%; resize: vertical; min-height: 100px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: color-mix(in srgb, var(--ink) 4%, transparent); color: var(--ink); font: 12px/1.7 var(--sans); }
/* Shared hints normally follow a label and use a negative margin; this hint follows the input. */
.batch-decrypt .setting-hint { margin: 8px 0 10px; }
.batch-decrypt__actions { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding-block: 12px; }
.batch-decrypt button { border: 0; background: none; color: var(--muted); font: 12px var(--sans); cursor: pointer; }
.batch-decrypt button:disabled { opacity: .5; cursor: default; }
textarea:focus-visible, .batch-decrypt button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.batch-decrypt__list { list-style: none; padding: 0; margin: 0; }
.batch-decrypt__list li { display: flex; align-items: center; gap: 12px; justify-content: space-between; padding: 12px 0; border-top: 1px solid var(--line); font: 12px/1.7 var(--sans); }
.batch-decrypt__list a { color: var(--ink); overflow-wrap: anywhere; }
.batch-decrypt__list button { flex-shrink: 0; }
</style>
