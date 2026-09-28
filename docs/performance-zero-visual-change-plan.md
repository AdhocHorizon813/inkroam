# Inkroam 零视觉变化性能优化审计与 Astra 工作说明

> 日期：2026-09-28  
> 目标：在 **不改变现有视觉效果、动画观感、交互语义、布局和用户偏好行为** 的前提下，降低 Inkroam 的运行时开销。  
> 本文是给未来 Astra / Codex 的工作说明。不要把“重构得更漂亮”当成目标；所有修改都必须能解释其性能收益，并经过等价性验证。

## 0. 核心原则

本轮不是 UI 重做，也不是继续大规模 CSS 清理。现有 CSS 已经过较深入的等价清理，后续收益更可能来自运行时热路径。

必须遵守：

1. **Zero visual change**：像素、透明度、模糊、材质、阴影、圆角、间距、动画时序、easing、stagger、滚动条外观均不得主动改变。
2. **Zero behavioral change**：滚动、页内锚点、前进后退位置恢复、系统明暗跟随、默认设置、旧偏好迁移、PDF fallback 等行为不得改变。
3. 优先消除 **重复读取、重复计算、重复 DOM/CSS 写入**，而不是换框架或大拆组件。
4. 优先优化滚动/动画等高频路径；低频初始化优化只有在能降低复杂度或副作用风险时才值得做。
5. 修改前后必须跑现有 typecheck / generate / regression checks；涉及样式和几何的修改还要做 computed style + geometry 对照。
6. 不允许仅凭“理论上更快”宣布完成。最好加入轻量 instrumentation，比较调用次数、实际 DOM/CSS mutation 次数以及浏览器 Performance trace。
7. 不要为了少几行代码牺牲现有注释。Inkroam 中很多看似奇怪的实现是浏览器兼容性结论。

---

## 1. 当前最值得优化：`usePageScrollable.ts`

文件：

`app/composables/usePageScrollable.ts`

当前设计本身是合理的：

- 使用原生滚动容器保留输入行为；
- `PageScrollbar.vue` 只绘制可见拇指；
- scroll event 通过 `requestAnimationFrame` 合并，一帧最多更新一次；
- `ResizeObserver` 监控尺寸变化；
- `MutationObserver` 处理页面切换后 children 替换；
- 自绘拇指解决“原生 scrollbar 在不可滚瞬间被浏览器撤掉，无法完成淡出”的问题。

**不要推翻这套设计。**

### 1.1 当前热路径

当前 `syncThumb(element)` 每次执行都会读取：

- `element.clientHeight`
- `element.scrollHeight`
- `element.scrollTop`

随后重新计算：

- track
- range
- thumb size
- thumb offset

最后写入：

- `--page-scrollbar-thumb-offset`
- `--page-scrollbar-thumb-size`

虽然 scroll 已经经过 rAF 节流，但连续滚动时仍可能每帧重复计算实际上不变的 geometry。

### 1.2 优化目标：把 geometry 与 position 分离

`clientHeight`、`scrollHeight`、thumb size 只有尺寸/内容几何变化时才需要重新计算。

滚动过程中真正高频变化的通常只有：

`scrollTop -> thumb offset`

建议内部缓存类似：

```ts
interface ThumbGeometry {
  track: number
  scrollHeight: number
  range: number
  size: number
  travel: number
}
```

由 resize / mutation / 首次 measure 更新 geometry。

scroll rAF 热路径只做：

```ts
const scrollTop = element.scrollTop
const offset = ...
```

保持现有公式、rounding、1px 容差等语义完全一致。

### 1.3 CSS custom property 写入 equality guard

当前即使最终像素值没变，也可能再次：

```ts
element.style.setProperty(...)
```

建议缓存：

```ts
let lastThumbSize = -1
let lastThumbOffset = -1
```

只有新值与上次不同才写。

尤其 offset 使用 `Math.round` 后，多个连续 scrollTop 值可能映射到同一个拇指像素位置。这些帧没有必要重复修改 inline style。

注意：比较的应该是**最终写入 CSS 的值**，避免浮点差异导致错误跳过。

### 1.4 必须保持的细节

不得改变：

