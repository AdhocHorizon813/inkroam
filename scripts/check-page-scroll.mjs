import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PAGE_SCROLLABLE_ATTRIBUTE, PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, PAGE_SCROLLBAR_OFFSET_PROPERTY,
  PAGE_SCROLLBAR_SIZE_PROPERTY, PAGE_SCROLL_QUERY, findHashTarget, pageMaxScroll, pageNeedsScroll,
  pageScrollTop, rememberScrollPosition, resolveDestinationTop, resolvePageScroller, scrollPageTo,
} from '../app/utils/page-scroll.ts'

/* 经典滚动条的槽位在文档绘制区之外，永远只有 canvas 色；桌面把滚动搬进 .page-scroll
   之后槽位才落在绘制区里（透明轨道下面就是氛围层）。下面钉住这套契约：
   谁在滚、读写走谁、锚点怎么找、以及 CSS 与 JS 用的是同一条媒体查询。 */

const calls = []
const wrapper = {
  scrollTop: 320, scrollHeight: 4200, clientHeight: 800,
  scrollTo(options) { this.scrollTop = options.top; calls.push(['wrapper', options]) },
}
const root = {
  scrollTop: 0, scrollHeight: 900, clientHeight: 900,
  scrollTo(options) { calls.push(['root', options]) },
}
const ids = { '收件人是下一个我': { id: '收件人是下一个我' }, encoded: { id: 'encoded' } }

let desktop = true
globalThis.sessionStorage = {
  store: new Map(),
  getItem(key) { return this.store.get(key) ?? null },
  setItem(key, value) { this.store.set(key, value) },
}
globalThis.window = {
  matchMedia: query => ({ matches: query === PAGE_SCROLL_QUERY ? desktop : false }),
  scrollTo(options) { calls.push(['window', options]) },
}
globalThis.document = {
  scrollingElement: root,
  documentElement: root,
  querySelector: selector => (selector === '.page-scroll' ? wrapper : null),
  getElementById: id => ids[id] ?? null,
}

/* 桌面：容器就是滚动容器；手机（媒体查询不匹配）：回到文档。 */
assert.equal(resolvePageScroller(), wrapper, 'Desktop scrolls the container')
desktop = false
assert.equal(resolvePageScroller(), document.scrollingElement, 'Touch pointers keep native document scrolling')
desktop = true

assert.equal(pageScrollTop(), 320)
assert.equal(pageMaxScroll(), 4200 - 800)

scrollPageTo(640)
assert.deepEqual(calls.at(-1), ['wrapper', { top: 640, behavior: 'auto' }], 'Container scrolling stays off window')
scrollPageTo(12, 'smooth')
assert.deepEqual(calls.at(-1), ['wrapper', { top: 12, behavior: 'smooth' }])

desktop = false
scrollPageTo(48)
assert.deepEqual(calls.at(-1), ['window', { top: 48, behavior: 'auto' }], 'Document scrolling goes through window')
desktop = true

/* 阅读位置：自己记的优先于 vue-router 给的历史位置。 */
wrapper.scrollTop = 320
rememberScrollPosition('/posts/a')
assert.equal(resolveDestinationTop('/posts/a', 999), 320, 'Remembered position wins')
assert.equal(resolveDestinationTop('/posts/b', 999), 999, 'Falls back to the router position')
assert.equal(resolveDestinationTop('/posts/b'), 0, 'Falls back to the top')

/* 锚点：HTML 里的 id 是未编码的，route.hash 是百分号编码的，两种都要命中。 */
assert.equal(findHashTarget('#收件人是下一个我'), ids['收件人是下一个我'])
assert.equal(findHashTarget('#%E6%94%B6%E4%BB%B6%E4%BA%BA%E6%98%AF%E4%B8%8B%E4%B8%80%E4%B8%AA%E6%88%91'), ids['收件人是下一个我'])
assert.equal(findHashTarget('encoded'), ids.encoded)
assert.equal(findHashTarget('#%xx'), null, 'Broken escapes must not throw')
assert.equal(findHashTarget('#nope'), null)

