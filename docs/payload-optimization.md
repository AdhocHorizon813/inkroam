# 页面数据精简：实现与前后对比

记录日期：2026-09-22。本文说明代码层面的数据优化，不是文章修改历史，也没有向正文添加更新时间。

## 结论

这次做的是**按页面用途选择查询字段**：列表只拿列表需要的信息，不再附带每篇文章的完整正文。没有压缩或删除 Markdown 原文，没有删减公式、图片或 PDF，也没有减少公开文章数量。

Nuxt 的 `useAsyncData` 查询结果会进入页面数据 payload，用于客户端恢复状态。以前即使列表模板只显示标题与摘要，查询返回的 `body` 仍然存在于结果中；“页面没显示正文”不等于“没有把正文数据交给客户端”。

## 原来的问题

首页、归档、课程列表、话题详情和相关阅读使用类似查询：

```ts
queryCollection('posts')
  .where('draft', '=', false)
  .order('date', 'DESC')
  .all()
```

没有限定字段，返回完整内容记录。对于渲染后的 Markdown，`body` 不只是纯文字，还包含结构化节点；数学公式的 KaTeX 结构也在其中。相关阅读只需比较标签、显示标题，却会拿到其他公开文章的整篇正文。

因此，问题不在于某篇正文太长，而在于**不需要正文的地方也查询了正文**。

## 具体如何修改

### 1. 定义共享的轻量条目

新增 `app/utils/entry-summary.ts`：

```ts
export const entrySummaryFields = [
  'path', 'title', 'description', 'date', 'tags', 'readingTime',
  'pinned', 'featured', 'aiGenerated', 'aiAssisted', 'order',
] as const

export type EntrySummary = Pick<
  PostsCollectionItem,
  typeof entrySummaryFields[number]
>
```

| 保留字段 | 用途 |
| --- | --- |
| `path` | 打开文章或笔记，区分内容类型和课程 |
| `title`、`description` | 列表标题与摘要 |
| `date`、`order` | 日期排序、归档、可选课程顺序 |
| `tags` | 标签展示、筛选、相关性计算 |
| `readingTime` | 阅读时长 |
| `pinned`、`featured`、`aiGenerated`、`aiAssisted` | 置顶、精选和 AI 标识 |

不再为这些列表选择 `body`，也不携带其他不在字段清单中的内容元数据。`draft` 仍在查询条件中用于排除草稿，只是不需要返回给列表显示。

### 2. 从查询端限制返回字段

```ts
queryCollection('posts')
  .select(...entrySummaryFields)
  .where('draft', '=', false)
  .order('date', 'DESC')
  .all()
```

这是查询结果层面的精简，不是在组件拿到完整数据后再隐藏正文。

| 使用位置 | 调整后读取的数据 |
| --- | --- |
| `app/pages/index.vue` | 最近文章、最近笔记、精选文章均为轻量条目 |
| `app/pages/archive.vue` | 归档所需的轻量条目 |
| `app/pages/notes/index.vue` | 全部笔记的轻量条目 |
| `app/pages/notes/[course]/index.vue` | 当前课程的轻量条目 |
| `app/pages/tags/[tag].vue` | 公开内容的轻量条目，再按标签及类型筛选 |
| `app/components/RelatedEntries.vue` | 用轻量条目比较标签、选出相关阅读 |
| `app/components/CourseNavigation.vue` | 仅当前课程的 `path/title/date/order` 四个字段 |

`RecentEntries`、`TimelineArchive` 和 `RelatedEntries` 的相关类型同步改为 `EntrySummary`，使组件不再要求传入完整文章记录。

话题目录及首页话题探索原本已经只查询 `path/tags`，本次没有把它们改成更大的通用字段集。

### 3. 保留真正需要正文的查询

- `ArticleReader` 仍然读取当前文章的完整内容，用于正文、章节目录、公式、图片和内嵌组件。
- 搜索页仍保留所需正文及分节索引，用于全文匹配和完整公式摘要；不能为了减少体积把公式排版能力删掉。
- 源 Markdown、PDF 附件、图片、字体等没有因为本次精简被压缩或改写。
- 原有草稿过滤、文章数量设置、课程分类、标签和标识仍然保留。

## 实测前后对比

在本轮优化前读取已有静态产物大小，完成修改后以 `BASE_PATH=/inkroam/` 重新运行 `npm run generate` 并测量同一路径。内容源正文不变；这次构建也包含同轮的课程导航和筛选状态修改，**不是只切换一个变量的独立性能基准实验**。

| 页面数据文件 | 修改前 | 修改后 | 减少字节 | 减少比例 |
| --- | ---: | ---: | ---: | ---: |
| `.output/public/_payload.json`（首页） | 430,326 B | 6,667 B | 423,659 B | 98.45% |
| `.output/public/posts/004world-inside-a-black-hole/_payload.json` | 413,606 B | 131,561 B | 282,045 B | 68.19% |

比例计算：`(修改前 - 修改后) / 修改前 × 100%`。

首页下降更明显，是因为它本身不需要任何文章正文；黑洞文章页仍需保留当前篇较大的正文及公式结构，只移除了相关阅读列表所携带的其他正文，因此不会降到首页一样小。

### 这些数字不代表什么

- 这是两个**未压缩数据文件**的字节数，不是整个网站体积，也不是总页面下载量。
- 不能据此声称首屏速度提升了 98.45%；实际速度还受 HTML、JS、CSS、字体、图片、PDF、网络和缓存影响。
- 没有测量 gzip/Brotli 后的传输大小、Core Web Vitals、运行时内存或 SQLite 数据库体积。
- 减少了不必要的数据序列化与客户端数据量，但具体加载耗时改善需要单独实测。
- 没有做分页或推荐索引预计算。当前相关内容查询仍返回全部公开条目的摘要，内容规模继续增长时可再优化。

## 验证与复现

PowerShell：

```powershell
$env:BASE_PATH='/inkroam/'
npm.cmd run generate
node --experimental-strip-types scripts/check-reading-polish.mjs --built
Get-Item '.output/public/_payload.json', '.output/public/posts/004world-inside-a-black-hole/_payload.json' |
  Select-Object FullName, Length
```

`check-reading-polish.mjs --built` 会解析真实 payload，检查首页、归档、笔记、话题及文章页的数组记录不含 `body/rawbody`，同时确认正文页仍有当前文章的完整 `body`。

本轮还通过了类型检查、话题统计与静态链接检查、笔记回归、搜索公式回归和最近内容数量设置回归。浏览器真实网络面板测速不在这次验证范围内。

修改前数字是本轮修改之前记录的基线，不是保存在仓库中的旧产物；现在重跑构建只能复核当前结果。未来文章数量或内容变化后，应重新建立同一内容基线，不能直接把新的大小与本表比较后全部归因于代码。

## 维护原则

新增列表字段时，同时更新 `entrySummaryFields` 与消费组件，不要为了一个字段退回无选择的全量查询。若只有个别页面需要特殊字段，优先为该查询明确补充，避免所有列表都携带它。
