# 视觉系统

交互层专项：[默认设置确认弹窗：视觉与动效规范](appearance-confirm-design.md)。这是在现有主题token上增加的短时决策层，不替代正文的编辑式视觉语言。

## 两种视觉身份

站点同时提供两套完全独立的视觉：**classic（纸媒原版）** 与 **modern（现代幻境）**。切换由 `:root[data-visual='...']` 驱动，不需要重新加载页面。

- classic 是「原始主题」，所有规则写在 `main.css` 前半段，不带属性前缀；
- modern 的所有规则都带 `:root[data-visual='modern']` 前缀，叠加在 classic 之上；
- 因此 classic 永远不会被 modern 的样式污染，两套设计可以长期共存。

## 数据属性总表

`AppearancePanel` 会把用户选择写进 `<html>` 的 `data-*`，CSS 只认这些属性，不认组件状态：

| 属性 | 取值 | 作用 |
| --- | --- | --- |
| `data-visual` | `modern` / `classic` | 视觉身份总开关 |
| `data-color-mode` | `dark` / `light` | 解析后的实际明暗（`auto` 在 JS 里解析） |
| `data-theme` | `dark` / `light` | 与 `data-color-mode` 同步，供 classic 变量使用 |
| `data-material` | `liquid` / `acrylic` / `mica` | 内容卡片的材质 |
| `data-nav-material` | 同上 | 顶栏材质（可与内容材质不同） |
| `data-dropdown-material` | 同上 | 筛选菜单与日历的独立材质，默认随明暗（浅色液态玻璃 / 深色云母） |
| `data-background-material` | 同上 | 背景材质 |
| `data-background` | `flat` / `theme` / `aurora` / `art` / `dusk` / `custom` | 背景氛围（面板里的「跟随」由 JS 解析成具体值后再写入） |
| `data-scrolled` | `true` / 不存在 | 页面滚动超过 8px 时置上，用于顶栏展开 |

同时 `AppearancePanel` 会把模糊、遮罩、氛围色写成内联 CSS 变量：`--nav-blur`（顶栏与外观面板）、`--content-blur`（页面面层）、`--dropdown-blur`（下拉框/浮层）、`--background-blur`、`--glass-blur`、`--modern-accent`、`--background-overlay-opacity`。三者互不代管：浮层不借导航的模糊，也不借内容面层的模糊——前者会让顶栏滑条连带改浮层，后者与浮层同层、调了看不出变化。

`color-scheme` 只跟 `data-color-mode` 走，不跟 `data-visual` 走，避免现代幻境浅色模式被强制使用深色原生控件。高级搜索日期已使用站内日历与 `currentColor` SVG，不再依赖浏览器日期图标或原生日历弹层；现代模式复用下拉浮层材质及 `--dropdown-blur`，纸媒模式保持不透明纸面。见 [ui-components.md](ui-components.md)。

## 颜色

### classic

浅色为默认，深色通过 `:root[data-theme='dark']` 覆盖：

| 变量 | 浅色 | 深色 |
| --- | --- | --- |
| `--paper` | `#f2efe8` | `#171a17` |
| `--ink` | `#1d211c` | `#e8e5dc` |
| `--muted` | `#696d64` | `#aaa99f` |
| `--line` | `#c8c5bc` | `#3d413b` |
| `--accent` | `#b63b2e` | `#e06b5d` |

### modern

modern 用一组独立变量，并让 classic 的语义变量指向它们，于是所有既有规则自动跟随：

```css
:root[data-visual='modern'] {
  --paper: transparent;
  --ink: var(--modern-ink);
  --muted: var(--modern-muted);
  --line: var(--modern-line);
  --accent: var(--modern-accent);
}
```

校准后的默认值：`--modern-accent: #9aaecb`、`--modern-cyan: #b8c7db`、`--modern-rose: #c3b6c5`、`--modern-ink: #f1f3f6`、`--modern-muted: rgba(229,233,239,.62)`、`--modern-line: rgba(255,255,255,.09)`。

