<script setup lang="ts">
import { useRadialShortcut, defaultRadialShortcut, isRadialCode } from '~/composables/useRadialShortcut'
import { vExperimentalGlass, vGlassPresence } from '~/utils/glass-surfaces'
import { RADIAL_ACTIONS, normalizeRadialSlots } from '~/utils/radial-actions'
import { scrollPageTo } from '~/utils/page-scroll'
import NavDepthLight from './NavDepthLight.vue'
const { shortcut, recording } = useRadialShortcut()
const route = useRoute()
const router = useRouter()
const open = ref(false), selected = ref(-1)
const rotation = ref(0)
watch(selected, index => {
  if (index < 0) return
  rotation.value += ((index * 60 - rotation.value + 540) % 360 + 360) % 360 - 180
})
const wheel = ref<HTMLElement | null>(null)
const center = reactive({ x: 0, y: 0 })
const size = ref(320)
const available = ref<boolean[]>([])
const actions = computed(() => normalizeRadialSlots(shortcut.value.slots).map(id => RADIAL_ACTIONS.find(action => action.id === id)!))
const selectors: Record<string, string> = {
  appearance: '.appearance-trigger', music: '.music-trigger',
  find: '[aria-controls="article-find-panel"]', sidebar: '.article-sidebar-toggle, .article-toc__toggle',
  export: '[aria-controls="article-export-panel"]',
  copy: '.article-tools__actions .copy-article-link--inline button, .article-tools__actions button.copy-article-link--inline',
}
const pressed = new Set<string>()
let origin: HTMLElement | null = null
let pointer = { x: 0, y: 0 }
let releaseCode = ''
let stopSave: (() => void) | undefined
function editable(target: EventTarget | null) { return target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]') }
function targetFor(id: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(selectors[id] || '[data-radial-action="none"]')).find(el => !el.disabled && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
}
function dismiss(restore = true) {
  open.value = false; selected.value = -1; releaseCode = ''; pressed.clear()
  if (restore && origin?.isConnected) origin.focus({ preventScroll: true })
}
function show(key = '', atPointer = true) {
  if (document.querySelector('dialog[open], [aria-modal="true"]')) return
  size.value = Math.min(320, window.innerWidth - 24, window.innerHeight - 24)
  const edge = size.value / 2 + 12
  center.x = Math.max(edge, Math.min(window.innerWidth - edge, atPointer && pointer.x ? pointer.x : window.innerWidth / 2))
  center.y = Math.max(edge, Math.min(window.innerHeight - edge, atPointer && pointer.y ? pointer.y : window.innerHeight / 2))
  available.value = actions.value.map(action => action.id === 'focus' ? !!document.fullscreenEnabled : ['top', 'search'].includes(action.id) || !!targetFor(action.id))
  releaseCode = key; selected.value = -1; open.value = true
  origin?.focus({ preventScroll: true })
  nextTick(() => wheel.value?.focus({ preventScroll: true }))
}
function execute(index = selected.value) {
  const action = actions.value[index]
  if (!action || !available.value[index]) { dismiss(); return }
  const target = targetFor(action.id)
  dismiss()
  // Synchronous dispatch preserves activation for clipboard/fullscreen APIs.
  if (action.id === 'focus') window.dispatchEvent(new Event('inkroam:toggle-focus'))
  else if (action.id === 'search') void router.push('/search')
  else if (action.id === 'top') scrollPageTo(0, matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')
  else {
    target?.click()
    if (action.id === 'sidebar' && target?.classList.contains('article-toc__toggle')) {
      target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      target.focus({ preventScroll: true })
    }
  }
}
function down(event: KeyboardEvent) {
  if (recording.value || event.isComposing) return
  if (open.value) {
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); return }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); execute(); return }
    if (event.key === 'Tab') { event.preventDefault(); return }
    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
      let index = selected.value < 0 ? (step > 0 ? -1 : 0) : selected.value
      for (let i = 0; i < actions.value.length; i++) { index = (index + step + actions.value.length) % actions.value.length; if (available.value[index]) break }
      selected.value = index
    }
    return
  }
  if (!shortcut.value.enabled || editable(event.target) || event.defaultPrevented || event.repeat) return
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) { pressed.clear(); return }
  const codes = shortcut.value.codes
  if (!codes.includes(event.code)) { pressed.clear(); return }
  if (!pressed.size) origin = document.activeElement instanceof HTMLElement ? document.activeElement : null
  pressed.add(event.code)
  if (codes.every(code => pressed.has(code))) { event.preventDefault(); show(event.code) }
}
function up(event: KeyboardEvent) {
  pressed.delete(event.code)
  if (open.value && releaseCode === event.code) { event.preventDefault(); execute() }
}
function move(event: PointerEvent) {
  pointer = { x: event.clientX, y: event.clientY }
  if (!open.value) return
  const x = pointer.x - center.x, y = pointer.y - center.y
  if (Math.hypot(x, y) < size.value * .18) { selected.value = -1; return }
  const angle = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360
  if (selected.value >= 0) {
    const difference = Math.abs(((angle - selected.value * 60 + 540) % 360) - 180)
    if (difference < 35) return
  }
  selected.value = Math.round(angle / 60) % 6
}
function preview() { origin = document.activeElement instanceof HTMLElement ? document.activeElement : null; show('', false) }
function abort() { dismiss(false) }
function visibility() { if (document.hidden) abort() }
watch(() => route.fullPath, abort)
watch(recording, value => { if (value) abort() })
watch(() => shortcut.value.enabled, value => { if (!value) dismiss() })
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('inkroam-radial-shortcut') || 'null')
    if (saved && typeof saved.enabled === 'boolean' && typeof saved.label === 'string' && Array.isArray(saved.codes) && saved.codes.length > 0 && saved.codes.length <= 3 && saved.codes.every(isRadialCode)) shortcut.value = { enabled: saved.enabled, codes: saved.codes, label: saved.label, slots: normalizeRadialSlots(saved.slots) }
    else shortcut.value = defaultRadialShortcut()
  } catch { /* Unavailable storage leaves the in-memory preference intact. */ }
  stopSave = watch(shortcut, value => { try { localStorage.setItem('inkroam-radial-shortcut', JSON.stringify(value)) } catch {} }, { deep: true })
  window.addEventListener('keydown', down); window.addEventListener('keyup', up)
  window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('blur', abort)
  window.addEventListener('resize', abort); window.addEventListener('inkroam:open-radial', preview)
  document.addEventListener('visibilitychange', visibility)
})
onBeforeUnmount(() => {
  stopSave?.(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
  window.removeEventListener('pointermove', move); window.removeEventListener('blur', abort)
  window.removeEventListener('resize', abort); window.removeEventListener('inkroam:open-radial', preview)
  document.removeEventListener('visibilitychange', visibility)
})
</script>
<template>
  <Teleport to="body">
    <Transition name="radial" :duration="300">
      <div v-if="open" class="radial-layer" @pointerdown.self="dismiss()">
        <div class="radial-position" :style="{ left: `${center.x}px`, top: `${center.y}px`, width: `${size}px`, height: `${size}px` }">
          <div ref="wheel" v-experimental-glass="open" v-glass-presence="open" data-glass-module="radial" class="radial-wheel dropdown-surface" role="dialog" aria-modal="true" aria-label="快捷轮盘" tabindex="-1">
            <NavDepthLight :follow-scroll="false" />
            <div class="radial-selection" :style="{ opacity: selected < 0 || !available[selected] ? 0 : 1, transform: `rotate(${rotation}deg)` }" aria-hidden="true"><span /></div>
            <button v-for="(action, index) in actions" v-show="action.id !== 'none'" :key="index" type="button" class="radial-action" :class="{ 'is-selected': selected === index }" :disabled="!available[index]" :style="{ left: `${50 + Math.sin(index * Math.PI / 3) * 33}%`, top: `${50 - Math.cos(index * Math.PI / 3) * 33}%` }" @focus="selected = index" @click="execute(index)">
              <span class="radial-action-light" aria-hidden="true"><svg :viewBox="action.id === 'copy' ? '0 0 24 24' : '0 0 26 26'"><path :d="action.path" /></svg><span>{{ action.label }}</span></span>
              <svg :viewBox="action.id === 'copy' ? '0 0 24 24' : '0 0 26 26'" aria-hidden="true"><path :d="action.path" /></svg><span>{{ action.label }}</span>
            </button>
            <button type="button" class="radial-center" aria-label="取消轮盘" @click="dismiss()"><span aria-hidden="true">×</span></button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<style scoped>
.radial-layer { position: fixed; inset: 0; z-index: 1100; }
.radial-position { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); }
.radial-wheel { position: relative; box-sizing: border-box; width: 100%; height: 100%; border: 0; border-radius: 999px; background: var(--paper); color: var(--ink); outline: none; }
/* A numeric capsule radius lets the optics engine clamp to the actual half-size;
   parseFloat(50%) previously supplied a 50px optical radius for a 160px circle. */
