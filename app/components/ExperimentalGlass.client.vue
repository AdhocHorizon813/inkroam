<script setup lang="ts">
import { mountExperimentalGlass } from '~/utils/experimental-glass'
import { GLASS_SURFACES_CHANGED } from '~/utils/glass-surfaces'

let destroy: (() => void) | undefined
let disposed = false
const nuxt = useNuxtApp()
const stopPageFinish = nuxt.hook('page:finish', () => {
  window.dispatchEvent(new Event(GLASS_SURFACES_CHANGED))
})
onMounted(async () => {
  await nextTick()
  if (!disposed) destroy = mountExperimentalGlass()
})
onBeforeUnmount(() => { disposed = true; stopPageFinish(); destroy?.() })
</script>

<template><!-- Glass attaches to docks and explicitly registered floating surfaces. --></template>

<style>
:root[data-visual='modern'] {
  --experiment-glass-tint: rgb(17 24 39 / .10);
  --experiment-glass-shadow: 0 4px 12px rgb(0 0 0 / .20);
  --experiment-control-shadow: 0 2px 5px rgb(0 0 0 / .22), 0 5px 12px rgb(0 0 0 / .12);
  --experiment-control-ink: #edf0f5;
  --experiment-control-track: rgb(10 15 25 / .14);
}
:root[data-visual='modern'][data-color-mode='light'] {
  --experiment-glass-tint: rgb(250 250 248 / .14);
  --experiment-glass-shadow: 0 4px 12px rgb(24 30 40 / .10);
  --experiment-control-shadow: 0 2px 5px rgb(24 30 40 / .09), 0 5px 12px rgb(24 30 40 / .05);
  --experiment-control-ink: #252d38;
  --experiment-control-track: rgb(120 130 145 / .10);
}
/* The image viewer has a deliberately dark scrim in either page theme. */
:root[data-visual='modern'] [data-liquid-glass-active][data-glass-theme='dark'] {
  --experiment-glass-tint: rgb(17 24 39 / .10);
  --experiment-glass-shadow: 0 4px 12px rgb(0 0 0 / .20);
  --experiment-control-ink: #edf0f5;
}
/* Narrow opt-in override: only surfaces with a decoded lens release their old
   fill/blur. No declarations touch article cards or the paper theme. Important
   is necessary against the independently-selected nav/music material recipes. */
/* The experiment has its own recipe. These opt-in rules never rewrite the
   liquid/acrylic/mica definitions, and vanish when the decoded lens is removed. */
:root[data-visual='modern'] [data-liquid-glass-active]:not([data-liquid-glass-control]) {
  background: var(--experiment-glass-tint) !important;
  border-color: transparent !important;
  box-shadow: var(--experiment-glass-shadow) !important;
  color: var(--experiment-control-ink);
}
/* Visited optics keep their decoded map, but no hidden backdrop is composited.
   Wake removes this gate before paint, without another asynchronous decode. */
[data-liquid-glass-dormant] {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  visibility: hidden !important;
}
/* Disable the legacy directional CSS border ONLY on experimental glass. Rim
   light now comes solely from the lens boundary normal and sampled backdrop. */
:root[data-visual='modern'] .appearance-panel[data-liquid-glass-active]::after {
  content: none !important;
  display: none !important;
}
/* NavDepthLight remains the owner of self-emission and its sync/delayed opacity
   timing. Refraction samples behind the header; light is painted above it. Keep
   the existing depth projections and the dark/light recipes unmodified. */

/* The real moving surface replaces the old pseudo-element's paint. Original
   labels remain interactive underneath the raised refractive lens. */
.glass-segment-indicator {
  position: absolute;
  z-index: 0;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 18px) / 3);
  border-radius: 10px;
  transform: var(--segment-transform, translate3d(0, 0, 0));
  transition: transform 380ms cubic-bezier(.16, 1, .3, 1);
  pointer-events: none;
  visibility: hidden;
}
.segmented-control--two > .glass-segment-indicator { width: calc((100% - 13px) / 2); }
.glass-segment-indicator[data-liquid-glass-active] { visibility: inherit; }
.glass-control-optics {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  visibility: hidden;
}
.glass-control-optics[data-liquid-glass-active] { visibility: inherit; }

/* Keep the card's optical tint constant across the asynchronous lens decode.
   While the true-glass map is pending, paint the same tint directly on the card.
   Once decoded, the existing [data-liquid-glass-content] rule transfers that
   paint to the real lens without the previous 68%-to-20% alpha jump.
   This applies only to opt-in experimental content glass on Chromium; ordinary
   light/dark materials retain their original appearance. */
