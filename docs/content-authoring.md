# 内容创作指南

## 新建一篇文章

1. 复制 `content/posts/_article-template.md`（带下划线前缀，不会被发布）；
2. 重命名为英文短横线文件名，例如 `my-new-article.md`——文件名会成为 URL 的 slug；
3. 填写 frontmatter，删掉模板里不需要的示例章节；
4. 确认 `draft: false` 后提交到 `main`，部署完成即上线。

模板里已经覆盖了标题、引用、列表、任务列表、代码块、表格、图片、分隔线等常用语法，可以直接当排版参考。

## 学习笔记

笔记与文章使用同一套 frontmatter、公式、目录和图片灯箱。复制 `content/notes/_note-template.md` 到对应课程目录，使用英文短横线文件名，完成后设置 `draft: false`；模板本身不进入内容集合。课程由所在目录确定，不需要另填课程字段，也不需要把课程名写成标签。

| 中文课程名 | 磁盘子目录 / 网页路径中的课程名 |
| --- | --- |
| 数学物理方程 | `equations-of-mathematical-physics` |
| 泛函分析 | `functional-analysis` |
| 数理统计 | `mathematical-statistics` |
| 智能计算基础 | `fundamentals-of-intelligent-computing` |
| 随机过程 | `stochastic-processes` |

例如 `content/notes/functional-analysis/normed-spaces.md` 发布到 `/notes/functional-analysis/normed-spaces`，课程主页为 `/notes/functional-analysis`，界面显示“泛函分析”。GitHub Pages 会自动加 `/inkroam/` 前缀，无须写进文件或链接。

`/notes` 显示课程入口与全部公开笔记的时间归档；课程页面只显示本课程笔记。全部归档包含文章与笔记，首页的最近文章和精选文章仍只包含文章，最近笔记单独按日期倒序展示，数量由外观面板的“最近笔记”独立控制。搜索与标签页包含两种内容。空课程也保留入口，草稿不进入公开列表。

新增课程时，在 `app/utils/courses.ts` 添加英文 slug 与中英文名称，再创建同名磁盘目录。当前支持 `课程/笔记.md` 两级结构，不支持课程下继续嵌套目录；避免在 frontmatter 手动覆盖 `path`。

构建后运行 `node --experimental-strip-types scripts/check-notes.mjs` 检查首页模块顺序、导航顺序、五个课程静态页面及中文标题。首次实现已用临时公开/草稿笔记验证课程隔离、正文公式、搜索索引与草稿过滤，测试内容不保留在发布目录。

## Frontmatter 字段（文章与笔记共用）

定义在 `content.config.ts`，字段缺失时使用括号里的默认值：

| 字段 | 类型 | 默认 | 作用 |
| --- | --- | --- | --- |
| `title` | string | 必填 | 文章标题，也用于 `<title>` 与列表 |
| `description` | string | 必填 | 一句话摘要，出现在首页、归档与搜索 |
| `date` | string | 必填 | `YYYY-MM-DD`，归档分组与排序依据 |
| `tags` | string[] | `[]` | 第一个标签会显示在列表元信息里 |
| `readingTime` | string | `'5 分钟'` | 阅读时长文案 |
| `aiGenerated` | boolean | `false` | 显示「AI 生成」标识 |
| `aiAssisted` | boolean | `false` | 显示「AI 辅助」标识 |
| `pinned` | boolean | `false` | 置顶，排序优先级最高 |
| `featured` | boolean | `false` | 进入首页「精选文章」区块 |
| `draft` | boolean | `false` | 草稿，不进首页/归档/搜索/标签页 |

排序规则（`app/pages/index.vue`）：先按 `pinned DESC`，再按 `date DESC`。

四种标识的显示位置：

| 标识 | 首页列表 | 精选区块 | 归档 | 文章页 |
| --- | --- | --- | --- | --- |
| 置顶 | ✅ | — | — | ✅ |
| 精选 | ✅ | — | ✅ | ✅ |
| AI 生成 | ✅ | ✅ | ✅ | ✅ |
| AI 辅助 | ✅ | ✅ | ✅ | ✅ |

## 标签与 slug

标签通过 `app/utils/tags.ts` 做中文名 ↔ URL slug 的双向映射：

```ts
export const tagSlugMap: Record<string, string> = {
  '写作': 'writing',
  '图像生成': 'image-generation',
  // …
}
export const getTagSlug = (name: string) => tagSlugMap[name] || encodeURIComponent(name)
export const getTagName = (slug: string) => tagNameMap[slug] || decodeURIComponent(slug)
```

