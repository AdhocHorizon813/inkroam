# 动效与交互

## 缓动系统

项目不用 `ease` / `ease-in-out` 这类关键字，而是四条显式曲线：

```css
:root {
  --ease-fluid: cubic-bezier(.16, 1, .3, 1);    /* 主曲线：入场、位移、颜色 */
  --ease-settle: cubic-bezier(.2, .82, .22, 1); /* 落位：指示器、面板、缩放 */
  --ease-panel: cubic-bezier(.18, .9, .24, 1);  /* 面板专用 */
  --ease-exit: cubic-bezier(.4, 0, .85, .25);   /* 离场：比入场快，带加速 */
}
```

约定是「**入场慢而顺，离场快而脆**」：入场用 420–520ms 的 `fluid`/`settle`，离场压到 130–180ms 的 `exit`，避免关闭动作拖泥带水。

⚠️ 这四条曲线在文件里定义了两次（约 1370 行与约 2051 行）。后一次是校准层，`--ease-settle` 由 `cubic-bezier(.22,.8,.26,1)` 改成 `cubic-bezier(.2,.82,.22,1)`，并补上了 `--ease-panel`。**实际生效的是后一次**。

## 滚动条显隐（2026-09-25）

页面滑条**自绘**：`::-webkit-scrollbar-thumb` 既不吃 `transition`（不逐帧重绘，夹具判定见 [scrollbar.md](scrollbar.md)），也会在容器不再可滚的那一瞬间被浏览器撤掉（内容变短的第一帧像素就回到底色，而状态还没写）——原生拇指的淡出无解。所以拇指交给 `app/components/PageScrollbar.vue`（整块 `pointer-events: none`，拖动/轨道翻页/滚轮仍由涂成透明的原生拇指承担），过渡写在它自己的 `opacity` 上。**时长不跟正文的动效约定走，而是照原生滚动条自己的**：定稿 500ms，淡出还要先等 300ms（原生滑条不做淡入、只做「先等再很快消失」，Android 300/250、Chrome 750/100、Flutter 600/300；小元素上「更显眼」靠对比度不靠时长。出处与实测值见 [scrollbar.md](scrollbar.md) 的「参考规则」）。`prefers-reduced-motion` 下这条过渡整个关掉：那个场景要的是立刻到位。

## 浮层收起方向（2026-09-25）

下拉菜单与日历收起是「裁剪窗从**远边**压向触发框」：窗和窗里的内容都贴在**钉住的那条边**上，内容全程不动，只有窗的远边在扫。向下展开时窗贴盒顶（盒顶钉在触发框下沿）；向上展开时窗贴盒底（盒底钉在触发框上沿，由 `useSearchPopover` 写 `data-flip='up'`，配 `align-content: end` 与窗内 `justify-content: flex-end`）。**坑**：`grid-template-rows` 那一行比盒子缩得快（收起 190ms 实测行 71px／盒 136px，把 UA 的 `height: fit-content` 覆盖成 `auto` 也一样），所以不能指望「行高＝盒高」；向上展开时若不按边对齐，窗会留在盒顶、内容跟着盒顶整块下滑 234px，看起来像「内容掉向页面中间」而不是收回触发框。逐帧数字与探针见 [work-checkpoint.md](work-checkpoint.md)。

## 路由入场动画

页面动画仅监听 `route.path`，同页 hash 变化不触发入场。`app/router.options.ts` 通过 `scrollBehaviorType` 启用浏览器原生非线性平滑滚动，并**自己覆写 `scrollBehavior`**（桌面把页面滚动搬进了 `.page-scroll`，见 [visual-system.md](visual-system.md)）：锚点偏移仍交给标题的 `scroll-margin-top`，历史位置改由项目按 `fullPath` 记在 `sessionStorage`；减少动效偏好下使用即时滚动。目录开合复用 settle / exit 曲线，电脑与手机都可折叠。

页面切换没有用 Vue 的 `<Transition>`（`NuxtPage :transition="false"`），而是在 `app.vue` 里用 Web Animations 手动驱动：

```ts
const surfaces = frame.querySelectorAll('.hero, .latest-section, .manifesto, .standard-page, .article-page')
const targets = [...surfaces].flatMap(surface => [...surface.children])
targets.forEach(t => t.style.opacity = '0')
requestAnimationFrame(() => requestAnimationFrame(() => {
  routeAnimations = targets.map((t, i) => t.animate([
    { opacity: 0, transform: 'translate3d(0, 10px, 0)' },
    { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  ], { duration: 620, delay: Math.min(i * 18, 108), easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' }))
}))
```

