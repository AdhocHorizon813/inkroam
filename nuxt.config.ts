export default defineNuxtConfig({
  modules: ['@nuxt/content'],
  css: ['katex/dist/katex.min.css', '~/assets/css/main.css'],
  devtools: { enabled: false },
  content: {
    experimental: { sqliteConnector: 'native' },
    build: {
      markdown: {
        remarkPlugins: { 'remark-math': {} },
        rehypePlugins: { 'rehype-katex': {} },
      },
    },
  },
  runtimeConfig: {
    public: {
      siteUrl: 'http://localhost:3000',
    },
  },
  nitro: {
    hooks: {
      'prerender:generate'(route) {
        if (route.route !== '/404.html' || typeof route.contents !== 'string') return
        const base = ((globalThis as any)?.process?.env?.BASE_PATH || '/') as string
        const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        // Nuxt's static 404 is a client fallback. Keep a way out without JS.
        const fallback = `<noscript><div class="site-shell"><main class="standard-page"><header class="page-intro"><p class="eyebrow">404 / PAGE NOT FOUND</p><h1>这一页不在这里。</h1><p>可以从首页、归档或搜索继续浏览。</p></header><p><a class="text-link" href="${escape(base)}">返回首页</a></p><p><a class="text-link" href="${escape(base)}archive/">浏览归档</a></p><p><a class="text-link" href="${escape(base)}search/">搜索文章与笔记</a></p></main></div></noscript>`
        route.contents = route.contents.replace('</body>', `${fallback}</body>`)
      },
    },
    prerender: {
      failOnError: true,
    },
  },
  app: {
    // GitHub Pages 子路径部署时由 Actions 注入 BASE_PATH（如 /仓库名/）；本地默认 '/'
    baseURL: (globalThis as any)?.process?.env?.BASE_PATH || '/',
    head: {
      htmlAttrs: {
        lang: 'zh-CN',
        'data-visual': 'modern',
        'data-material': 'mica',
        'data-nav-material': 'mica',
        'data-dropdown-material': 'mica',
        'data-background': 'flat',
        'data-color-mode': 'dark',
      },
      titleTemplate: '%s · 纸上漫游',
      meta: [
        { name: 'description', content: '关于技术、生活与长期思考的个人博客。' },
        { name: 'theme-color', content: '#0a0d1b' },
        { name: 'color-scheme', content: 'light dark' },
      ],
    },
  },
  vite: {
    server: {
      // Allow access over temporary tunnels (cloudflared / localtunnel / ngrok) for phone preview.
      // A leading dot matches the domain and all its subdomains.
      allowedHosts: ['.trycloudflare.com', '.loca.lt', '.ngrok-free.app', '.ngrok.io'],
    },
  },
  compatibilityDate: '2026-08-01',
})
