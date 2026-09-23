<script setup lang="ts">
import { articleExcerptSections, excerptParts } from '~/utils/search-excerpt'
import { groupSearchMatches } from '~/utils/search-results'
useSeoMeta({
  title: '搜索',
  description: '搜索纸上漫游的全部文章、学习笔记与正文内容。',
})

const route = useRoute()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')

const { data: posts } = await useAsyncData('search-posts', () =>
  queryCollection('posts')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .all(),
)

const { data: sections } = await useAsyncData('post-search-sections-readable-math', () =>
  queryCollectionSearchSections('posts', {
    // KaTeX renders both MathML (including TeX annotations) and visible HTML.
    // Index the visible representation once; keep article accessibility intact.
    ignoredTags: ['math', 'annotation', 'annotation-xml', 'script', 'style'],
    extraFields: ['description', 'date', 'tags', 'readingTime', 'draft'],
  })
    .where('draft', '=', false),
)

const normalize = (value: string) => value.toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim()

const searchTerms = computed(() => normalize(query.value).split(' ').filter(Boolean))
const previewSections = computed(() => {
  const result = new Map()
  for (const post of posts.value || []) {
    for (const [id, parts] of articleExcerptSections(post.body, post.path, post.description)) result.set(id, parts)
  }
  return result
})

const contentResults = computed(() => {
  const searchValue = query.value.trim()
  const terms = searchTerms.value
  if (!terms.length) return []

  return (sections.value || [])
    .map((section) => {
      const sectionHeading = section.level > 1 ? section.title : ''
      const searchable = normalize([sectionHeading, section.content].join(' '))

      if (!terms.every(term => searchable.includes(term))) return null

      const normalizedHeading = normalize(sectionHeading)
      const score = terms.reduce((total, term) => total + (normalizedHeading.includes(term) ? 3 : 0), 0)

      return {
        ...section,
        score,
        excerpt: excerptParts(previewSections.value.get(section.id) || [{ kind: 'text', text: section.content || section.description || '' }], searchValue),
      }
    })
    .filter((section): section is NonNullable<typeof section> => section !== null)
    .sort((a, b) => b.score - a.score || String(b.date).localeCompare(String(a.date)))
})

const matchesByPath = computed(() => groupSearchMatches(contentResults.value))

const articleResults = computed(() => {
  const terms = searchTerms.value
  if (!terms.length) return []
  return (posts.value || []).map(post => {
    const titleMatch = terms.every(term => normalize(post.title).includes(term))
    const matches = matchesByPath.value.get(post.path) || []
    return { ...post, titleMatch, matches, score: titleMatch ? 100 : Math.max(0, ...matches.map(section => section.score)) }
  }).filter(post => post.titleMatch || post.matches.length)
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
})

const totalResults = computed(() => articleResults.value.length)

watch(() => route.query.q, (value) => {
  const nextQuery = typeof value === 'string' ? value : ''
  if (nextQuery !== query.value) query.value = nextQuery
})

function submitSearch() {
  const searchValue = query.value.trim()
  navigateTo({
    path: '/search',
    query: searchValue ? { q: searchValue } : {},
  }, { replace: true })
}

const formatDate = (date: string) => date.replaceAll('-', '.')
</script>

<template>
  <main class="standard-page search-page">
    <section class="page-intro compact-intro">
      <p class="eyebrow">SEARCH</p>
      <h1>搜索文章与笔记</h1>
      <p>从标题、章节与正文中寻找留下的文字。</p>

      <form class="search-form" role="search" @submit.prevent="submitSearch">
        <label class="visually-hidden" for="site-search">搜索全部文章与笔记</label>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          id="site-search"
          v-model="query"
          class="search-input"
          type="search"
          name="q"
          placeholder="输入标题、主题或正文关键词"
          autocomplete="off"
          spellcheck="false"
        >
        <button type="submit">搜索</button>
      </form>
    </section>

    <section class="search-results" aria-live="polite" aria-label="搜索结果">
      <div v-if="query.trim()" class="search-results__heading">
        <span>搜索结果</span>
        <span>{{ totalResults }} 篇内容</span>
      </div>

      <div v-if="articleResults.length" class="search-group">
        <article
          v-for="post in articleResults"
          :key="post.path"
          class="search-result search-result--grouped"
        >
          <div class="search-result__meta">
            <time :datetime="post.date">{{ formatDate(post.date) }}</time>
            <span v-if="post.tags?.[0]">{{ post.tags[0] }}</span>
          </div>
          <h2><NuxtLink :to="post.path"><SearchHighlight :text="post.title" :terms="searchTerms" /></NuxtLink></h2>
          <p><SearchHighlight :text="post.description" :terms="searchTerms" /></p>
          <ul v-if="post.matches.length" class="search-matches">
            <li v-for="match in post.matches.slice(0, 3)" :key="match.id">
              <NuxtLink :to="match.id">
                <span class="search-match__title"><SearchHighlight :text="match.level > 1 ? match.title : '摘要与开篇'" :terms="searchTerms" /> <span aria-hidden="true">↗</span></span>
                <span class="search-match__excerpt"><SearchExcerpt :parts="match.excerpt" :terms="searchTerms" /></span>
              </NuxtLink>
            </li>
          </ul>
          <SearchMoreMatches v-if="post.matches.length > 3" :key="query" :count="post.matches.length - 3">
            <ul class="search-matches">
              <li v-for="match in post.matches.slice(3)" :key="match.id">
                <NuxtLink :to="match.id">
                  <span class="search-match__title"><SearchHighlight :text="match.level > 1 ? match.title : '摘要与开篇'" :terms="searchTerms" /> <span aria-hidden="true">↗</span></span>
                  <span class="search-match__excerpt"><SearchExcerpt :parts="match.excerpt" :terms="searchTerms" /></span>
                </NuxtLink>
              </li>
            </ul>
          </SearchMoreMatches>
        </article>
      </div>

      <p v-if="query.trim() && !totalResults" class="search-empty">没有找到相关内容，试试更短或不同的关键词。</p>
      <p v-else-if="!query.trim()" class="search-empty">输入关键词后，将搜索所有已发布的文章与笔记。</p>
    </section>
  </main>
</template>

<style scoped>
.search-result--grouped:hover { transform: none; }
.search-result__meta { flex-wrap: wrap; }
.search-matches { list-style: none; padding: 0; margin: 18px 0 0; border-left: 1px solid var(--line); }
.search-matches li + li { margin-top: 14px; }
.search-matches a { display: block; padding: 4px 0 4px 16px; }
.search-match__title { display: block; color: var(--ink); font-size: 13px; line-height: 1.7; }
.search-match__excerpt { display: block; margin-top: 4px; color: var(--muted); font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
.search-matches a:hover .search-match__title { color: var(--accent); }
</style>