要点：

- 对页面**顶层区块**逐个做 stagger，延迟 `index * 18ms` 且封顶 108ms，所以内容多的页面也不会等到天荒地老；
- 先同步把 `opacity` 置 0，再等两帧（双 `requestAnimationFrame`）才开始动画，避免首帧闪出未动画状态；
- 每次路由切换先 `cancel()` 掉上一批动画，快速连点不会叠加；
- `prefers-reduced-motion: reduce` 时整段跳过。

## 滚动感知的头部

`app.vue` 里的 `syncScrollState` 在 `scrollY > 8` 时给 `<html>` 加上 `data-scrolled="true"`：

```css
@media (min-width: 768px) {
  :root[data-visual='modern'][data-scrolled='true'] .site-header {
    margin-inline: calc(50% - 50vw + 18px);
    width: calc(100vw - 36px);
  }
}
```

只改 `margin-inline` 和 `width`，**不改高度和内边距**，所以展开过程不会引起内容跳动，浏览器只需做一次布局平移。过渡 440ms `--ease-fluid`。

窄屏（<768px）刻意不展开：视口本来就窄，拉满宽度既没有视觉收益，还可能因为取整误差产生横向滚动条。

### 锚点跳转与头部遮挡

头部是 `position: sticky`，而文章标题自带 `id`（由 `@nuxtjs/mdc` 生成），点击 `§` 标题里的 `<a href="#...">` 时浏览器会把标题对齐到视口顶部 `y = 0`，正好落在头部下面被盖住。

修法是给标题加 `scroll-margin-top`（`app/assets/css/main.css`，只作用于 modern 主题）：

```css
:root[data-visual='modern'] { --anchor-offset: 88px; }
:root[data-visual='modern'] .article-content h2,
:root[data-visual='modern'] .article-content h3,
:root[data-visual='modern'] .article-content h4 { scroll-margin-top: var(--anchor-offset); }
```

`88px` 的来历：modern 头部底边最高是 `top 14px + height 54px = 68px`（窄屏 `9px + 50px = 59px`，横屏 `7px + 48px = 55px`），再留约 20px 呼吸空间。

**改动头部的 `top` / `height` 时要同步核对 `--anchor-offset`**，它必须大于头部底边；反过来，不要为了省事把它调成 0——对照组已经证明那样标题会正好被盖住。

classic 主题的头部在正常流里、不吸顶，所以不加这个偏移，否则跳转后标题会凭空下移一段。

验证方式（headless Chrome + CDP）：点击第 3 个 `h2` 的锚点后断言 `target.getBoundingClientRect().top >= header.getBoundingClientRect().bottom`；再把该标题的 `scroll-margin-top` 临时置为 `0px` 复现原 bug 作为对照组。1280×800 与 390×844 两个视口均通过（修复后 87.8 / 88.3px，对照组 -0.2 / 0.3px）。

### 页内锚点的统一入口

正文标题的锚点是 Markdown 生成的普通 `<a href="#id">`，**不是 NuxtLink**，所以不走路由：`modern` 主题把 `scroll-behavior` 设为 `auto`，点下去是瞬跳；而用 NuxtLink 的文章目录却是平滑滚动——同一个页面里两种手感。

现在所有页内锚点都由 `app.vue` 的 `onDocumentClick` 统一处理：命中 `a[href^="#"]`（已被 NuxtLink 处理过的用 `event.defaultPrevented` 排除）后 `router.push({ hash })`，于是和目录走同一条 `scrollBehaviorType: 'smooth'`（见 `app/router.options.ts`）的路径。

⚠️ **必须用 `anchor.getAttribute('href')`，不要用 `anchor.hash`**：中文 id 在 HTML 属性里是未编码的（`#收件人是下一个我`），而 `anchor.hash` 返回**百分号编码**形式（`#%E6%94%B6...`）。把这个编码串再交给 `router.push` 会被**二次编码**（`%` → `%25`），`app/router.options.ts` 的 scrollBehavior 拿 `#%25E6...` 去查元素必然找不到——表现是「点了完全不动」，同时 URL 里留下一个坏 hash。（实现层两种写法都试一次：原始 id 优先，失败再试百分号解码后的 id。）

