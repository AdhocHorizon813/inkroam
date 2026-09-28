# CSS 等价清理：背景与缓动

## 当前结论（2026-09-28）

### 到底清理了什么

- **材质旧配方**：液态玻璃、亚克力、云母的早期 `--surface-bg`、描边、阴影、饱和度等重复定义；保留后文实际生效的配方。
- **背景旧效果**：被覆盖的36%光斑、浅色7%/4%旧混色，以及图片滤镜、极光透明度和暗角旧声明；不是取消背景效果。
- **页面旧尺寸与排版**：例如 `.site-shell` 早期1240px/1120px宽度配方、`.hero` 多轮旧高度/内边距、标题旧字号；只保留本来最终生效的声明，未重新决定页面尺寸。
- **导航和文章旧装饰**：被后文替代的圆角、底色、阴影与边距；没有删除当前生效的卡片、边框或留白。
- **外观设置旧布局**：面板早期28px圆角、旧背景/阴影，背景选项旧三列、强调色选项旧flex布局等；现有最终7px规则、两列/grid布局仍在原处，后续主题和响应式覆盖也保留。
- **旧动画声明**：如页面入场旧420/520ms定义、面板旧淡入缩放定义、旧缓动变量；保留后文实际生效的560/640ms页面入场定义及现行面板动画，未加速、减弱或取消动效。

每一项的**完整选择器、属性、删除值、保留值及源码位置**见本文末尾“逐项清理明细”：最近一轮53组/60条，前三批110组/137条。这样可以核对具体删除，而不是只看行数。

本轮可静态证明等价的顶层重复覆盖清理已完成，累计移除197条旧声明。不是“重复数量归零”：42组涉及兼容回退、变量支持边界或不同 important 的声明被有意保留；媒体查询、supports、层及不同选择器间的覆盖未作强行合并。产品设计、最终数值和有效规则顺序不变。

本轮基线为 `eeb3c44`，工作树开始时干净；此前137条清理之上再删除60条。采用相同选择器/属性/重要性、后续无条件覆盖的边界；对函数和单位要求更保守，后值引入旧值未用的功能时保留原值。文件此次净减59行。

新增长期门禁 `scripts/check-css-cascade.mjs`，已纳入 `npm run check` 和部署检查：顶层重复项必须与 `css-cascade-exceptions.json` 中有理由的清单一致；新增覆盖会失败。优先修改已有职责规则，不为消除报错机械更新例外。该检查不宣称证明媒体分支、简写/长写、不同选择器或全部计算样式正确。

### 实测性能边界

同一依赖、同一内容、同一 `/inkroam/` 构建配置下，修改前后分别完整 generate：

| 产物 | 修改前 bytes | 修改后 bytes | 减少 |
| --- | ---: | ---: | ---: |
| 主 entry CSS | 149449 | 146556 | 2893（约1.94%） |
| 主 entry CSS gzip | 28048 | 27610 | 438（约1.56%） |
| 全部 CSS 文件合计 | 177880 | 174987 | 2893 |
| 各 CSS 独立 gzip 后合计 | 35406 | 34968 | 438 |

gzip 使用 Node zlib 默认参数离线测量，不是 CDN 实际响应体测量；全部文件合计也不是单页必然加载量。这证明交付体积下降，不能推导首屏时间、帧率或 GPU 成本改善。没有降低模糊、阴影、透明度或动画质量来换性能，也没有新增依赖。

验证：197条删除的全文件AST对照、22/22产物回归、类型检查及diff检查通过。此次CUA未发现可用浏览器，创建iab也失败，**本轮60条尚未进行浏览器视觉对照**。下方历史137条的浏览器记录不作为本轮视觉验收结果。更复杂的规则重排仍以浏览器基线为前提，不在额度紧张时冒险改写设计。

以下保留各批历史记录，其计数与验收状态仅对应当时批次。

目的：清理失效覆盖，不重新设计。基线 `ddedf86` 的 `app/assets/css/main.css`；清理前该文件无未提交改动，其它文件的既有改动保持不动。

## 第一批实际修改

| 删除的旧声明 | 保留的最终规则 | 判断依据 |
| --- | --- | --- |
| 通用现代背景的36%旧光斑渐变 | 后文同选择器 `background: #101318` | 无条件、同选择器、同属性、同重要性，后者为普通有效颜色；早期块仅保留几何职责 |
| 较早的 `--ease-fluid` | `cubic-bezier(.16, 1, .3, 1)` | 后文重复定义，数值相同 |
| 较早的 `--ease-settle` `.22,.8,.26,1` | `cubic-bezier(.2, .82, .22, 1)` | 后文同作用域变量已覆盖前值，所有使用者仍解析为后值 |
| 浅色 flat 背景7%/4%、旧衰减位置和底色 | 后文9%/6%、36%/40%衰减、`#eef0f2` | 同选择器、同 background 属性；两者使用相同渐变/color-mix/变量语法能力，不删除浏览器兼容回退 |

共删除四条声明，去掉随之清空的规则块。没有移动任何保留规则，没有改最终值、选择器、媒体条件、动效、组件模板或交互。其它有意义的主题覆盖不在本批范围内。

## 第二批：浅色背景旧覆盖

继续删除七条无条件、同选择器/同属性/同重要性的早期声明；最终规则仍在原位置：

| 属性所属元素 | 删除的早期值 | 保留的最终值 |
| --- | --- | --- |
| 浅色 body 背景 | `#f0efeb` | `#eceef1` |
| 浅色图片 filter | `saturate(.58) brightness(1.18)` | `saturate(.78) brightness(1.03) contrast(.94)` |
| 浅色图片 opacity | 重复声明 | `calc(1 - var(--background-overlay-opacity, .5))` |
| 浅色通用极光 opacity | `.08` | `.18` |
| 浅色 aurora 模式极光 opacity | `.16` | `.46` |
| 浅色暗角 opacity | 重复声明 | `var(--background-overlay-opacity, 1)` |
| 浅色暗角 background | 旧单层线性渐变 | 原本已生效的线性渐变 + 径向渐变，全部参数不变 |

兼容性核对：这批不涉及新增语法要求，图片滤镜使用同一代 CSS filter 函数，暗角仍为传统渐变与 rgba。**刻意保留**浅色 `.ambient-backdrop` 的 `background: #f0efeb`，因为后续配方用 `color-mix()`；不支持后者的环境可能需要前者回退。同选择器重复不自动意味着可以删除。

两批累计删除11条声明，文件净减25行；没有调整最终视觉参数或移动保留规则。测试清单显式增加七个删除目标，不以自动重写快照绕过对照。

## 验证

### 第三批：集中清理材质与页面的旧覆盖

按用户要求扩大单轮范围、集中验证。额外清理126条旧声明，涉及内容材质的 `--surface-*` 变量，以及导航、首页、归档、About、文章等区域的重复尺寸、间距、颜色及阴影。清单固定在 `scripts/css-cleanup-targets.json`（99个选择器/属性组），供逐项复核；不是每次运行自动扫描并删除。

