<script setup lang="ts">
const props = withDefaults(defineProps<{ src: string; title?: string }>(), { title: 'PDF 文档' })
const config = useRuntimeConfig()
// Only local attachments: no remote embeds, scripts, or parent-directory paths.
const pdfUrl = computed(() => {
  const path = props.src || ''
  if (!path.startsWith('/pdfs/') || !/\.pdf$/i.test(path) || /[\\?#%]|\.\./.test(path)) return ''
  return `${config.app.baseURL.replace(/\/$/, '')}${encodeURI(path)}`
})
const fileName = computed(() => props.src.split('/').pop() || 'PDF 文档')

/* 判据只看“浏览器能不能内嵌 PDF”，不看设备类型，也不看屏幕宽度：平板、手机横屏、
   “请求桌面版网站”都走同一套逻辑，避免把能内嵌的平板误判成手机。
   1) navigator.pdfViewerEnabled 有值：直接采信（Chrome / Firefox for Android 为 false）；
   2) 老浏览器没有该属性：只把 Android 当作不能内嵌（旧版 Android Chrome），其余保持内嵌；
   3) 不能内嵌时才显示卡片，用户点「在页面内阅读」再用 PDF.js 画到 canvas。 */
const canEmbed = ref(false)
onMounted(() => {
  const supported = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled
  canEmbed.value = supported === undefined ? !/Android/i.test(navigator.userAgent) : supported
})

/* 不能内嵌的环境走自带阅读器：pdfjs-dist 的分块与 worker 只在用户点「在页面内阅读」
   时才下载，桌面浏览器永远不会拉它。加载失败就退回卡片，附件入口始终可用。 */
const PdfCanvasReader = defineAsyncComponent(() => import('~/components/PdfCanvasReader.vue'))
const readerOpen = ref(false)
const readerFailed = ref(false)
const fallbackNote = computed(() =>
  readerFailed.value
    ? '阅读器没能加载，请改用“打开原文件”。'
    : '手机浏览器不能把 PDF 嵌进网页：点“在页面内阅读”可在这里翻页，或交给系统阅读器打开。',
)

function openReader() {
  readerFailed.value = false
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
      <a v-if="pdfUrl && (canEmbed || readerOpen)" :href="pdfUrl" target="_blank" rel="noopener noreferrer">打开原文件 ↗</a>
    </header>
    <template v-if="pdfUrl && canEmbed && !readerOpen">
      <object class="pdf-viewer__document" :data="pdfUrl" type="application/pdf" :aria-label="title">
        <p>当前浏览器无法内嵌显示 PDF，请使用上方“打开原文件”查看或下载。</p>
      </object>
    </template>
    <PdfCanvasReader
      v-else-if="pdfUrl && readerOpen && !readerFailed"
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
:root[data-visual='modern'] .pdf-viewer__open.pdf-viewer__open--primary {
  border-color: var(--modern-accent); background: var(--modern-accent); color: #12161d;
}
:root[data-visual='modern'] .pdf-viewer__open.pdf-viewer__open--primary:hover,
:root[data-visual='modern'] .pdf-viewer__open.pdf-viewer__open--primary:focus-visible {
  border-color: var(--modern-accent); background: color-mix(in srgb, var(--modern-accent) 88%, white);
}
</style>