.radial-action { appearance: none; position: absolute; z-index: 1; transform: translate(-50%, -50%); display: grid; justify-items: center; align-content: center; gap: 7px; width: 28%; min-height: 64px; padding: 8px 2px; border: 0; border-radius: 18px; box-shadow: none; background: transparent; color: var(--muted); font: 12px/1.5 var(--sans); text-decoration: none; cursor: pointer; transition: color 180ms ease, translate 260ms var(--ease-fluid, ease); -webkit-tap-highlight-color: transparent; }
.radial-action svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.radial-action.is-selected:not(:disabled) { color: var(--ink); translate: 0 -2px; }
.radial-action > svg, .radial-action > span:not(.radial-action-light) { position: relative; z-index: 1; }
.radial-action-light { position: absolute; inset: 8px 2px; display: grid; justify-items: center; align-content: center; gap: 7px; opacity: 0; pointer-events: none; transition: opacity 260ms ease, color 260ms ease; }
.radial-action:disabled { opacity: .3; cursor: default; }
.radial-action:focus-visible { outline: 1px solid var(--accent); border-radius: 12px; }
.radial-selection { position: absolute; inset: 0; pointer-events: none; transition: transform 280ms cubic-bezier(.2,.8,.2,1), opacity 160ms ease; }
.radial-selection span { position: absolute; left: 35%; top: 6%; width: 30%; height: 23%; border-radius: 18px; background: color-mix(in srgb, var(--ink) 7%, transparent); }
.radial-center { appearance: none; position: absolute; z-index: 2; inset: 41%; display: grid; place-items: center; padding: 0; background: color-mix(in srgb, var(--ink) 4%, transparent); border: 0; box-shadow: none; border-radius: 50%; color: var(--muted); font: 20px/1 var(--sans); cursor: pointer; transition: background 220ms ease, color 220ms ease; }
.radial-center:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
.radial-center:focus-visible { outline: 2px solid var(--accent); }
.radial-enter-active .radial-wheel, .radial-leave-active .radial-wheel { transition: transform 300ms cubic-bezier(.16,1,.3,1), opacity 180ms ease; }
.radial-leave-active { pointer-events: none; }
.radial-enter-from .radial-wheel, .radial-leave-to .radial-wheel { transform: scale(.86); opacity: 0; }
/* Entire selector belongs inside :global: a partial :global followed by a scoped
   suffix can discard that suffix during Vue compilation and style the root. */