筛选边界：仅无条件顶层、完全相同选择器和属性、相同 important；保留最后一条声明原位。材质自定义属性按原有级联保留最终值；普通属性仅纳入末值为传统数值/单位、普通颜色、none/transparent，或每次值完全相同的组。不跨媒体查询/层，不把简写和长写当作同属性，不删除可能需要的功能回退，不改动任何最终值。本批没有整体移动规则或拆文件。

前三批累计137条删除，main.css 相对基线净减167行。第三批集中验证结果：AST 对照、18/18源码回归、/inkroam/生产生成、21/21产物回归、git diff --check 全部通过。浏览器像素/动效验收未执行，未提交推送。旧声明多并不等于137个用户可见问题：这次处理的是维护负担，已有设计效果不是改进目标。

运行 `node scripts/check-css-cleanup.mjs ddedf86`：使用项目现有 PostCSS 解析器，确认每个目标都有后续无条件同选择器/属性/重要性声明；在基线 AST 中仅移除上述137条声明后，与当前**整份** AST 按顺序比较。忽略注释、格式及因此清空的规则壳，统一 CRLF/LF；其余规则、值和顺序必须全部相同。

该脚本是本批的可复现审计，不加入长期检查入口：后续合法 CSS 改动会使此旧基线比较失败，届时应建立新批次和新基线，不能简单更新快照后宣称等价。它不是通用 CSS 优化器，也不自行证明任意两个 CSS 值的浏览器兼容性。

本地 AST 对照、18/18 源码回归、`BASE_PATH=/inkroam/` 生产生成及21/21产物回归通过（50 HTML、1347 本地链接目标）。浏览器逐帧/像素对照未执行，不将静态证据称为视觉验收。本批以严格限定的级联等价删除降低风险；下一批若涉及规则移动、简写合并、优先级或媒体条件变化，应先取得浏览器计算样式与截图基线。

## 2026-09-27 浏览器级计算样式对照（清理之后补做）

静态 AST 只能证明级联等价，不能证明浏览器算出来的样子相同；本节补的是真实 Chromium 里的同一页面 A/B 计算样式对照。

方法：临时探针在页面内定位 dev 注入的 `style[data-vite-dev-id=".../app/assets/css/main.css"]`，把它的文本临时换成基线文本（`git show ddedf86:app/assets/css/main.css`，并按 `check-css-cleanup.mjs` 的口径把两个背景图 URL 映射到迁移后的路径），等 900ms 后逐属性采样 `getComputedStyle`（27 个选择器 × 元素全部属性 + `::-webkit-scrollbar` / `::-webkit-scrollbar-track` + `getBoundingClientRect`），随后还原再采样一次。整轮里 DOM、内联变量、视口、外观状态、图片 URL 都不变，唯一变量就是这份 CSS。

结果：现代/纸媒 × 浅色/深色 × 1440×900 / 390×844 共 8 组，**“清理版 vs 基线”与“还原后仍等于清理版”两向都是零差异**，桌面和移动分支（含触摸模拟）都在内。同轮还确认图片迁移后 4 个新路径返回 200、4 个旧的一级地址返回 404，首页/文章页/About 的真实加载只有 200 与 304。

边界：这只证明这 137 条删除没有改变计算样式与几何，不覆盖过渡与动画的逐帧表现、真机触摸、原生焦点和平台字体差异。探针目前是临时文件（`tmp/probe-visual-acceptance.mjs`，不入库），要长期复现得另建入库脚本，并且同样不进 `check-all`。四条交互路径仍按 `browser-regression-checklist.md` 待人工执行。

保留已有设计不是保留失效代码。整理应让当前设计的真实来源更清晰，而不是引入新的视觉方向。

## 逐项清理明细（2026-09-28 补充）

以下直接从 Git 基线和当前 CSS 解析生成，不用“优化了样式”概括。行号是本次记录时的定位快照，后续编辑可能变化，以选择器和属性为准。

共同删除依据：同一顶层、完全相同选择器与属性、相同 important 的后续声明已覆盖旧值；删除旧值，最终值留在原处。**表中旧值 → 保留值不是本次设计改值**，保留值在清理前就已生效。不同条件/优先级与兼容回退不能套用这一依据，保留项见 `scripts/css-cascade-exceptions.json`。

### 最近一轮：53 组，60 条旧声明

这一部分对应 eeb3c44 之后的实际改动，涵盖背景暗角、容器尺寸、导航过渡、首页排版、外观面板和页面/面板旧动画定义。

#### 1. background

```css
:root[data-visual='modern'] .ambient-vignette
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:383 | <code>linear-gradient(180deg, rgba(4, 7, 18, .06), rgba(4, 7, 18, .3) 58%, rgba(4, 7, 18, .78)), radial-gradient(ellipse at center, transparent 30%, rgba(3, 5, 16, .4) 100%)</code> |
| 保留（未改） | 当前 main.css:933 | <code>linear-gradient(180deg, rgba(0, 0, 0, .02), rgba(0, 0, 0, .18))</code> |

#### 2. width

```css
:root[data-visual='modern'] .site-shell
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:389 | <code>min(1240px, calc(100% - 40px))</code> |
| 删除旧声明 | eeb3c44:973 | <code>min(1120px, calc(100% - 40px))</code> |
| 保留（未改） | 当前 main.css:1929 | <code>min(1120px, calc(100% - 36px))</code> |

#### 3. transition

```css
:root[data-visual='modern'] .main-nav a
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:429 | <code>color 180ms var(--ease-fluid), background-color 180ms var(--ease-fluid)</code> |
| 保留（未改） | 当前 main.css:1762 | <code>color 260ms var(--ease-fluid)</code> |

#### 4. background

```css
:root[data-visual='modern'] .main-nav a:hover,
:root[data-visual='modern'] .main-nav a.router-link-active
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:435 | <code>rgba(255, 255, 255, .1)</code> |
| 保留（未改） | 当前 main.css:951 | <code>rgba(255, 255, 255, .065)</code> |

#### 5. min-height

```css
:root[data-visual='modern'] .hero
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:441 | <code>min(720px, calc(100vh - 126px))</code> |
| 删除旧声明 | eeb3c44:992 | <code>min(660px, calc(100vh - 112px))</code> |
| 删除旧声明 | eeb3c44:1581 | <code>min(720px, calc(100vh - 104px))</code> |
| 保留（未改） | 当前 main.css:1947 | <code>min(620px, calc(100vh - 92px))</code> |

#### 6. padding

```css
:root[data-visual='modern'] .hero
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:442 | <code>clamp(72px, 9vw, 122px) clamp(28px, 7vw, 88px) 72px</code> |
| 删除旧声明 | eeb3c44:993 | <code>clamp(70px, 9vw, 112px) clamp(30px, 6vw, 68px)</code> |
| 保留（未改） | 当前 main.css:1949 | <code>clamp(64px, 8vw, 94px) clamp(30px, 7vw, 76px) 58px</code> |

#### 7. backdrop-filter

