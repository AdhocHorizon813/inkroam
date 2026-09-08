# 内容创作指南

## 新建一篇文章

1. 复制 `content/posts/_article-template.md`（带下划线前缀，不会被发布）；
2. 重命名为英文短横线文件名，例如 `my-new-article.md`——文件名会成为 URL 的 slug；
3. 填写 frontmatter，删掉模板里不需要的示例章节；
4. 确认 `draft: false` 后提交到 `main`，部署完成即上线。

模板里已经覆盖了标题、引用、列表、任务列表、代码块、表格、图片、分隔线等常用语法，可以直接当排版参考。

## Frontmatter 字段

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

## 图片

- 图片文件放进 `public/images/`；
- Markdown 里用**以 `/images/` 开头的绝对路径**：

```md
![图片替代文字](/images/my-image.png)
```

构建时 Nuxt 会按 `BASE_PATH` 重写路径，线上实际输出为 `/inkroam/images/my-image.png`，无需手写仓库前缀。

图片进入文章后会自动获得灯箱能力（点击放大、双击/滚轮缩放），并继承 `.article-content img` 的 `max-width: 100%; height: auto;`，不会变形。行为细节见 [article-image-lightbox.md](article-image-lightbox.md)。

图片下方的说明文字用普通段落书写即可；如果用 `<figure>` + `<figcaption>`，样式也已就绪。

## 搜索是如何工作的

搜索页用了两条数据源（`app/pages/search.vue`）：

1. `queryCollection('posts')`：拿全量文章，用于**标题匹配**；
2. `queryCollectionSearchSections('posts', { extraFields: ['description', 'date', 'tags', 'readingTime', 'draft'] })`：把正文按标题切成小节，用于**正文匹配**。

匹配逻辑是「空格分词 + 每词都必须命中」（AND），标题命中的小节得 3 分，其余按日期倒序。结果分两组展示，正文结果会截取命中词前后的片段作为摘要。

这意味着：**小节标题写得好，搜索体验就好**。用 `##` / `###` 给内容分段，比写一大段长文更容易被搜到。

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
