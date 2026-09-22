<script setup lang="ts">
const residentImage = `${useRuntimeConfig().app.baseURL}images/lin-che.png`

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
    <section class="resident" aria-labelledby="resident-title">
      <header class="resident-heading">
        <p class="eyebrow">ANOTHER RESIDENT</p>
        <h2 id="resident-title">林澈 <span>/ Lin Che</span></h2>
      </header>

      <div class="resident-copy about-copy">
        <p>林澈是我创造的一个原创角色。</p>
        <p>她有点清冷，也有点慵懒。喜欢数学、计算机，还有那些暂时没有答案的问题。大多数时候很安静，偶尔会冒出一些奇怪的想法。</p>
        <p>创造她最开始没有什么特别复杂的理由。</p>
        <p>只是一些零散的画面和想法反复出现。关于她应该长什么样，会喜欢什么，会怎样看待这个世界。它们逐渐变得具体，于是觉得，与其让这些东西散掉，不如让它们属于一个人。</p>
        <p class="resident-pause">所以有了林澈。</p>
        <p>她不是这个博客的作者，也没有被赋予什么必须完成的使命。</p>
        <p class="resident-closing">只是在「纸上漫游」里，我想给她留一个位置。</p>
      </div>

      <figure class="resident-figure">
        <img
          :src="residentImage"
          width="1024"
          height="1536"
          alt="林澈的全身插图：长直黑发，身穿黑色西装外套、白衬衫与黑色百褶裙，安静地站在浅灰色背景前。"
          loading="lazy"
          decoding="async"
        >
      </figure>
    </section>
  </main>
</template>

<style scoped>
.resident {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  column-gap: 8%;
  align-items: start;
  isolation: isolate;
  margin-top: clamp(80px, 10vw, 140px);
}

.resident-heading { grid-column: 1 / -1; margin-bottom: 38px; }
.resident-heading h2 {
  margin: 0;
  color: var(--ink);
  font: 500 clamp(28px, 3.5vw, 40px)/1.4 var(--serif);
  letter-spacing: -.035em;
}
.resident-heading h2 span { color: var(--muted); font-size: .65em; letter-spacing: -.015em; }
.resident-copy { grid-column: 1; grid-row: 2; min-width: 0; max-width: 32em; z-index: 1; }
.resident .resident-copy.about-copy > p {
  color: var(--ink);
  font-size: 16px;
  line-height: 1.95;
}
.resident-copy .resident-pause { margin-top: 38px; }
.resident-copy .resident-closing { max-width: 24em; margin-top: 48px; margin-bottom: 0; color: var(--ink); }

/* The source has empty space on the left. Only that space enters the text
   gutter; the figure itself stays outside the reading column. */
.resident-figure {
  grid-column: 2;
  grid-row: 2;
  width: 118%;
  max-width: 420px;
  justify-self: end;
  margin: -88px 0 0;
  z-index: 0;
  mask-image: linear-gradient(to right, transparent, #000 48%, #000 99%, transparent),
    linear-gradient(to bottom, transparent, #000 3%, #000 99%, transparent);
  mask-composite: intersect;
}
.resident-figure img { display: block; width: 100%; height: auto; }

@media (max-width: 767.98px) {
  .resident { display: block; margin-top: 72px; }
  .resident-heading { margin-bottom: 30px; }
  .resident-copy { max-width: none; }
  .resident-figure {
    width: min(100%, 360px);
    aspect-ratio: 1 / 2;
    margin: 38px auto 0;
    overflow: hidden;
    mask-image: linear-gradient(to right, transparent, #000 7%, #000 97%, transparent),
      linear-gradient(to bottom, transparent, #000 2%, #000 99%, transparent);
  }
  .resident-figure img { width: 100%; height: 100%; object-fit: cover; object-position: right center; }
}
</style>
