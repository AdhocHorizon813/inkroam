import { findPassageTarget } from '~/utils/passage-link'
import { resolvePageScroller, pageScrollTop, scrollPageTo, findHashTarget } from '~/utils/page-scroll'

/* Keep the ordinary heading hash as fallback; no injected text or new highlight. */
export function scrollToPassageWhenReady(key: string, hash: string, behavior: ScrollBehavior, path: string, timeout = 1200) {
  const startedAt = Date.now()
  const href = window.location.href
  const attempt = (): void => {
    if (window.location.href !== href) return
    const article = document.querySelector('.article-content')
    const sameArticle = article?.getAttribute('data-article-path')?.replace(/\/$/, '') === path.replace(/\/$/, '')
    const target = sameArticle && article ? findPassageTarget(article, key) : null
    if (target) {
      const scroller = resolvePageScroller()
      const origin = scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top
      const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--anchor-offset')) || 0
      scrollPageTo(pageScrollTop() + target.getBoundingClientRect().top - origin - offset, behavior)
      return
    }
    if (Date.now() - startedAt >= timeout) {
      if (hash && sameArticle) findHashTarget(hash)?.scrollIntoView({ block: 'start', behavior })
      return
    }
    requestAnimationFrame(attempt)
  }
  attempt()
}