**新增中文标签时，请同时补一条 ASCII 映射。** 未映射的标签会走 `encodeURIComponent`，在 GitHub Pages 的 `BASE_PATH` 构建里可能触发 `/tags/...` 路由 prerender 500（`nitro.prerender.failOnError: true` 会让整个构建失败）。排查步骤见 [deployment-github-pages.md](deployment-github-pages.md#常见构建失败)。

## 内嵌 PDF

将文件放进 `public/pdfs/`，在笔记 Markdown 中使用：

```md
::pdf-viewer{src="/pdfs/functional-analysis/lecture-01.pdf" title="泛函分析 · 第一讲"}
::
```

上述示例对应磁盘 `public/pdfs/functional-analysis/lecture-01.pdf`。组件会自动添加 GitHub Pages 的 `/inkroam/` 基础路径，不要手动写仓库前缀。只接受本地 PDF 路径，不接受外部网址、查询参数或父目录跳转。

`app/components/content/PdfViewer.vue` 使用浏览器原生 PDF 内嵌能力，在正文中提供响应式阅读区域；翻页、缩放等控件由浏览器提供。部分浏览器尤其移动端可能无法内嵌或体验有限，组件始终保留“打开原文件”入口。当前尚未接入 PDF.js，不能保证跨浏览器统一阅读体验。

Markdown 入口照常进入课程、归档及搜索，但 PDF 内部文字不参与站内搜索；可将摘要和重要概念写在附件前面。PDF 全文索引需要额外文本提取，扫描件还需要 OCR。

## 图片用法

- 图片文件放进 `public/images/`；
- Markdown 里用**以 `/images/` 开头的绝对路径**：

```md
![图片替代文字](/images/my-image.png)
```

构建时 Nuxt 会按 `BASE_PATH` 重写路径，线上实际输出为 `/inkroam/images/my-image.png`，无需手写仓库前缀。

图片进入文章后会自动获得灯箱能力（点击放大、双击/滚轮缩放），并继承 `.article-content img` 的 `max-width: 100%; height: auto;`，不会变形。行为细节见 [article-image-lightbox.md](article-image-lightbox.md)。

图片下方的说明文字用普通段落书写即可；如果用 `<figure>` + `<figcaption>`，样式也已就绪。

## 数学公式

支持 LaTeX 公式，行内公式使用 `$...$`，独立公式使用单独成行的 `$$`：

```md
质能关系是 $E = mc^2$。

$$
\frac{1}{r^2} = \frac{8\pi G}{3c^2}\rho
$$
```

公式由 `remark-math` 和 `rehype-katex` 在构建时渲染，字体随站点打包。长公式在窄屏上可以横向滚动。展示公式源码时请使用行内代码或代码块；普通文本中的美元符号可以写成 `\$`。

## 搜索是如何工作的

搜索页用了两条数据源（`app/pages/search.vue`）：

1. `queryCollection('posts')`：拿全量文章，用于**标题匹配**；
2. `queryCollectionSearchSections('posts', { extraFields: ['description', 'date', 'tags', 'readingTime', 'draft'] })`：把正文按标题切成小节，用于**正文匹配**。

匹配逻辑是「空格分词 + 每词都必须命中」（AND），章节标题命中的每个词得 3 分。结果按文章路径归并，一篇文章只出现一次；文章标题匹配优先，其余按最佳章节分数、日期倒序排列。每篇默认展示前三处命中，其余可展开，章节链接直接定位到正文。关键词以文本节点高亮，不使用 HTML 注入。

这意味着：**小节标题写得好，搜索体验就好**。用 `##` / `###` 给内容分段，比写一大段长文更容易被搜到。

### 搜索中的公式

搜索匹配索引跳过 KaTeX 的 `math`（MathML）及 `annotation` / `annotation-xml` 节点，避免重复匹配。显示摘要则由 `app/utils/search-excerpt.ts` 从正文结构中单独提取：普通文字和完整公式分别保存，公式只取外层 KaTeX 中的一份 TeX 注解，绝不拼接多份渲染层。

`SearchExcerpt.vue` 将公式交给 KaTeX 排版，保留根号、分式、上下标；摘要截取不会截断公式，长公式可横向滚动。普通文字继续通过文本节点进行关键词高亮，公式使用 `trust: false` 禁止可信扩展，无法排版时显示“公式请见正文”。手写代码块中的公式源码仍作为普通内容保留。

回归验证：执行 `npm run generate` 后运行 `node --experimental-strip-types scripts/check-search-math.mjs`，使用实际黑洞文章检查索引去重、段落链接、摘要公式完整性及根号和分式排版。脚本使用当前固定版本 Content 的内部分节函数，升级该依赖时需同步检查。

结果元信息只显示首个标签，与首页分类规则一致，其余标签仍保留在文章中。“标题匹配”提示已移除，标题命中仍优先排序并保留关键词高亮。

## 文章目录

文章侧栏自动读取 Content 的 `body.toc.links`，显示二、三级标题，无需额外填写 frontmatter。电脑和手机都可展开、收起，桌面初始展开，手机初始折叠；随滚动标记当前章节。没有标题的文章不显示目录。实现位于 `app/components/ArticleToc.vue`，链接复用正文标题 ID 和现有锚点偏移，在页内平滑滚动，不触发页面入场动画。

## 发布前检查

- [ ] 文件放在 `content/posts/`，名字是英文短横线格式；
- [ ] `title` / `description` / `date` 已填写；
- [ ] 新用到的中文标签已在 `app/utils/tags.ts` 补上 ASCII slug；
- [ ] 需要置顶 / 精选 / AI 标识的字段已设置；
- [ ] `draft: false`；
- [ ] 本地 `npm run dev` 看过一遍排版（尤其是图片与代码块）；
- [ ] `npm run typecheck` 通过（新增内容通常不影响类型，但改 schema 会）。

## 常见问题

**文章不显示？**
先确认 `draft: false`，再确认文件名不是以下划线开头（下划线文件会被当作模板排除）。

**归档里年份不对？**
归档按 `date` 的前四位分组，日期格式必须是 `YYYY-MM-DD`。

**构建失败，报某个 `/tags/...` 路由 500？**
中文标签缺 slug 映射，按上文补 `tagSlugMap`。

**想给文章加封面图？**
目前 schema 没有 `cover` 字段。文章内的图片用 Markdown 写法即可；如果需要封面，需要先扩展 `content.config.ts` 的 schema 并在列表组件里消费该字段。

**改了 `content.config.ts` 的 schema 之后页面报错？**
Content 3 的索引需要重建，重启 `npm run dev` 或重新 `npm run generate`。
