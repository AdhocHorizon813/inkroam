# 滚动条：槽位、宽度与显隐（2026-09-25）

站内有四种滚动条，规则、宽度和显隐都不一样。改其中任何一个之前，先读完这篇。

| 位置 | 谁在画 | 宽度 | 颜色 | 显隐 |
| --- | --- | --- | --- | --- |
| 页面（桌面） | **自绘**（`PageScrollbar.vue` + `main.css`；原生拇指涂透明，只留拖动/翻页/滚轮） | **10px** | `--scrollbar-thumb` | 内容不够长时淡出（`data-scrollable="false"`） |
| 页面（手机） | 系统覆盖式滚动条 | 不占位 | 系统 | 系统自动隐藏，我们不管 |
| 文章目录 | 浏览器，`ArticleToc.vue` 里那个 `overflow-y: auto` 的 `<ol>`，走全局 7px 规则 | 7px | `--scrollbar-thumb` | 原生行为 |
| 浮层内部（外观面板、下拉、日历） | 浏览器，全局 `*::-webkit-scrollbar` | 7px | `--scrollbar-thumb` | 原生行为 |

正文内部的滚动（目录槽、浮层列表）本来就在页面绘制区里，没有问题。下面这套规则只为解决**页面滚动条槽位**那个特例。

## 为什么要给页面滚动条单独一套规则

经典（非覆盖式）滚动条的槽位落在**文档绘制区之外**：`position: fixed` 的 `.ambient-backdrop`、自绘的 `::-webkit-scrollbar` 轨道都盖不上去，那里显示的永远是 canvas —— 也就是 `body` 的背景色。紧挨一张底图时，右边缘就是一条白边：实测同一行相邻像素差 **94/255**（底图 `75,95,142` → 槽位 `236,238,241`）。

试过两条**无效**的路，别再走：

- 给 fixed 背景层加 `width: 100vw`：仍被裁在绘制区里，槽位像素一字不变；
- 把根滚动条改成自绘透明轨道：轨道透明了，透出来的还是 canvas。

有效的是**把滚动搬进绘制区**：

```css
@media (hover: hover) and (pointer: fine) {
  html { overflow-y: hidden; }   /* 没有根滚动条 → ICB 变成整个窗口 */
  .page-scroll { height: 100dvh; overflow-y: scroll; overflow-x: clip; background: transparent; }
}
```

`.page-scroll` 在 `app.vue` 与 `error.vue` 里包住 `.site-shell`；`.ambient-backdrop` 与外观面板留在容器**外面**。槽位因此落进页面能画到的区域，透明的轨道下面就是氛围层。同一位置实测相邻像素差降到 **1–3/255**，边界上不再有台阶。

配套约定：

- **宽度不变**：容器滚动条 10px，等于原先的原生细滚动条；扣掉槽位后正文可用宽度与搬家前一致，不产生横向位移。
- 手机（指针粗、无 hover）是覆盖式滚动条，保持原生文档滚动；`app/utils/page-scroll.ts` 的 `PAGE_SCROLL_QUERY` 必须与上面那条媒体查询**逐字一致**。
- 滚动位置一律经 `app/utils/page-scroll.ts` 读写；`window.scrollY` 只对文档滚动有效。
- `app/router.options.ts` 自己实现 `scrollBehavior`（vue-router 只会滚 `window`）。细节见 [visual-system.md](visual-system.md) 的「滚动容器」一节。

## 显隐：拇指自己画，只改透明度

需求原话是「页面无需滑动时不显示滑条，需要时淡入、不用了淡出，且只改透明度，不增删元素」——因为增删元素会让 `overflow-y: scroll` 预留的槽位跟着出现／消失，整页横移。

**为什么最后落到自绘**：一开始想在原生拇指上做透明度（`@property --page-scrollbar-alpha` + `color-mix`），淡出确实动起来了——但那只有在**内容仍然很长**、只是手写状态属性时才看得到。真实路径上「内容变短」正是容器不再可滚的那一瞬间，浏览器会立刻停止绘制原生拇指：夹具 `tmp/fade-cut-fixture.html`（`tmp/probe-cut.mjs`）实测，内容变短后**第一帧**拇指像素就回到底色 `16,20,24`，而此刻状态属性还没写、alpha 还是 `1`。**原生拇指的淡出是无解的，只能自己画一条。**

现在的分工：

