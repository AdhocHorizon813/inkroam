# 纸上漫游

「写下那些不该被遗忘的想法。」

纸上漫游是一个关于写作与阅读的个人博客。我们记录那些与技术与生活相关的、值得被慢慢阅读与回味的内容——长期主义的思考、工具与方法，以及一些不想被时间冲刷掉的记忆。

博客提供两种视觉风格：**现代幻境**与**纸媒原版**。你不必喜欢默认的样子——右下角的外观面板可以随时调整主题、材质与背景，让阅读更贴近你自己的习惯。

线上地址：<https://adhochorizon813.github.io/inkroam/>

## 写作

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

设计与实现细节记录在 [`docs/`](docs/README.md)：

- [架构与技术选型](docs/architecture.md)
- [视觉系统与美学细节](docs/visual-system.md)
- [动效与交互细节](docs/motion-and-interaction.md)
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

