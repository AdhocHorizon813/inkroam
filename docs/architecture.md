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
  assets/css/site.css         全站样式的有序入口
  components/
    AppearancePanel.vue       外观面板（主题/材质/背景/氛围色/文章数量/PDF 附件）
    SlidingNav.vue            主导航 + 滑动指示器
    ThemeToggle.vue           深浅色快捷开关
    ImageLightbox.vue         文章图片灯箱
    *Badge.vue                置顶 / 精选 / AI 生成 / AI 辅助 标识
  pages/
    index.vue                 首页：hero + 最近文章 + 最近笔记 + 精选 + 宣言
    archive.vue               按年份分组的归档
    about.vue                 关于页
    search.vue                标题 + 正文分节搜索
    posts/[slug].vue          文章页
    notes/index.vue           课程目录 + 全部笔记归档
    notes/[course]/index.vue  单课程时间归档
    notes/[course]/[slug].vue 笔记正文（复用 ArticleReader）
    tags/[tag].vue            标签聚合页
  utils/tags.ts               标签名 ↔ slug 双向映射
  utils/pdf-embed.ts          能否内嵌 PDF 的判据（PdfViewer 与外观面板共用）
content/posts/*.md            文章源文件
content/notes/*/*.md          课程文件夹中的笔记源文件
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

数据精简的完整实现说明、字段清单与前后测量见 [页面数据精简](payload-optimization.md)。

首页查询文章和笔记各一次。[首页](../app/pages/index.vue)先用当前解锁会话补全文章摘要，再从完整列表分别取最近文章与精选文章。精选的数量、行和空状态读同一个结果，因此超出最近条数的文章也能在解锁后进入精选。课程前后篇和阅读线索同样共用一次摘要映射。

[解锁会话](../app/composables/useUnlockedNotes.ts)按文档 ID 保存内容，用仅含路径和 ID 的派生索引定位摘要。重锁会替换会话记录并使索引失效。解锁得到的标题、标记和正文只在客户端内存使用，Nuxt 查询缓存保存公开记录。

列表与相关阅读使用 `entrySummaryFields` / `EntrySummary`。正文阅读页读取当前篇完整内容，课程前后篇只查询当前课程的 path/title/date/order。

[搜索页](../app/pages/search.vue)使用两份数据。Nuxt Content 的分节索引负责全文匹配、评分与章节链接。`search-post-previews` 负责文章标题、日期、标签与结果预览。查询回调在序列化前从正文提取各章节的文字与完整 TeX 片段，键为分节 ID。修改公式摘要边界时，从 [search-excerpt.ts](../app/utils/search-excerpt.ts) 入手。

回归：`node --experimental-strip-types scripts/check-reading-polish.mjs --built` 验证课程边界和生成 payload 不含列表正文；本地开发服务运行在 127.0.0.1:3000 后，可添加 `--live` 检查筛选网址的服务端输出。2026-09-22 同内容构建对比：首页未压缩 payload 从 430326 降到 6667 字节，黑洞文章从 413606 降到 131561 字节；这些是构建数据文件大小，不是总页面传输量或测速结果。

学习笔记复用 `posts` 集合：内容源包括 `posts/*.md` 与 `notes/*/*.md`，分别保留 `/posts` 和 `/notes` 路径前缀，因此归档、标签和分节搜索共用索引与草稿过滤。首页按路径拆分文章与笔记，不混入最近文章或精选文章。

`TimelineArchive.vue` 统一渲染全部归档、全部笔记、单课程笔记；`RecentEntries.vue` 统一渲染首页最近文章和最近笔记；`ArticleReader.vue` 统一处理文章/笔记正文。`courses.ts` 是课程注册表，`/notes` 的普通链接让静态生成器发现所有课程页面，包括空课程。课程磁盘目录用 `.gitkeep` 保留。

1. Markdown 存放在 `content/posts/*.md` 或 `content/notes/*/*.md`；
2. `content.config.ts` 用 Zod 定义共用的 `posts` collection（`type: 'page'`、两个内容源）和每个字段的默认值；
3. 页面在构建期用 `queryCollection('posts')` 取数，外层包 `useAsyncData` 做缓存与去重；
4. 搜索页额外用 `queryCollectionSearchSections('posts', { extraFields: [...] })` 取得按标题分节的索引，再在前端做多词 AND 匹配与打分。

