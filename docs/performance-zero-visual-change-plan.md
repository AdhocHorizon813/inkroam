# Inkroam 零视觉变化性能优化审计与 Astra 工作说明

> 日期：2026-09-28  
> 目标：在 **不改变现有视觉效果、动画观感、交互语义、布局和用户偏好行为** 的前提下，降低 Inkroam 的运行时开销。
>
> 本文面向未来 Astra / Codex。不要把“重构得更漂亮”当成目标；所有修改都必须能解释性能收益，并经过等价性验证。

## 0. 核心原则

本轮不是 UI 重做，也不是继续大规模 CSS 清理。现有 CSS 已经过较深入的等价清理，后续收益更可能来自运行时热路径。

1. **Zero visual change**：像素、透明度、模糊、材质、阴影、圆角、间距、动画时序、 easing、stagger、滚动条外观均不得主动改变。
2. **Zero behavioral change**：滚动、页内锚点、前进后退位置恢复、系统明暗跟随、默认设置、旧偏好迁移、PDF fallback 等行为不得改变。
3. 优先消除重复读取、重复计算、重复 DOM/CSS 写入，而不是换框架或大拆组件。
4. 优先优化滚动/动画等高频路径；低频初始化优化只有在能降低复杂度或副作用风险时才值得做。
5. 修改前后必须跑现有 typecheck / generate / regression checks；涉及样式和几何的修改还要做 computed style + geometry 对照。
6. 不允许仅凭“理论上更快”宣布完成。最好加入轻量 instrumentation，比较调用次数、实际 DOM/CSS mutation 次数以及浏览器 Performance trace。
7. 不要为了少几行代码牺牲现有注释。Inkroam 中很多看似奇怪的实现是浏览器兼容性结论。

---

## 1. P0：`usePageScrollable.ts` 的滚动热路径

文件：`app/composables/usePageScrollable.ts`

当前设计本身合理：原生滚动容器保留输入行为，`PageScrollbar.vue` 只负责绘制；scroll event 已通过 `requestAnimationFrame` 合并；`ResizeObserver` 监控尺寸；`MutationObserver` 处理页面切换后 children 替换；自绘拇指用于解决原生 scrollbar 在不可滚瞬间被撤掉、无法完成淡出的问题。

**不要推翻这套设计。**

### 1.1 当前热路径

当前 `syncThumb(element)` 每次执行都会读取：

- `element.clientHeight`
- `element.scrollHeight`
- `element.scrollTop`

随后重新计算 track、range、thumb size、thumb offset，并写入：

- `--page-scrollbar-thumb-offset`
- `--page-scrollbar-thumb-size`

虽然 scroll 已经过 rAF 节流，但连续滚动时仍可能每帧重复计算实际上不变的 geometry。

### 1.2 把 geometry 与 position 分离

`clientHeight`、`scrollHeight`、thumb size 只有尺寸/内容几何变化时才需要重新计算。滚动过程中真正高频变化的通常只有 `scrollTop -> thumb offset`。

可以内部缓存：

```ts
interface ThumbGeometry {
  track: number
  scrollHeight: number
  range: number
  size: number
  travel: number
}
```

由 resize / mutation / 首次 measure 更新 geometry。scroll rAF 热路径只读 `scrollTop` 并计算 offset。

必须保持现有公式、rounding、1px 容差等语义完全一致。

### 1.3 CSS custom property equality guard

缓存最终写入值，例如：

```ts
let lastThumbSize = -1
let lastThumbOffset = -1
```

只有新值与上次不同才调用 `style.setProperty()`。尤其 offset 使用 `Math.round` 后，多个连续 scrollTop 可能映射到同一个拇指像素位置，这些帧不必重复修改 inline style。

比较最终 CSS 像素值，不要让浮点中间值影响等价判断。

### 1.4 必须保持

不得改变：

- `MIN_THUMB_SIZE = 40`
- thumb size / offset 公式
- 不可滚时 offset = 0、size = track
- `PAGE_SCROLL_QUERY`
- 首帧 `data-scrollable-settled=false`
- 双 rAF 后才允许 fade delay
- 手机/桌面分支语义
- scrollbar 的“原生输入 + 自绘视觉”分工

---

## 2. P0：`app.vue` 避免重复写 `data-scrolled`

当前 `syncScrollState()` 每次 scroll callback 都判断 `pageScrollTop() > 8`，然后设置或删除 `document.documentElement.dataset.scrolled`。

长文章中部连续滚动时状态长期都是 `true`，没有必要重复触碰 DOM attribute。

建议增加状态 guard：

```ts
let lastScrolled: boolean | undefined

function syncScrollState() {
  const scrolled = pageScrollTop() > 8
  if (scrolled === lastScrolled) return
  lastScrolled = scrolled

  const root = document.documentElement
  if (scrolled) root.dataset.scrolled = 'true'
  else delete root.dataset.scrolled
}
```

