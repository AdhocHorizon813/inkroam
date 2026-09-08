# 文档索引

这里记录「纸上漫游」的设计意图、实现细节与维护须知。动新功能前先读相关文档，可以少踩坑，也能保住那些「看起来多余、其实有用」的细节。

| 文档 | 内容 |
| --- | --- |
| [architecture.md](architecture.md) | 技术栈、目录结构、渲染模型、数据流与 SEO |
| [visual-system.md](visual-system.md) | 双主题视觉系统：颜色、字体、排版、材质、背景 |
| [aesthetic-principles.md](aesthetic-principles.md) | 审美原则：克制、动效性格、层次与取舍（几乎不含代码） |
| [motion-and-interaction.md](motion-and-interaction.md) | 缓动曲线、导航指示器、面板展开、路由动画 |
| [ui-components.md](ui-components.md) | 界面组分逐个讲：顶栏、页面切换、外观面板、首页、文章页、列表、徽章 |
| [article-image-lightbox.md](article-image-lightbox.md) | 文章图片灯箱：缩放、平移、键盘与无障碍 |
| [content-authoring.md](content-authoring.md) | Frontmatter 字段、标签 slug、图片与发布流程 |
| [deployment-github-pages.md](deployment-github-pages.md) | GitHub Pages 部署、子路径与已知问题 |

## 按任务找文档

- 改颜色 / 排版 / 材质 → [visual-system.md](visual-system.md)，先看「层叠顺序」一节；
- 判断一个视觉 / 动效改动该不该做 → [aesthetic-principles.md](aesthetic-principles.md)；
- 加动效 / 改过渡 → [motion-and-interaction.md](motion-and-interaction.md)，复用现有缓动变量；
- 改顶栏 / 外观面板 / 列表等具体界面 → [ui-components.md](ui-components.md)；
- 写一篇文章 → [content-authoring.md](content-authoring.md)；
- 构建失败 / 部署异常 → [deployment-github-pages.md](deployment-github-pages.md) 的排查清单；
- 动灯箱 → [article-image-lightbox.md](article-image-lightbox.md)。

## 一条约定

`app/assets/css/main.css` 是单文件、靠层叠顺序生效的样式表。**后写的规则会覆盖前面的同名规则**，修改前请先确认目标选择器在文件中的位置。详情见 [visual-system.md](visual-system.md#层叠顺序)。
