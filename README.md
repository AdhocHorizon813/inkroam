# 纸上漫游

「写下那些不该被遗忘的想法。」

纸上漫游是一个关于写作与阅读的个人博客。我们记录那些与技术与生活相关的、值得被慢慢阅读与回味的内容——长期主义的思考、工具与方法，以及一些不想被时间冲刷掉的记忆。

博客提供两种视觉风格：**现代幻境**与**纸媒原版**。你不必喜欢默认的样子——右下角的外观面板可以随时调整主题、材质与背景，让阅读更贴近你自己的习惯。

阅读外观的「默认设置」可让材质、模糊与背景跟随明暗模式；老访客保留已有偏好，切换前需确认。弹窗的材质、排版、动效、透明度调整与截图反馈见 [完整设计规范](docs/appearance-confirm-design.md)。

线上地址：<https://adhochorizon813.github.io/inkroam/>

## 阅读功能

- **阅读音乐**：左下角可播放 Paper Hours Vol. 1 / Vol. 2 共六首 lofi，支持本地音乐导入与列表管理、独立封面、站内全屏音乐视图，以及切歌、进度、音量和循环，站内切页继续播放。默认不自动播放；初始不设置音频地址，打开面板也不加载音乐，点击播放才请求当前曲目。Vol. 2 使用试听反馈后重编的第二版，制作与采样署名见 [Vol. 2 记录](docs/music-vol02.md)，在其“管理列表”中也可查看署名。播放器细节见 [音乐播放器](docs/music-player.md)。

- **正文工具**：文章与笔记标题下可做独立页内查找，并导出整篇或指定小节的 PDF / PNG 阅读版。PDF 使用浏览器另存为 PDF，PNG 工具按需加载；超长内容建议按小节或用 PDF。实现边界与待验收项见 [正文工具](docs/article-tools.md)。

- **数学竞赛（数学专业类）**：高等代数按一章一篇笔记整理为 [矩阵与行列式](content/notes/mathematics-competition/01-advanced-algebra-matrices-and-determinants.md)、[线性空间、线性方程组与二次型](content/notes/mathematics-competition/02-advanced-algebra-linear-spaces-and-quadratic-forms.md)、[多项式](content/notes/mathematics-competition/03-advanced-algebra-polynomials.md)。包含定义、推导、竞赛例题、易错点与自测解答；三组交互图分别展示矩阵面积变换、二次型主轴和重根合并。初始图与公式支持无 JavaScript 阅读，交互图无需额外依赖。检查运行 `node --experimental-strip-types scripts/check-competition-algebra.mjs`，静态生成后加 `--built`。

- **数据结构讲义**：[导读与十七讲](content/notes/data-structures/00-study-guide.md)，共 18 篇，面向数学与应用数学背景，配严格定义、慢速推导、分散短程序和练习。正文共 42 个完整 C17 程序，包含 Bellman-Ford、BST/B/B+/AVL更新、堆式置换选择与任意路败者树文件归并、Huffman位流、邻接表生命周期和top-k；每个程序后展示实测输出。运行 `node scripts/check-study-code.mjs` 编译并核对输出（需 GCC）；修改示例后用 `--write-outputs` 更新结果。第二讲含四种遍历的逐步交互，Mermaid 图按需渲染。实现限制、验证与外部待验收项见 [教学内容记录](docs/data-structures-teaching.md)。

- **随手翻一页**：归档里的随机阅读入口，从已发布文章与笔记中选择；当前标签页内优先不重复，保留正常链接操作，不上传阅读记录。

- **复制链接**：文章与笔记页尾可复制干净的全文链接；选中正文后，同一按钮改为复制选段链接，定位到所在段落，公式/跨段/重复段落退回章节。剪贴板不可用时提供手动复制。边界见 [选段分享](docs/passage-sharing.md)。