氛围色由用户在面板里从 12 个预设中选择或自定义，写回 `--modern-accent`。派生色有两条约定：

- **预计算**：`--accent-tint-36` / `--accent-tint-48` 在 `:root` 上一次性 `color-mix` 出来。如果改成在每个元素里现算，主题切换时浏览器要重复计算成百上千次；
- **文本用 `--accent-strong`**：`color-mix(in srgb, var(--modern-accent) 84%, var(--modern-ink))`，保证强调色在深色背景上仍有足够对比度，用于搜索标题、徽章等。

## 字体与排版

字体栈只定义一次，modern 通过重定义 `--serif` 完成整体切换：

```css
/* classic */
--serif: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', SimSun, serif;
--sans: Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;

/* modern：把 serif 指向无衬线栈 */
--serif: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
```

这是一个「一处改动、全局生效」的技巧：所有写 `font-family: var(--serif)` 的规则在 modern 下自动变成无衬线，不需要逐条覆盖。

排版刻度（modern 校准后的最终值）：

| 元素 | 规格 |
| --- | --- |
| 首页主标题 | `clamp(58px, 7.4vw, 106px)` / 字重 610 / 行高 1.035 / 字距 `-.065em` |
| 文章标题 | `clamp(43px, 7vw, 78px)` / 字重 650 / 字距 `-.055em` |
| 区块标题 | `clamp(34px, 4vw, 52px)` / 字距 `-.045em` |
| 正文 | 17px / 行高 2.05（移动端 16px / 1.95） |
| eyebrow 小标签 | 10px / 字重 600 / 字距 `.24em` |

字距的方向感是刻意的：**大标题用负字距收紧，小号全大写标签用正字距拉开**。正文行高 2 左右，是为了中文长文的呼吸感。大标题还用了 `text-wrap: balance`，避免最后一行只剩一个字。

阅读列宽固定为 `170px + minmax(0, 720px)`（侧栏 + 正文），`gap: clamp(42px, 7vw, 82px)`，720px 是中文正文的舒适上限。

## 材质

三种材质（liquid / acrylic / mica）不是滤镜，而是一组语义变量：

| 变量 | 作用 |
| --- | --- |
| `--surface-bg` | 卡片背景 |
| `--surface-bg-strong` | 顶栏 / 面板的更强背景 |
| `--surface-border` | 边框 |
| `--surface-shadow` | 外阴影 + 内高光 |
| `--surface-saturation` | `backdrop-filter` 的饱和度 |

- **liquid（液态玻璃）**：渐变底 + 高饱和 + 明显的 `inset` 内高光，最「厚」；
- **acrylic（亚克力）**：半透明纯色，通透、对比低；
- **mica（云母）**：基色里混入氛围色，最「贴主题」。

**出厂默认随明暗分两套**（`AppearancePanel.vue` 里的 `LIGHT_DEFAULTS` / `DARK_DEFAULTS` / `LEGACY_DEFAULTS`）：

| 项 | 浅色（新默认） | 深色（新默认，与 v5 旧值同值） | v5 旧值 |
| --- | --- | --- | --- |
| 四条材质通道（导航 / 内容 / 下拉框 / 背景） | 液态玻璃 | 云母 | 云母 |
| 导航模糊 / 内容模糊 / 下拉框模糊 / 背景模糊 | 14 / 5 / 4 / 0 px | 12 / 10 / 12 / 4 px | 12 / 10 / 12 / 4 px |
| 背景遮罩透明度 | 40% | 40% | 40% |

深浅刻意不对称：浅色底图的明暗落差本来就小，同一档模糊在浅色上更容易把正文糊成一层灰雾，所以浅色取更轻的值。

