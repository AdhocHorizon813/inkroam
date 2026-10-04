# 浏览器显示模式

阅读外观中的「显示模式」位于「外观模式」下方，复用现有三段控件、主题材质及选中动画。不显示常驻退出/专注说明小字，仅保留不支持与请求失败提示。

- 关闭：正常窗口；新用户和刷新后的初值。
- 全屏：通过 Fullscreen API 对 documentElement 请求全屏，保留站点布局。
- 专注：同样进入全屏，仅隐藏 .site-header / .site-footer，保留正文宽度、章节目录、阅读外观入口。

该设置独立于外观预设，在默认设置启用、纸媒原版下均可操作。不加入 AppearanceState、默认值迁移或 localStorage；实际状态以 fullscreenElement 为准。Esc/浏览器退出时同步恢复「关闭」。页面内路由切换不主动重设。

请求必须来自点击；失败时提示并保持真实状态。不支持 Fullscreen API 时禁用两个进入按钮并说明，不伪装成功。浏览器自身 F11 全屏不是网页 API 状态，网页不能可靠控制它。

实现：app/components/DisplayModeSettings.vue。回归：node scripts/check-display-mode.mjs，已纳入 check-all。测试模拟浏览器 API，不代表实机全屏视觉验收。

接口依据：[MDN Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)。
