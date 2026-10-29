# 实验性玻璃退出生命周期与指示器矩形修复

日期：2026-10-30。

远端实现提交：`8f7daedf`（退出生命周期）、`b566472f`（指示器镜片圆角）、`1394a73c`（恢复滑条原位折射）。三个实现提交均保留在 `fix/glass-exit-lifecycle`。

基线：`9fc8815c3c94c12c746408f0c7b5607789b9dc71`。

## 修复范围

- 保留搜索下拉、日历、阅读外观、液态玻璃子页、参数折叠区和音乐面板在退出过程中的光学资源。
- 关闭完成后休眠已解码镜片，停止背景合成；移除组件或关闭实验时销毁资源。
- 修复 Chromium 原生锚点定位路径漏同步指示器镜片 CSS 圆角产生的浅色矩形。
- 恢复滑条早期有效的原位滤镜路径：滑块在自己的滑轨上方采样，进度球、音量和设置滑条均不再使用面板外置镜片。
- 保留滑条原有“静止白色、按压透明”的覆盖层。
- 不修改用户的折射、通透度、抗锯齿、采样预算或弹簧参数。

## 根因

| 对象 | 提前失去材质或绘制异常的路径 |
| --- | --- |
| 搜索下拉、日历 | `open=false` 立即添加 `inert`；候选过滤器因此删除仍在退出的宿主，300ms 指令保留期未能阻止控制器销毁。Popover 另有独立 190ms 定时器。 |
| 阅读外观面板、音乐面板 | 同样将 `inert` 错当成不可见。音乐面板另有 visibility 事件与 240ms 定时器控制休眠，存在多个生命周期所有者。 |
| 一级、二级阅读设置 | `data-glass-page-hidden` 或 `inert` 立即隐藏移出滚动容器的镜片；原页面仍在执行 transform/opacity 退出动画。镜片只追踪进入页。 |
| 参数折叠区 | 业务状态立即取消注册，镜片又被 hidden/inert 门控。grid 退出为 380ms，旧全局 300ms 保留时间也不足。 |
| 分项滑动指示器的浅色矩形 | 原生 CSS anchor 路径只同步位置和尺寸，提前返回，漏掉 `border-radius`。实际背景滤镜绘制盒为直角，原滑块为圆角。圆角 SVG 位移图不能代替 CSS 背景滤镜绘制盒的圆角。 |

滑条回归与白色静止外观不同：早期 `b8ec896` 把真实滤镜直接挂在滑块上。之后将所有控件镜片移到面板滚动容器之前，滑条镜片也随之移出，滑轨却在后续的滚动内容中绘制，镜片因绘制顺序无法采样自己的滑轨。现在仅指示器保留外置镜片；thumb 的 `lens=host`，恢复原滑轨上方的绘制顺序，并自然继承滚动、裁剪、透明度和全屏形变。没有删掉白色静止外观，也没有调大折射参数。

原位镜片休眠唤醒会恢复原来的 inline visibility；销毁时完整恢复该属性，避免重开后继续被 hidden 隐藏。

`inert` 负责禁止交互，不能作为背景光学层是否仍应绘制的依据。音乐全屏模式还会把背景兄弟节点设为 inert；它们仍可能可见，也不应因此退化。

## 生命周期

`data-glass-presence` 由动画所有者维护：

| 阶段 | 行为 |
| --- | --- |
| opening | 注册/唤醒镜片，取消前一次关闭的异步释放任务。 |
| open | 保留已解码镜片及正常弹簧交互。 |
| closing | 立即禁止交互，保留材质；原 DOM 和移出的镜片同步位置、透明度与裁剪。 |
| closed | 已访问且已解码的镜片进入休眠，移除实际 backdrop URL，停用绘制及引擎更新。初次未打开的控件保持懒加载。 |
| 再次打开 | 同步恢复缓存 URL，再由几何观察器适配尺寸；保留已解码图和控制器。 |
| 移除/实验关闭 | 销毁控制器、镜片 DOM、观察器、事件监听、弹簧及挂起任务。 |