第二个细节：目标与当前 hash 相同时，路由会判为重复导航直接跳过，所以这里补一次 `scrollIntoView({ behavior: 'smooth' })`，否则「跳过去之后再点同一个标题」会毫无反应。

`§` 也一并移进了标题锚点（`.article-content h2 a::before`）。它以前是 `h2::before`——看起来像标题的一部分，其实在链接之外，点它不会跳转。移动之后整个标题（含 §）是同一个可点区域，也就都会带上标题链接自身的下划线。

## 导航指示器

`SlidingNav.vue` 用一个绝对定位的 `.nav-highlight` 表示当前项，位置由 JS 测量后写进 CSS 变量：

```ts
indicator.x = linkBox.left - navBox.left
indicator.width = linkBox.width
```

CSS 只负责过渡：

```css
.nav-highlight {
  width: var(--nav-indicator-width);
  transform: translate3d(var(--nav-indicator-x), -50%, 0);
  transition: width 380ms var(--ease-settle), transform 380ms var(--ease-settle);
  opacity: 0;
}
.nav-highlight.is-ready { opacity: 1; }
```

细节：

- 用 `ResizeObserver` 监听导航容器和每个链接，字体加载完成、窗口缩放、语言切换都能自动重算；
- 初始 `opacity: 0`，测量完成后加 `is-ready` 再淡入，避免首帧指示器从左上角「飞」到目标位置；
- classic 主题下 `.nav-highlight` 直接 `display: none`，因为纸媒风格用的是下划线而不是胶囊。

## 分段控件指示器

外观面板里的三段式控件也只有一个指示器，靠 `--segment-transform` 移动：

```ts
function segmentStyle(index: number) {
  return { '--segment-transform': `translate3d(calc(${index * 100}% + ${index * 5}px), 0, 0)` }
}
```

`+ index * 5px` 是补偿 `gap: 5px`；宽度用 `calc((100% - 18px) / 3)` 扣掉内边距和间隙。按钮本身的 `.active` 背景被清空（`background: transparent !important`），否则会出现「指示器 + 按钮高亮」双重高亮。

## 外观面板的展开

面板不是淡入，而是从右下角的触发器「长」出来：

- 触发器声明 `anchor-name: --appearance-trigger`，面板用 `position-anchor` 定位；
- 入场用 `clip-path: inset(...round 22px)` 从触发器尺寸展开到全尺寸，520ms `--ease-settle`；
- 在不支持 CSS anchor positioning 的浏览器里，`@supports` 块不生效，退回 `right/bottom` 的固定定位。

## View Transitions 主题切换

切换视觉/材质这类「大面积变化」时，`AppearancePanel` 会调用 `document.startViewTransition()`：

1. 切换前给 `<html>` 加 `.no-transition`（`transition: none !important`），确保快照捕获的是旧态的**终态**，不会把逐帧颜色过渡也拍进去；
2. 在回调里 `applyAppearance()`，让浏览器一次性渲染新主题；
3. 转场结束后再等两帧，才移除 `.no-transition`——否则新主题会被误判为一次样式变化，触发全页逐帧过渡；
4. 用递增的 `vtSeq` 序列号防止快速连点时，上一次的收尾逻辑干扰这一次。

`prefers-reduced-motion: reduce` 或浏览器不支持时，直接同步 `applyAppearance()`，不做转场。

## 悬停细节

`story-row`（首页文章行）的悬停不是整行位移，而是内容与箭头分开动：

```css
@media (hover: hover) and (pointer: fine) {
  .story-row:hover .story-body { transform: translate3d(7px, 0, 0); }
  .story-row:hover .story-arrow { color: var(--modern-ink); transform: translate3d(3px, -3px, 0); }
}
```

正文平移 7px、箭头朝右上 3px，配合 520ms `--ease-settle` 形成轻微的「让路」感。只在精确指针设备启用，触屏点按不会残留位移状态。

## 减少动效

全局兜底规则：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

注意它压的是 `duration` 而不是删掉动画，所以 `transitionend` / `animationend` 事件仍然会触发，不会破坏依赖事件回调的逻辑。

## 维护注意

1. 新动效优先复用 `--ease-*` 变量，不要临时写 `ease`；
2. 入场动画记得配一个更快的离场时长；
3. 涉及测量的动画（指示器、面板）要给初始状态留 `opacity: 0` + `is-ready` 的过渡，避免首帧跳位；
4. 任何新的滚动/尺寸监听都加 `{ passive: true }`，并在 `onBeforeUnmount` 里移除。