**谁能拿到这套新默认，由面板上的「默认设置」开关决定**（见 [ui-components.md](ui-components.md)）：新访客
（localStorage 里一个键都没有）默认**启用**，一进来就是当前明暗的这一套；老访客（有任何存储痕迹）默认**禁用**，
他存过的值原样保留，**缺的键落回 `LEGACY_DEFAULTS`（云母 + 12 / 10 / 12 / 4）**——也就是改动前的观感，不会因为
升级被换成新默认。启用态下切系统明暗会整批换成另一套；禁用态下切系统明暗一个字都不改。

⚠️ `main.css` 的 `:root` 另有一组首帧兜底（现在与深色那一套一致：`--nav-blur: 12px` / `--content-blur: 10px` /
`--dropdown-blur: 12px` / `--background-blur: 4px`），因为首帧的 `data-color-mode` 固定是深色；挂载后由面板写内联
变量覆盖。首帧仍是深色（浅色访客会看到一次深色首帧），要彻底消除需要在 `<head>` 里加一段同步脚本，见
[work-checkpoint.md](work-checkpoint.md)。

⚠️ 材质变量在文件里被定义过两次（约 212 行与约 853 行）。后一次是「Refined flat direction」校准，把三档的差异压小、饱和度归一到 100% 附近。**实际生效的是后一次**，修改时不要只改前面那组。

## 背景

`data-background` 有六种模式，统一渲染在 `.ambient-backdrop` 这个固定层里（`z-index: -2`）。面板里的「跟随」不是一个属性值：它由 JS 按当前明暗解析成具体模式后写入 `data-background`，所以 CSS 只会见到下面六个值。

- `flat`（静谧纯色）：中性纯色底，隐藏图片与极光；
- `theme`（主题纯色）：画布就是这个氛围色本身（`background: var(--modern-accent)`），同样隐藏图片与极光；浓淡由「背景遮罩透明度」统一控制，这里不另设比例；
- `aurora`（极光渐变）：三个大半径径向渐变 + `blur(64px)`，透明度由 0.12 提升到 0.3；
- `art`（暮色都市）：`/images/modern-dream-city.png`，`saturate(.82) brightness(.66)` 压暗压灰；
- `dusk`（夕空町市）：`/images/yuzoramachi.png`，与 `art` 共用同一条图片管线，只换底图；
- `custom`（自定义）：用户上传图片，压缩成 webp data URL 存在 localStorage，叠在 art 之上作为兜底。

默认值是「跟随」：首次打开时深色取 `art`、浅色取 `dusk`，面板高亮的也是解析后的那一项。用户点过任意一张卡片（上传自定义图同样算）后，`backgroundPicked` 会写进 localStorage，此后不再跟随系统明暗；「恢复默认」把它清回「跟随」。

**两种纯色画布（`flat` / `theme`）共用同一套结构规则**：底下没有图层可模糊，所以它们一起隐藏 `.ambient-image` / `.ambient-aurora`、取消卡片的 `backdrop-filter`、把卡片改成透明无边框并保留圆角。这些规则的选择器统一写成 `:is([data-background='flat'], [data-background='theme'])`；新增纯色画布时必须并进去，否则它会退回成「有图层的画布」。材质侧的 `acrylic` / `liquid` 反过来用 `:not(:is(...))` 把这两者排除在玻璃逻辑之外。

遮罩是背景可读性的关键：

```css
.ambient-backdrop::after {
  background: var(--backdrop-overlay);           /* 深色 #0b0e1a / 浅色 #eef0f2 */
  opacity: var(--background-overlay-opacity);    /* 用户 0–100% */
}
.ambient-image {
  opacity: calc(1 - var(--background-overlay-opacity));  /* 联动反向 */
}
```

遮罩越强，底图越淡——两层是联动的，而不是各自独立，这样任何取值下正文对比度都够。

## 滚动容器：为什么滚动不在 `html` 上（2026-09-25）

经典（非覆盖式）滚动条的槽位落在**文档绘制区之外**：`position: fixed` 的 `.ambient-backdrop`、自绘的 `::-webkit-scrollbar` 轨道都盖不上去，那里显示的永远是 canvas —— 也就是 `body` 的背景色。紧挨一张底图时，右边缘就是一条白边：实测同一行相邻像素差 **94/255**（底图 `75,95,142` → 槽位 `236,238,241`）。

