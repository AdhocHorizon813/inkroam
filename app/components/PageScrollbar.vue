<template>
  <!-- 自绘页面滑条，只负责外观：槽位由 .page-scroll 的 overflow-y: scroll 占着（10px，
       零位移），原生拇指被涂成透明但保留全部原生交互（拖动、轨道翻页、滚轮），
       所以这里整块 pointer-events: none，不重复实现一遍原生行为。
       拇指的高度与位移来自 usePageScrollable 写的 --page-scrollbar-thumb-size/-offset；
       为什么会走到自绘这一步（原生拇指在不可滚的瞬间被浏览器撤掉，淡出画不出来）见
       docs/scrollbar.md。样式全部在 app/assets/css/main.css 里，和 .page-scroll 在一起。 -->
  <div class="page-scrollbar" aria-hidden="true">
    <div class="page-scrollbar__thumb" />
  </div>
</template>
