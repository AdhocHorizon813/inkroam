<script setup lang="ts">
/* 未知路径的兜底路由。没有它时，任何匹配不到路由的地址都会让 Vue Router 在控制台
   打印"没有匹配到该地址"的告警，服务端渲染同样会刷一屏。这里只负责把状态码定为 404，
   外观与状态码仍由 app/error.vue 决定（--live 检查仍然要求 HTTP 404）。
   故意不用 fatal: true：那会让每次未知地址都在终端打出 [request error] [fatal]，
   比原来的告警更吵；非致命 404 由错误页安静地渲染。 */
throw createError({
  statusCode: 404,
})
</script>

<!-- setup 里抛错后不会渲染任何内容；空模板只为满足 Vue 编译器，
     否则开发时会多一条 "missing template or render function" 警告。 -->
<template>
  <div />
</template>