```css
.page-scrollbar { display: none; }                     /* 只在支持 ::-webkit-scrollbar 的桌面环境里显示 */
@supports selector(::-webkit-scrollbar) {
  .page-scrollbar { position: fixed; inset: 0 0 0 auto; width: 10px; z-index: 40; display: block; pointer-events: none; }
  .page-scrollbar__thumb {
    height: var(--page-scrollbar-thumb-size, 0px);      /* 几何由 usePageScrollable 写 */
    transform: translateY(var(--page-scrollbar-thumb-offset, 0px));
    background-color: var(--scrollbar-thumb);
    opacity: 1; transition: opacity 500ms var(--ease-fluid);
  }
  .page-scroll[data-scrollable='false'] .page-scrollbar__thumb {
    opacity: 0;
    transition-duration: 500ms;
    transition-timing-function: var(--ease-exit);
    transition-delay: var(--page-scrollbar-delay, 300ms);   /* 先等一会儿，再很快消失 */
  }
  .page-scroll[data-scrollable-settled='false'] { --page-scrollbar-delay: 0ms; }   /* 首帧不等 */
}
.page-scroll::-webkit-scrollbar-thumb { background: transparent; }   /* 原生拇指只留行为 */
```

- **谁画**：`app/components/PageScrollbar.vue`（`app.vue` 与 `error.vue` 各放一个）。整块 `pointer-events: none`：拖动、轨道翻页、滚轮仍由那条**透明的原生拇指**承担，自绘的只负责外观，不重复实现一遍原生行为。
- **谁写状态与几何**：`app/composables/usePageScrollable.ts`。盯子元素尺寸（`ResizeObserver`）、子元素增删（`MutationObserver`，页面切换会换掉子元素）、窗口尺寸与滚动（经 `onPageScroll`，一帧最多算一次），写 `data-scrollable` 与 `--page-scrollbar-thumb-size/-offset` 两个变量。
- **判据**：`pageNeedsScroll()`（`app/utils/page-scroll.ts`）＝ `scrollHeight - clientHeight > 1`。留 1px 容差，子像素舍入不该让滑条闪一下。
- **几何**：拇指高 = `min(轨道高, max(40px, 轨道高² / scrollHeight))`（`MIN_THUMB_SIZE = 40`，再短就抓不住），位移按 `scrollTop / (scrollHeight - clientHeight)` 等比。不能滚时给满高——反正它已经淡到 0，但下一次「变长再淡回来」时尺寸得是对的。
- **手机**：覆盖式滚动条不占位，容器本身也不滚，直接摘掉属性，自绘那条 `display: none`（`@supports` 不匹配同理，见「平台差异」）。
- **首帧是唯一例外**：`data-scrollable-settled='false'` 把延迟关掉，短页面不该先画出一条滑条再等 300ms 收起来；两帧后（这次绘制已经过去）翻成 `'true'`，之后每次变更才带延迟。属性仍由 JS 在挂载后写，所以短页面可能先画出滑条再淡出。改 `overflow: auto` 能避免这一帧，但会带来真正的布局位移，不换。
- `prefers-reduced-motion` 下自绘那条的过渡整个关掉（两个方向都要写，见 `main.css`）：这个场景要的是立刻到位。

实测（headless Chrome，1500×900，深色主题；`tmp/probe-bar.mjs`，打在本机 dev server 上）：

| 状态 | 实测 |
| --- | --- |
| 长文章，能滚 | 条子 `display:block / pointer-events:none`、拇指 `opacity=1`、高 372px、槽位仍 **10px**、像素 `66,74,91` |
| 内容**真的变短** | `7ms` 仍是 `66,74,91` → `430ms` `α=0.976 / px=64,72,90`（**中间态，看得见**）→ `889ms` `α=0 / px=22,32,53` |
| 内容再变长 | `α = 0 → 0.987 → 1`，像素 `41,50,69 → 66,74,91` |
| 滚动 600px | 位移变量 `translateY(248px)`，拇指跟得上 |
| 对照：原生拇指（`tmp/probe-cut.mjs`） | 内容变短的**第一帧**像素就回到底色 `16,20,24`，而 alpha 仍是 `1`——淡出无解，这正是自绘的理由 |

淡出的手感：`300ms` 延迟 + `500ms` 的 `exit` 曲线（加速型，起步慢），所以前 0.3 秒像素纹丝不动，之后才明显掉下来——这是原生滑条自己的节奏，不是卡顿。

