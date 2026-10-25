<script setup lang="ts">
defineProps<{ trackId: string; src?: string }>()
</script>

<template>
  <div class="music-artwork" aria-hidden="true">
    <img v-if="src" :src="src" alt="" decoding="async" width="320" height="320">
    <!-- Original vector studies, not external artwork or an audio fetch. -->
    <svg v-else viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" fill="var(--paper)" />
      <rect x="20" y="20" width="280" height="280" rx="2" fill="currentColor" opacity=".07" />
      <g stroke="currentColor" stroke-width="1.2">
        <template v-if="trackId === '01_rain_on_the_margin'">
          <path d="M80 62h160v196H80zM160 62v196M80 158h160" opacity=".45" />
          <path v-for="n in 8" :key="n" :d="`M${70 + n * 20} 90l-12 30m8 65-12 30`" opacity=".3" />
          <path d="M60 265h200" opacity=".3" />
        </template>
        <template v-else-if="trackId === '02_lamplight_and_paper'">
          <path d="m116 76-32 60h112l-32-60ZM140 136v104m-32 0h64" opacity=".65" />
          <path d="m166 207 68-12 20 62-68 12zM186 221l36-6m-32 17 36-6m-32 17 26-4" opacity=".4" />
          <path d="m102 151-25 65m98-65 18 37" opacity=".18" />
        </template>
        <template v-else-if="trackId === '03_a_lemma_after_midnight'">
          <path d="M204 64a66 66 0 1 0 48 94 58 58 0 0 1-48-94Z" opacity=".5" />
          <path d="M66 228h188M66 242h158M66 256h172m-143-42 20-30 18 30m32-18h38" opacity=".32" />
          <circle cx="80" cy="86" r="2" /><circle cx="254" cy="80" r="2" />
        </template>
        <template v-else>
          <circle cx="160" cy="160" r="83" opacity=".2" />
          <circle cx="160" cy="160" r="61" opacity=".3" />
          <path d="M146 187v-69l47-10v67m-47-44 47-10" opacity=".65" />
          <ellipse cx="133" cy="188" rx="13" ry="9" opacity=".65" />
          <ellipse cx="180" cy="176" rx="13" ry="9" opacity=".65" />
        </template>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.music-artwork { aspect-ratio: 1; overflow: hidden; border-radius: inherit; color: var(--accent); background: var(--paper); }
.music-artwork :is(img, svg) { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
