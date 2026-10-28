# 实验性液态玻璃：接入与验收记录

更新：2026-10-28。当前以用户指定的 liquidglass.dev 为视觉参考，已完成浮层接入和本轮代码检查；没有浏览器视觉验收，没有提交部署。本文是当前口径，取代此前几轮临时参数说明。

## 不变的要求

- 开关位于阅读外观「光效时序」之后，左侧关闭、右侧开启，默认关闭。沿用现有分段控件与保存通路 paper-trail-appearance-v5；只接受布尔 true。
- 独立于默认设置和层次感。纸媒模式禁用并暂时停止效果，但保留选择；恢复默认关闭。
- 用户说“保护原样式”是不要修改其它材质的定义，不是让实验效果继承亚克力、云母等原配方。原组件布局、字体、交互和动画保留；实验开启时使用自己的光学与薄染色，关闭恢复原材质。
- 不改 main.css/depth.css 的其它材质规则，不读取其它材质的 blur/saturate/brightness，不重启导航性能重构。

## 已接入范围

| 模块 | 光学预设 | 挂载方式 |
| --- | --- | --- |
| 底部音乐/显示入口 | 上游 Button | 独立装饰层，不处理前景字形 |
| 顶部导航栏 | 上游 Navbar | 保留原吸顶、宽度动画与导航交互 |
| 阅读外观、音乐面板（含全屏） | 上游 Panel | 宿主 backdrop-filter |
| 筛选/导出范围下拉、日期日历 | 上游 Menu | 宿主 backdrop-filter |
| 正文工具操作区及页内查找/导出面板 | 上游 Panel | 仅打开工具时挂载 |
| 启用/禁用默认设置确认弹窗 | 上游 Panel | 原生 dialog 打开时挂载 |

导航栏现已接入；正文阅读卡片未接入。阅读目录本身是纯文本结构，没有为它新增玻璃卡片。确认弹窗的 top layer、焦点、Esc、遮罩和非线性动画不变；没有修改音乐播放或正文查找、导出逻辑。

## 来源与光学依据