## 参考规则：原生滚动条怎么淡出（2026-09-25 补）

「滑条太小、淡入淡出看不出来」不是错觉，也不是把时长拉长就能解决的。原生实现的规则是：**滑条不做淡入，只在停下来之后先等一会儿、再很快地淡出**；而「显眼」这件事由**粗细和对比度**负责，不是由时长负责。

| 实现 | 淡出前延迟 | 淡出时长 | 出现方式 | 粗细 / 对比 |
| --- | --- | --- | --- | --- |
| Chromium 覆盖式（Windows 11 Fluent；`ui/native_theme/overlay_scrollbar_constants.cc`） | **750ms** | **100ms** | 无过渡，出现即实体 | 激活 10px；空闲 = **0.4 倍**厚度（`kOverlayScrollbarIdleThicknessScale`）；1px 描边 |
| Chromium 覆盖式（旧版，同一文件） | 500ms | 200ms | 同上 | 同上 |
| Firefox（`layout/generic/ScrollbarActivity.cpp`） | `LookAndFeel::ScrollbarFadeBeginDelay` 的一次性定时器 | `active` 属性 + 主题 CSS 过渡 | 另有 `ScrollbarDisplayOnMouseMove`：鼠标一动就显示 | — |
| Android（`ViewConfiguration`） | `SCROLL_BAR_DEFAULT_DELAY = 300ms` | `SCROLL_BAR_FADE_DURATION = 250ms` | — | `SCROLL_BAR_SIZE = 4dp` |
| Flutter `Scrollbar`（`scrollbar.dart`） | `_kScrollbarTimeToFade = 600ms` | `_kScrollbarFadeDuration = 300ms` | 与淡出同长 | 厚度 6.0；最小拇指 18.0；最小可交互 48.0 |
| WinUI `ScrollViewer`（微软文档） | — | — | 触摸滚动只显示细的 panning indicator，鼠标/笔移到它上面才「变形」成传统滚动条 | 覆盖 16px，建议靠边留 16px |
| Material「Duration & easing」 | — | 入场 225ms / 离场 195ms；移动端 300ms；**桌面 150–200ms**；超过 400ms「too slow」 | — | — |
| NN/g 响应时极限 | ≤100ms 会被感知为「即时」，也就是根本不成其为动画 | — | — | — |
| NN/g 变化盲视 | 紧跟在视觉中断（重排、闪屏）之后的变化最容易被漏掉——中断只要 67ms 就够，而眨眼是 300–400ms | — | — | 对策是**对比度、尺寸、留白**（「眯眼测试」）＋用动画代替瞬时变化 |
| WCAG 2.2 SC 1.4.11 非文本对比 | — | — | — | UI 组件及其状态的可见信息需 ≥3:1；并明确警告**细线和细小形状实际渲染会比标称更淡**，最好别用太细的线，或把颜色调到阈值以上 |

由此定下三条：

1. **淡出 = 先等，再很快消失。** 等的那一下把「滑条消失」和造成它的内容重排分成两件事；挤在同一帧里就会被变化盲视吃掉。我们取 300ms 延迟（Android，各家最保守）。**这条只有在拇指是自己画的前提下才有意义**——原生拇指在容器不再可滚的那一瞬间就被撤掉，等多久都白等。
2. **时长定稿 500ms**（比 Material 的桌面区间 150–200ms 长，也超了它那条 400ms「too slow」——这是刻意取值，不是没查到规则）。原生滑条连淡入都没有——它是被交互「叫出来」的；我们这里是内容高度变化自动触发，所以留一个淡入。
3. **要更显眼，动对比度，别动时间。** 3:1 是条明确的门槛：本页滑条在深色主题下是 `rgba(255,255,255,.22)`，压在那张底图上实测相邻像素 1.8:1（拇指 `66,74,91` vs 轨道 `23,32,53`），离 3:1 还差一截；要够 3:1 大约得把 alpha 提到 **0.35**。宽度同理——原生是用「被关注时变粗」表达状态的（Chrome 空闲 0.4 倍 → 激活 1.0 倍，Windows 细条 → 16px），我们槽位恒定 10px 是刻意取舍（换零位移）。**这些数值要改，先改 alpha，不要改时长。**

## 两个必须记住的坑

