<script setup lang="ts">
useSeoMeta({ title: '关于', description: '关于纸上漫游，以及为什么还要继续写博客。' })
</script>

<template>
  <main class="standard-page about-page">
    <header class="page-intro">
      <p class="eyebrow">ABOUT THIS PLACE</p>
      <h1>保持好奇，<br>也保持自己的判断。</h1>
    </header>

    <div class="about-grid">
      <aside>
        <div class="monogram">纸</div>
        <p>独立写作者<br>长期主义练习者</p>
      </aside>
      <div class="about-copy">
        <p class="lead">纸上漫游是一处不追逐即时反馈的个人空间。</p>
        <p>我在这里写技术带来的变化，也写阅读、设计、效率与日常生活。相比给出标准答案，我更关心一个判断是怎样逐渐形成的，以及它在时间里是否仍然成立。</p>
        <p>博客中的文字会保留修改的痕迹，也可能推翻过去的自己。对我来说，这不是缺点，而是长期写作真正有价值的部分。</p>
        <blockquote>写作不是为了显得正确，而是为了把模糊的感受变成可以被检验的想法。</blockquote>
        <p>如果你也在意清醒、耐心与独立思考，希望这里能成为我们偶尔相遇的地方。</p>
        <NuxtLink class="text-link" to="/">阅读最近文章 <span>↗</span></NuxtLink>
      </div>
    </div>
  </main>
</template>