```css
:root[data-visual='modern'] .hero
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:446 | <code>blur(calc(var(--glass-blur) * .45)) saturate(145%)</code> |
| 保留（未改） | 当前 main.css:956 | <code>blur(var(--glass-blur))</code> |

#### 8. -webkit-backdrop-filter

```css
:root[data-visual='modern'] .hero
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:447 | <code>blur(calc(var(--glass-blur) * .45)) saturate(145%)</code> |
| 保留（未改） | 当前 main.css:957 | <code>blur(var(--glass-blur))</code> |

#### 9. backdrop-filter

```css
:root[data-visual='modern'] .hero-aside
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:493 | <code>blur(calc(var(--glass-blur) * .8)) saturate(155%)</code> |
| 保留（未改） | 当前 main.css:975 | <code>none</code> |

#### 10. -webkit-backdrop-filter

```css
:root[data-visual='modern'] .hero-aside
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:494 | <code>blur(calc(var(--glass-blur) * .8)) saturate(155%)</code> |
| 保留（未改） | 当前 main.css:976 | <code>none</code> |

#### 11. padding-left

```css
:root[data-visual='modern'] .story-row:hover
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:532 | <code>28px</code> |
| 保留（未改） | 当前 main.css:1542 | <code>0</code> |

#### 12. margin

```css
:root[data-visual='modern'] .manifesto
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:544 | <code>22px 0</code> |
| 保留（未改） | 当前 main.css:1015 | <code>18px 0</code> |

#### 13. padding

```css
:root[data-visual='modern'] .manifesto
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:545 | <code>clamp(56px, 8vw, 88px) 8%</code> |
| 保留（未改） | 当前 main.css:1016 | <code>clamp(52px, 7vw, 78px) clamp(34px, 7vw, 74px)</code> |

#### 14. border-color

```css
:root[data-visual='modern'] .appearance-trigger
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:584 | <code>rgba(255, 255, 255, .22)</code> |
| 保留（未改） | 当前 main.css:1040 | <code>rgba(255, 255, 255, .1)</code> |

#### 15. box-shadow

```css
:root[data-visual='modern'] .appearance-trigger
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:586 | <code>0 18px 48px rgba(1, 3, 18, .35), inset 0 1px 0 rgba(255, 255, 255, .24)</code> |
| 保留（未改） | 当前 main.css:1042 | <code>0 8px 24px rgba(0, 0, 0, .18)</code> |

#### 16. backdrop-filter

```css
:root[data-visual='modern'] .appearance-trigger
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:587 | <code>blur(var(--glass-blur)) saturate(160%)</code> |
| 保留（未改） | 当前 main.css:1043 | <code>none</code> |

#### 17. -webkit-backdrop-filter

```css
:root[data-visual='modern'] .appearance-trigger
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:588 | <code>blur(var(--glass-blur)) saturate(160%)</code> |
| 保留（未改） | 当前 main.css:1044 | <code>none</code> |

#### 18. color

```css
.appearance-trigger > span:first-child
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:590 | <code>var(--modern-accent)</code> |
| 保留（未改） | 当前 main.css:1308 | <code>inherit</code> |

#### 19. width

```css
.appearance-panel
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:595 | <code>min(390px, calc(100vw - 28px))</code> |
| 保留（未改） | 当前 main.css:1896 | <code>min(390px, calc(100vw - 28px))</code> |

#### 20. border-radius

```css
.appearance-panel
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:601 | <code>28px</code> |
| 删除旧声明 | eeb3c44:1088 | <code>7px</code> |
| 保留（未改） | 当前 main.css:1899 | <code>7px</code> |

#### 21. background

```css
.appearance-panel
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:602 | <code>linear-gradient(145deg, rgba(25, 31, 61, .88), rgba(9, 13, 31, .82))</code> |
| 保留（未改） | 当前 main.css:1048 | <code>#181d24</code> |

#### 22. box-shadow

```css
.appearance-panel
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:604 | <code>0 32px 90px rgba(0, 2, 14, .52), inset 0 1px 0 rgba(255, 255, 255, .2)</code> |
| 保留（未改） | 当前 main.css:1049 | <code>0 20px 56px rgba(0, 0, 0, .28)</code> |

#### 23. backdrop-filter

```css
.appearance-panel
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:605 | <code>blur(38px) saturate(175%)</code> |
| 保留（未改） | 当前 main.css:1050 | <code>none</code> |

#### 24. -webkit-backdrop-filter

```css
.appearance-panel
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:606 | <code>blur(38px) saturate(175%)</code> |
| 保留（未改） | 当前 main.css:1051 | <code>none</code> |

#### 25. margin-bottom

```css
.appearance-panel__header
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:609 | <code>22px</code> |
| 保留（未改） | 当前 main.css:2226 | <code>14px</code> |

#### 26. border-top

```css
.setting-group
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:613 | <code>1px solid rgba(255, 255, 255, .1)</code> |
| 保留（未改） | 当前 main.css:2143 | <code>0</code> |

#### 27. margin-bottom

```css
.setting-label
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:621 | <code>11px</code> |
| 保留（未改） | 当前 main.css:2231 | <code>10px</code> |

#### 28. grid-template-columns

```css
.background-options
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:627 | <code>repeat(3, 1fr)</code> |
| 保留（未改） | 当前 main.css:1022 | <code>repeat(2, 1fr)</code> |

#### 29. display

```css
.accent-options
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:640 | <code>flex</code> |
| 保留（未改） | 当前 main.css:2086 | <code>grid</code> |

#### 30. gap

```css
.accent-options
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:640 | <code>12px</code> |
| 保留（未改） | 当前 main.css:2088 | <code>10px</code> |

#### 31. box-shadow

```css
.accent-options button
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:641 | <code>0 6px 16px color-mix(in srgb, var(--swatch) 38%, transparent)</code> |
| 保留（未改） | 当前 main.css:2093 | <code>none</code> |

#### 32. justify-content

```css
.appearance-panel__footer
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:643 | <code>space-between</code> |
| 保留（未改） | 当前 main.css:2838 | <code>flex-end</code> |

#### 33. margin

```css
:root[data-visual='modern'] .standard-page,
:root[data-visual='modern'] .article-page
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:745 | <code>20px 0 22px</code> |
| 保留（未改） | 当前 main.css:1164 | <code>18px 0</code> |

#### 34. padding

```css
:root[data-visual='modern'] .standard-page,
:root[data-visual='modern'] .article-page
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:746 | <code>clamp(54px, 7vw, 86px) clamp(24px, 6vw, 76px)</code> |
| 保留（未改） | 当前 main.css:1165 | <code>clamp(56px, 7vw, 82px) clamp(30px, 6vw, 68px)</code> |

#### 35. color

```css
:root[data-visual='modern'] .archive-year h2
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:781 | <code>color-mix(in srgb, var(--modern-accent) 78%, white)</code> |
| 保留（未改） | 当前 main.css:1174 | <code>color-mix(in srgb, var(--modern-accent) 72%, var(--modern-ink))</code> |

#### 36. border-color

```css
:root[data-visual='modern'] .archive-item:hover
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:794 | <code>color-mix(in srgb, var(--modern-accent) 48%, rgba(255, 255, 255, .16))</code> |
| 保留（未改） | 当前 main.css:1185 | <code>color-mix(in srgb, var(--modern-accent) 35%, var(--modern-line))</code> |

