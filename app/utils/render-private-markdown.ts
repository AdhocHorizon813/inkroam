// Only imported after decryption. Never send plaintext through Content/MDC or SSR.
import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import { splitPrivateNote } from './private-note-metadata'
import 'katex/dist/katex.min.css'

export function renderPrivateMarkdown(source: string) {
  const markdown = new Marked({ gfm: true, async: false })
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  markdown.use({
    renderer: {
      // Documents are content, never executable HTML, Vue components or network embeds.
      html: token => escape(token.text),
      image: token => `<span class="private-attachment">[附件：${escape(token.text || '图片')}，未自动加载]</span>`,
      link(token) {
        const label = this.parser.parseInline(token.tokens)
        return `<a href="${escape(token.href)}" rel="noreferrer noopener" target="_blank">${label}</a>`
      },
    },
    extensions: [
      {
        name: 'blockMath', level: 'block',
        start: source => source.indexOf('$$'),
        tokenizer(source) {
          const match = /^\$\$[ \t]*\n?([\s\S]+?)\$\$(?:[ \t]*(?:\n|$))/.exec(source)
          if (match) return { type: 'blockMath', raw: match[0], text: match[1] }
        },
        renderer: token => katex.renderToString(token.text, { displayMode: true, output: 'html', throwOnError: false, trust: false, maxExpand: 1000 }),
      },
      {
        name: 'inlineMath', level: 'inline',
        start: source => source.indexOf('$'),
        tokenizer(source) {
          const match = /^\$(?!\$)([^\n$]+?)\$(?!\$)/.exec(source)
          if (match) return { type: 'inlineMath', raw: match[0], text: match[1] }
        },
        renderer: token => katex.renderToString(token.text, { output: 'html', throwOnError: false, trust: false, maxExpand: 1000 }),
      },
    ],
  })
  // Visible header only; the caller must not put private metadata in SEO or Nuxt state.
  const { body, metadata } = splitPrivateNote(source)
  const html = DOMPurify.sanitize(markdown.parse(body) as string, {
    USE_PROFILES: { html: true },
    // KaTeX draws radicals and stretchy accents with inline SVG paths.
    ADD_TAGS: ['svg', 'path'],
    ADD_ATTR: ['viewBox', 'preserveAspectRatio', 'd'],
    FORBID_TAGS: ['img', 'picture', 'video', 'audio', 'source', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'style'],
    FORBID_ATTR: ['src', 'srcset', 'ping', 'id', 'name'],
    ALLOW_DATA_ATTR: false,
  })
  const template = document.createElement('template')
  template.innerHTML = html
  const toc = Array.from(template.content.querySelectorAll('h2, h3')).map((heading, index) => {
    // Opaque local anchors: never put confidential heading text in a URL.
    heading.id = `private-section-${index + 1}`
    return { id: heading.id, text: heading.textContent || '', depth: Number(heading.tagName[1]) }
  })
  return { html: template.innerHTML, metadata, toc }
}