**一、原生滚动条不吃 transition。** `::-webkit-scrollbar-thumb { transition: background-color … }` 在 Chrome 里**不会逐帧重绘**：颜色直接跳变。这不是优先级问题，也不是写法问题——把同样的 CSS 放进一张独立页面（夹具 `tmp/fade-fixture.html`，初始样式表，必定生效）里逐毫秒采样，红色到透明依旧是 1ms 内跳变。

**二、滑块消失得比状态还早。** 把透明度挪到宿主元素上（注册 `@property --page-scrollbar-alpha`，伪元素用 `color-mix` 读）确实让原生拇指的透明度能动起来，夹具里量到的序列是 `α=1 → 0.80 → 0.60 → 0.40 → 0.20 → 0`。但那只在**内容仍然很长**、只是手写状态时成立：真实路径上「内容变短」就是容器不再可滚的那一瞬，浏览器立刻停止绘制原生拇指（`tmp/probe-cut.mjs`：内容变短后第一帧像素已回到底色，alpha 还是 1）。所以**淡出必须由自绘的拇指承担**——也就是现在 `.page-scrollbar__thumb` 上那条 `opacity` 过渡；`@property` + `color-mix` 那套已经拆掉。

顺带一条同源的经验：**运行时 `document.head.append(style)` 注入的滚动条伪元素规则也不会生效**，所以验收时必须让规则出现在初始样式表里（改源码 / HMR / 独立夹具），不能靠页面里临时插样式来测。

## 平台差异

- **Chrome / Edge**：只写了 `scrollbar-width` 或 `scrollbar-color`，`::-webkit-scrollbar` 全套规则会被忽略。所以容器上用 `@supports selector(::-webkit-scrollbar)` 把这两个属性让回 `auto`，让自绘规则生效；宽度写死 10px 与原生细滚动条一致，正文宽度不变。原生拇指在这里被涂成全透明（`background: transparent`），**但保留全部原生行为**：拖动、轨道翻页、滚轮都还在，自绘那条只画外观。
- **内层滚动面**（外观面板、下拉、目录列表等）**刻意不动**：它们吃 `* { scrollbar-width: thin }`（约 1822 行），Chrome 因此忽略 `*::-webkit-scrollbar`，走的是**系统细滚动条**——在经典外观的系统上就是带上下三角按钮的那一条。2026-09-25 用户确认喜欢这个外观，**不要**把它改成自绘。副作用两条：那些地方没有 hover 变色（`--scrollbar-thumb-hover` 对系统条无效），所以内层与外层的滑条长得不一样是预期结果，不是漏样式。
- **Firefox**：没有 `::-webkit-*` 伪元素，`@supports` 不匹配 → 自绘那条 `display: none`，保留全局的原生细样式（`scrollbar-width: thin` + 主题色）。代价是滑条没有淡入淡出——那边的原生拇指在我们这套机制下也撤得一样快，但至少不会出现两条。
- **手机 / 触屏**：覆盖式滚动条浮在内容上，不需要也不该搬动文档滚动；自绘那条也是 `display: none`。

## 契约与验收

- `PAGE_SCROLL_QUERY`（`app/utils/page-scroll.ts`）＝ `main.css` 里那条媒体查询，逐字一致。
- `PAGE_SCROLLABLE_ATTRIBUTE` ＝ `'data-scrollable'`、`PAGE_SCROLLABLE_SETTLED_ATTRIBUTE` ＝ `'data-scrollable-settled'`、`PAGE_SCROLLBAR_SIZE_PROPERTY` / `PAGE_SCROLLBAR_OFFSET_PROPERTY` ＝ 两个几何变量：CSS、composable 与检查脚本共用同一批常量名。
- 槽位宽度、按钮／角落的清理、自绘拇指的 CSS 契约（原生拇指透明、几何变量、`pointer-events: none`、两个方向的时长与延迟、首帧例外、减动效）：都由 `scripts/check-page-scroll.mjs` 钉住（源码级，不做像素断言）。
- 像素级验收靠探针：`tmp/probe-bar.mjs`（自绘拇指状态、几何与真实淡出）、`tmp/probe-cut.mjs` + `tmp/fade-cut-fixture.html`（原生拇指为什么淡不出来）、`tmp/fade-fixture.html`（伪元素过渡机制判定）、`tmp/probe-adv-date.mjs`（浮层定位）。方法都是「dev server + CDP + 截图回灌 canvas 取像素」。