`glass-motion.ts` 在 Vue 双帧 transition 设置之后检查浏览器的有限 CSS/WAAPI 动画，等待 `Animation.finished`。兜底时间按活动 effect 的真实 endTime、currentTime 和 playbackRate 计算；到期重新检查，不强行拆除仍在运动的镜片。取消和重新打开会使旧 Promise/RAF 失效。无限装饰动画不阻止退出。

Vue 留场 DOM 在 `beforeUnmount` 后仍可见时继续持有材质；`unmounted` 发现 DOM 已断开则立即清理。

Popover 的退出顶层行为也等待实际动画完成，旧 190ms 定时器已删除。音乐原有形变和 CSS 退出动画保留；原来的 240ms 休眠计时器已删除。

## 关键文件

- `app/utils/glass-surfaces.ts`：注册、可取消释放和 `v-glass-presence`。
- `app/utils/glass-motion.ts`：实际动画完成检测及受控兜底。
- `app/utils/experimental-glass.ts`：基于可见生命周期筛选；已解码资源休眠与唤醒；停止用 inert 拆材质；取消重复的全局子树属性观察。
- `app/utils/glass-controls.ts`：面板共享运动调度器跟随进入和退出的子页/折叠区；独立镜片透明度、裁剪、CSS 圆角同步；休眠时停止弹簧及引擎更新。
- `app/components/ExperimentalGlass.client.vue`：休眠绘制门控；指示器继承已关闭面板的 visibility。
- `AppearancePanel.vue`、`GlassSettings.vue`、`SearchAdvanced.vue`、`SearchFilterSelect.vue`、`SearchDatePicker.vue`、`MusicPlayer.vue`、`ArticleTools.vue`：在动画所有者上绑定可见生命周期。
- `app/composables/useSearchPopover.ts`：Popover 顶层归属与实际退出完成同步。

其他指令调用点也已检索：SlidingNav、GlassRange、PDF 工具栏和图片查看器保留共享指令路径；图片查看器的 Vue leave 由宿主及祖先动画等待覆盖。本轮没有对 PDF/图片查看器做浏览器视觉验收。

## 浏览器观察与帧对照

环境为云端桌面 Chrome，支持 CSS anchor positioning。未连接 Android 真机；也没有把桌面浏览器声明为 Android 测试。

调试使用本地临时探针：在指针事件后按 RAF 读取 DOM/CSS 状态，并可将浏览器 CSS 动画暂停在中间位置。探针已从产品源码移除。观察过程有明显主线程开销，以下时间不能当成性能基准或连续 60fps 录像。

| 观察 | 基线 / 修复前 | 修复后 |
| --- | --- | --- |
| 阅读外观关闭期间的可见样本 | 235ms、541ms 样本：active=false，回到 `blur(14px) saturate(1.35)`。 | 343ms、612ms 样本：phase=closing，active=true，保留 `blur(8.48528px) url(...)`。 |
| 搜索下拉退出中间帧 | 源码路径在 inert 后排除镜片。 | closing，active=true，保留 `url(#lg6-v1)`；退出中重新打开仍复用该 URL。 |
| 日历退出中间帧 | 固定时间控制顶层退出，且 inert 过滤拆材质。 | closing，active=true，保留 `url(#lg7-v1)`，`:popover-open=true`。 |
| 搜索下拉完全关闭 | — | phase=closed，`:popover-open=false`，镜片 dormant=true。 |
| 参数组折叠中间帧 | 立即隐藏镜片。 | 10 个已启用控件保持 active=true、dormant=false；镜片 opacity 读数 0.197597，跟随折叠区淡出。 |
| 音乐关闭中间帧 | inert 路径拆除控制器。 | 面板保留 `blur(8.48528px) url(#lg8-v1)`；进度/音量镜片保留各自 URL，两个 thumb 均 active=true、dormant=false。 |
| 音乐全屏往返及关闭中重开 | — | 保留同一面板滤镜 ID；原形变流程完成。 |
| 音乐完全关闭 | — | phase=closed、dormant=true；面板和独立镜片的实际 inline backdrop URL 均已清空，镜片 visibility=hidden。 |
| 原生锚点镜片几何 | 实测 28×18 镜片 CSS radius=0px，宿主 radius=9px。 | 28×18 镜片 CSS radius=9px；分项指示器镜片 radius=10px，且保留 SVG URL。 |
| 实验关闭 | — | active=0，独立镜片 DOM=0，面板恢复原样式。 |