- `MIN_THUMB_SIZE = 40`
- thumb size 计算公式
- thumb offset 计算公式
- 不可滚时 offset = 0
- 不可滚时 size = track
- `PAGE_SCROLL_QUERY`
- 首帧 `data-scrollable-settled=false`
- 双 rAF 后才允许 fade delay 的行为
- 手机/桌面分支语义
- scrollbar 的原生输入 + 自绘视觉分工

---

## 2. `app.vue`：避免 header scroll state 的重复 DOM mutation

文件：

`app/app.vue`

当前 `syncScrollState()` 每次 scroll callback 都判断：

```ts
pageScrollTop() > 8
```

随后设置或删除：

`document.documentElement.dataset.scrolled`

问题是：用户从文章中部持续滚动时，状态长期都是 `true`，但函数仍可能反复尝试写同一个状态。

### 2.1 建议

增加本地状态 guard：

```ts
let lastScrolled: boolean | undefined

function syncScrollState() {
  const scrolled = pageScrollTop() > 8
  if (scrolled === lastScrolled) return

  lastScrolled = scrolled
  document.documentElement.toggleAttribute('data-scrolled', scrolled)
}
```

初始化时必须保证第一次调用一定能同步 DOM，因此不要错误地把初值设成 `false` 后直接跳过“页面一开始就在顶部”的必要清理；`undefined` 更安全。

也可以考虑 `toggleAttribute`，但只有在确认 CSS/测试只依赖属性存在性而不是精确值 `'true'` 后才使用。**保守方案是维持原来的 `data-scrolled="true"` 表达。**

### 2.2 理论收益

长页面连续滚动时，状态真正变化通常只发生在：

- 0~8px -> >8px
- >8px -> 0~8px

也就是说，大量 scroll callback 可以变成纯 boolean comparison，不再触碰 DOM attribute。

---

## 3. 可选第二阶段：统一 page-scroll 的 frame scheduler

当前至少有两个 scroll consumer：

- `usePageScrollable()`：更新自绘 scrollbar；
- `app.vue`：更新 `data-scrolled` header 状态。

现状并非错误，也不一定是明显瓶颈。

如果 instrumentation 显示 scroll listener / rAF 调度存在可见重复工作，可以考虑在：

`app/utils/page-scroll.ts`

建立统一的“每帧一次”调度层：

```text
native/container scroll
        |
        v
single rAF scheduler
   |           |
   v           v
scrollbar    header
```

未来 Article TOC / reading progress 等高频消费者也可以复用。

### 风险

这是架构改动，收益未必大于复杂度。

因此：

**只有测量证明值得时才做。**

不要为了“代码更统一”而改。

---

## 4. `ResizeObserver` / `MutationObserver` 增量订阅

当前 `watchChildren()` 在 child list 变化后大致会：

1. `resizeObserver.disconnect()`
2. 遍历所有 `element.children`
3. 重新 `observe`
4. `measure()`

页面切换频率不高，因此这不是第一优先级。

### 4.1 可选优化

利用 `MutationObserver` callback 的 `MutationRecord[]`：

- `removedNodes` -> `resizeObserver.unobserve(node)`
- `addedNodes` -> `resizeObserver.observe(node)`

避免一个 child 变化就重新订阅所有 children。

### 4.2 注意

必须正确处理：

- `HTMLElement` 判断；
- fragment / 非 element node；
- Nuxt 页面整体替换；
- mount / unmount；
- observer 生命周期；
- 一次 mutation batch 后是否只 measure 一次。

如果实现明显变复杂，则宁可保留现状。

**低频路径不值得为了微优化增加 bug 面积。**

---

## 5. `AppearancePanel.vue`：优化重点不是渲染，而是状态进入 reactive system 前的 normalization

文件：

`app/components/AppearancePanel.vue`

这是当前复杂度热点之一，文件约 38 KB，包含：

- UI
- localStorage
- v4/v5 migration
- 新老访客兼容
- 默认设置
- 系统明暗
- background migration
- custom background
- material / blur
- shared latest counts
- PDF fallback
- View Transition / appearance application

已有 `appearance-storage.ts` 是正确方向。