初值使用 `undefined`，确保第一次同步一定执行。保守起见继续保留原来的 `data-scrolled="true"` 表达，不要未经验证改成只依赖属性存在性的形式。

普通“从顶部滚到底”的过程中，真正的状态 mutation 理论上应基本只有一次；返回顶部再发生一次。

---

## 3. P2：统一 page-scroll frame scheduler（先测量）

当前至少有两个 scroll consumer：

- `usePageScrollable()` 更新自绘 scrollbar；
- `app.vue` 更新 header 的 `data-scrolled`。

现状不是错误，也未必是明显瓶颈。只有 instrumentation 证明重复 listener/rAF 调度值得处理时，才考虑在 `app/utils/page-scroll.ts` 建立统一的每帧调度层：

```text
native/container scroll
        |
        v
single rAF scheduler
   |           |
   v           v
scrollbar    header
```

未来 Article TOC / reading progress 等高频消费者也可复用。

这是架构改动，**不要为了“更统一”而做**。

---

## 4. P2：ResizeObserver / MutationObserver 增量订阅

当前 child list 变化后会 disconnect ResizeObserver，再重新 observe 全部 children，然后 measure。页面切换频率不高，所以不是第一优先级。

可选优化：利用 `MutationRecord[]`，对 `removedNodes` 执行 `unobserve`，对 `addedNodes` 执行 `observe`，一个 mutation batch 后只 measure 一次。

必须正确处理 HTMLElement 判断、非 element node、Nuxt 页面整体替换、mount/unmount 和 observer 生命周期。

如果实现明显变复杂，则保留现状。**低频路径不值得为了微优化增加 bug 面积。**

---

## 5. P1：`AppearancePanel.vue` 在进入 reactive state 前完成 normalization

`AppearancePanel.vue` 是复杂度热点，包含 localStorage、v4/v5 migration、新老访客兼容、默认设置、系统明暗、background migration、custom background、material/blur、latest counts、PDF fallback、View Transition / appearance application 等。

已有 `appearance-storage.ts` 是正确方向。

建议继续提取无 Vue 副作用的纯函数，例如：

```ts
normalizeAppearanceState(...)
resolveAppearanceDefaults(...)
normalizeStoredAppearance(...)
resolveManagedDefaults(...)
```

目标：

```text
localStorage/raw stored state
          |
          v
decode / migrate / normalize  <- pure functions
          |
          v
complete valid AppearanceState
          |
          v
Object.assign(state, normalized)
          |
          v
applyAppearance()
```

而不是让 reactive `state` 在初始化期间经历大量逐字段修正。

主要收益不是宣称节省几毫秒 CPU，而是减少响应式中间状态、降低 watch 看见半成品 state 的可能、便于单测，并让 migration/default semantics 更容易证明。

### 必须严格保持的语义

- 真新访客 vs 已有任意旧存储访客；
- `defaultSettings` 只有显式 true 才启用的老访客语义；
- v4 -> v5 migration；
- `backgroundPicked` 缺失时的兼容；
- `art` -> `auto` 的特定旧存储迁移；
- 深色/浅色不同默认材质和 blur；
- `colorMode=auto` 对系统主题变化的响应；
- 手动关闭 default settings 后不得被系统明暗切换覆盖；
- SSR 初值与 mounted 后系统主题补齐的 hydration 考量；
- PDF fallback；
- latest post/note count；
- custom background localStorage。

任何“简化”如果改变这些语义，都不属于本轮性能优化。

---

## 6. 暂时不要优化的地方

### 6.1 路由入场动画

`app.vue` 当前主要使用 `opacity + transform: translate3d(...) + Web Animations API`，带 reduced-motion guard 和双 rAF。这已经是浏览器比较友好的路径。

没有 Performance trace 证据时不要改成另一套 Vue Transition / CSS animation。

尤其不要改变：

- 620ms duration
- `cubic-bezier(.16, 1, .3, 1)`
- 10px translate
- 18ms stagger
- 108ms delay cap

### 6.2 backdrop-filter / blur 参数

不允许通过降低 blur、减少玻璃层、去阴影等方式获得性能。那是视觉降级，不是 zero visual change optimization。

可以调查合成层和 paint，但没有证据时不要动视觉参数。

### 6.3 本轮不做的大工程

- 引入 Pinia
- 引入 Tailwind
- CSS Modules 迁移
- 强拆主 CSS
- 重写滚动体系
- 为文件行数机械拆 Vue component
- 无目标的大规模 dead-code / CSS cleanup
- 全站 composable 重构
- 改 UI 设计

---

## 7. 先做 instrumentation，再宣布优化

建议用本地临时 instrumentation 统计约 10 秒连续滚动的 Before / After：