所有查询都显式过滤 `draft: false`，草稿不会进入首页、归档、搜索和标签页。

## 状态管理

没有引入 Pinia。首页与外观面板共享独立的「最近文章数量」与「最近笔记数量」：

```ts
const latestPostCount = useState<LatestPostCount>('latest-post-count', () => 10)
const latestNoteCount = useState<LatestPostCount>('latest-note-count', () => 10)
```

外观偏好不走全局状态，直接持久化在 `localStorage`（见下），刷新后由 `AppearancePanel` 在 `onMounted` 读回。

旧 v5 配置保留原 `latestPostCount`，缺失的 `latestNoteCount` 使用 10；两项都只接受 5、10、`all`，分别保存与恢复，不修改存储键、不清空其他外观偏好。

PDF 附件的呈现偏好也走共享状态：`useState('pdf-fallback', () => 'card')`，取值 `card`（先给文件卡片）或 `reader`（直接打开页面内阅读器）。外观面板的分段控件与 `PdfViewer` 卡片上的「始终在页面内阅读」勾选框都只改这一份状态，面板 `watch` 它回写 `state.pdfFallback`，再交给既有的 `watch(state)` 统一持久化——两处入口不会各自去写 `localStorage`。旧配置没有该字段时默认为 `card`，不需要升级存储键。该偏好只在浏览器不能内嵌 PDF 时生效：能内嵌的浏览器上面板会在选项上方说明「当前浏览器支持内嵌，此项不生效」，并按其它设置项同样的方式整组 `:disabled`，判断用的 `supportsEmbeddedPdf()`（`utils/pdf-embed.ts`）与 `PdfViewer` 是同一份实现。

## 外观偏好的存储

| Key | 内容 |
| --- | --- |
| `paper-trail-appearance-v5` | 主配置 JSON：`visual` / `colorMode` / 三种材质 / 三档模糊 / 遮罩透明度 / `accent` / `latestPostCount` / `latestNoteCount` / `pdfFallback` / `diagramScale`（Mermaid 图的显示比例，0–100） |
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

### 正文导出资源

[导出模块](../app/utils/article-export.ts)在预览就绪前管理 iframe，失败或取消时负责移除。就绪后由 [ArticleTools](../app/components/ArticleTools.vue) 接管。PDF 等待打印结束，有两分钟兜底；PNG 生成后释放预览，下载地址最多保留一分钟。离开文章或重新锁定文档会卸载工具并清理资源。

### 卡片与路由的过渡由谁收尾

[玻璃指示器](../app/utils/glass-controls.ts)在每次横拖事件中读取各可选按钮的中心，同一读数用于判断最近选项和限制两端行程。下一次事件按当时的位置重新测量。松手时先读取落点按钮的位置和尺寸，再启动大小与位置弹簧。

正文玻璃在滤镜解码后接管卡片底色。[glass-content.ts](../app/utils/glass-content.ts) 给宿主加上一帧 `data-glass-tint-handoff`，强制本次底色切换立即生效。下一帧或提前销毁时都会撤掉标记。卡片自己的内联过渡可以在此期间独立修改。

一次切页的入场动效归 [app.vue](../app/app.vue) 中当次路由 watcher 管理。准备绘制时，目标带有 `data-route-enter-pending`。两帧后播放入场。快速切页或卸载时，watcher 撤掉等待标记、取消待执行帧和已启动的动画。搜索页只移动文字等子内容，卡片边界保持原位。

在阅读外观二级菜单里，轨道跟随选项组，滑块跟随选中项。两者需要手动裁剪时，`alignAllOptics` 在一次对齐内共享面板、滚动区与展开区的边界，分别保留轨道外侧阴影和滑块圆角的裁剪规则。稳定展开时，支持 CSS 锚点的浏览器自行定位轨道。

[DepthReceivers](../app/components/DepthReceivers.vue) 分别更新发光的导航和接收光的卡片。导航的可见边界随滚动与展宽实时测量。正文卡片的布局位置在尺寸或内容变化时重读，滚动时用页面偏移换算；只有布局、滚动位置或投影区域尺寸变化才重新裁剪卡片遮罩。

### 样式入口