### 5.1 当前值得继续提取的逻辑

建议把纯逻辑提成无 Vue 副作用函数，例如：

```ts
normalizeAppearanceState(...)
resolveAppearanceDefaults(...)
normalizeStoredAppearance(...)
resolveManagedDefaults(...)
```

目标流程：

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

### 5.2 这项优化的主要收益

不要夸大纯 CPU 收益。

主要收益是：

- 降低初始化期间响应式中间状态；
- 降低 watch 看见“半 normalized state”的可能；
- 更容易单测；
- migration / default semantics 更容易证明；
- 将来改默认值时减少回归风险。

### 5.3 必须严格保持的语义

尤其不要破坏：

- 真新访客 vs 已有任意旧存储访客；
- `defaultSettings` 只有显式 true 才启用的老访客语义；
- v4 -> v5 migration；
- `backgroundPicked` 缺失时的兼容；
- `art` -> `auto` 的特定旧存储迁移；
- 深色 / 浅色不同默认材质和 blur；
- `colorMode=auto` 对系统主题变化的响应；
- 手动关闭 default settings 后不得被系统明暗切换覆盖；
- SSR 初值与 mounted 后系统主题补齐的 hydration 考量；
- PDF fallback；
- latest post/note count；
- custom background localStorage。

任何“简化”如果改变上述任意一条，都不属于本轮性能优化。

---

## 6. 暂时不要优化的地方

### 6.1 路由入场动画

`app.vue` 当前路由动画主要使用：

- `opacity`
- `transform: translate3d(...)`
- Web Animations API
- stagger delay
- reduced-motion guard
- 双 rAF 确保初始 opacity 落帧

这是浏览器比较友好的动画路径。

不要为了性能把它改成另一套 Vue Transition / CSS animation，除非 Performance trace 明确显示问题。

特别不要改变：

- 620ms duration
- `cubic-bezier(.16, 1, .3, 1)`
- 10px translate
- 18ms stagger
- 108ms delay cap

这些都属于现有效果。

### 6.2 backdrop-filter / blur 参数

不允许通过“降低 blur”“减少玻璃层”“去掉阴影”等方式获得性能。

那叫视觉降级，不叫 zero visual change optimization。

可以调查合成层和 paint，但没有证据时不要动视觉参数。

### 6.3 不要进行这些“大工程”

本轮不做：

- Pinia 引入；
- Tailwind 引入；
- CSS Modules 迁移；
- 主 CSS 强拆成大量文件；
- 滚动体系重写；
- 为了文件行数机械拆 Vue component；
- 再来一轮无目标的大规模 dead-code / CSS cleanup；
- 全站 composable 重构；
- 改 UI 设计。

---

## 7. 建议先加 instrumentation，再优化

为了避免“理论优化”，建议在本地临时 instrumentation 中统计 10 秒连续滚动：

### Before / After 指标

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

instrumentation 不应提交，或者放在明确的 dev-only probe 中。

不要在正式生产代码里留下 console spam。

### 预期现象

优化后：

- scroll event 数不会变；
- offset updater 仍大致一帧一次；
- geometry recomputation 应显著下降；
- thumb size 写入在纯滚动期间应接近 0；
- 相同 round 后 offset 的重复写入会减少；
- `data-scrolled` 在普通“从顶部滚到底”过程中应基本只有一次 true mutation；
- 视觉完全一致。

---

## 8. 验证协议

每个 patch 后都验证，不要一次改五块再查问题。

推荐顺序：

### Patch A
`data-scrolled` equality guard。

验证：

- 顶部 header；
- 滚过 8px；
- 返回顶部；
- route change；
- refresh at restored scroll position；
- mobile / desktop。

### Patch B
scrollbar geometry cache + CSS property equality guard。

验证：

- 短页面不可滚；
- 长页面可滚；
- 滚动顶部 / 中间 / 底部；
- resize；
- 页面切换后内容高度改变；
- 图片/异步内容改变高度；
- scrollbar 淡入淡出；
- 首帧无错误的 300ms delay；
- desktop fine pointer；
- mobile/coarse pointer。

### Patch C
observer 增量订阅（如果做）。

验证所有 Patch B 场景，尤其 route replacement。