- **文章目录**：由正文的二、三级标题自动生成，标记当前章节；电脑和手机均支持带缓动的展开、收起，点击目录在页内平滑滚动到章节。
- **全文搜索**：按文章归并标题和正文匹配，关键词高亮；每篇先展示三处命中，其余可展开，章节链接可直接定位。
- **高级搜索**：可展开筛选文章/笔记、课程、标签、日期范围和排序；选项支持框内搜索，日期支持站内日历与手输，支持无关键词筛选，条件保存在网址中。
- **PDF 页内阅读**：自带阅读器支持页码跳转、旋转、缩放与按文件记忆阅读位置；搜索按钮可展开文内查找，支持匹配跳页与文字高亮，按需逐页搜索。聚焦画布后可用左右键或 PageUp/PageDown 翻页，保留浏览器组合快捷键；浏览器原生嵌入模式保持不变，使用其自身搜索。扫描图片不做 OCR，PDF 不加入站内搜索。见 [PDF 文内搜索](docs/pdf-search.md)。
- **图片阅读**：独立图片支持灯箱放大；带链接的图片保留链接行为，不强制进入灯箱。
- **阅读设置**：右下角面板提供主题、材质和背景调整，滚动区域上下边缘使用对称淡出过渡。
- **光效时序**：层次感下方可选同步或延迟，默认同步；关闭层次感时禁用，偏好独立保存。延迟沿用桌面440ms等待，移动端保持同步。禁用默认设置会固定当前壁纸，不再因明暗切换自动换图。
- **漫光玻璃**：阅读外观 → 漫光玻璃设置，默认关闭。支持导航栏、正文与首页卡片、阅读与音乐面板、正文工具及其轨道、下拉与日历、确认窗、PDF 工具栏、图片按钮、底部入口、滑动指示器及滑条滑块，共 13 组设置；可使用全局覆盖或分别调整通透度、采样与性能参数。核心按需加载，关闭恢复原材质；纸媒模式及不支持的浏览器保留原样。当前使用 Chromium 背景滤镜，开发阶段已收尾，产品名称统一为「漫光玻璃」。现状与验证见 [收尾记录](docs/liquid-glass-closeout-2026-11-01.md)，参数见 [设置说明](docs/liquid-glass-component-settings.md)。
- **最近内容数量**：最近文章与最近笔记分别设置 5 篇、10 篇或所有，独立保存到浏览器。
- **错误页**：找不到页面时提供首页、归档与搜索入口；静态 404 另有禁用 JavaScript 时的返回链接。

内容格式与搜索规则见 [内容创作指南](docs/content-authoring.md)，目录和面板维护见 [界面组分](docs/ui-components.md)。

## 写作

课程笔记支持可选 `order` 序号与同课程上一篇/下一篇；话题筛选条件保存在网址中，可分享及后退恢复。未增加公开更新时间或修改历史。

