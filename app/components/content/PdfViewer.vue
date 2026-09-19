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

/* Android / iOS 浏览器没有内嵌 PDF 的能力：<object> 只会留一个空白框，写在里面的
   兜底文案浏览器也不会显示。这些环境改成“打开 PDF”卡片。SSR 与首次渲染先输出卡片
   （没有 JS 也有可用入口），挂载后确认浏览器真的能内嵌再升级为 <object>，
   这样手机不会白白下载整份附件。 */
const canEmbed = ref(false)
onMounted(() => {
  const supported = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (supported !== false && !mobile) canEmbed.value = true
})
</script>

<template>
  <section class="pdf-viewer" :aria-label="title">
    <header class="pdf-viewer__header">
      <strong>{{ title }}</strong>
      <a v-if="pdfUrl && canEmbed" :href="pdfUrl" target="_blank" rel="noopener noreferrer">打开原文件 ↗</a>
    </header>
    <template v-if="pdfUrl && canEmbed">
      <object class="pdf-viewer__document" :data="pdfUrl" type="application/pdf" :aria-label="title">
        <p>当前浏览器无法内嵌显示 PDF，请使用上方“打开原文件”查看或下载。</p>
      </object>
    </template>
    <div v-else-if="pdfUrl" class="pdf-viewer__fallback">
      <p class="pdf-viewer__file">{{ fileName }}</p>
      <p class="pdf-viewer__note">手机浏览器不能把 PDF 嵌进网页，点击下方按钮会在系统阅读器或新标签页里打开。</p>
      <a class="pdf-viewer__open" :href="pdfUrl" target="_blank" rel="noopener noreferrer">打开 PDF <span aria-hidden="true">↗</span></a>
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
</style>
