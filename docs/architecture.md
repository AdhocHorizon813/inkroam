# 架构与技术选型

## 技术栈

| 层 | 选择 | 说明 |
| --- | --- | --- |
| 框架 | Nuxt 4.4.2 | 静态生成（`nuxt generate`），没有服务端运行时 |
| 内容 | @nuxt/content 3.16.0 | 本地 Markdown + SQLite 索引 |
| 语言 | TypeScript 5.9 + vue-tsc | `npm run typecheck` |
| 部署 | GitHub Pages | Actions 发布 `.output/public` |

所有 npm 脚本都带 `NODE_OPTIONS=--experimental-sqlite`。Content 3 的原生 SQLite 连接器（`nuxt.config.ts` 里的 `content.experimental.sqliteConnector: 'native'`）依赖这个开关，去掉后 `dev`/`generate` 会直接报错。

## 目录结构

```
app/
  app.vue                     持久外壳：header + route-frame + footer + 外观面板
  assets/css/main.css         全部样式（约 3200 行）
  components/
    AppearancePanel.vue       外观面板（主题/材质/背景/氛围色/文章数量）
    SlidingNav.vue            主导航 + 滑动指示器
    ThemeToggle.vue           深浅色快捷开关
    ImageLightbox.vue         文章图片灯箱
    *Badge.vue                置顶 / 精选 / AI 生成 / AI 辅助 标识
  pages/
    index.vue                 首页：hero + 最近文章 + 精选 + 宣言
    archive.vue               按年份分组的归档
    about.vue                 关于页
    search.vue                标题 + 正文分节搜索
    posts/[slug].vue          文章页
    tags/[tag].vue            标签聚合页
  utils/tags.ts               标签名 ↔ slug 双向映射
content/posts/*.md            文章源文件
content.config.ts             collection 与 frontmatter schema
public/                       静态资源（图片、og.png、robots.txt）
docs/                         本目录
.github/workflows/deploy.yml  GitHub Pages 部署
```

## 渲染模型

`app/app.vue` 是跨路由持久的外壳，只重建 `.route-frame` 里的内容：

- `NuxtPage :transition="false"`：页面切换不使用 Vue `<Transition>`，而是由 app.vue 里的 Web Animations 手动驱动（见 [motion-and-interaction.md](motion-and-interaction.md)）。这样做是为了避免「旧页面离场 + 新页面入场」两套动画互相竞争造成闪烁。
- `.route-frame` 是动画的稳定锚点，路由切换时不重建，因此可以在它内部对子元素做逐帧入场。
- `<header>` 与 `<footer>` 不参与路由动画，视觉上保持连续。

## 数据流

1. Markdown 存放在 `content/posts/*.md`；
2. `content.config.ts` 用 Zod 定义 `posts` collection（`type: 'page'`、`source: 'posts/*.md'`）和每个字段的默认值；
3. 页面在构建期用 `queryCollection('posts')` 取数，外层包 `useAsyncData` 做缓存与去重；
4. 搜索页额外用 `queryCollectionSearchSections('posts', { extraFields: [...] })` 取得按标题分节的索引，再在前端做多词 AND 匹配与打分。

所有查询都显式过滤 `draft: false`，草稿不会进入首页、归档、搜索和标签页。

## 状态管理

没有引入 Pinia。唯一的跨组件共享状态是首页与外观面板共享的「最近文章数量」：

```ts
const latestPostCount = useState<LatestPostCount>('latest-post-count', () => 10)
```

外观偏好不走全局状态，直接持久化在 `localStorage`（见下），刷新后由 `AppearancePanel` 在 `onMounted` 读回。

## 外观偏好的存储

| Key | 内容 |
| --- | --- |
| `paper-trail-appearance-v5` | 主配置 JSON：`visual` / `colorMode` / 三种材质 / 三档模糊 / 遮罩透明度 / `accent` / `latestPostCount` |
| `paper-trail-appearance-v4` | 旧版本配置，首次读取时自动迁移（旧的单一 `blur` 会拆成 nav/content 两档） |
| `paper-trail-custom-background` | 自定义背景，压缩后的 webp data URL |
| `paper-trail-custom-background-name` | 自定义背景的文件名，用于按钮文案 |

读取或写入失败时不会中断页面，而是把错误写进 `role="status"` 的隐藏区域（`aria-live="polite"`），用读屏器告知用户。

## SEO

- 每个页面用 `useSeoMeta` 设置 `title` / `description`；
- `app.vue` 设置全局的 `ogSiteName`、`ogTitle`、`ogDescription`、`ogImage` 与 twitter 卡片；
- 文章页额外设置 `ogType: 'article'`。

绝对地址（`og:image`、`og:url`、`canonical`）由 `app.vue` 统一拼接：

- `siteUrl` 在 CI 里由 `NUXT_PUBLIC_SITE_URL` 注入（`deploy.yml` 的「Resolve public site URL」步骤），本地回落到 `http://localhost:3000`；
- `canonical` 用 `useHead` 输出，统一为「目录形式」（带尾斜杠），与 GitHub Pages 的解析一致；
- 文章页不再覆盖 `ogImage`，继承全局的 `og.png`。

## 样式组织

全部样式集中在 `app/assets/css/main.css`，按写入顺序分三层：

1. **基础层**：CSS 变量、reset、classic（纸媒）排版。`:root` 定义 `--paper` / `--ink` / `--muted` / `--line` / `--accent` 与字体栈。
2. **modern 层**：所有选择器都带 `:root[data-visual='modern']` 前缀。这是关键设计——classic 主题完全不受 modern 规则影响，两套视觉可以共存而不用拆文件。
3. **校准层**：文件后段（约 838 行起，注释「Refined flat direction」）对 modern 做二次覆盖，把早期的玻璃拟态收敛成更克制的扁平风。**后写优先**，所以前面同名规则的很多值其实已经失效。

这种「一个大文件 + 属性作用域」的做法省去了构建期 CSS 处理，代价是对层叠顺序敏感。新增规则前，先搜索目标选择器在文件中的位置：如果它在后面还有同名定义，你的修改可能不会生效。