### Patch D
Appearance normalization 提取。

验证：

- 无 localStorage 的新访客；
- v5 完整存储；
- v5 缺字段；
- v4 存储；
- malformed storage；
- light / dark / auto；
- defaultSettings on/off；
- system theme runtime change；
- custom background；
- backgroundPicked 缺失；
- latest count；
- PDF fallback。

---

## 9. 自动化检查

修改后至少运行仓库已有的：

- typecheck；
- generate/build；
- `check-all` 或当前等价完整检查；
- page scroll 专项检查；
- appearance 专项检查（若有）；
- CSS/产物 regression checks。

如果仓库中的 visual equivalence probe 仍只是 `tmp/` 临时工具，可以考虑在确认成熟后整理成：

`scripts/check-visual-equivalence.mjs`

但不要默认塞进每次普通 `check-all`，因为浏览器级检查可能更重。

建议独立：

```bash
npm run check:visual
```

前提是仓库现有工具链适合这样做。

---

## 10. 浏览器级等价验证

对于任何涉及 scrollbar / CSS / appearance 的修改，仅 typecheck 不够。

应比较修改前后：

- `getComputedStyle`
- bounding rect / geometry
- pseudo scrollbar（如果 probe 支持）
- DOM attributes
- CSS variables
- screenshot / visual diff（条件允许时）

视口、DOM、状态必须相同。

对于 scrollbar，可以固定若干 scrollTop：

```text
0%
25%
50%
75%
100%
```

比较：

- thumb size；
- thumb offset；
- opacity；
- track geometry。

结果必须相同。

---

## 11. 性能验证不要只看 FPS

Inkroam 在高性能桌面设备上很可能修改前后都稳定 60/120 FPS，因此 FPS 不一定能体现优化。

更有意义的是：

- 每帧 JS work 是否减少；
- style mutation 是否减少；
- forced layout 是否减少；
- layout / paint 是否减少；
- GPU/compositor 路径是否保持；
- 长任务是否减少；
- 低性能设备的 frame budget 是否更稳定。

核心思想：

> 不改变最终画面，只减少为了得到同一画面所做的重复工作。

---

## 12. 推荐执行顺序

优先级：

### P0：低风险、高确定性

1. `app.vue`：`data-scrolled` equality guard。
2. `usePageScrollable.ts`：CSS variable equality guard。
3. `usePageScrollable.ts`：geometry cache，滚动热路径只更新 position。
4. Before/After instrumentation。

### P1：中等收益、主要改善可维护性

5. Appearance normalization / migration 纯函数化。
6. 为这些纯函数补针对旧存储的测试。

### P2：测量后再决定

7. MutationObserver / ResizeObserver 增量订阅。
8. page-scroll 单一 frame scheduler。
9. visual equivalence probe 正式入库。

---

## 13. Astra 工作方式要求

未来 Astra 接手时：

1. 先读：
   - 本文；
   - `docs/engineering-retrospective-2026-09-26.md`
   - `docs/scrollbar.md`
   - `docs/browser-regression-checklist.md`
   - `docs/ui-components.md`
   - `app/composables/usePageScrollable.ts`
   - `app/utils/page-scroll.ts`
   - `app/app.vue`
   - `app/components/AppearancePanel.vue`

2. 先确认当前 `main` 是否已经发生后续变化，不要机械套用本文的代码片段。

3. 一次只做一个独立 patch。

4. 每个 patch 说明：
   - 原先做了什么重复工作；
   - 新实现为什么语义等价；
   - 哪些视觉/行为 invariant 被保留；
   - 跑了哪些测试；
   - 实测减少了多少调用 / mutation（如果可测）。

5. 如果某项优化只能获得极小收益，却需要复杂重构：
   **不做。**

6. 不要为了“完成任务”主动扩大范围。

7. 不要生成上千行重复的逐条清单。总结关键证据即可；详细机器输出放临时文件。

---

## 14. 最终目标

理想结果不是“代码看起来更高级”，而是：

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

这更接近高质量原生 UI 的优化方式：

**复杂视觉可以保留；复杂视觉不意味着每一帧都必须做复杂工作。**