已实际操作搜索选择/关闭/重开、日历关闭、外观面板关闭/重开、两级菜单往返、参数组展开/收起、音乐全屏往返和关闭。深色和浅色均有浏览器样本；深色测试将相关原始材质明确设为 liquid，避免将云母门控误报为故障。

尚未提供完整的逐帧视频与成套前后截图；以上是实际读取的帧样本和几何对照，不能据此宣称所有设备“零坏帧”。Android 真机、快速连续触摸/滚动/路由切换的完整矩阵，以及正式 FPS/GPU/内存采样仍待完成。

## 滑条恢复后的最终浏览器回归

- 进度与音量滑块本体直接持有 `url(#lg5-v1)`、`url(#lg6-v1)`，音乐面板内 thumb 对应的独立镜片数量为 0。
- 真实指针按住采样：press=1，白色覆盖层 opacity=0，滑块 42×28、CSS radius=14px、z-index=4，滤镜仍挂在滑块本体。原有按压形变与松手白色外观保留。
- 实际拖动：音量从 35% 到 81%，原滑块的同一个 SVG URL 保留，松手弹簧正常收敛。
- 完全关闭：两个原位滑块 dormant=true、filter 为空、visibility=hidden。
- 再次打开：两个滑块 active=true、dormant=false、visibility 恢复，同一个 SVG URL 同步恢复，无控制器重建。
- 音乐全屏往返：两个原位滑块保持 active 和同一个 SVG URL。全屏布局和返回关闭流程完成。

## 自动回归与性能边界

- 实际生命周期逻辑：1380ms 祖先 WAAPI 退出、380ms 取消、520ms 反转、Vue 留场、无动画和清理。
- 25 次关闭/重开：没有新增控制器；休眠时修改质量设置不触发该镜片质量更新；移除休眠宿主后控制器和观察器释放。
- 滑条回归：即使位于带滚动遮罩的面板内，仍在原滑块本体上创建引擎；不创建外部 thumb 镜片，按压尺寸 42×28/radius=14；休眠/唤醒复用控制器且恢复 visibility。
- 镜片回归：原生 anchor 的 CSS 圆角与宿主一致，弹簧形变后仍一致；退出页 inert 时保留镜片并同步 opacity，closed 后休眠。
- 保留已有拖拽中心约束、松手后尺寸形变、RTL 滑条、端点间距、AA 贴图像素与明暗边缘参数测试。
- 共享调度器仅在相关 owner 实际运动期间运行；原生锚点继续负责静态/惯性滚动的位置跟随，不为每个控件增加常驻 RAF。
- 未使用永久预渲染全部隐藏玻璃、关闭动画、遮罩或参数修改来掩盖问题。

## 验证记录

- 类型检查：通过。
- 源码/逻辑回归：40/40 通过。
- Nuxt production build：通过。
- GitHub Pages `/inkroam/` 静态生成：通过，221 条路由、108 个 HTML 页面。
- 完整源码与构建产物检查：44/44 通过；108 个 HTML 页面没有提前请求实验玻璃引擎，动态导入仍保留。

当前以独立分支交付。Android 与完整逐帧验收未完成，因此保持 PR 草稿，不合并 main。
