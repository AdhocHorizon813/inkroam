# 部署到 GitHub Pages

## 线上地址

| 用途 | 地址 |
| --- | --- |
| 站点 | <https://adhochorizon813.github.io/inkroam/> |
| 仓库 | <https://github.com/AdhocHorizon813/inkroam> |
| 工作流 | `.github/workflows/deploy.yml` |

站点是**项目页**，因此所有资源都挂在 `/inkroam/` 子路径下。这一点是理解后续所有「路径问题」的前提。

## 工作流

推送到 `main` 或手动触发（`workflow_dispatch`）都会执行：

```
build  → checkout / setup-node 22 / npm ci / npm run generate
         → touch .output/public/.nojekyll
         → configure-pages / upload-pages-artifact（path: .output/public）
deploy → deploy-pages@v4（environment: github-pages）
```

几个关键点：

- **`BASE_PATH: /${{ github.event.repository.name }}/`**：把仓库名注入为子路径，`nuxt.config.ts` 的 `app.baseURL` 读取它。本地不设该变量时默认 `/`。
- **`.nojekyll`**：GitHub Pages 默认用 Jekyll 处理站点，会忽略以下划线开头的目录（`_nuxt/` 正是 Nuxt 的资源目录）。这个空文件禁用 Jekyll，资源才能被访问。
- **`nitro.prerender.failOnError: true`**：任何一个页面预渲染失败都会让构建失败。这是有意的——宁可部署失败，也不要把半成品发上线。
- **`concurrency: group: pages` + `cancel-in-progress`**：连续推送时取消旧构建，避免两个部署互相覆盖。

## 子路径（BASE_PATH）

| 场景 | 命令 | 结果 |
| --- | --- | --- |
| 本地开发 | `npm run dev` | 根路径 `/` |
| 本地复现线上 | 见下 | 子路径 `/inkroam/` |
| CI 构建 | `npm run generate`（带 `BASE_PATH`） | 子路径 `/inkroam/` |

本地用 Bash：

```bash
BASE_PATH=/inkroam/ npm run generate
npm run preview
```

PowerShell：

```powershell
$env:BASE_PATH='/inkroam/'; npm run generate
npm run preview
```

**为什么要在本地复现子路径？** 绝对路径的资源在根路径下永远是对的，只有挂到子路径才会暴露问题。历史上标签路由的 prerender 失败就属于这一类。

好消息是：Markdown 里写 `/images/xxx.png` 会被构建自动重写为 `/inkroam/images/xxx.png`，不需要手动加前缀（已在线上验证）。

## 常见构建失败

### `/tags/...` 路由 prerender 500

**症状**：`build` 作业在 `npm run generate` 阶段失败，日志里某个 `/tags/<中文或编码后的标签>` 路由返回 500。

**原因**：`app/utils/tags.ts` 的 `tagSlugMap` 里缺少该中文标签的 ASCII slug，构建环境对 `encodeURIComponent` 出来的路径处理不稳定。

**处理**：

1. 打开 `app/utils/tags.ts`；
2. 在 `tagSlugMap` 补一行，例如 `'图像生成': 'image-generation'`；
3. 本地验证 `BASE_PATH=/inkroam/ npm run generate`；
4. 通过后再提交。

## 曾经的坑（已修复，别改回去）

### 1. `og:image` 指向 localhost

`app.vue` 用 `runtimeConfig.public.siteUrl` 拼绝对地址，而它的默认值是 `http://localhost:3000`，所以必须在 CI 注入真实域名。`deploy.yml` 里的「Resolve public site URL」步骤负责这件事：

```yaml
- name: Resolve public site URL
  run: echo "NUXT_PUBLIC_SITE_URL=https://${OWNER,,}.github.io/${{ github.event.repository.name }}" >> "$GITHUB_ENV"
  env:
    OWNER: ${{ github.repository_owner }}
```

`${OWNER,,}` 是 bash 的小写展开：GitHub 用户名可能含大写（本仓库是 `AdhocHorizon813`），而 Pages 域名一律小写，先转换再拼接，canonical 才不会出现大小写混用。**不要删掉这一步。**

### 2. 文章页的 `og:image` 为空

`app/pages/posts/[slug].vue` 里曾写死 `ogImage: ''` / `twitterImage: ''`，会把 `app.vue` 的全局值覆盖成空字符串，社交平台抓到的是一张空图。现已删除，文章页继承全局 `og.png`。

如果以后想给文章配专属分享图，应该在 `content.config.ts` 增加 `cover` 字段，再在文章页用它拼 `ogImage`——**不要**再写空字符串。

### 3. 缺少 canonical

`app.vue` 现在用 `useHead` 输出 `<link rel="canonical">`，地址是 `siteUrl + 目录形式的路由路径`。绑定自定义域名或调整路由后，记得同步这里的拼接逻辑。

## 手动触发与回滚

- 手动触发：仓库 Actions 页面选择「Deploy to GitHub Pages」→ Run workflow；
- 回滚：`git revert <commit>` 后推送，或直接把 `main` 重置到上一个已知良好的提交再推送（会触发重新部署）；
- 部署记录：仓库 Actions → Deploy to GitHub Pages → 选一次运行，可看到 `github-pages` 环境的地址。

## 上线后自查

1. 首页、`/archive`、`/about`、`/search`、任意文章页、任意标签页都能打开；
2. 浏览器 Network 面板里 `_nuxt/*.js`、`_nuxt/*.css` 返回 200（若有 404，多半是 `.nojekyll` 或 `BASE_PATH` 的问题）；
3. 文章图片正常显示且不变形；
4. 图片灯箱可打开、双击/滚轮缩放正常（见 [article-image-lightbox.md](article-image-lightbox.md)）；
5. 控制台无报错；
6. 查看页面源码：`og:image`、`og:url`、`canonical` 都指向 `https://adhochorizon813.github.io/inkroam/...`，而不是 localhost。
