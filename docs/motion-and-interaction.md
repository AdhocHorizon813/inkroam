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

## 路由入场动画

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