用户指定参考：[Playground](https://liquidglass.dev/#playground)。固定源码：[gentpan/liquidglass @ 068ad226f53e1ca62d857f78bdc32f58f3c5fce7](https://github.com/gentpan/liquidglass/tree/068ad226f53e1ca62d857f78bdc32f58f3c5fce7)。核心及 MIT 许可保存在 app/vendor/liquidglass/，没有运行远程 CDN，也没有引入它的组件样式系统。

已读 assets/site.js 与 lib/components.js。Playground 的图片透镜默认 refraction28、bezel.6、curvature4、chroma.15、blur0、specular.5；它不是所有控件的通用参数。真实组件分别使用 Button、Panel、Menu 和 Navbar 配方。本项目按照对应用途映射，具体定义集中在 app/utils/glass-optics.ts。

| 参数 | Button | Panel | Menu |
| --- | --- | --- | --- |
| refraction | 14 | 24 | 22 |
| bezel | .8 | .3 | .35 |
| curvature | 3 | 4 | 3 |
| blur | 0 | 2 | 6 |
| specular | .6 | .5 | .8 |
| specularWidth | 1.5 | 2 | 2.5 |

Navbar 使用 refraction16、bezel.8、curvature3、blur1、specular.55、specularWidth1.5。四组均使用 ior1.5、lightAngle-120。上游 Surface.attach 对任意 DOM 的 backdrop 路径明确设置 chroma0，本项目遵循该路径，不照搬图片透镜的彩边。上游采用曲面位移贴图与方向性边缘反光，不是独立接收面上的真实焦散。

薄染色和阴影在 ExperimentalGlass.client.vue：浅色白色.14，深色 rgb(17 24 39 / .10)，阴影0 4px 12px黑色.10。参考上游默认 tint、暗色组件 tint 和 shadow-2，按 Inkroam 文字深浅切换。没有复制上游苹果蓝配色、字体、布局或控件样式。源码参考不等于已经达到 Apple 的实机观感。

## 生命周期与几何

- ExperimentalGlass.client.vue 仅客户端启动管理器。关闭时不动态加载引擎、不生成贴图；开启且存在目标后才 import。Nuxt 默认会预取动态入口，因此另在 nuxt.config.ts 的 build:manifest 只对该引擎禁用 prefetch/preload，其它资源提示不变。
- glass-surfaces.ts 指令显式注册浮层，没有全站 DOM 子树监听。关闭保留300ms以覆盖原160/180ms收起；快速重开取消清理。Vue 过渡卸载也保留该时长，避免离场仍可见时提前丢失材质。
- 音乐从未播放到播放时，入口宿主从内层按钮转交外层胶囊，旧实例销毁，不重复折射。
- 面板直接使用背景滤镜，以避免自身 clip-path 对内层玻璃采样的隔断。前景文字不使用 filter。保留原圆角；音乐全屏时圆角跟随现有动画到0。
- 面板尺寸观察仅调整光学几何与贴图采样。最长边最多1024采样像素，未改变设备DPR、布局或视口。仍有生成与绘制成本，不能宣称零开销。
- 贴图URL就绪才启用实验背景，四秒未准备好回退。关闭/纸媒/卸载移除滤镜并恢复接入前的相关内联值。异步加载用序号防止关闭后重新接回。
- Chromium/Blink 使用真实背景滤镜路径。非Blink、减少透明度偏好下保持原材质；浏览器类别与CSS语法支持不等于像素级正确性。Safari/Firefox跨引擎折射未接入。

## 本轮检查（2026-10-28）

通过：npm.cmd run typecheck；check-glass-surfaces、check-appearance-mode、check-reading-appearance、check-article-tools、check-search-popover、check-music-player。

新增指令导入触发旧 VM 测试的 export 语法错误，已仅在对应测试提取阶段移除模板指令导入；指令生命周期由单独套件检查。新增套件也纳入 check-all。没有削减原断言。

这些检查覆盖类型、偏好隔离、浮层注册/关闭/重开/卸载、旧工具开合、搜索浮层和音乐行为；不证明光学观感、真实浏览器焦点行为或性能。已以 BASE_PATH=/inkroam/ 运行静态生成；本次续作的最终回归结果见下方阶段记录。按用户要求不操作浏览器，由用户自行验收。

此前只有早期版本在 Edge 深色模式做过两个按钮尺寸与滤镜挂载的有限检查，不能用它替代当前配方和新模块验收。

## 接下来由用户验收

1. 不同原材质下开实验应使用独立玻璃；关闭后恢复各自样式。
2. 深浅色文字可读性、折射强度、边缘反光是否自然，是否出现黑边或截断。
3. 音乐全屏/缩回、面板收起、快速重开、路由切换；不能出现提前恢复原材质的闪跳。
4. 正文工具切换、长下拉滚动和向上展开、日历、确认弹窗；原点击/键盘行为应保留。
5. 手机与长曲名变宽、刷新持久化、减少透明度、纸媒往返。

不把已知壁纸副本说成任意DOM折射，不用模糊光带冒充焦散。后续根据实际反馈调整，不能再次擅自统一为按钮参数，或以保留其它材质为由继承它们的配方。

## 导航及按需加载收尾（2026-10-28）

- app.vue 的既有 site-header 显式注册为 navbar；不改高度、宽度、margin、top、圆角和440ms宽度过渡，不改 SlidingNav 的选中动画。实验就绪时仅在实验组件内隐藏旧材质的 nav-depth-light 内部洗光，避免混入旧配方；原下层投影保留，关闭自动恢复旧层。NavDepthLight.vue 与 depth.css 源码未改。
- 专注模式不为隐藏导航创建实例，退出专注后重新接入；已用适配器测试覆盖。
- 新增 check-glass-adapter，运行真实适配器配合可控的引擎/DOM边界，覆盖默认关闭零导入、加载中关闭/卸载、宿主转交、滤镜值及优先级恢复、纸媒/WebKit回退、减少透明度、解码超时及专注往返。不是浏览器光学测量。
- 检查首次生产产物时发现 Nuxt 为动态引擎插入 prefetch，因此只对引擎清单项取消预取/预载，保留动态导入与其它资源提示。新增 check-glass-built：检查动态分包仍存在、运行时引用仍存在、全部HTML无该文件的提前请求。该修复前不能声称默认关闭时完全不下载引擎。
- 新套件均加入 check-all（产物项仅 --built）。老测试中 recent-counts、filter-select、calendar 的模板指令导入也完成模拟环境适配，没有删除原行为断言。
- 导航扩大/缩小时仍会重算折射贴图；没有浏览器性能录制，不宣称解决Chrome卡顿。1024采样上限不是FPS证据，也不是降低设备DPR。
- 用户要求持续到剩余额度低于20%，但当前工具没有可读取的5小时/周额度百分比，已明确告知这一限制。不能把任务预算或上下文占用冒充账号用量。
### 本阶段最终结果

2026-10-28：npm.cmd run typecheck、BASE_PATH=/inkroam/ npm.cmd run generate、npm.cmd run check -- --built 全部成功，最后为42/42套。产物检查108个HTML均无引擎提前请求标签；动态引擎文件仍存在（本次cXEYiTIP.js，9048 bytes未压缩），运行时import保留。源码审查确认main.css、depth.css、NavDepthLight.vue、SlidingNav.vue、ArticleToc.vue及五个被接入组件的原style区块与HEAD一致；实验覆盖在独立组件中。

日志：tmp/liquid-glass-typecheck.log、tmp/liquid-glass-generate.log、tmp/liquid-glass-built-check.log。未操作浏览器，未提交推送部署。实验的视觉与性能仍待实机验收。