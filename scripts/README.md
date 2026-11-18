# 检查与维护脚本

统一入口为 `npm run check`。脚本不会启动开发服务器、构建站点或打开浏览器。文案和小幅视觉调整不必每次运行全套检查；需要执行时按改动范围选择。用户要求不测试时，不运行这些命令。

## 选择范围

| 用途 | 命令 |
| --- | --- |
| 只看玻璃组清单，不执行 | `npm run check -- --group=glass --list` |
| 玻璃相关源码 | `npm run check -- --group=glass` |
| 多个相关功能组 | `npm run check -- --group=appearance --group=reading` |
| 全部源码 | `npm run check` |
| 仅包含产物断言的套件 | `npm run check -- --built-only` |
| 源码与产物，兼容原命令 | `npm run check -- --built` |
| 仅在线服务检查 | `npm run check -- --live-only` |
| 参数说明 | `npm run check -- --help` |

功能组：`glass`、`appearance`、`reading`、`content`、`navigation`、`search`、`pdf`、`music`、`release`。重复组不会重复执行。组与阶段没有交集时明确报错，避免空清单被误报为通过。

`--built-only` 需要已有 `.output/public`，多数产物检查按 `/inkroam/` 子路径编写。`--live-only` 需要已有根路径 `localhost:3000` 服务。两种 only 参数可组合，保留 PDF 在线检查中的产物断言。`--live` 仍兼容原来的源码加在线检查。

## 2026-11-01 整理

独立 `.mjs` 从 52 个减少到 48 个。四个小套件按职责合并，全部原断言保留，块级作用域隔离局部变量：

| 原脚本 | 现在所属脚本 |
| --- | --- |
| `check-toc-active.mjs` | `check-reading-polish.mjs` |
| `check-tree-walk.mjs` | `check-technical-prose.mjs` |
| `check-search-grouping.mjs` | `check-search-filters.mjs` |
| `check-appearance-storage.mjs` | `check-appearance-mode.mjs` |

CI 原来先跑 41 套源码、再跑 45 套包含源码的产物检查，共 86 次脚本调用。合并后为 37 套源码和 11 套产物；新增加密笔记检查后，当前为 38 套源码和 11 套产物，共 49 次。兼容的 `--built` 合并执行 42 套。这是按编排计算的数量，不是实测耗时提升。

11 月 1 日整理后，七个混合套件仍在产物阶段重复执行源码断言。11 月 18 日的调整见下节。

在线模式补齐 `check-reading-polish` 原本未收到的 `--live`，启用已有话题筛选在线断言。仅选择在线阶段时执行。

`check-release-gates.mjs` 同步覆盖阶段选择、功能分组、只列清单、旧参数兼容及失败退出，不增加新检查文件。

## 源码与产物分别检查什么

`--built-only` 在七个混合套件内只运行产物分支。例如数学竞赛笔记会从 Markdown 取标题、核对生成页面，但公式逐条交给 KaTeX 解析只需在源码阶段做一次。`--live-only` 同理，在线搜索检查会实际请求筛选页面，跳过本地的一万条匹配分组样例。直接运行混合套件可用同样的阶段选项，`--built` 和 `--live` 仍包含源码检查。

维护阶段选择时，从 [运行器](./lib/check-runner.mjs) 的功能组和 [阶段参数](./lib/check-stages.mjs) 入手。[发布门禁](./check-release-gates.mjs) 从脚本目录核对默认选集，另按名称保护产物和在线覆盖。新增普通源码套件时，在运行器的所属组登记即可。

改阅读外观后，三个检查共用 [面板装载入口](./lib/appearance-panel-vm.mjs)。组件新增运行时导入时，在这里接入真实模块或测试替身。主题响应、背景迁移、首页条数的断言与各自的存储样例仍在对应套件中。

播放器回归由 `check-music-player.mjs` 编译并挂载 Vue 组件。点击和媒体事件会经过真实模板；解码、文件存储与动画完成时间可由检查控制。调试“播放请求已发出，暂停图标却提前出现”时可单跑 `npm run check -- --group=music`。

## 手动工具与维护原则

编译讲义中的 C 程序用 `check-study-code.mjs`，与历史 CSS 基线比较用 `check-css-cleanup.mjs`。改动快捷轮盘或 NSGA-II 教学示例时可分别运行 `check-quick-radial.mjs` 和 `check-nsga-ii.mjs`，后者的 `--built` 也检查生成页。性能录制由 `analyze-depth-traces.mjs` 和 `inspect-depth-capture.mjs` 按需读取。

性能录制默认按 `http://localhost:3000/` 选择页面，其他地址可显式传入，例如 `node scripts/inspect-depth-capture.mjs --url=http://localhost:3000/search trace.json.gz`。两个分析命令都要求录制包含可唯一定位目标页面的主帧和渲染主线程。多标签页同地址或录制期间无法归属的样本会报错。

新增检查优先加入所属功能文件；仅独立依赖、运行环境或生命周期确有区别时才新建脚本。源码字符串断言只用于重要契约，不能把固定 CSS 写法、字号或动画数值当成视觉正确性的证明。
