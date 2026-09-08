# 视觉系统

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
| `data-background-material` | 同上 | 背景材质 |
| `data-background` | `flat` / `art` / `aurora` / `custom` | 背景模式 |
| `data-scrolled` | `true` / 不存在 | 页面滚动超过 8px 时置上，用于顶栏展开 |

同时 `AppearancePanel` 会把模糊、遮罩、氛围色写成内联 CSS 变量：`--nav-blur`、`--content-blur`、`--background-blur`、`--glass-blur`、`--modern-accent`、`--background-overlay-opacity`。

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

⚠️ 材质变量在文件里被定义过两次（约 212 行与约 853 行）。后一次是「Refined flat direction」校准，把三档的差异压小、饱和度归一到 100% 附近。**实际生效的是后一次**，修改时不要只改前面那组。

## 背景

`data-background` 有四种模式，统一渲染在 `.ambient-backdrop` 这个固定层里（`z-index: -2`）：

- `flat`：纯色底，隐藏图片与极光；
- `art`：`/images/modern-dream-city.png`，`saturate(.82) brightness(.66)` 压暗压灰；
- `aurora`：三个大半径径向渐变 + `blur(64px)`，透明度由 0.12 提升到 0.3；
- `custom`：用户上传图片，压缩成 webp data URL 存在 localStorage，叠在 art 之上作为兜底。

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

1. **新增颜色先找变量**：能用 `--modern-*` 或 `color-mix` 派生就不要写死色值，否则换氛围色时会漏掉。
2. **modern 专属规则必须加前缀**：`:root[data-visual='modern']`，否则会污染 classic。
3. **注意层叠顺序**：`main.css` 后段有校准层，前面同名规则可能已失效。
4. **别删 `--accent-tint-*` 的预计算**：它是主题切换性能的关键。