/* 源码契约：CSS 与 JS 用同一条媒体查询，容器透明，文档本身不滚。 */
const css = readFileSync('app/assets/css/main.css', 'utf8')
assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\.page-scroll \{[\s\S]*?overflow-y: scroll/)
assert.match(css, /\.page-scroll \{[\s\S]*?height: 100dvh/)
assert.match(css, /html \{ overflow-y: hidden; \}/, 'No root scrollbar means no canvas-only gutter')
assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/, 'The scroller media query must exist in CSS')
const media = css.match(/@media \(hover: hover\) and \(pointer: fine\)/)
assert(media && PAGE_SCROLL_QUERY === '(hover: hover) and (pointer: fine)', 'JS query equals the CSS query')
assert.match(css, /\.page-scroll \{[\s\S]*?background: transparent/, 'Track must reveal the ambient layer')

const app = readFileSync('app/app.vue', 'utf8')
const error = readFileSync('app/error.vue', 'utf8')
assert.match(app, /<div ref="pageScroll" class="page-scroll">/)
assert.match(error, /<div ref="pageScroll" class="page-scroll">/, 'The error page scrolls in the same container')
assert.doesNotMatch(app, /window\.scrollY/, 'Header state must use the page scroller helper')
assert.doesNotMatch(readFileSync('app/components/ArticleToc.vue', 'utf8'), /window\.scrollY/, 'TOC must use the page scroller helper')
assert.doesNotMatch(app, /window\.addEventListener\('scroll'/, 'Scroll events do not bubble out of the container')

const router = readFileSync('app/router.options.ts', 'utf8')
assert.match(router, /scrollBehavior\(to, from, savedPosition\)/)
assert.match(router, /resolveDestinationTop\(to\.fullPath, savedPosition\?\.top\)/, 'The router scrolls the container itself')
assert.match(router, /resolve\(false\)/, 'vue-router must not touch window afterwards')

/* 滑条显隐（2026-09-25 追加）：容器上的状态属性由 usePageScrollable 写，
   CSS 只把拇指的 alpha 转到 0 —— 元素、轨道、槽位全程留着，所以布局不位移。
   宽度故意钉在 10px：它就是原先原生细滚动条的宽度。 */
assert.equal(PAGE_SCROLLABLE_ATTRIBUTE, 'data-scrollable')
assert.equal(PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, 'data-scrollable-settled')
assert.equal(pageNeedsScroll({ scrollHeight: 901, clientHeight: 900 }), false, 'A single pixel may still be rounding')
assert.equal(pageNeedsScroll({ scrollHeight: 902, clientHeight: 900 }), true)
assert.equal(pageNeedsScroll({ scrollHeight: 900.4, clientHeight: 900 }), false, 'Sub-pixel rounding must not flash the bar')
/* 自绘拇指（2026-09-25 追加）：原生拇指在容器不再可滚的那一瞬间就被浏览器撤掉，
   实测内容变短后第一帧像素已回到底色，而状态还没变——淡出永远画不出来，所以外观
   改由 .page-scrollbar__thumb 承担，原生拇指只保留行为（拖动/翻页/滚轮）。
   Chrome/Edge 走这条；Firefox 没有 ::-webkit-* 伪元素，@supports 不匹配即回落原生。 */
assert.match(css, /\.page-scrollbar \{ display: none; \}/, 'The drawn bar starts hidden')
assert.match(css, /\.page-scroll::-webkit-scrollbar-thumb \{ background: transparent; \}/, 'The native thumb keeps its behaviour but loses its paint')
assert.match(css, /\.page-scrollbar__thumb \{[\s\S]*?height: var\(--page-scrollbar-thumb-size, 0px\);[\s\S]*?transform: translateY\(var\(--page-scrollbar-thumb-offset, 0px\)\);[\s\S]*?transition: opacity 500ms var\(--ease-fluid\);/, 'Geometry comes from the composable, the fade-in from opacity')
assert.match(css, /\.page-scrollbar \{[\s\S]*?pointer-events: none;/, 'Native drag, track paging and the wheel stay in charge')
/* 淡出先等 300ms（Android 的 SCROLL_BAR_DEFAULT_DELAY），时长当前 500ms（临时值）；
   延迟存在的意义是别让淡出和造成它的内容重排挤在同一帧。 */
assert.match(css, /\.page-scroll\[data-scrollable='false'\] \.page-scrollbar__thumb \{[\s\S]*?opacity: 0;[\s\S]*?transition-duration: 500ms;[\s\S]*?transition-timing-function: var\(--ease-exit\);[\s\S]*?transition-delay: var\(--page-scrollbar-delay, 300ms\);/, 'Hiding waits, then fades on the exit curve')
assert.match(css, /\.page-scroll\[data-scrollable-settled='false'\] \{ --page-scrollbar-delay: 0ms; \}/, 'The very first measurement must not wait')
assert.match(css, /\.page-scrollbar__thumb,\s*\.page-scroll\[data-scrollable='false'\] \.page-scrollbar__thumb \{ transition: none; \}/, 'Reduced motion resets both fade directions')
assert.doesNotMatch(css, /--page-scrollbar-alpha/, 'The color-mix opacity hack is gone: the drawn bar owns its opacity')
assert.doesNotMatch(css, /\.page-scroll\[data-scrollable='true'\] \{[\s\S]*?transition:/, 'Coming back must not redeclare the transition: delay 0 comes from the base rule')
assert.match(css, /\.page-scroll::-webkit-scrollbar \{ width: 10px/, 'Same gutter as the native thin scrollbar')
assert.match(css, /@supports selector\(::-webkit-scrollbar\) \{\s*\.page-scroll \{\s*scrollbar-width: auto/, 'Chrome only honours ::-webkit-scrollbar once scrollbar-width is auto')
assert.doesNotMatch(css, /\.page-scroll::-webkit-scrollbar-button|\.page-scroll::-webkit-scrollbar-corner/, 'Arrow buttons and the corner are none of our business')
assert.match(css, /\.page-scroll::-webkit-scrollbar-track \{ background: transparent; \}/, 'The track keeps revealing the ambient layer')
assert.doesNotMatch(/(\.page-scroll::-webkit-scrollbar-thumb \{[^}]*\})/.exec(css)[1], /transition:/, 'Native scrollbar pseudo-elements never repaint transitions')
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.page-scrollbar__thumb,/, 'Reduced motion must switch off the drawn fade')
assert.match(css, /html\.no-transition \.page-scroll \{ transition: none !important; \}/, 'Theme switching must not fade the bar')

const composable = readFileSync('app/composables/usePageScrollable.ts', 'utf8')
assert.match(composable, /PAGE_SCROLLABLE_ATTRIBUTE/)
assert.match(composable, /new ResizeObserver\(measure\)/, 'Content height changes must be observed')
assert.match(composable, /childList: true/, 'Page swaps replace children, so re-subscribe them')
assert.match(composable, /PAGE_SCROLL_QUERY/, 'Touch devices fall back to native document scrolling')
assert.match(composable, /PAGE_SCROLLABLE_SETTLED_ATTRIBUTE\) !== 'false'/, 'Only the first measurement skips the fade delay')
assert.match(composable, /requestAnimationFrame\(\(\) => requestAnimationFrame\(/, 'One frame is still before the paint that starts the transition')
assert.equal(PAGE_SCROLLBAR_SIZE_PROPERTY, '--page-scrollbar-thumb-size')
assert.equal(PAGE_SCROLLBAR_OFFSET_PROPERTY, '--page-scrollbar-thumb-offset')
assert.match(composable, /MIN_THUMB_SIZE = 40/, 'The thumb must stay grabbable')
assert.match(composable, /PAGE_SCROLLBAR_SIZE_PROPERTY/, 'The composable owns the drawn thumb geometry')
assert.match(composable, /onPageScroll\(scheduleThumb\)/, 'The thumb follows the container scroll, not window')
assert.match(app, /<PageScrollbar \/>/)
assert.match(error, /<PageScrollbar \/>/, 'The error page needs the same drawn bar')
assert.match(app, /usePageScrollable\(pageScroll\)/)
assert.match(error, /usePageScrollable\(pageScroll\)/, 'The error page needs the same bar state')

/* 兜底路由：没有它，未知地址会让 Vue Router 打印匹配失败的告警。
   故意保持非 fatal、不带 statusMessage：fatal 会让每次未知地址都在终端打出
   [request error] [fatal]，statusMessage 会触发 h3 的弃用告警；空模板则是为了避免
   Vue 报 "missing template or render function"。 */
const catchAll = readFileSync('app/pages/[...slug].vue', 'utf8')
const catchAllError = (catchAll.match(/createError\(\{([\s\S]*?)\}\)/) || ['', ''])[1]
assert.match(catchAllError, /statusCode: 404/)
assert.doesNotMatch(catchAllError, /fatal/, 'Non-fatal keeps the dev terminal quiet')
assert.doesNotMatch(catchAllError, /statusMessage/, 'h3 deprecates statusMessage for long messages')
assert.match(catchAll, /<template>/, 'A template avoids the missing-render-function warning')

console.log('PASS: desktop container scrolling, document fallback, remembered positions, encoded anchors, drawn scrollbar state/geometry and CSS/JS coupling. No real browser pixel measurements.')