试过且**无效**的两条路，别再走：

- 给 fixed 背景层加 `width: 100vw`：仍被裁在绘制区里，槽位像素一字不变；
- 把根滚动条改成自绘透明轨道：轨道透明了，透出来的还是 canvas。

有效的是**把滚动搬进绘制区**——和文章目录那条滑条本来就是同一套机制（目录的槽位在页面上，不是文档外）：

```css
@media (hover: hover) and (pointer: fine) {
  html { overflow-y: hidden; }   /* 没有根滚动条 → ICB 变成整个窗口 */
  .page-scroll { height: 100dvh; overflow-y: scroll; overflow-x: clip; background: transparent; }
}
```

`.page-scroll` 在 `app.vue` 与 `error.vue` 里包住 `.site-shell`；`.ambient-backdrop` 与外观面板留在容器**外面**（都是 fixed 全局层，不该被内容布局牵连）。槽位因此落进页面能画到的区域，透明的轨道下面就是氛围层。同一位置实测量到相邻像素差降到 **1–3/255**，只剩滚动条拇指自己的边缘。

滑条本身（宽度、颜色、能滚才显隐、平台差异）单独写在 [scrollbar.md](scrollbar.md)。

配套约定：

- **宽度不变**：容器 `offsetWidth` 仍是窗口宽（1500 窗口下 1478），扣掉自己的滚动条后正文可用宽度与以前完全一致，不产生布局位移。
- 手机（指针粗、无 hover）是覆盖式滚动条，本来就浮在内容上，保持原生文档滚动。`app/utils/page-scroll.ts` 的 `PAGE_SCROLL_QUERY` 必须与上面那条媒体查询逐字一致。
- 滚动位置一律经 `app/utils/page-scroll.ts` 读写：`window.scrollY`、`document.documentElement.scrollTop` 只对文档滚动有效，桌面读到的是恒为 0 的值。
- `app/router.options.ts` 自己实现 `scrollBehavior`：Nuxt 默认把位置交给 vue-router 去滚 `window`，而桌面 `window` 已经不动了，连它记录的"历史位置"也恒为 0。锚点仍靠目标元素的 `scroll-margin-top`（`--anchor-offset`）避开 sticky 头部，跨页锚点与刷新还原都要等内容渲染出来再滚（`scrollToHashWhenReady` / `scrollPageToWhenReady`）。
- 阅读位置按 `fullPath` 记在 `sessionStorage`（导航前 + `pagehide` + 页面隐藏时），刷新与前进 / 后退都能回到原处——浏览器自身的滚动还原只认文档滚动，搬进容器后它帮不上忙。
- 头部 `[data-scrolled]` 与文章目录的当前章节都从同一个工具读位置；滚动监听必须用**捕获阶段**（scroll 事件不冒泡，容器内部的滚动传不到 window）。

## 玻璃拟态的实现细节

早期版本用 `::before` 叠一层 115° 的白色渐变并配合 `mask: linear-gradient(#000, transparent 32%)`，模拟玻璃边缘的高光衰减。校准层把这几处 `::before` 改成了 `display: none`，实际生效的是更克制的方案：

- 边框用 `--surface-border`（约 8–10% 白）；
- `inset 0 1px 0 rgba(255,255,255,.1)` 做顶部内高光；
- 外阴影很轻（`0 10px 30px rgba(0,0,0,.13)`），避免「浮起来」的廉价感。

## 响应式策略

| 条件 | 处理 |
| --- | --- |
| `max-width: 767.98px` | 主断点：单列布局、隐藏次要信息、缩小圆角与内边距 |
| `min-width: 768px` 且 `min-aspect-ratio: 4/3` 且 `max-height: 2400px` | 宽屏矮窗口（笔记本、投影）压缩垂直间距 |
| `max-height: 600px` 变体 | 更极端的高度压缩 |
| `hover: hover` 且 `pointer: fine` | 悬停位移只在鼠标/触控板启用，触屏不触发 |