@media not (prefers-reduced-transparency: reduce) {
  :root[data-visual='modern'][data-glass-content-preview='on']
  :is(.hero, .latest-section, .manifesto, .standard-page, .article-page):not([data-liquid-glass-content]) {
    background: rgb(17 24 39 / .20) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  :root[data-visual='modern'][data-color-mode='light'][data-glass-content-preview='on']
  :is(.hero, .latest-section, .manifesto, .standard-page, .article-page):not([data-liquid-glass-content]) {
    background: rgb(250 250 248 / .22) !important;
  }
}
/* Real content-card optics, isolated from the five original material recipes.
   The frame is paint-only/out-of-flow. Long pages allocate a viewport tile,
   never a full-article SVG filter; text, selection and sticky TOC stay native. */
:root[data-visual='modern'] [data-liquid-glass-content] {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-color: transparent !important;
}
:root[data-visual='modern'] [data-liquid-glass-content]::before {
  display: none !important;
}
.experimental-content-glass {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  overflow: clip;
  pointer-events: none;
  visibility: hidden;
}
[data-liquid-glass-content] > .experimental-content-glass { visibility: visible; }
.experimental-content-glass__lens {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background: rgb(17 24 39 / .20);
}
:root[data-color-mode='light'] .experimental-content-glass__lens {
  background: rgb(250 250 248 / .22);
}
:root[data-visual='modern'] .glass-control-optics[data-liquid-glass-control] {
  box-shadow: none !important;
}
.segmented-control:has(> .glass-segment-indicator[data-liquid-glass-active])::before { visibility: hidden; }
/* Isolation would prevent a nested indicator from sampling outside its group. */
.segmented-control:has(> .glass-segment-indicator[data-liquid-glass-active]) { isolation: auto; }

/* Native input stays hit-testable, focusable and keyboard-operable. Hide only
   its painted thumb, and only after the real DOM lens has decoded. */
:root[data-visual='modern'] .glass-range:has(> [data-liquid-glass-active]) > input::-webkit-slider-thumb {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
:root[data-visual='modern'] [data-liquid-glass-control] {
  background: transparent !important;
  border: 0 !important;
  box-shadow: var(--experiment-control-shadow) !important;
}
/* Quiet at rest, lifted and transparent while held.
   The rim is generated by the optical map, never by a corner gradient. Paint
   this on the inline lens; only the persistent rail may be portaled. */
:root[data-visual='modern'] [data-liquid-glass-control][data-glass-module='indicator']:not(.glass-control-optics) {
  background: rgb(255 255 255 / calc(.10 * (1 - var(--glass-press, 0)))) !important;
  box-shadow:
    0 calc(3px * var(--glass-press, 0)) calc(12px * var(--glass-press, 0)) rgb(0 0 0 / calc(.18 * var(--glass-press, 0))),
    inset 0 0 calc(8px * var(--glass-press, 0)) rgb(0 0 0 / calc(.10 * var(--glass-press, 0))) !important;
}
:root[data-visual='modern'][data-color-mode='light'] [data-liquid-glass-control][data-glass-module='indicator']:not(.glass-control-optics) {
  background: rgb(0 0 0 / calc(.10 * (1 - var(--glass-press, 0)) + .03 * var(--glass-press, 0))) !important;
}
/* The indicator must paint after the real track labels to refract them.
   Pointer events still reach the original buttons; no copied text or hit boxes. */
[data-liquid-glass-control][data-glass-module='indicator']:not(.glass-control-optics) { z-index: 3; }
.glass-track-optics { transform-origin: center; }
:root[data-visual='modern'] .glass-track-optics[data-glass-track-presentation] {
  /* Shadow/tint accompany entry and subpage motion immediately. Only the
     optical filter waits for decode; dormant/owner visibility still wins. */
  visibility: inherit;
  /* Preserve the original light/dark tint hue, but fade its alpha as the
     indicator clarity rises. The SVG backdrop refraction remains intact. */
  background: color-mix(in srgb, var(--experiment-glass-tint) var(--glass-track-tint-strength, 100%), transparent) !important;
  box-shadow: var(--experiment-glass-shadow) !important;
}
/* The old dark track made a transparent lens look like a sunken black button.
   This override is scoped to a decoded experimental control, not other materials. */
:root[data-visual='modern'] .segmented-control:has(> [data-liquid-glass-control]) {
  background: var(--experiment-control-track);
}
:root[data-visual='modern'] .segmented-control[data-glass-track-presentation] { background: transparent; }
/* Upstream slider behavior: solid white at rest, glass while held. This cap is
   only for range thumbs, never for sliding selection indicators. */
[data-liquid-glass-control][data-glass-module='thumb']::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: #fff;
  opacity: clamp(0, calc(1 - var(--glass-press, 0)), 1);
  pointer-events: none;
}
.glass-range > [data-liquid-glass-control],
.music-progress__ball[data-liquid-glass-control] { z-index: 4; }
.glass-range:has(> [data-liquid-glass-control]) > input:focus-visible { outline-offset: 4px; }
.music-progress:has([data-liquid-glass-control]) .music-progress__input { z-index: 5; }
.music-progress:has([data-liquid-glass-control]) .music-progress__ball-layer { z-index: 4; }
/* Horizontal drags select on release; vertical gestures remain page scrolling. */
:is(.segmented-control, .main-nav, .article-tools__actions):has(> [data-liquid-glass-control]) {
  touch-action: pan-y;
  user-select: none;
}

@media (prefers-reduced-motion: reduce) {
  .glass-segment-indicator { transition: none; }
}
</style>
