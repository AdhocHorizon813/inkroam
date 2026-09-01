# 纸上漫游

一个以中文长文阅读为核心的 Nuxt Content 博客。默认提供现代幻境界面，同时完整保留纸媒编辑部风格，支持 Markdown、文章归档、标签和深色模式。

## 两套外观

页面右下角的“外观”面板可以随时切换：

- `现代幻境`：采用克制的扁平化编辑界面，支持深色/浅色，并可选液态玻璃、亚克力、云母三种材质。
- `纸媒原版`：保留原有的纸张排版与明暗主题。
- 背景默认使用静谧纯色，也可选择内置暮色都市、纯 CSS 极光，或上传自己的图片。

外观偏好和上传的自定义背景只保存在当前浏览器，不会上传到服务器。现代版默认背景位于 `public/images/modern-dream-city.png`。

## 本地运行

需要 Node.js 22.12 或更高版本。

```bash
npm install
npm run dev
```

浏览器访问 `http://localhost:3000`。

## 写一篇新文章

在 `content/posts/` 新建 Markdown 文件：

```md
---
title: 文章标题
description: 一句话摘要
date: 2026-08-28
tags: [写作, 思考]
readingTime: 5 分钟
featured: false
draft: false
---

这里开始写正文。
```

`draft: true` 的文章不会出现在首页和归档中。

如果增加新的中文标签，请同时在 `app/utils/tags.ts` 中添加一个英文 URL 别名。

## 检查与构建

```bash
npm run typecheck
npm run generate
```

静态网站会生成在 `.output/public`，可以部署到 Cloudflare Pages 或其他静态托管平台。

Cloudflare Pages 推荐设置：

- 构建命令：`npm run generate`
- 输出目录：`.output/public`
- 环境变量：`NUXT_PUBLIC_SITE_URL=https://你的域名`

## 集中修改品牌

- 网站名称与导航：`app/app.vue`
- 首页介绍：`app/pages/index.vue`
- 关于页：`app/pages/about.vue`
- 颜色、字体与排版：`app/assets/css/main.css`
- 外观选择与自定义背景：`app/components/AppearancePanel.vue`
- SEO 与站点地址：`nuxt.config.ts`
- 社交分享图：`public/og.png`
