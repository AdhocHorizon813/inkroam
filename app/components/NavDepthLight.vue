<template>
  <span class="nav-depth-light" aria-hidden="true" />
</template>

<style scoped>
.nav-depth-light { display: none; }
:global(:root[data-visual='modern']:is([data-depth='soft'], [data-depth='defined']) .nav-depth-light) {
  display: block;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  will-change: opacity;
  transition: opacity 520ms cubic-bezier(.4, 0, .2, 1) var(--depth-light-delay, 0ms);
}
:global(:root[data-visual='modern']:is([data-depth='soft'], [data-depth='defined'])[data-scrolled='true'] .nav-depth-light) {
  opacity: .58;
  transition: opacity 480ms cubic-bezier(.22, .8, .3, 1) var(--depth-light-delay, 0ms);
}
/* One continuous surface: separately rasterized 32px endcaps exposed a seam
   beside the logo. Restore the unsliced recipe, not a different light strength.
   The delayed opacity timing remains an intermediate experiment, not final UX. */
.nav-depth-light {
  background: linear-gradient(180deg,
    rgb(255 255 255 / .025) 0%,
    rgb(255 255 255 / .008) 46%,
    rgb(0 0 0 / .012) 100%);
  box-shadow: inset 0 0 12px 200px var(--depth-glass-glow-inner), inset 0 1px 0 var(--depth-glass-top);
}
@media (prefers-reduced-motion: reduce) {
  :global(:root[data-visual='modern']:is([data-depth='soft'], [data-depth='defined']) .nav-depth-light) { transition: none; }
}
</style>
