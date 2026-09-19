<script setup lang="ts">
const props = withDefaults(defineProps<{ src: string; title?: string }>(), { title: 'PDF 文档' })
const config = useRuntimeConfig()
// Only local attachments: no remote embeds, scripts, or parent-directory paths.
const pdfUrl = computed(() => {
  const path = props.src || ''
  if (!path.startsWith('/pdfs/') || !/\.pdf$/i.test(path) || /[\\?#%]|\.\./.test(path)) return ''
  return `${config.app.baseURL.replace(/\/$/, '')}${encodeURI(path)}`
})
</script>

<template>
  <section class="pdf-viewer" :aria-label="title">
    <header class="pdf-viewer__header">
      <strong>{{ title }}</strong>
      <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener noreferrer">打开原文件 ↗</a>
    </header>
    <template v-if="pdfUrl">
      <object class="pdf-viewer__document" :data="pdfUrl" type="application/pdf" :aria-label="title">
        <p>当前浏览器无法内嵌显示 PDF，请使用上方“打开原文件”查看或下载。</p>
      </object>
    </template>
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
:root[data-visual='modern'] .pdf-viewer,
:root[data-visual='modern'] .pdf-viewer__header { border-color: var(--modern-line); }
</style>
