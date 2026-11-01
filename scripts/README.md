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

CI 原来先跑 41 套源码、再跑 45 套包含源码的产物检查，共 86 次脚本调用。现在为 37 套源码和 11 套产物，共 48 次；这是按编排计算的数量，不是实测耗时提升。

七个同时包含源码与产物断言的脚本暂未拆分，产物阶段仍执行它们内部的源码断言。此次主要省去合并后 30 个源码专用套件在第二阶段的重复执行。保持独立子进程，避免修改全局对象的 DOM/VM 模拟环境互相污染；没有通过缓存跳过失败检查。

在线模式补齐 `check-reading-polish` 原本未收到的 `--live`，启用已有话题筛选在线断言。仅选择在线阶段时执行。

`check-release-gates.mjs` 同步覆盖阶段选择、功能分组、只列清单、旧参数兼容及失败退出，不增加新检查文件。

## 手动工具与维护原则

以下不进入默认回归：`check-study-code.mjs` 编译 C 教学程序；`check-css-cleanup.mjs` 对指定历史提交做一次性结构对照；`analyze-depth-traces.mjs`、`inspect-depth-capture.mjs` 分析手动提供的 trace。无需为了文件数将它们与运行时检查混在一起。

新增检查优先加入所属功能文件；仅独立依赖、运行环境或生命周期确有区别时才新建脚本。源码字符串断言只用于重要契约，不能把固定 CSS 写法、字号或动画数值当成视觉正确性的证明。

本次只有代码整理和静态审阅。依用户要求，没有执行测试、类型检查、构建或浏览器验收；未提交推送。