#### 37. background

```css
:root[data-visual='modern'] .monogram
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:813 | <code>linear-gradient(145deg, var(--modern-accent), var(--modern-cyan))</code> |
| 保留（未改） | 当前 main.css:1194 | <code>var(--modern-ink)</code> |

#### 38. border-left

```css
:root[data-visual='modern'] .about-copy blockquote
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:823 | <code>3px solid var(--modern-accent)</code> |
| 保留（未改） | 当前 main.css:1203 | <code>2px solid var(--modern-accent)</code> |

#### 39. background

```css
:root[data-visual='modern'] .article-content blockquote
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:898 | <code>linear-gradient(90deg, color-mix(in srgb, var(--modern-accent) 12%, transparent), transparent)</code> |
| 保留（未改） | 当前 main.css:1225 | <code>color-mix(in srgb, var(--modern-accent) 6%, transparent)</code> |

#### 40. background

```css
:root[data-visual='modern'] .article-end > span
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:909 | <code>linear-gradient(145deg, var(--modern-accent), var(--modern-cyan))</code> |
| 保留（未改） | 当前 main.css:1236 | <code>var(--modern-ink)</code> |

#### 41. opacity

```css
.panel-fade-enter-from,
.panel-fade-leave-to
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1349 | <code>0</code> |
| 删除旧声明 | eeb3c44:1467 | <code>0</code> |
| 保留（未改） | 当前 main.css:1568 | <code>1</code> |

#### 42. transform

```css
.panel-fade-enter-from,
.panel-fade-leave-to
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1350 | <code>translate3d(0, 6px, 0)</code> |
| 删除旧声明 | eeb3c44:1467 | <code>translate3d(0, 8px, 0) scale(.985)</code> |
| 保留（未改） | 当前 main.css:1569 | <code>translate3d(0, 50px, 0)</code> |

#### 43. transition

```css
.page-enter-active
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1459 | <code>opacity 420ms var(--ease-fluid), transform 520ms var(--ease-settle)</code> |
| 保留（未改） | 当前 main.css:2028 | <code>opacity 560ms var(--ease-fluid), transform 640ms var(--ease-settle)</code> |

#### 44. transition

```css
.page-leave-active
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1460 | <code>opacity 140ms var(--ease-exit), transform 180ms var(--ease-fluid)</code> |
| 保留（未改） | 当前 main.css:2031 | <code>opacity 220ms var(--ease-exit), transform 260ms var(--ease-fluid)</code> |

#### 45. opacity

```css
.page-enter-from
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1461 | <code>0</code> |
| 保留（未改） | 当前 main.css:2057 | <code>0</code> |

#### 46. transform

```css
.page-enter-from
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1461 | <code>translate3d(0, 8px, 0)</code> |
| 保留（未改） | 当前 main.css:2058 | <code>translate3d(0, 7px, 0)</code> |

#### 47. opacity

```css
.page-leave-to
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1462 | <code>0</code> |
| 保留（未改） | 当前 main.css:2061 | <code>0</code> |

#### 48. transform

```css
.page-leave-to
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1462 | <code>translate3d(0, -3px, 0)</code> |
| 保留（未改） | 当前 main.css:2062 | <code>translate3d(0, -2px, 0)</code> |

#### 49. transition

```css
.panel-fade-enter-active
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1464 | <code>opacity 220ms var(--ease-fluid), transform 440ms var(--ease-settle)</code> |
| 保留（未改） | 当前 main.css:1559 | <code>transform 520ms var(--ease-settle), clip-path 520ms var(--ease-settle)</code> |

#### 50. transition

```css
.panel-fade-leave-active
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1465 | <code>opacity 130ms var(--ease-exit), transform 180ms var(--ease-fluid)</code> |
| 保留（未改） | 当前 main.css:1564 | <code>transform 260ms var(--ease-fluid), clip-path 260ms var(--ease-fluid)</code> |

#### 51. font-size

```css
:root[data-visual='modern'] .hero h1
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1583 | <code>clamp(58px, 7.4vw, 106px)</code> |
| 保留（未改） | 当前 main.css:1954 | <code>clamp(52px, 6.6vw, 88px)</code> |

#### 52. font-size

```css
:root[data-visual='modern'] .section-heading h2
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:1588 | <code>clamp(34px, 4vw, 52px)</code> |
| 保留（未改） | 当前 main.css:1961 | <code>clamp(30px, 3.5vw, 44px)</code> |

#### 53. min-width