:global(:root[data-visual='modern'] .radial-wheel.dropdown-surface) { background-image: none; }
:global(:root[data-visual='modern']:is([data-depth='soft'],[data-depth='defined']) .radial-wheel) { --radial-emission: .22; box-shadow: 0 4px 12px -4px rgb(0 0 0 / .12), 0 22px 36px -14px rgb(0 0 0 / .23); }
:global(:root[data-visual='modern'][data-depth='defined'] .radial-wheel) { --radial-emission: .36; box-shadow: 0 5px 14px -4px rgb(0 0 0 / .17), 0 30px 48px -16px rgb(0 0 0 / .3); }
/* Light: the plate occludes overhead light; glyph-shaped shadows fall below it. */
:global(:root[data-visual='modern'][data-color-mode='light']:is([data-depth='soft'],[data-depth='defined']) .radial-action-light) { opacity: var(--radial-emission); color: rgb(26 32 40 / .65); transform: translateY(9px); filter: blur(3px); }
:global(:root[data-visual='modern'][data-color-mode='light']:is([data-depth='soft'],[data-depth='defined']) .radial-action.is-selected .radial-action-light) { opacity: calc(var(--radial-emission) + .08); color: rgb(26 32 40 / .65); transform: translateY(11px); filter: blur(5px); }
/* Dark: reuse the navbar's glass emission token, with light cast by glyphs.
   No upper-left radial wash and no filter on the backdrop's ancestor. */
:global(:root[data-visual='modern'][data-color-mode='dark']:is([data-depth='soft'],[data-depth='defined']) .radial-wheel) { box-shadow: 0 8px 24px -12px rgb(0 0 0 / .24), 0 20px 42px -22px var(--depth-glass-glow-inner, rgb(226 234 250 / .12)); }
:global(:root[data-visual='modern'][data-color-mode='dark']:is([data-depth='soft'],[data-depth='defined']) .radial-action-light) { opacity: var(--radial-emission); color: var(--ink); transform: translateY(12px); filter: blur(5px); }
:global(:root[data-visual='modern'][data-color-mode='dark']:is([data-depth='soft'],[data-depth='defined']) .radial-action.is-selected .radial-action-light) { opacity: calc(var(--radial-emission) + .2); color: rgb(255 255 255); }
@media (prefers-reduced-motion: reduce) { .radial-selection, .radial-action, .radial-action-light, .radial-center, .radial-enter-active .radial-wheel, .radial-leave-active .radial-wheel { transition: none; } }
</style>