1. 原始 scroll event 次数；
2. `scheduleThumb()` 调用次数；
3. `syncThumb()` / 新 position updater 实际执行次数；
4. geometry recomputation 次数；
5. `--page-scrollbar-thumb-size` 实际写入次数；
6. `--page-scrollbar-thumb-offset` 实际写入次数；
7. `data-scrolled` 实际 mutation 次数；
8. rAF callback 数；
9. Performance panel 中 scripting / rendering / painting；
10. dropped frames / long tasks（如有）。

instrumentation 不应污染生产代码，也不要留下 console spam。

预期优化后：scroll event 数不变；offset updater 仍大致每帧一次；geometry recomputation 显著下降；纯滚动时 thumb size 写入接近 0；round 后相同 offset 的重复写入减少；`data-scrolled` 从顶部滚到底基本只产生一次 true mutation。

---

## 8. Patch 验证协议

一次只做一个独立 patch。

### Patch A：`data-scrolled` equality guard

验证：顶部、越过 8px、返回顶部、route change、刷新后恢复滚动位置、mobile / desktop。

### Patch B：scrollbar geometry cache + CSS property equality guard

验证：短页面、长页面、顶部/中间/底部、resize、页面切换、异步内容高度变化、scrollbar 淡入淡出、首帧 delay、desktop fine pointer、mobile/coarse pointer。

### Patch C：observer 增量订阅（如果做）

重复 Patch B 场景，尤其 route replacement。

### Patch D：Appearance normalization

验证：无 localStorage 新访客、v5 完整/缺字段、v4、malformed storage、light/dark/auto、defaultSettings on/off、系统主题运行时变化、custom background、backgroundPicked 缺失、latest counts、PDF fallback。

---

## 9. 自动化与浏览器级检查

修改后至少运行仓库现有的 typecheck、generate/build、完整 regression checks、page-scroll 专项检查、appearance 专项检查（若有）、CSS/产物检查。

如果 visual equivalence probe 仍只是 `tmp/` 工具，可在成熟后考虑整理成 `scripts/check-visual-equivalence.mjs`，但不要未经评估直接塞进普通 `check-all`。浏览器级检查可考虑独立为 `npm run check:visual`。

涉及 scrollbar / CSS / appearance 时，仅 typecheck 不够。应比较修改前后：

- `getComputedStyle`
- bounding rect / geometry
- pseudo scrollbar（probe 支持时）
- DOM attributes
- CSS variables
- screenshot / visual diff（条件允许时）

对于 scrollbar 固定 `0% / 25% / 50% / 75% / 100%` scrollTop，比较 thumb size、offset、opacity、track geometry。结果必须相同。

---

## 10. 性能验证不要只看 FPS

高性能设备上修改前后都可能稳定 60/120 FPS，所以更有意义的是：

- 每帧 JS work 是否减少；
- style mutation 是否减少；
- forced layout 是否减少；
- layout / paint 是否减少；
- GPU/compositor 路径是否保持；
- long task 是否减少；
- 低性能设备 frame budget 是否更稳定。

核心思想：**不改变最终画面，只减少为了得到同一画面所做的重复工作。**

---

## 11. 推荐执行顺序

### P0：低风险、高确定性

1. `app.vue`：`data-scrolled` equality guard。
2. `usePageScrollable.ts`：CSS variable equality guard。
3. `usePageScrollable.ts`：geometry cache，滚动热路径只更新 position。
4. Before/After instrumentation。

### P1：中等收益、主要改善可维护性

5. Appearance normalization / migration 纯函数化。
6. 为这些纯函数补旧存储测试。

### P2：测量后再决定

7. MutationObserver / ResizeObserver 增量订阅。
8. page-scroll 单一 frame scheduler。
9. visual equivalence probe 正式入库。

---

## 12. Astra 接手要求

开始前先读：

- 本文
- `docs/engineering-retrospective-2026-09-26.md`
- `docs/scrollbar.md`
- `docs/browser-regression-checklist.md`
- `docs/ui-components.md`
- `app/composables/usePageScrollable.ts`
- `app/utils/page-scroll.ts`
- `app/app.vue`
- `app/components/AppearancePanel.vue`

然后：

1. 先确认当前 `main` 是否已发生后续变化，不要机械套用本文代码片段。
2. 一次只做一个独立 patch。
3. 每个 patch 说明：原先的重复工作、新实现为何语义等价、保留了哪些 invariant、跑了哪些测试、实测减少了多少调用/mutation（如可测）。
4. 如果某项优化只能获得极小收益却需要复杂重构，**不做**。
5. 不要为了“完成任务”扩大范围。
6. 不要再生成上千行重复流水账；总结关键证据，详细机器输出放临时文件。

---

## 13. 最终目标

```text
同一个 Inkroam
同一个 UI
同一个动画
同一个玻璃效果
同一个滚动行为
同一个偏好兼容性

但：

更少的 layout-sensitive reads
更少的重复计算
更少的 DOM mutations
更少的 CSS variable writes
更清晰的 reactive boundary
更容易证明的性能与行为等价性
```

**复杂视觉可以保留；复杂视觉不意味着每一帧都必须做复杂工作。**
