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
        <p class="lead">纸上漫游是我的个人博客。</p>
        <p>名字没有什么特别复杂的含义。很多东西只存在于脑子里的时候，很容易过几天就忘了，所以干脆找个地方把它们留下来。</p>
        <p>这里大概会出现技术、学习、设计、生活，也可能有一些很难分类的东西。我对什么产生兴趣，就可能写什么。</p>
        <p>这些文章也不一定代表我最终的看法。以后发现以前想错了，我会改；如果想法变了，也没必要假装自己从来没有那么想过。</p>
        <blockquote>写作不是为了显得正确，而是为了把模糊的感受变成可以被检验的想法。</blockquote>
        <p>我不知道这个博客最后会变成什么样。</p>
        <p>先写着再说。</p>
        <NuxtLink class="text-link" to="/">阅读最近文章 <span>↗</span></NuxtLink>
      </div>
    </div>
  </main>
</template>
