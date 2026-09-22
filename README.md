# 纸上漫游

「写下那些不该被遗忘的想法。」

纸上漫游是一个关于写作与阅读的个人博客。我们记录那些与技术与生活相关的、值得被慢慢阅读与回味的内容——长期主义的思考、工具与方法，以及一些不想被时间冲刷掉的记忆。

博客提供两种视觉风格：**现代幻境**与**纸媒原版**。你不必喜欢默认的样子——右下角的外观面板可以随时调整主题、材质与背景，让阅读更贴近你自己的习惯。

线上地址：<https://adhochorizon813.github.io/inkroam/>

## 阅读功能

- **文章目录**：由正文的二、三级标题自动生成，标记当前章节；电脑和手机均支持带缓动的展开、收起，点击目录在页内平滑滚动到章节。
- **全文搜索**：按文章归并标题和正文匹配，关键词高亮；每篇先展示三处命中，其余可展开，章节链接可直接定位。
- **阅读设置**：右下角面板提供主题、材质和背景调整，滚动区域上下边缘使用对称淡出过渡。
- **最近内容数量**：最近文章与最近笔记分别设置 5 篇、10 篇或所有，独立保存到浏览器。

内容格式与搜索规则见 [内容创作指南](docs/content-authoring.md)，目录和面板维护见 [界面组分](docs/ui-components.md)。

## 写作

课程笔记支持可选 `order` 序号与同课程上一篇/下一篇；话题筛选条件保存在网址中，可分享及后退恢复。未增加公开更新时间或修改历史。

学习笔记放在 `content/notes/<英文课程目录>/<英文文件名>.md`，可复制 `content/notes/_note-template.md`。导航“笔记”进入课程目录与全部笔记时间线；首页“最近笔记”位于最近文章下方，笔记同时收录到归档、搜索和标签页。课程英文路径与中文名称映射见 `app/utils/courses.ts`，五门课程与发布示例见 [内容创作指南](docs/content-authoring.md#学习笔记)。

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

笔记可通过 `::pdf-viewer{src="/pdfs/文件名.pdf" title="讲义"}` 组件在正文内嵌 PDF（以 `::` 结束组件块），附件放在 `public/pdfs/`，详细示例见 [内嵌 PDF](docs/content-authoring.md#内嵌-pdf)。使用浏览器原生阅读器，不支持内嵌的浏览器可打开原文件；PDF 正文暂不参与站内搜索。

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

推送到 `main` 即触发 GitHub Actions：`npm run generate` → 上传 `.output/public` → 发布到 GitHub Pages 的 `/inkroam/` 子路径。也可以在仓库 Actions 页面手动触发（`workflow_dispatch`）。

细节与排查见 [`docs/deployment-github-pages.md`](docs/deployment-github-pages.md)。

## 文档

About 页在原有正文后设有原创角色「林澈 / Lin Che」的小节。插图位于 `public/images/lin-che.png`，共享两种视觉模式的排版与颜色变量；布局和换图注意事项见 [视觉系统](docs/visual-system.md#about-页的-another-resident)。

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