```css
.route-frame
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | eeb3c44:2084 | <code>0</code> |
| 保留（未改） | 当前 main.css:2067 | <code>0</code> |

### 前三批：110 组，137 条旧声明

<details>
<summary>展开此前 137 条清理的完整旧值与保留值</summary>


#### 1. background

```css
:root[data-visual='modern'] .ambient-backdrop
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:356 | <code>radial-gradient(circle at 18% 10%, color-mix(in srgb, var(--background-tint) 36%, transparent), transparent 36%), radial-gradient(circle at 82% 20%, rgba(65, 207, 255, .2), transparent 33%), linear-gradient(145deg, #0a0f22 0%, #161634 48%, #080b18 100%)</code> |
| 保留（未改） | 当前 main.css:925 | <code>#101318</code> |

#### 2. --ease-fluid

```css
:root
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1578 | <code>cubic-bezier(.16, 1, .3, 1)</code> |
| 保留（未改） | 当前 main.css:2036 | <code>cubic-bezier(.16, 1, .3, 1)</code> |

#### 3. --ease-settle

```css
:root
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1579 | <code>cubic-bezier(.22, .8, .26, 1)</code> |
| 保留（未改） | 当前 main.css:2037 | <code>cubic-bezier(.2, .82, .22, 1)</code> |

#### 4. background

```css
:root[data-visual='modern'][data-color-mode='light'][data-background='flat'] .ambient-backdrop
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1838 | <code>radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--background-tint) 7%, transparent), transparent 34%), radial-gradient(circle at 82% 76%, color-mix(in srgb, var(--background-tint) 4%, transparent), transparent 38%), #f0efeb</code> |
| 保留（未改） | 当前 main.css:2535 | <code>radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--background-tint) 9%, transparent), transparent 36%), radial-gradient(circle at 82% 76%, color-mix(in srgb, var(--background-tint) 6%, transparent), transparent 40%), #eef0f2</code> |

#### 5. background

```css
:root[data-visual='modern'][data-color-mode='light'] body
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1266 | <code>#f0efeb</code> |
| 保留（未改） | 当前 main.css:2513 | <code>#eceef1</code> |

#### 6. filter

```css
:root[data-visual='modern'][data-color-mode='light'] .ambient-image
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1275 | <code>saturate(.58) brightness(1.18)</code> |
| 保留（未改） | 当前 main.css:2522 | <code>saturate(.78) brightness(1.03) contrast(.94)</code> |

#### 7. opacity

```css
:root[data-visual='modern'][data-color-mode='light'] .ambient-image
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1276 | <code>calc(1 - var(--background-overlay-opacity, .5))</code> |
| 保留（未改） | 当前 main.css:2523 | <code>calc(1 - var(--background-overlay-opacity, .5))</code> |

#### 8. opacity

```css
:root[data-visual='modern'][data-color-mode='light'] .ambient-aurora
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1278 | <code>.08</code> |
| 保留（未改） | 当前 main.css:2526 | <code>.18</code> |

#### 9. opacity

```css
:root[data-visual='modern'][data-color-mode='light'][data-background='aurora'] .ambient-aurora
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1279 | <code>.16</code> |
| 保留（未改） | 当前 main.css:2527 | <code>.46</code> |

#### 10. opacity

```css
:root[data-visual='modern'][data-color-mode='light'] .ambient-vignette::before
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1281 | <code>var(--background-overlay-opacity, 1)</code> |
| 保留（未改） | 当前 main.css:2529 | <code>var(--background-overlay-opacity, 1)</code> |

#### 11. background

```css
:root[data-visual='modern'][data-color-mode='light'] .ambient-vignette::before
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1282 | <code>linear-gradient(180deg, rgba(255, 255, 255, .12), rgba(240, 239, 235, .62))</code> |
| 保留（未改） | 当前 main.css:2530 | <code>linear-gradient(180deg, rgba(255, 255, 255, .04), rgba(244, 245, 247, .16) 58%, rgba(232, 235, 239, .38)), radial-gradient(ellipse at center, transparent 42%, rgba(234, 237, 241, .26) 100%)</code> |

#### 12. --surface-bg

```css
:root[data-visual='modern'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:312 | <code>linear-gradient(135deg, rgba(29, 35, 67, .48), rgba(12, 17, 38, .28))</code> |
| 删除旧声明 | ddedf86:1047 | <code>rgba(22, 26, 33, .76)</code> |
| 保留（未改） | 当前 main.css:1453 | <code>rgba(24, 28, 35, .68)</code> |

#### 13. --surface-bg-strong

```css
:root[data-visual='modern'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:313 | <code>linear-gradient(135deg, rgba(28, 34, 67, .68), rgba(10, 14, 32, .48))</code> |
| 删除旧声明 | ddedf86:1048 | <code>rgba(19, 23, 29, .84)</code> |
| 保留（未改） | 当前 main.css:1454 | <code>rgba(18, 22, 28, .34)</code> |

#### 14. --surface-border

```css
:root[data-visual='modern'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:314 | <code>rgba(255, 255, 255, .2)</code> |
| 删除旧声明 | ddedf86:1049 | <code>rgba(255, 255, 255, .1)</code> |
| 保留（未改） | 当前 main.css:1455 | <code>rgba(255, 255, 255, .2)</code> |

#### 15. --surface-shadow

```css
:root[data-visual='modern'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:315 | <code>0 24px 80px rgba(1, 3, 14, .32), inset 0 1px 0 rgba(255, 255, 255, .24)</code> |
| 删除旧声明 | ddedf86:1050 | <code>0 14px 40px rgba(0, 0, 0, .16)</code> |
| 保留（未改） | 当前 main.css:1456 | <code>0 12px 36px rgba(0, 0, 0, .16)</code> |

#### 16. --surface-saturation

```css
:root[data-visual='modern'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:316 | <code>165%</code> |
| 删除旧声明 | ddedf86:1051 | <code>105%</code> |
| 保留（未改） | 当前 main.css:1457 | <code>125%</code> |

#### 17. --surface-bg

```css
:root[data-visual='modern'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:320 | <code>rgba(14, 20, 43, .62)</code> |
| 删除旧声明 | ddedf86:1055 | <code>rgba(24, 28, 35, .62)</code> |
| 保留（未改） | 当前 main.css:1417 | <code>rgba(22, 26, 33, .46)</code> |

#### 18. --surface-bg-strong

```css
:root[data-visual='modern'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:321 | <code>rgba(10, 15, 34, .78)</code> |
| 删除旧声明 | ddedf86:1056 | <code>rgba(20, 24, 30, .78)</code> |
| 保留（未改） | 当前 main.css:1418 | <code>rgba(18, 22, 28, .56)</code> |

#### 19. --surface-border

```css
:root[data-visual='modern'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:322 | <code>rgba(255, 255, 255, .13)</code> |
| 删除旧声明 | ddedf86:1057 | <code>rgba(255, 255, 255, .09)</code> |
| 保留（未改） | 当前 main.css:1419 | <code>rgba(255, 255, 255, .12)</code> |

#### 20. --surface-shadow

```css
:root[data-visual='modern'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:323 | <code>0 28px 72px rgba(0, 3, 16, .4), inset 0 1px 0 rgba(255, 255, 255, .12)</code> |
| 删除旧声明 | ddedf86:1058 | <code>0 12px 34px rgba(0, 0, 0, .14)</code> |
| 保留（未改） | 当前 main.css:1420 | <code>0 12px 36px rgba(0, 0, 0, .16)</code> |

#### 21. --surface-saturation

```css
:root[data-visual='modern'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:324 | <code>135%</code> |
| 删除旧声明 | ddedf86:1059 | <code>100%</code> |
| 保留（未改） | 当前 main.css:1421 | <code>135%</code> |

#### 22. --surface-bg

```css
:root[data-visual='modern'][data-material='mica']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:328 | <code>color-mix(in srgb, #171d38 84%, var(--modern-accent) 16%)</code> |
| 保留（未改） | 当前 main.css:916 | <code>rgba(23, 27, 34, .62)</code> |

#### 23. --surface-bg-strong

```css
:root[data-visual='modern'][data-material='mica']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:329 | <code>color-mix(in srgb, #0e142c 88%, var(--modern-accent) 12%)</code> |
| 保留（未改） | 当前 main.css:917 | <code>rgba(20, 24, 30, .78)</code> |

#### 24. --surface-border

```css
:root[data-visual='modern'][data-material='mica']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:330 | <code>color-mix(in srgb, var(--modern-accent) 18%, rgba(255, 255, 255, .14))</code> |
| 保留（未改） | 当前 main.css:918 | <code>rgba(255, 255, 255, .08)</code> |

#### 25. --surface-shadow

```css
:root[data-visual='modern'][data-material='mica']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:331 | <code>0 22px 65px rgba(2, 4, 18, .36), inset 0 1px 0 rgba(255, 255, 255, .1)</code> |
| 保留（未改） | 当前 main.css:919 | <code>0 10px 30px rgba(0, 0, 0, .13)</code> |

#### 26. --surface-saturation

```css
:root[data-visual='modern'][data-material='mica']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:332 | <code>120%</code> |
| 保留（未改） | 当前 main.css:920 | <code>100%</code> |

#### 27. background

```css
:root[data-visual='modern'] body
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:339 | <code>#080b18</code> |
| 保留（未改） | 当前 main.css:923 | <code>#101318</code> |

#### 28. opacity

```css
:root[data-visual='modern'] .ambient-aurora
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:402 | <code>.26</code> |
| 保留（未改） | 当前 main.css:930 | <code>.12</code> |

#### 29. opacity

```css
:root[data-visual='modern'][data-background='aurora'] .ambient-aurora
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:405 | <code>.62</code> |
| 保留（未改） | 当前 main.css:931 | <code>.3</code> |

#### 30. top

```css
:root[data-visual='modern'] .site-header
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:422 | <code>18px</code> |
| 删除旧声明 | ddedf86:1085 | <code>14px</code> |
| 保留（未改） | 当前 main.css:1932 | <code>14px</code> |

#### 31. height

```css
:root[data-visual='modern'] .site-header
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:424 | <code>70px</code> |
| 删除旧声明 | ddedf86:1086 | <code>62px</code> |
| 删除旧声明 | ddedf86:1734 | <code>58px</code> |
| 保留（未改） | 当前 main.css:1934 | <code>54px</code> |

#### 32. padding

```css
:root[data-visual='modern'] .site-header
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:425 | <code>0 18px 0 14px</code> |
| 保留（未改） | 当前 main.css:937 | <code>0 14px</code> |

#### 33. border-radius

```css
:root[data-visual='modern'] .site-header
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:427 | <code>24px</code> |
| 删除旧声明 | ddedf86:1088 | <code>12px</code> |
| 保留（未改） | 当前 main.css:1936 | <code>14px</code> |

#### 34. background

```css
:root[data-visual='modern'] .site-header
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:428 | <code>var(--surface-bg-strong)</code> |
| 保留（未改） | 当前 main.css:938 | <code>var(--surface-bg-strong)</code> |

#### 35. letter-spacing

```css
:root[data-visual='modern'] .brand
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:451 | <code>.04em</code> |
| 保留（未改） | 当前 main.css:1525 | <code>-.01em</code> |

#### 36. width

```css
:root[data-visual='modern'] .brand-mark
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:455 | <code>40px</code> |
| 删除旧声明 | ddedf86:1097 | <code>34px</code> |
| 保留（未改） | 当前 main.css:1940 | <code>32px</code> |

#### 37. height

```css
:root[data-visual='modern'] .brand-mark
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:456 | <code>40px</code> |
| 删除旧声明 | ddedf86:1098 | <code>34px</code> |
| 保留（未改） | 当前 main.css:1941 | <code>32px</code> |

#### 38. color

```css
:root[data-visual='modern'] .brand-mark
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:457 | <code>#fff</code> |
| 保留（未改） | 当前 main.css:948 | <code>#15191f</code> |

#### 39. box-shadow

```css
:root[data-visual='modern'] .brand-mark
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:459 | <code>0 8px 28px color-mix(in srgb, var(--modern-accent) 44%, transparent), inset 0 1px 1px rgba(255, 255, 255, .5)</code> |
| 删除旧声明 | ddedf86:1102 | <code>none</code> |
| 保留（未改） | 当前 main.css:1943 | <code>none</code> |

#### 40. padding

```css
:root[data-visual='modern'] .main-nav a
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:465 | <code>9px 14px</code> |
| 保留（未改） | 当前 main.css:1759 | <code>8px 12px</code> |

#### 41. border-radius

```css
:root[data-visual='modern'] .main-nav a
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:466 | <code>14px</code> |
| 删除旧声明 | ddedf86:1104 | <code>7px</code> |
| 保留（未改） | 当前 main.css:1760 | <code>9px</code> |

#### 42. font-size

```css
:root[data-visual='modern'] .main-nav a
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:468 | <code>13px</code> |
| 保留（未改） | 当前 main.css:1526 | <code>12px</code> |

#### 43. margin-top

```css
:root[data-visual='modern'] .hero
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:482 | <code>20px</code> |
| 删除旧声明 | ddedf86:1110 | <code>18px</code> |
| 保留（未改） | 当前 main.css:1948 | <code>14px</code> |

#### 44. border-radius

```css
:root[data-visual='modern'] .hero
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:486 | <code>38px</code> |
| 删除旧声明 | ddedf86:1112 | <code>16px</code> |
| 保留（未改） | 当前 main.css:1950 | <code>18px</code> |

#### 45. box-shadow

```css
:root[data-visual='modern'] .hero
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:488 | <code>var(--surface-shadow)</code> |
| 保留（未改） | 当前 main.css:955 | <code>var(--surface-shadow)</code> |

#### 46. max-width

```css
:root[data-visual='modern'] .hero h1
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:525 | <code>760px</code> |
| 删除旧声明 | ddedf86:1739 | <code>900px</code> |
| 保留（未改） | 当前 main.css:1953 | <code>820px</code> |

#### 47. letter-spacing

```css
:root[data-visual='modern'] .hero h1
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:527 | <code>-.065em</code> |
| 删除旧声明 | ddedf86:1122 | <code>-.055em</code> |
| 删除旧声明 | ddedf86:1743 | <code>-.065em</code> |
| 保留（未改） | 当前 main.css:1955 | <code>-.055em</code> |

#### 48. text-shadow

```css
:root[data-visual='modern'] .hero h1
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:529 | <code>0 12px 42px rgba(4, 6, 20, .4)</code> |
| 保留（未改） | 当前 main.css:962 | <code>none</code> |

#### 49. color

```css
:root[data-visual='modern'] .hero h1 em
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:533 | <code>transparent</code> |
| 保留（未改） | 当前 main.css:965 | <code>#b8c7db</code> |

#### 50. background

```css
:root[data-visual='modern'] .hero h1 em
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:534 | <code>linear-gradient(105deg, #fff 4%, var(--modern-accent) 44%, var(--modern-cyan))</code> |
| 保留（未改） | 当前 main.css:966 | <code>none</code> |

#### 51. padding

```css
:root[data-visual='modern'] .hero-aside
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:541 | <code>26px</code> |
| 保留（未改） | 当前 main.css:969 | <code>24px 0 24px 28px</code> |

#### 52. border

```css
:root[data-visual='modern'] .hero-aside
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:542 | <code>1px solid rgba(255, 255, 255, .17)</code> |
| 保留（未改） | 当前 main.css:970 | <code>0</code> |

#### 53. border-radius

```css
:root[data-visual='modern'] .hero-aside
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:543 | <code>24px</code> |
| 保留（未改） | 当前 main.css:972 | <code>0</code> |

#### 54. background

```css
:root[data-visual='modern'] .hero-aside
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:544 | <code>rgba(8, 12, 30, .28)</code> |
| 保留（未改） | 当前 main.css:973 | <code>transparent</code> |

#### 55. box-shadow

```css
:root[data-visual='modern'] .hero-aside
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:545 | <code>inset 0 1px 0 rgba(255, 255, 255, .13), 0 16px 44px rgba(1, 3, 14, .18)</code> |
| 保留（未改） | 当前 main.css:974 | <code>none</code> |

#### 56. padding

```css
:root[data-visual='modern'] .text-link
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:557 | <code>9px 14px</code> |
| 保留（未改） | 当前 main.css:979 | <code>8px 0</code> |

#### 57. border

```css
:root[data-visual='modern'] .text-link
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:558 | <code>1px solid rgba(255, 255, 255, .17)</code> |
| 保留（未改） | 当前 main.css:980 | <code>0</code> |

#### 58. border-radius

```css
:root[data-visual='modern'] .text-link
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:559 | <code>999px</code> |
| 保留（未改） | 当前 main.css:982 | <code>0</code> |

#### 59. background

```css
:root[data-visual='modern'] .text-link
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:560 | <code>rgba(255, 255, 255, .08)</code> |
| 保留（未改） | 当前 main.css:983 | <code>transparent</code> |

#### 60. background

```css
:root[data-visual='modern'] .text-link:hover
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:566 | <code>color-mix(in srgb, var(--modern-accent) 22%, transparent)</code> |
| 保留（未改） | 当前 main.css:987 | <code>transparent</code> |

#### 61. margin-top

```css
:root[data-visual='modern'] .latest-section
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:571 | <code>22px</code> |
| 保留（未改） | 当前 main.css:991 | <code>18px</code> |

#### 62. border-radius

```css
:root[data-visual='modern'] .latest-section
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:574 | <code>34px</code> |
| 保留（未改） | 当前 main.css:993 | <code>16px</code> |

#### 63. background

```css
:root[data-visual='modern'] .latest-section
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:575 | <code>var(--surface-bg)</code> |
| 保留（未改） | 当前 main.css:994 | <code>var(--surface-bg)</code> |

#### 64. box-shadow

```css
:root[data-visual='modern'] .latest-section
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:576 | <code>var(--surface-shadow)</code> |
| 保留（未改） | 当前 main.css:995 | <code>var(--surface-shadow)</code> |

#### 65. letter-spacing

```css
:root[data-visual='modern'] .section-heading h2
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:585 | <code>-.045em</code> |
| 保留（未改） | 当前 main.css:1532 | <code>-.045em</code> |

#### 66. padding

```css
:root[data-visual='modern'] .story-row
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:591 | <code>28px</code> |
| 保留（未改） | 当前 main.css:999 | <code>28px 0</code> |

#### 67. border

```css
:root[data-visual='modern'] .story-row
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:593 | <code>1px solid rgba(255, 255, 255, .11)</code> |
| 保留（未改） | 当前 main.css:1000 | <code>0</code> |

#### 68. border-radius

```css
:root[data-visual='modern'] .story-row
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:594 | <code>22px</code> |
| 保留（未改） | 当前 main.css:1002 | <code>0</code> |

#### 69. background

```css
:root[data-visual='modern'] .story-row
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:595 | <code>linear-gradient(135deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .025))</code> |
| 保留（未改） | 当前 main.css:1003 | <code>transparent</code> |

#### 70. box-shadow

```css
:root[data-visual='modern'] .story-row
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:596 | <code>inset 0 1px 0 rgba(255, 255, 255, .08)</code> |
| 保留（未改） | 当前 main.css:1004 | <code>none</code> |

#### 71. background

```css
:root[data-visual='modern'] .story-row:hover
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:602 | <code>linear-gradient(135deg, color-mix(in srgb, var(--modern-accent) 7%, rgba(255, 255, 255, .07)), rgba(255, 255, 255, .03))</code> |
| 保留（未改） | 当前 main.css:1008 | <code>transparent</code> |

#### 72. color

```css
:root[data-visual='modern'] .story-meta
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:605 | <code>var(--modern-accent)</code> |
| 保留（未改） | 当前 main.css:1010 | <code>#9aaecb</code> |

#### 73. letter-spacing

```css
:root[data-visual='modern'] .story-body h3
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:609 | <code>-.035em</code> |
| 保留（未改） | 当前 main.css:1533 | <code>-.04em</code> |

#### 74. border-radius

```css
:root[data-visual='modern'] .manifesto
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:618 | <code>34px</code> |
| 保留（未改） | 当前 main.css:1017 | <code>16px</code> |

#### 75. background

```css
:root[data-visual='modern'] .manifesto
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:619 | <code>var(--surface-bg)</code> |
| 保留（未改） | 当前 main.css:1018 | <code>var(--surface-bg)</code> |

#### 76. box-shadow

```css
:root[data-visual='modern'] .manifesto
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:620 | <code>var(--surface-shadow)</code> |
| 保留（未改） | 当前 main.css:1019 | <code>var(--surface-shadow)</code> |

#### 77. background

```css
:root[data-visual='modern'] .appearance-trigger
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:659 | <code>linear-gradient(135deg, rgba(37, 43, 78, .68), rgba(13, 18, 40, .48))</code> |
| 保留（未改） | 当前 main.css:1041 | <code>#1a1f27</code> |

#### 78. border-radius

```css
:root[data-visual='modern'] .standard-page,
:root[data-visual='modern'] .article-page
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:823 | <code>38px</code> |
| 保留（未改） | 当前 main.css:1166 | <code>16px</code> |

#### 79. background

```css
:root[data-visual='modern'] .standard-page,
:root[data-visual='modern'] .article-page
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:824 | <code>var(--surface-bg)</code> |
| 保留（未改） | 当前 main.css:1167 | <code>var(--surface-bg)</code> |

#### 80. box-shadow

```css
:root[data-visual='modern'] .standard-page,
:root[data-visual='modern'] .article-page
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:825 | <code>var(--surface-shadow)</code> |
| 保留（未改） | 当前 main.css:1168 | <code>var(--surface-shadow)</code> |

#### 81. padding

```css
:root[data-visual='modern'] .archive-item
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:868 | <code>19px 20px</code> |
| 保留（未改） | 当前 main.css:1178 | <code>21px 0</code> |

#### 82. border

```css
:root[data-visual='modern'] .archive-item
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:869 | <code>1px solid rgba(255, 255, 255, .1)</code> |
| 保留（未改） | 当前 main.css:1179 | <code>0</code> |

#### 83. border-radius

```css
:root[data-visual='modern'] .archive-item
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:870 | <code>17px</code> |
| 保留（未改） | 当前 main.css:1181 | <code>0</code> |

#### 84. background

```css
:root[data-visual='modern'] .archive-item
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:871 | <code>rgba(255, 255, 255, .045)</code> |
| 保留（未改） | 当前 main.css:1182 | <code>transparent</code> |

#### 85. background

```css
:root[data-visual='modern'] .archive-item:hover
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:877 | <code>color-mix(in srgb, var(--modern-accent) 7%, rgba(255, 255, 255, .05))</code> |
| 保留（未改） | 当前 main.css:1186 | <code>transparent</code> |

#### 86. box-shadow

```css
:root[data-visual='modern'] .monogram
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:898 | <code>0 18px 50px color-mix(in srgb, var(--modern-accent) 33%, transparent), inset 0 1px 1px rgba(255, 255, 255, .5)</code> |
| 保留（未改） | 当前 main.css:1196 | <code>none</code> |

#### 87. padding

```css
:root[data-visual='modern'] .about-copy blockquote
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:907 | <code>24px 28px</code> |
| 保留（未改） | 当前 main.css:1201 | <code>20px 24px</code> |

#### 88. border

```css
:root[data-visual='modern'] .about-copy blockquote
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:908 | <code>1px solid rgba(255, 255, 255, .12)</code> |
| 保留（未改） | 当前 main.css:1202 | <code>0</code> |

#### 89. border-radius

```css
:root[data-visual='modern'] .about-copy blockquote
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:910 | <code>0 18px 18px 0</code> |
| 保留（未改） | 当前 main.css:1204 | <code>0</code> |

#### 90. padding

```css
:root[data-visual='modern'] .article-content
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:979 | <code>clamp(28px, 5vw, 58px)</code> |
| 保留（未改） | 当前 main.css:1215 | <code>0</code> |

#### 91. border

```css
:root[data-visual='modern'] .article-content
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:980 | <code>1px solid rgba(255, 255, 255, .12)</code> |
| 保留（未改） | 当前 main.css:1216 | <code>0</code> |

#### 92. border-radius

```css
:root[data-visual='modern'] .article-content
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:981 | <code>28px</code> |
| 保留（未改） | 当前 main.css:1217 | <code>0</code> |

#### 93. background

```css
:root[data-visual='modern'] .article-content
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:982 | <code>rgba(5, 9, 24, .4)</code> |
| 保留（未改） | 当前 main.css:1218 | <code>transparent</code> |

#### 94. box-shadow

```css
:root[data-visual='modern'] .article-content
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:983 | <code>inset 0 1px 0 rgba(255, 255, 255, .08), 0 24px 56px rgba(0, 2, 14, .2)</code> |
| 保留（未改） | 当前 main.css:1219 | <code>none</code> |

#### 95. box-shadow

```css
:root[data-visual='modern'] .article-end > span
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1005 | <code>0 12px 34px color-mix(in srgb, var(--modern-accent) 32%, transparent)</code> |
| 保留（未改） | 当前 main.css:1238 | <code>none</code> |

#### 96. padding

```css
:root[data-visual='modern'] .tag-results
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1009 | <code>28px</code> |
| 保留（未改） | 当前 main.css:1240 | <code>0</code> |

#### 97. font-weight

```css
:root[data-visual='modern'] .hero h1
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1121 | <code>620</code> |
| 保留（未改） | 当前 main.css:1528 | <code>610</code> |

#### 98. --surface-bg

```css
:root[data-visual='modern'][data-color-mode='light'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1246 | <code>rgba(250, 249, 246, .78)</code> |
| 删除旧声明 | ddedf86:1667 | <code>rgba(250, 249, 246, .78)</code> |
| 保留（未改） | 当前 main.css:2551 | <code>rgba(250, 249, 246, .52)</code> |

#### 99. --surface-bg-strong

```css
:root[data-visual='modern'][data-color-mode='light'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1247 | <code>rgba(253, 252, 249, .86)</code> |
| 删除旧声明 | ddedf86:1668 | <code>rgba(255, 255, 255, .34)</code> |
| 保留（未改） | 当前 main.css:2552 | <code>rgba(255, 255, 255, .3)</code> |

#### 100. --surface-border

```css
:root[data-visual='modern'][data-color-mode='light'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1248 | <code>rgba(28, 34, 42, .11)</code> |
| 保留（未改） | 当前 main.css:1460 | <code>rgba(255, 255, 255, .66)</code> |

#### 101. --surface-shadow

```css
:root[data-visual='modern'][data-color-mode='light'][data-material='liquid']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1249 | <code>0 12px 34px rgba(34, 39, 46, .075)</code> |
| 保留（未改） | 当前 main.css:1461 | <code>0 10px 30px rgba(35, 40, 48, .1)</code> |

#### 102. --surface-bg

```css
:root[data-visual='modern'][data-color-mode='light'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1253 | <code>rgba(248, 247, 243, .62)</code> |
| 删除旧声明 | ddedf86:1629 | <code>rgba(250, 249, 246, .5)</code> |
| 保留（未改） | 当前 main.css:2555 | <code>rgba(250, 249, 246, .46)</code> |

#### 103. --surface-bg-strong

```css
:root[data-visual='modern'][data-color-mode='light'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1254 | <code>rgba(253, 252, 249, .74)</code> |
| 删除旧声明 | ddedf86:1630 | <code>rgba(253, 252, 249, .6)</code> |
| 保留（未改） | 当前 main.css:2556 | <code>rgba(253, 252, 249, .58)</code> |

#### 104. --surface-border

```css
:root[data-visual='modern'][data-color-mode='light'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1255 | <code>rgba(28, 34, 42, .1)</code> |
| 保留（未改） | 当前 main.css:1424 | <code>rgba(28, 34, 42, .11)</code> |

#### 105. --surface-shadow

```css
:root[data-visual='modern'][data-color-mode='light'][data-material='acrylic']
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1256 | <code>0 10px 30px rgba(34, 39, 46, .065)</code> |
| 保留（未改） | 当前 main.css:1425 | <code>0 12px 34px rgba(34, 39, 46, .08)</code> |

#### 106. color

```css
:root[data-visual='modern'][data-color-mode='light'] .brand-mark
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1286 | <code>#fff</code> |
| 保留（未改） | 当前 main.css:2081 | <code>#fff</code> |

#### 107. color

```css
:root[data-visual='modern'][data-color-mode='light'] .main-nav a:hover,
:root[data-visual='modern'][data-color-mode='light'] .main-nav a.router-link-active
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1290 | <code>#20242a</code> |
| 保留（未改） | 当前 main.css:1767 | <code>#171a1f</code> |

#### 108. box-shadow

```css
:root[data-visual='modern']:is([data-background='flat'], [data-background='theme']) .hero,
:root[data-visual='modern']:is([data-background='flat'], [data-background='theme']) .latest-section,
:root[data-visual='modern']:is([data-background='flat'], [data-background='theme']) .manifesto,
:root[data-visual='modern']:is([data-background='flat'], [data-background='theme']) .standard-page,
:root[data-visual='modern']:is([data-background='flat'], [data-background='theme']) .article-page
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1477 | <code>none</code> |
| 保留（未改） | 当前 main.css:2261 | <code>none</code> |

#### 109. font-size

```css
:root[data-visual='modern'] .brand
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:1735 | <code>13px</code> |
| 保留（未改） | 当前 main.css:1938 | <code>12px</code> |

#### 110. opacity

```css
:root[data-visual='modern'] .ambient-vignette
```

| 操作 | 位置 | 声明值 |
| --- | --- | --- |
| 删除旧声明 | ddedf86:2929 | <code>var(--background-overlay-opacity, 1)</code> |
| 保留（未改） | 当前 main.css:2756 | <code>var(--background-overlay-opacity, 1)</code> |

</details>