学习笔记放在 `content/notes/<英文课程目录>/<英文文件名>.md`，可复制 `content/notes/_note-template.md`。导航“笔记”进入课程目录与全部笔记时间线；首页“最近笔记”位于最近文章下方，笔记同时收录到归档、搜索和标签页。课程英文路径与中文名称映射见 `app/utils/courses.ts`，课程注册与发布示例见 [内容创作指南](docs/content-authoring.md#学习笔记)。

在 `content/posts/` 中新建一个 Markdown 文件，即可发布一篇新文章：

```md
---
title: 文章标题
description: 一句话摘要
date: 2026-08-28
tags: [写作, 思考]
readingTime: 5 分钟
draft: false
---

这里开始写正文。
```

设置 `draft: true` 可以暂时保存草稿，它不会出现在首页或归档里。

## 本地预览

笔记可通过 `::pdf-viewer{src="/pdfs/notes/课程英文名/笔记标识/文件名.pdf" title="讲义"}` 组件在正文内嵌 PDF（以 `::` 结束组件块），附件放在 `public/pdfs/notes/<课程英文名>/<笔记标识>/`（文章用 `posts/<文章标识>/`），详细示例见 [内嵌 PDF](docs/content-authoring.md#内嵌-pdf)。使用浏览器原生阅读器，不支持内嵌的浏览器可打开原文件；PDF 正文暂不参与站内搜索。附件自 2026-09-27 起与图片一致按用途分入子目录：**旧的一级地址 `/pdfs/<文件名>.pdf` 已经失效，未保留兼容副本**。

```bash
npm install
npm run dev
```

然后访问 `http://localhost:3000`。

线上部署在 GitHub Pages 的子路径 `/inkroam/` 下，需要复现线上路径时：

```bash
# macOS / Linux
BASE_PATH=/inkroam/ npm run generate && npm run preview
```

```powershell
# Windows PowerShell
$env:BASE_PATH='/inkroam/'; npm run generate; npm run preview
```

## 部署

### 回归检查

CSS 维护：已有顶层级联例外受 `check-css-cascade` 门禁保护，优先修改原规则，不追加重复补丁。清理范围、保留原因和构建体积对比见 [CSS 清理记录](docs/css-cleanup-2026-09-27.md)。

运行时维护：滚动状态同值写入去重、外观初始化先规范化再写入响应式状态；回归测试保护现有默认值、迁移与滚动时序。实现、测试数据及尚未完成的浏览器验收见 [零视觉变化性能计划](docs/performance-zero-visual-change-plan.md)。

层次光效目前在桌面导航尺寸变化后延迟 440ms 再改变亮度，**这是排查卡顿期间的中间实验设计，不是性能问题解决后的最终动效**。Chrome 卡顿仍未解决；不能将这种滞后固化为最终规范。后续需在解决性能瓶颈后重新验证光效与几何变化的协调时序，保留既有质感。实测与边界见 [双浏览器诊断](docs/depth-browser-comparison-2026-10-07.md)。

真实浏览器检查按 [浏览器回归验收清单](docs/browser-regression-checklist.md) 执行；清单的建立不代表已经完成视觉验收。

`npm run check` 运行不需要构建或浏览器的逻辑检查。先以 `BASE_PATH=/inkroam/` 生成静态站点，再运行 `npm run check -- --built`，额外检查内容产物和站内链接（既有构建测试以生产子路径为基准）。已有根路径开发服务 `localhost:3000` 时可追加 `--live`，检查笔记搜索和 PDF 服务响应。测试不替代真实浏览器下的布局、动效及权限验收。

推送到 `main` 即触发 GitHub Actions：类型检查 → 源码回归 → `npm run generate` → 产物回归 → 上传 `.output/public` → 发布到 GitHub Pages 的 `/inkroam/` 子路径。任一检查失败将阻止后续上传和部署。也可以在仓库 Actions 页面手动触发（`workflow_dispatch`）。

细节与排查见 [`docs/deployment-github-pages.md`](docs/deployment-github-pages.md)。

## 文档

液态玻璃的二级菜单提供分组件参数与全局覆盖。“采用默认设置”使用作者在 Edge 精调的固定方案；参数备份、控制范围和验证边界见 [漫光玻璃设置](docs/liquid-glass-component-settings.md)。

About 页在原有正文后设有原创角色「林澈 / Lin Che」的小节。插图位于 `public/images/about/lin-che.png`，共享两种视觉模式的排版与颜色变量；布局和换图注意事项见 [视觉系统](docs/visual-system.md#about-页的-another-resident)。图片自 2026-09-27 起按用途分入 `backgrounds/`、`about/`、`posts/<文章标识>/`、`notes/<课程英文名>/` 子目录（见 [写作规范](docs/content-authoring.md#图片用法)）：**旧的一级地址 `/images/<名字>.png` 已经失效，未保留兼容副本**。

该模块的源码回归检查：`node scripts/check-about-resident.mjs`；静态生成后加 `--built` 检查部署路径与图片产物。实际响应式和主题视觉仍需浏览器验收。

首页“按话题探索”提供常用主题入口，话题页支持全部/文章/笔记筛选，正文“继续阅读”自动关联同主题内容（不依据 AI 模型归属标签推荐）。

归档页的“按话题浏览”进入话题目录（`/tags`），可按名称筛选、查看篇数并打开该话题的文章与笔记。正文侧栏“相关话题”提供同样入口。后续功能计划与调研记录在 [待办清单](docs/todo.md)。

设计与实现细节记录在 [`docs/`](docs/README.md)：

- [架构与技术选型](docs/architecture.md)
- [视觉系统与美学细节](docs/visual-system.md)
- [审美原则（弱代码）](docs/aesthetic-principles.md)
- [动效与交互细节](docs/motion-and-interaction.md)
- [界面组分（顶栏、面板、列表）](docs/ui-components.md)
- [文章图片灯箱](docs/article-image-lightbox.md)
- [内容创作指南](docs/content-authoring.md)
- [GitHub Pages 部署](docs/deployment-github-pages.md)

## 常见构建失败（GitHub Actions）

如果 `Deploy to GitHub Pages` 的 `build` 作业在 `npm run generate` 阶段失败，并出现某个 `/tags/...` 路由 prerender 500，通常是标签 slug 映射缺失导致的。

- 构建环境会使用 `BASE_PATH`（仓库子路径）执行静态生成；
- `app/utils/tags.ts` 中未显式映射的中文标签会走 `encodeURIComponent`；
- 在该场景下，部分非 ASCII 标签路由可能触发 prerender 异常。

### 处理方式

1. 打开 `/home/runner/work/inkroam/inkroam/app/utils/tags.ts`；
2. 在 `tagSlugMap` 为对应中文标签补充 ASCII slug（例如：`图像生成 -> image-generation`）；
3. 本地验证：`BASE_PATH=/inkroam/ npm run generate`；
4. 确认构建通过后再提交。

更完整的部署说明见 [`docs/deployment-github-pages.md`](docs/deployment-github-pages.md)。

