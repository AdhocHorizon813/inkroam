<script setup lang="ts">
import { supportsEmbeddedPdf } from '~/utils/pdf-embed'

const props = withDefaults(defineProps<{ src: string; title?: string }>(), { title: 'PDF 文档' })
const config = useRuntimeConfig()
// Only local attachments: no remote embeds, scripts, or parent-directory paths.
const pdfUrl = computed(() => {
  const path = props.src || ''
  if (!path.startsWith('/pdfs/') || !/\.pdf$/i.test(path) || /[\\?#%]|\.\./.test(path)) return ''
  return `${config.app.baseURL.replace(/\/$/, '')}${encodeURI(path)}`
})
const fileName = computed(() => props.src.split('/').pop() || 'PDF 文档')

/* 判据在 `~/utils/pdf-embed`（外观面板用同一份规则）：只看浏览器能不能内嵌 PDF，
   不看设备类型或屏幕宽度，避免把能内嵌的平板误判成手机。SSR 与首次渲染一律先出卡片
   （没有 JS 也有可用入口），挂载后确认能内嵌才替换成 <object>，手机不会白白下载整份附件。 */
const canEmbed = ref(false)
onMounted(() => {
  canEmbed.value = supportsEmbeddedPdf()
})

/* 不能内嵌的环境走自带阅读器：默认先给卡片，用户点「在页面内阅读」才下载 pdfjs-dist
   的分块与 worker，能内嵌的浏览器永远不会拉它。外观面板的「PDF 附件」选项可以把这一步
   提前——偏好为「直接阅读」时自动打开阅读器，同样只在不能内嵌时生效。加载失败退回卡片，
   附件入口始终可用。 */
const PdfCanvasReader = defineAsyncComponent(() => import('~/components/PdfCanvasReader.vue'))
// 与外观面板共用同一份偏好，读法与 index.vue 读取「最近文章数量」一致。
type PdfFallbackMode = 'card' | 'reader'
const pdfFallback = useState<PdfFallbackMode>('pdf-fallback', () => 'card')
const readerOpen = ref(false)
const readerFailed = ref(false)
/* 卡片上的勾选框：勾上再点「在页面内阅读」，这次阅读之外还把偏好改成「直接阅读」，
   面板负责把 sharedPdfFallback 回写成 state 并持久化到 localStorage。 */
const alwaysInPage = ref(false)
const showReader = computed(() => !canEmbed.value && (readerOpen.value || pdfFallback.value === 'reader'))
const fallbackNote = computed(() =>
  readerFailed.value
    ? '阅读器没能加载，请改用“打开原文件”。'
    : '这个浏览器不能把 PDF 嵌进网页：点“在页面内阅读”可在这里翻页，或交给系统阅读器打开。',
)

function openReader() {
  readerFailed.value = false
  if (alwaysInPage.value) pdfFallback.value = 'reader'
  readerOpen.value = true
}

function onReaderFailed() {
  readerFailed.value = true
}
</script>

<template>
  <section class="pdf-viewer" :aria-label="title">
    <header class="pdf-viewer__header">
      <strong>{{ title }}</strong>
      <a v-if="pdfUrl && (canEmbed || showReader)" :href="pdfUrl" target="_blank" rel="noopener noreferrer">打开原文件 ↗</a>
    </header>
    <template v-if="pdfUrl && canEmbed">
      <object class="pdf-viewer__document" :data="pdfUrl" type="application/pdf" :aria-label="title">
        <p>当前浏览器无法内嵌显示 PDF，请使用上方“打开原文件”查看或下载。</p>
      </object>
    </template>
    <PdfCanvasReader
      v-else-if="pdfUrl && showReader && !readerFailed"
      :src="pdfUrl"
      :title="title"
      @failed="onReaderFailed"
    />
    <div v-else-if="pdfUrl" class="pdf-viewer__fallback">
      <p class="pdf-viewer__file">{{ fileName }}</p>
      <p class="pdf-viewer__note">{{ fallbackNote }}</p>
      <div class="pdf-viewer__actions">
        <button type="button" class="pdf-viewer__open pdf-viewer__open--primary" @click="openReader">在页面内阅读</button>
        <a class="pdf-viewer__open" :href="pdfUrl" target="_blank" rel="noopener noreferrer">打开原文件 <span aria-hidden="true">↗</span></a>
      </div>
      <label v-if="pdfFallback === 'card'" class="pdf-viewer__always">
        <input v-model="alwaysInPage" type="checkbox">
        <span>始终在页面内阅读</span>
      </label>
    </div>
    <p v-else role="status">PDF 路径无效，请使用 /pdfs/ 开头的本地 .pdf 文件路径。</p>
  </section>
</template>

<style scoped>
.pdf-viewer { margin-block: 2em; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.pdf-viewer__header { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px 20px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.pdf-viewer__header strong { font-size: 15px; overflow-wrap: anywhere; }
.pdf-viewer__header a { font-size: 12px; white-space: nowrap; }
.pdf-viewer__document { display: block; width: 100%; height: clamp(360px, 75vh, 960px); background: #f5f5f5; color: #222; }
.pdf-viewer__document p { padding: 24px; }
.pdf-viewer__fallback { display: grid; justify-items: start; gap: 10px; padding: 16px; }
.pdf-viewer__always { display: inline-flex; align-items: center; gap: 8px; margin-top: 2px; color: var(--muted); font-size: 12.5px; line-height: 1.5; cursor: pointer; }
.pdf-viewer__always input { width: 14px; height: 14px; margin: 0; accent-color: var(--accent); cursor: pointer; }
.pdf-viewer__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.pdf-viewer__file { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.pdf-viewer__note { max-width: 46ch; margin: 0; color: var(--muted); font: 13px/1.75 var(--serif); }
.pdf-viewer__open {
  display: inline-flex; align-items: center; gap: 8px;
  margin-top: 4px; padding: 10px 16px;
  border: 1px solid var(--line); border-radius: 999px;
  color: var(--ink); font-size: 14px; text-decoration: none;
  transition: border-color 200ms var(--ease-fluid), background-color 200ms var(--ease-fluid);
}
.pdf-viewer__open span { color: var(--accent); }
.pdf-viewer__open:hover, .pdf-viewer__open:focus-visible { border-color: var(--accent); }
:root[data-visual='modern'] .pdf-viewer__open { border-color: var(--modern-line); background: rgba(255, 255, 255, .06); color: var(--modern-ink); }
:root[data-visual='modern'] .pdf-viewer__open:hover,
:root[data-visual='modern'] .pdf-viewer__open:focus-visible { border-color: var(--modern-accent); background: rgba(255, 255, 255, .1); }
:root[data-visual='modern'] .pdf-viewer,
:root[data-visual='modern'] .pdf-viewer__header { border-color: var(--modern-line); }
button.pdf-viewer__open { cursor: pointer; font-family: inherit; font-size: 14px; background: transparent; }
.pdf-viewer__open.pdf-viewer__open--primary { border-color: var(--accent); background: var(--accent); color: var(--paper); }
.pdf-viewer__open.pdf-viewer__open--primary span { color: currentColor; }
:root[data-visual='modern'] .pdf-viewer__always { color: var(--modern-muted); }
:root[data-visual='modern'] .pdf-viewer__always input { accent-color: var(--modern-accent); }
:root[data-visual='modern'] .pdf-viewer__open.pdf-viewer__open--primary {
  border-color: var(--modern-accent); background: var(--modern-accent); color: #12161d;
}
:root[data-visual='modern'] .pdf-viewer__open.pdf-viewer__open--primary:hover,
:root[data-visual='modern'] .pdf-viewer__open.pdf-viewer__open--primary:focus-visible {
  border-color: var(--modern-accent); background: color-mix(in srgb, var(--modern-accent) 88%, white);
}
</style>