[全站入口](../app/assets/css/site.css)列出全站 CSS 的实际加载顺序。每个文件同时收录该功能的主题与屏幕尺寸分支。Nuxt 随后加载层次投影。正文技术排版随文章阅读器导入；播放器、玻璃适配器和导航光带各自拥有组件样式。

| 要修改的效果 | 从哪里开始 |
| --- | --- |
| 页面与显示面板滚动槽、拇指几何和淡出 | [page-scroll.css](../app/assets/css/page-scroll.css)；JS 向拇指写入位移与高度。 |
| 主题变量、全站重置、页面外壳与路由动效 | [main.css](../app/assets/css/main.css)。首屏模糊兜底和导航时长等共享参数也在此处。 |
| 壁纸、极光、氛围色与背景遮罩 | [background.css](../app/assets/css/background.css)。画布消费主题变量，独立于前景卡片。 |
| 导航、品牌、展宽端点与横屏间距 | [navigation.css](../app/assets/css/navigation.css)。吸顶位置还须与页面外壳的顶部留白配对。 |
| 首页、归档、关于、文章列表及跨页面标题排版 | [editorial.css](../app/assets/css/editorial.css)。例如列表元数据的间距在 `.story-meta`。 |
| 正文网格、侧栏和 Markdown 基础排版 | [article-reader.css](../app/assets/css/article-reader.css)。侧栏收起态由 ArticleReader.vue 控制，正文技术排版单独加载。 |
| 搜索结果、分组和课程目录 | [search-and-courses.css](../app/assets/css/search-and-courses.css)。 |
| 阅读面板、设置行、分段控件与底部入口定位 | [appearance-panel.css](../app/assets/css/appearance-panel.css)。两侧入口共用 `--dock-bottom-inset`。 |
| 卡片、导航和面板共用的基础表面与材质配方 | [surface-materials.css](../app/assets/css/surface-materials.css)。正文卡片的负层级材质也在此处。 |
| 列表与正文共用的 AI、精选、置顶标记 | [article-badges.css](../app/assets/css/article-badges.css)。 |
| 确认窗、遮罩、按钮强调与窄屏排列 | [confirm-dialog.css](../app/assets/css/confirm-dialog.css)。调用方为按钮指定 `__accent` 或 `__neutral`。 |
| 下拉面材质、原生 popover 的定位和向上收起时的对齐 | [dropdown.css](../app/assets/css/dropdown.css)。搜索、日历和正文工具共用 `.dropdown-surface`。向上贴边的规则只作用于带 `data-flip="up"` 的搜索浮层。 |
| 正文图片点击提示、图片查看器、缩放和进退场 | [image-lightbox.css](../app/assets/css/image-lightbox.css)，同一组规则包含窄屏与减少动态效果分支。 |
| 出厂材质与首屏衔接 | [appearance-defaults.ts](../app/utils/appearance-defaults.ts) 提供深浅预设与旧偏好兜底。Nuxt 取深色材质生成初始 HTML；面板挂载后将解析后的偏好写入根元素。CSS 的挂载前模糊值与图表比例由阅读外观专项对照。 |
| 导航展宽与光效 | main.css 的 `--nav-width-duration` 决定展宽时间，也供 [depth.css](../app/assets/css/depth.css) 的桌面延迟光效引用。按压折射由玻璃控件负责，实际投影表面由 DepthReceivers 定位。 |

**调整移动端两个入口的底距。** 在 appearance-panel.css 的 `max-width: 767.98px` 分支修改 `--dock-bottom-inset`。音乐与显示入口共用它；显示面板的底边再加 56px 给按钮留位。全屏音乐的内容内边距由 MusicPlayer 自己控制。

**调整确认窗。** 在 confirm-dialog.css 找 `.appearance-confirm__actions`。宽于 380px 时两列等宽，380px 及以下排成一列。默认设置弹窗强调“采用”，批量解密与导出明文强调“取消”。二次验钥的输入、提交与取消逻辑由 ArticleTools 负责。

### 媒体资源与轮盘入口

MusicPlayer 持有活动音频地址与各本地曲目的时长探测，移除曲目和销毁组件时应一起取消探测。PdfCanvasReader 分开保存正在读取的页文本与已完成的文本。快捷轮盘从原生操作按钮的 data-radial-action 取执行目标，新入口应在实际可点击的控件上标记。
