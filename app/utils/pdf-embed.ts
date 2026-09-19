/* 浏览器能否把 PDF 内嵌进页面。这是唯一判据，外观面板与 PdfViewer 共用一份规则：
   只看能力，不看设备类型、也不看屏幕宽度，所以平板、手机横屏、平板「请求桌面版网站」
   都会落到同一结果，不会把能内嵌的平板误判成手机。

   1) navigator.pdfViewerEnabled 有值就直接采信：Chrome / Firefox for Android 报 false，
      iPad 与桌面浏览器报 true；
   2) 老浏览器没有该属性时，只把 Android 当作不能内嵌（旧版 Android Chrome），其余保持内嵌；
   3) 服务端没有 navigator，返回 false —— 预渲染产物统一先出卡片，挂载后再按真实能力升级。 */
export function supportsEmbeddedPdf(
  nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): boolean {
  if (!nav) return false
  const supported = (nav as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled
  if (typeof supported === 'boolean') return supported
  return !/Android/i.test(nav.userAgent)
}
