# 界面组分：从顶栏到页脚

这篇文档按**界面组分**逐个讲：它由什么组成、为什么长这样、动效怎么走、哪些地方不能随便改。数值细节在 [visual-system.md](visual-system.md) 和 [motion-and-interaction.md](motion-and-interaction.md)，判断标准在 [aesthetic-principles.md](aesthetic-principles.md)；这里关注的是**它们怎么拼在一起**。

## 站点骨架

目录高亮由 `toc-active.ts` 根据标题位置与实际滚动范围计算。锚点目标受页底限制时，匹配其被截到滚动上限的真实落点，不再要求标题必须越过顶部判定线；无匹配锚点时滚到页底选中最后章节。离开锚点落点后恢复位置跟随，不让旧 hash 锁定目录。`ArticleToc` 监听 hash、滚动、窗口大小与正文尺寸变化。回归命令：`node --experimental-strip-types scripts/check-toc-active.mjs`。

课程目录布局调研与实现（2026-09-19，已获用户同意实施）：对于目前只有中英文名称与篇数的五门课程，现采用单列紧凑导航列表，中文/英文在左、篇数与箭头在右，用分隔线组织而不是放大现有卡片。移动端英文允许自然换行。依据：[Carbon structured list](https://carbondesignsystem.com/components/structured-list/usage/) 对同类内容扫读的指导、[MUI lists](https://mui.com/material-ui/react-list/) 的连续纵向索引模式；卡片并未过时，但这里不需要其复杂信息承载能力。此为适配本页面的设计判断，不是流行度统计。

学习笔记入口位于主导航“归档”左侧，课程与正文子路径均保持“笔记”选中。移动端不再按链接序号隐藏入口，窄屏允许顶栏换行。课程目录始终为单列紧凑导航列表，行高至少 84px，左右分别显示课程名称和篇数/箭头；窄屏缩小间距并允许英文自然换行；`TimelineArchive` 共用于归档与笔记页面，`RecentEntries` 共用于首页最近文章与最近笔记，正文统一使用 `ArticleReader`。最近文章与最近笔记分别由外观面板的两组数量设置控制，互不影响。

搜索摘要的行内公式由 `SearchExcerpt.vue` 渲染。公式容器保留横向滚动，但局部隐藏原生滚动条及其箭头，避免短公式因细微溢出在下方出现可点击的三角形；不要因此修改全站滚动条。

`app/app.vue` 是所有页面的外壳：

```
.ambient-backdrop          固定背景层（z-index: -2，aria-hidden）
  .ambient-source
    .ambient-image         图片背景
    .ambient-aurora        极光渐变
  .ambient-vignette        暗角
.site-shell                内容容器（居中、限宽）
  .site-header             顶栏（sticky）
  .route-frame             页面容器，也是路由入场动画的作用范围
  .site-footer             页脚
.appearance-dock           右下角外观入口（fixed）
```

三条约定贯穿整个骨架：

1. **背景层永远在最后面**，且 `aria-hidden="true"`——它是氛围，不是内容；
2. **`.route-frame` 只做动画容器**，`NuxtPage` 的 `:transition` 被显式关掉，入场动画由 `app.vue` 手动驱动；
3. **外观面板挂在 `.site-shell` 之外**，因为它是全局浮层，不该被内容布局影响。

## 页面切换

页面之间的过渡**不是** Vue 的 `<Transition>`，而是 `app.vue` 里手写的 Web Animations。`nuxt.config.ts` 里没有 `pageTransition`，各页面也没有 `definePageMeta`——`NuxtPage` 被显式传了 `:transition="false"`。

原因：`<Transition>` 的常见写法会同时跑「旧页面离场 + 新页面入场」两套动画，两条时间线一旦对不齐就会闪。而这里只需要一个方向——**新内容进场**。

### 一次切换发生了什么

```
watch(route.path)
  → 跳过首次加载（没有 previousPath 就直接 return）
  → nextTick()                    等新页面挂载
  → cancel() 上一批动画            快速连点不会叠加
  → 在 .route-frame 内找表面元素
      .hero / .latest-section / .manifesto / .standard-page / .article-page
  → 取这些元素的直接子元素作为动画目标
  → 同步把 opacity 置 0
  → 等两帧（双 requestAnimationFrame）
  → 逐个 animate：opacity 0 → 1，translateY 10px → 0
      duration 620ms
      delay    min(index * 18, 108) ms
      easing   cubic-bezier(.16, 1, .3, 1)   ← 就是 --ease-fluid
```

### 几个刻意的选择

- **只做入场，不做离场**：旧页面在切换瞬间就被替换。给「已经不需要的内容」做离场动画，等于让用户等它消失，和「离场快而脆」的原则相反；
- **滚动位置沿用 Nuxt 默认**：项目没有自定义 `scrollBehavior`——路径变化回到顶部、带 `#hash` 时定位到锚点、浏览器前进 / 后退则恢复之前的位置。所以「翻页」的手感是：内容先重置到顶部，再逐个浮上来；
- **只监听 `route.path`**：页内 hash 跳转（点标题、点目录）不会重放整页入场动画，只做页内平滑滚动；
- **逐个 stagger，但封顶**：延迟 `index * 18ms` 最多累加到 108ms。内容多的页面不会等到天荒地老，又保留了「一层层浮上来」的层次感；
- **位移只有 10px**：动的是重心，不是距离；620ms 的 `--ease-fluid` 负责「顺」；
- **先置 0 再等两帧**：直接 `animate()` 的话，首帧可能先渲染出未动画状态、闪一下。同步把 `opacity` 置 0，等两帧后启动，随后立刻移除内联 `opacity`，交给 WAAPI 的 `fill: 'both'` 接管；
- **`onfinish` 里 `cancel()`**：动画结束后清掉 WAAPI 状态，避免残留的 `fill` 影响后续样式；
- **`prefers-reduced-motion` 时整段跳过**：不是把时长压到 0，而是根本不启动。

### 和主题切换的区别

| | 页面切换 | 主题切换 |
| --- | --- | --- |
| 触发 | 路由变化 | 面板里的视觉 / 材质 / 强调色 / 背景 |
| 机制 | Web Animations 手动驱动 | `document.startViewTransition()` 快照 |
| 动画对象 | 新页面的区块 | 整页交叉淡入 |
| 为什么不同 | 只需要「进」，不需要「出」 | 需要同时看到旧态和新态 |

`.route-frame` 是这套动画的**稳定锚点**：它在路由切换时不重建，所以可以安全地在它内部查找元素。`<header>` 和 `<footer>` 在它之外，视觉上始终连续——导航不会跟着页面一起闪。

实现细节见 [motion-and-interaction.md](motion-and-interaction.md#路由入场动画)。

## 顶栏

### 结构

`.site-header` 是「品牌 + 导航」两段式：

- `.brand`：`.brand-mark`（圆角方块里的「纸」字）+ 文字「纸上漫游」，整块是回首页的链接，带 `aria-label`；
- `SlidingNav`：`<nav aria-label="主导航">`，内含一个绝对定位的 `.nav-highlight`、五个链接（文章 / 笔记 / 归档 / 关于 / 搜索）和 `ThemeToggle`。

### 审美

顶栏是一枚**悬浮胶囊**：sticky 定位、圆角 14px、高度 54px（modern 校准后的值），距顶部留 14px，材质由 `data-nav-material` 决定。它不和页面内容贴边，所以看起来像「浮在纸上的一层玻璃」，而不是一条压住内容的横条。

classic 主题下它退回正常文档流、不吸顶——纸媒风格不需要「悬浮」这个隐喻。

### 窄屏

手机（`≤540px`）顶栏保留桌面的**两端布局**：品牌贴左、导航贴右，也就是基础的 `justify-content: space-between`；断点里只把高度放开成 `height: auto; min-height: 60px`，并补上 `padding-block: 12px`。

**不要把「品牌 + 导航」当成一组居中。** 曾经的 `justify-content: center` 会在 393px 视口下把整组内容居中于胶囊：两端各留一条空白带，而导航的中线（216.5px）比胶囊中线（196.5px）右偏 20px——没有任何两件东西互相对齐，看上去就是「错位」。

`flex-wrap: wrap` 只作兜底：modern 的胶囊自带 `overflow: hidden`，与其让链接被裁掉，不如让它们换行。

要让一行放得下，品牌需要让位，两条规则：

| 场景 | 规则 |
| --- | --- |
| modern（`≤768px`） | 隐藏文字「纸上漫游」，只留 `.brand-mark` |
| classic（`≤400px`） | 同样隐藏文字：「纸上漫游」(110px) + 间距 + 五个链接 (207px) 约需 329px，而该断点下站点宽度只有 `100% - 28px`，实测 357px 以下就放不下，400px 是留出的余量 |

两种情况下 `.brand` 都保留 `aria-label="纸上漫游首页"`，品牌语义不丢。

验证方式：在手机宽度下量 `.site-header` 与 `.brand` / `.main-nav` 的 `getBoundingClientRect()`，左右内缩应当接近且对称（393px 下为 12px / 14px，与桌面一致），同时确认 `document.scrollingElement.scrollWidth === window.innerWidth`（不产生横向滚动），且没有链接越出胶囊边界。320 / 360 / 393 / 412 / 480 / 540px 六档、modern 与 classic 两个主题目前都通过。

### 动效

页面滚动超过 8px 时，`app.vue` 给 `<html>` 打上 `data-scrolled="true"`，顶栏展开成一条**全宽 rail**：

- 只改 `margin-inline` 和 `width`，**不改高度和内边距**——这是关键，否则展开时内容会跳动；
- 过渡 440ms `--ease-fluid`，收尾很慢，像「摊开」而不是「弹出」；
- 窄屏（<768px）刻意不展开，避免取整误差产生横向滚动条。

### 不能随便改的地方

顶栏的 `top` 和 `height` 决定了它盖住视口顶部的范围，而文章标题的锚点跳转要靠 `--anchor-offset: 88px` 避开它。**改这两个值必须同步核对 `--anchor-offset`**，细节见 [motion-and-interaction.md](motion-and-interaction.md#锚点跳转与头部遮挡)。

## 导航指示器

`.nav-highlight` 是「先测量、再出现」的最佳例子：

- `SlidingNav.vue` 用 `ResizeObserver` 监听导航容器和每个链接，把当前位置与宽度写进 `--nav-indicator-x` / `--nav-indicator-width`；
- CSS 只负责过渡（380ms `--ease-settle`），不参与计算；
- 初始 `opacity: 0`，测量完成后加 `is-ready` 才淡入——否则首帧指示器会从左上角「飞」到目标位置；
- classic 主题下直接 `display: none`，因为纸媒用的是下划线。

**为什么用 `ResizeObserver` 而不是只监听 `resize`**：字体加载完成、语言切换、字号变化都会改变链接宽度，`resize` 事件不会触发，指示器就会停在错误的位置。

## 主题切换按钮

`ThemeToggle` 是顶栏里唯一的状态按钮，文案在「日 / 月」之间切换，`aria-label` 同步更新。

它有一个容易被忽略的约束：**深浅色与外观面板共用同一份状态**（localStorage 的 `paper-trail-appearance-v5`，字段 `colorMode`）。如果这里另起一套变量，用户先用面板切到「自动」、再点这个按钮，两套开关就会互相覆盖。切换时同时写 `data-theme` 和 `data-color-mode`：前者给 classic 的变量用，后者给 modern 用。

## 外观面板（右下角菜单）

### 结构

```
.appearance-dock                 fixed 右下角
  .appearance-trigger            「Aa 显示」按钮（aria-expanded / aria-controls）
  .appearance-panel              面板本体（关闭时 inert + aria-hidden）
    .appearance-panel__scroll
      .appearance-panel__header  标题 + 关闭按钮
      .setting-group × 12        分组设置
      .appearance-panel__footer  状态提示 + 恢复默认
```

十二组设置依次是：视觉风格、外观模式、最近写下、导航材质、导航模糊、内容材质、内容模糊、背景氛围、背景材质、背景模糊、背景遮罩透明度、氛围色。**材质分导航 / 内容 / 背景三条独立通道**，所以顶栏、卡片、背景可以各用各的质感。

### 审美

面板不是淡入的，而是**从触发器里「长」出来**：用 CSS anchor positioning 把面板锚定到按钮，入场用 `clip-path: inset(... round 22px)` 从按钮尺寸展开到完整尺寸（520ms `--ease-settle`）。不支持 anchor positioning 的浏览器通过 `@supports` 退回右下角固定定位。

分段控件刻意**只保留一个指示器**：`.active` 按钮自身的背景被清空（`background: transparent !important`），否则会出现「指示器 + 按钮高亮」的双重高亮，视觉上会显得脏。

### 动效：大面积切换用 View Transitions

切换视觉身份、材质、强调色、背景时，变化会波及整页。这里不走逐帧颜色过渡，而是：

1. 先给 `<html>` 加 `.no-transition`，保证快照捕获的是旧态的**终态**；
2. 在 `document.startViewTransition()` 里一次性 `applyAppearance()`；
3. 转场结束后**再等两帧**才移除 `.no-transition`，否则新主题会被误判为一次样式变化；
4. 用递增的 `vtSeq` 挡住快速连点时的收尾干扰。

`prefers-reduced-motion` 或不支持 View Transitions 时，直接同步应用，不做转场。

### 实现要点

- 面板外框保持固定，只让 `.appearance-panel__scroll` 内部滚动。上下边缘共用 `--panel-edge-fade: 20px`（原为 16px），中点透明度为 55%，形成略宽且对称的淡出。这里使用 `mask-image`，不是增大整块面板的背景模糊；标准与 WebKit 声明必须同步修改。修改后检查顶部标题和底部恢复默认按钮的可读性。

- 所有选择都写进 `<html>` 的 `data-*` 和内联 CSS 变量，**CSS 不读组件状态**；
- 关闭时面板 `scrollTop` 归零，下次打开从顶部开始；
- 自定义背景在上传时就压缩成 webp data URL（最长边 1920、质量 .82）并校验体积，避免塞爆 localStorage；
- 旧版存储键（v4）会做一次迁移，原来的单个 `blur` 被拆成 `navBlur` / `contentBlur`。

## 首页

首页由五个区块组成，共同点是**都靠版式层级说话，不靠颜色和装饰**：

| 区块 | 作用 | 关键点 |
| --- | --- | --- |
| `.hero` | 第一屏主张 | 全大写 eyebrow + 超大标题（含斜体强调）+ 右侧引导 |
| `.latest-section` | 最近文章 | 标题区带「N 篇」计数，列表用 `.story-row` |
| `.featured-section` | 精选 | 复用 `.story-row`，只筛 `featured` |
| `.manifesto` | 收束 | 居中的一句引用 + 一个链接 |
| `.site-footer` | 页脚 | 两段文案左右分布，顶部一条实线 |

### `.story-row`

列表行是三列网格：序号（70px）/ 正文 / 箭头（40px）。细节：

- 序号补零成 `01`、`02`，用等宽感建立秩序；
- 悬停时正文平移 7px、箭头朝右上 3px（520ms `--ease-settle`），只在精确指针设备启用；
- `content-visibility: auto` 配合 `contain-intrinsic-size`，长列表只渲染视口附近的行。

### 区块入场

首页的区块会参与应用级的页面切换动画，完整的时序与取舍见上文「页面切换」。

## 文章页

侧栏标签下的 `ArticleToc.vue` 读取 `post.body.toc.links`，展示二、三级标题。电脑和手机均通过带 `aria-expanded` 的按钮展开收起；桌面初始展开，手机初始折叠，没有标题时隐藏。折叠使用 grid 行高和透明度过渡：展开 440ms settle，收起 260ms exit；收起内容设置 inert，防止键盘进入隐藏链接。目录用 NuxtLink 锚点，沿用正文 `scroll-margin-top`。滚动监听通过 requestAnimationFrame 合并，使用 `aria-current="location"` 标记当前位置，并在卸载时清理监听。

目录样式局限在组件内，颜色使用现有语义变量，以兼容现代与纸媒、深浅色主题。后续如调整标题锚点偏移，应同步核对目录当前位置的判断阈值。

`[slug].vue` 的结构：

```
.article-page
  .article-header     返回链接 → kicker（标签 / 日期 / 时长 / 徽章）→ h1 → deck
  .article-grid
    .article-aside    左侧主题栏（sticky）
    .article-content  正文（列宽上限 720px）
  .article-end        圆形「完」+ 引导文案 + 归档链接
```

几个和审美直接相关的点：

- **kicker 是元信息条**：极小字号、正字距、低对比度，把「这是哪一类文章」压缩到一行；
- **deck** 用 `description`，字号介于标题与正文之间，承担「再给一次机会决定要不要读下去」的作用；
- **`.article-aside` 用 `position: sticky`**，滚动时始终贴着阅读位置，窄屏收进单列；
- **正文 `h2` 的锚点带 `§` 伪元素**（`.article-content h2 a::before`）：§ 属于链接本身，所以点它也跳转；一个符号完成章节标记，不再加色块或图标；
- **`.article-end`** 用一个圆形「完」字收尾，把「读完」这件事视觉化。

正文里的图片由 `.article-content` 上的事件委托接管（点击放大、双击 / 滚轮缩放），实现细节见 [article-image-lightbox.md](article-image-lightbox.md)；标题锚点靠 `scroll-margin-top` 避开顶栏，页内锚点则统一交给路由以获得与目录一致的平滑滚动，两处细节见 [motion-and-interaction.md](motion-and-interaction.md#锚点跳转与头部遮挡)。

## 内嵌 PDF 阅读器

正文里的 `::pdf-viewer{src="/pdfs/…" title="…"}` 由 `app/components/content/PdfViewer.vue` 渲染，按环境分三种形态：

| 环境 | 形态 | 说明 |
| --- | --- | --- |
| 能内嵌的浏览器（桌面、iPad） | 原生 `<object type="application/pdf">` | 翻页、缩放、打印由浏览器提供 |
| `navigator.pdfViewerEnabled === false`（Chrome / Firefox for Android 等） | 卡片 | 文件名 + 说明 + 「在页面内阅读」/「打开原文件」 |
| 卡片上点了「在页面内阅读」 | `app/components/PdfCanvasReader.vue` | PDF.js 画到 canvas，页码 / 缩放 / 横向滑动翻页 |
| 面板选「直接阅读」，或卡片勾上「始终在页面内阅读」后点按钮 | 同上，直接打开 | 偏好写在 `paper-trail-appearance-v5` 的 `pdfFallback`，卡片与面板双向同步 |

几个刻意的选择：

- **默认出卡片，确认能内嵌再升级**：静态站只有一份 HTML（`nuxt generate`），预渲染时无法判断浏览器能力；先输出卡片能保证不能内嵌的设备不会先下载整份附件，也让没有 JS 的读者仍有可用链接。代价是能内嵌的设备首次渲染会看到卡片被 `<object>` 替换；
- **只判断能力，不判断设备**：唯一依据是 `navigator.pdfViewerEnabled`，老浏览器缺这个属性时只把 Android 当作不能内嵌。不读 UA 机型、也不看屏幕宽度，iPad、Android 平板、手机横屏、平板「请求桌面版网站」都会落到正确形态；
- **不要依赖 `<object>` 内部的兜底文案**：不能内嵌的浏览器不会显示它，手机用户看到的只是一个空白框——这就是最初「手机上什么都没显示」的原因；
- **PDF.js 按需加载**：`defineAsyncComponent` + 动态 `import('pdfjs-dist')`，worker 用 `?url` 交给打包器处理，`BASE_PATH` 部署不会丢路径；桌面路径完全不请求这两个分块；
- **画布没有文本层**：PDF 内的文字不能选中、不参与站内搜索，需要被搜到的内容写在附件前面。
- **偏好两个入口、一份状态**：外观面板的「PDF 附件」分段控件与卡片上的「始终在页面内阅读」勾选框都只改 `useState('pdf-fallback')`；面板 `watch` 这份共享状态回写 `state.pdfFallback`，再由既有 `watch(state)` 统一持久化，因此不存在两处各自写 localStorage 的竞争。偏好只在不能内嵌时生效：能内嵌的浏览器永远走原生阅读器，面板里选了「直接阅读」也不会改变它。
- **能内嵌时该项直接禁用**：面板的可用性与标注同样由 `supportsEmbeddedPdf()`（`app/utils/pdf-embed.ts`，与 `PdfViewer` 共用）决定——能内嵌的浏览器上这一栏 `disabled`（复用 `.setting-group:disabled` 的淡化），标签变成「PDF 附件 · 支持内嵌」；判断前（SSR 与首次渲染）保持可用且不加断言，避免在手机上先显示一句错误的「支持内嵌」。

验证方式（无头 Chrome + CDP，临时探针放 `tmp/`，不提交）：用 `Page.addScriptToEvaluateOnNewDocument` 覆盖 `navigator.pdfViewerEnabled = false` 来模拟 Android（只改 UA 不够，桌面内核仍会报告 true），点击「在页面内阅读」后应出现 `.pdf-reader__canvas`、页码为 `1 / 3`，网络里能看到 `pdf.worker` 与 PDF 请求；勾上「始终在页面内阅读」再点按钮，`localStorage` 里的 `pdfFallback` 应变成 `reader`（面板分段控件同步高亮），刷新后不必再点；能力为 true 时（桌面、iPad、平板桌面模式）应只有 `<object>`，网络里不应出现 pdfjs 分块。回归命令：`node --experimental-strip-types scripts/check-pdf-embed.mjs`（加 `--built` 时检查 `/inkroam/` 产物）。

## 列表页：归档 / 标签 / 搜索

三个页面共用 `.standard-page` + `.page-intro` 的开头，但列表形态不同：

| 页面 | 列表形态 | 设计意图 |
| --- | --- | --- |
| 归档 | `.archive-item` 四列网格（日期 / 标题 / 标签 / 箭头） | 按年分组，强调「时间感」 |
| 标签 | 复用 `.story-row` | 与首页一致，强调「同一主题的连续性」 |
| 搜索 | `.search-result` 按文章归并，内部列出命中章节 | 每篇只出现一次，保留章节直达与关键词高亮 |

搜索空格分词后要求**每个词都命中**（AND）。文章标题匹配优先，随后按最佳章节得分（章节标题每词 3 分）、日期倒序排列。每篇默认显示三处匹配，剩余匹配可展开，细节见 [content-authoring.md](content-authoring.md#搜索是如何工作的)。

搜索“展开其余 N 处匹配”由 `SearchMoreMatches.vue` 控制：使用 grid `0fr → 1fr` 做真实高度展开，展开 440ms settle、收起 260ms exit，不使用透明度淡入淡出。按钮同步更新展开/收起文案、`aria-expanded` 和独立的 `aria-controls`；折叠区设置 inert，查询改变时恢复折叠，减少动效偏好下跳过可感知过渡。

## 徽章

四个小组件，模板都只有几行，但语义必须成对出现（可见文字 + `aria-label`）：

| 徽章 | 显示文字 | 触发字段 |
| --- | --- | --- |
| `PinnedBadge` | 置顶 | `pinned` |
| `FeaturedBadge` | 精选 | `featured` |
| `AiGeneratedBadge` | AI 生成 | `aiGenerated` |
| `AiAssistedBadge` | AI 辅助 | `aiAssisted` |

AI 徽章用「AI」+「生成 / 辅助」两段结构，让「AI」作为固定标记、后半段区分程度；装饰性文字标 `aria-hidden`，整体由 `title` / `aria-label` 提供完整语义。各页面显示哪些徽章，见 [content-authoring.md](content-authoring.md#frontmatter-字段) 里的表。

## 页脚

`.site-footer` 很简单：左右两段文案，顶边一条实线。它承担的是**结束感**——和 `.article-end` 一样，让页面有一个明确的收束，而不是在内容结束后突然中断。

## 跨组分的约定

改任何组分之前，先确认这五条：

1. **CSS 只认 `data-*` 与内联变量**，不读组件状态——外观面板才能一处改、全站生效；
2. **复用 `--ease-*` / `--modern-*` / `--surface-*`**，不要临时写死一套；
3. **悬停只在 `hover: hover` 且 `pointer: fine`** 下启用，触屏不能残留位移；
4. **`prefers-reduced-motion` 下压时长而不是删动画**，保证 `transitionend` 仍然触发；
5. **每个可交互元素都要有 `:focus-visible` 描边**，`offset` 为正，别被圆角裁掉。

## 相关文档

- 颜色 / 字体 / 材质 / 背景的具体值：[visual-system.md](visual-system.md)
- 缓动曲线与动效实现：[motion-and-interaction.md](motion-and-interaction.md)
- 审美判断标准：[aesthetic-principles.md](aesthetic-principles.md)
- 图片灯箱：[article-image-lightbox.md](article-image-lightbox.md)
- Frontmatter 与徽章显示位置：[content-authoring.md](content-authoring.md)