用 `767.98px` 而不是 `768px` 是为了避开某些浏览器的小数像素边界问题。

## 无障碍

- 所有可交互元素都有 `:focus-visible` 描边，且 `outline-offset` 为正，不被圆角裁掉；
- `prefers-reduced-motion: reduce` 下全局把 `transition-duration` / `animation-duration` 压到 `.01ms`；
- 图标按钮与徽章都带 `aria-label` / `title`，纯装饰元素标 `aria-hidden="true"`；
- `.visually-hidden` 用于给读屏器保留文案（例如外观面板的状态提示）。

## 维护注意

### About 页的 Another Resident

`app/pages/about.vue` 在原有正文之后追加「林澈 / Lin Che」，保持同一 DOM 适配 classic / modern。它不是人物资料卡，不增加独立材质、动画或主题状态。文案使用既有 `about-copy`，小标签复用 `eyebrow`；标题使用 `--serif`、`--ink`、`--muted`。

- 桌面以非对称网格、较大的段前留白区隔原文。人物图右对齐，宽为右侧网格的 118%、上限 420px，向左延伸负空间；正文处于更高图层，人物主体留在阅读列之外。正文局部使用 16px / 1.95 和 `--ink`，避免继承横屏 About 的 13px 小字，减轻强背景下图重文轻的问题。
- 手机沿用 `767.98px` 主断点，按标题、正文、图片单列排列。图片容器为 `1 / 2`，`object-fit: cover; object-position: right center`，只裁原图左侧部分空白，不裁垂直范围。
- 原图为 `public/images/lin-che.png`（1024 × 1536），URL 带应用 `baseURL`，支持 GitHub Pages 子路径；固定宽高比、懒加载，避免首屏抢加载。
- CSS mask 仅柔化边界，不对原图做混色、反色或降低整体透明度。桌面左侧负空间渐变至 48% 才完全不透明，上下淡出限制在 3% / 1%；手机仍保留原有 2% / 1% 上下淡出及横向裁切。深色下仍保留原画本身的浅灰背景。
- 更换图片需重新核对主体位置及手机裁切，不适用于主体居中或横幅图片。不要将人物设定扩展成 UI 字段，也不要调整上方原 About 文案。

桌面图片用 `margin-top: -88px` 向标题方向抬高，并减少底部占位；手机独立覆盖为 `38px`，不继承上移。已根据用户提供的桌面截图迭代，类型检查与子路径静态构建通过；手机及其他主题的实际截图验收仍待浏览器连接恢复。

### 通用规则

林澈模块可运行 `node scripts/check-about-resident.mjs` 检查七段文案、阅读顺序、图片尺寸/替代文本、根路径与子路径 URL、移动端覆盖及主题变量契约。完成静态生成后运行 `node scripts/check-about-resident.mjs --built`，额外核对生成页面和图片；默认预期 `/inkroam/`，其他部署路径通过 `BASE_PATH` 指定。脚本无新增依赖，不替代浏览器渲染检查。

待浏览器可用时，人工验收 320 / 390 / 768 / 1440px，分别切换 classic / modern 与深浅色：检查横向溢出、头发及鞋完整性、文字与人物不重叠、手机不继承桌面负上边距、灰底融合及文字对比度。另检查 200% 缩放和减少动态效果设置。未实际执行的项目不可记为通过。

1. **新增颜色先找变量**：能用 `--modern-*` 或 `color-mix` 派生就不要写死色值，否则换氛围色时会漏掉。
2. **modern 专属规则必须加前缀**：`:root[data-visual='modern']`，否则会污染 classic。
3. **注意层叠顺序**：`main.css` 后段有校准层，前面同名规则可能已失效。
4. **别删 `--accent-tint-*` 的预计算**：它是主题切换性能的关键。
