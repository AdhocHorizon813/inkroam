export default defineNuxtConfig({
  modules: ['@nuxt/content'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  content: {
    experimental: { sqliteConnector: 'native' },
  },
  runtimeConfig: {
    public: {
      siteUrl: 'http://localhost:3000',
    },
  },
  nitro: {
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
