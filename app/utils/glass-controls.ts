import type { GlassController } from '../vendor/liquidglass/liquid-glass.js'
import { currentGlassQuality } from './glass-quality-dom'

type Engine = typeof import('../vendor/liquidglass/liquid-glass.js')

// Adapted from gentpan/liquidglass LgSegmented/LgNavbar/LgSlider (MIT, pinned
// 068ad226). Retain spring velocity deformation; optics now sit underneath
// the original labels, as requested. Original controls own all text and events.
export function attachGlassControl(host: HTMLElement, engine: Engine) {
  const slider = host.dataset.glassModule === 'thumb'
  const group = slider ? host.closest<HTMLElement>('.glass-range, .music-progress') : host.parentElement
  if (!group) return { destroy() {} }
  const input = slider ? group.querySelector<HTMLInputElement>('input[type="range"]') : null
  const musicProgress = group.classList.contains('music-progress')
  const navbar = group.classList.contains('main-nav')
  const buttons = slider ? [] : Array.from(group.children).filter((child): child is HTMLElement =>
    child instanceof HTMLElement && (child.tagName === 'BUTTON' || child.tagName === 'A')
    && !child.classList.contains('theme-toggle'))
  if (slider ? !input : !buttons.length) return { destroy() {} }

  const oldStyles = ['left', 'top', 'width', 'height', 'transform', 'margin-left', 'border-radius', 'transition', 'filter', 'backdrop-filter', '-webkit-backdrop-filter']
    .map(name => [name, host.style.getPropertyValue(name), host.style.getPropertyPriority(name)] as const)
  // Keep optics underneath the original glyphs; never clone or recolor labels.
  // A scroll mask is a backdrop root: a lens inside it sees a flat/empty track.
  // Put only the optics before the masked content, in the panel's coordinate
  // system. Original labels, rail, focus and hit targets never move or duplicate.
  const panel = host.closest<HTMLElement>('.appearance-panel, .music-panel')
  const scroller = panel ? host.closest<HTMLElement>('.appearance-panel__scroll, .music-scroll') : null
  const reveal = host.closest<HTMLElement>('.glass-settings__reveal')
  const portaled = Boolean(panel && scroller)
  const lens = portaled ? document.createElement('span') : host
  if (portaled) {
    lens.className = 'glass-control-optics'
    lens.dataset.glassModule = 'indicator'
    lens.setAttribute('aria-hidden', 'true')
    panel!.insertBefore(lens, panel!.firstChild)
  }

  let controller: GlassController | undefined
  let ready = false, disposed = false, initialized = false
  let x = 0, velocity = 0, press = 0, targetWidth = 0, targetHeight = 0, targetY = 0
  let pressedPointer: number | null = null
  let dragStartX = 0, dragStartY = 0, dragged = false, suppressClick = false
  let clickTimer = 0
  let dragChoice: HTMLElement | null = null
  let quality = currentGlassQuality(host.offsetWidth, host.offsetHeight, host.dataset.glassTheme, host)
  let timeout = 0
  let settle = 0
  let resize: ResizeObserver | undefined
  let state: MutationObserver | undefined
  const cleanups: (() => void)[] = []
  const listen = (el: EventTarget, name: string, fn: EventListener) => {
    el.addEventListener(name, fn)
    cleanups.push(() => el.removeEventListener(name, fn))
  }
  const position = engine.createSpring(0, (value, speed) => { x = value; velocity = speed; render() },
    { stiffness: slider ? 900 : 380, damping: slider ? 50 : 28 })
  const pressure = engine.createSpring(0, value => { press = value; render() }, { stiffness: 520, damping: 32 })
  const widthSpring = engine.createSpring(0, value => { targetWidth = value; render() }, { stiffness: 380, damping: 32 })
  const heightSpring = engine.createSpring(0, value => { targetHeight = value; render() }, { stiffness: 380, damping: 32 })
  const verticalSpring = engine.createSpring(0, value => { targetY = value; render() }, { stiffness: 380, damping: 32 })
  let alignFrame = 0
  // While the subpages slide, follow the host every frame instead of waiting for
  // the motion to end.
  let followFrame = 0
  let followUntil = 0
  const followMotion = () => {
    followFrame = 0
    if (disposed) return
    alignOptics()
    if (performance.now() < followUntil) followFrame = requestAnimationFrame(followMotion)
  }
  const startFollow = () => {
    followUntil = performance.now() + 400
    if (!followFrame) followFrame = requestAnimationFrame(followMotion)
  }

  function alignOptics() {
    if (!portaled || disposed) return
    const box = host.getBoundingClientRect(), frame = panel!.getBoundingClientRect()
    const view = scroller!.getBoundingClientRect()
    // Portaled optics must follow the accordion's clipping as it opens/closes.
    const revealBox = reveal?.getBoundingClientRect()
    const viewTop = Math.max(view.top, revealBox?.top ?? view.top)
    const viewBottom = Math.min(view.bottom, revealBox?.bottom ?? view.bottom)
    const sx = frame.width / Math.max(1, panel!.offsetWidth)
    const sy = frame.height / Math.max(1, panel!.offsetHeight)
    lens.style.left = `${(box.left - frame.left) / sx - panel!.clientLeft}px`
    lens.style.top = `${(box.top - frame.top) / sy - panel!.clientTop}px`
    lens.style.width = host.style.width
    lens.style.height = host.style.height
    lens.style.borderRadius = host.style.borderRadius
    // `v-show` keeps the other appearance subpage mounted but not rendered, so a
    // lens that was visible a moment ago must not keep painting at its stale rect.
    const rendered = host.offsetParent !== null && box.width >= 1 && box.height >= 1
    lens.style.visibility = !rendered || box.bottom <= viewTop || box.top >= viewBottom ? 'hidden' : ''
    // Respect the scroll viewport without inheriting its backdrop-root mask.
    lens.style.clipPath = `inset(${Math.max(0, viewTop - box.top) / sy}px ${Math.max(0, box.right - view.right) / sx}px ${Math.max(0, box.bottom - viewBottom) / sy}px ${Math.max(0, view.left - box.left) / sx}px round ${host.style.borderRadius})`
  }
  const queueAlign = () => {
    if (!alignFrame) alignFrame = requestAnimationFrame(() => { alignFrame = 0; alignOptics() })
  }
  if (portaled) {
    listen(scroller!, 'scroll', queueAlign)
    // A level-1 / level-2 switch slides the incoming subpage in with translateX
    // over 260ms. The optics layer lives in panel coordinates, so it must re-read
    // the host rect on every frame of that motion; aligning only at
    // transitionend leaves the whole animation visibly misaligned and then snaps.
    const realign = () => queueAlign()
    listen(panel!, 'transitionstart', startFollow)
    listen(panel!, 'transitionrun', startFollow)
    listen(panel!, 'transitionend', realign)
    listen(panel!, 'transitioncancel', realign)
    listen(panel!, 'animationstart', startFollow)
    listen(panel!, 'animationend', realign)
  }
  function render() {
    if (!controller || disposed) return
    // Motion stretches the lens, never the original text or hit targets.
    const stretch = quality.deform === false || (!slider && dragged) ? 0 : Math.min(slider ? 10 : 14, Math.abs(velocity) * .02)
    const deformation = quality.deform !== false ? press : 0
    const w = slider ? 28 + deformation * 14 + stretch : targetWidth + stretch + deformation * 4
    const h = slider ? 18 + deformation * 10 - stretch * .2 : Math.max(16, targetHeight - stretch * .23 - deformation * 2)
    const left = x - w / 2
    const top = targetY - h / 2
    // Navbar uses Inkroam's existing compact 9px corner, not a half-height pill.
    const radius = slider ? h / 2 : Math.min(navbar ? 9 : 10, h / 2)
    quality = currentGlassQuality(w, h, host.dataset.glassTheme, host)
    controller.update({ x: 0, y: 0, width: w, height: h, radius,
      blur: quality.blur, mapScale: quality.mapScale,
      maxFps: quality.maxFps, settleDelay: quality.settleDelay,
      edgeSoftness: quality.edgeSoftness, rimGlow: 0, boundedBezel: true,
      specular: quality.specular * (slider ? 1 : .75), specularAmbient: quality.specularAmbient })
    // Transform on the old host is replaced only while the experiment owns it.
    // Positioning still uses its original containing block (music ball is nested).
    const nested = musicProgress
    host.style.left = `${nested ? 0 : left}px`
    host.style.top = nested ? '50%' : `${top}px`
    host.style.width = `${w}px`
    host.style.height = `${h}px`
    host.style.borderRadius = `${radius}px`
    host.style.transform = nested ? 'translate(-50%, -50%)' : 'none'
    host.style.marginLeft = '0'
    host.style.transition = 'none'
    host.style.setProperty('--glass-press', String(press))
    alignOptics()
  }

  function selected() {
    return buttons.find(b => b.getAttribute('aria-expanded') === 'true'
      || b.getAttribute('aria-current') === 'page'
      || b.getAttribute('aria-pressed') === 'true' || b.classList.contains('active')
      || b.classList.contains('router-link-active')) ?? buttons[0]!
  }
  function target(button: HTMLElement, immediate = false) {
    widthSpring.set(button.offsetWidth, { immediate })
    heightSpring.set(button.offsetHeight, { immediate })
    verticalSpring.set(button.offsetTop + button.offsetHeight / 2, { immediate })
    position.set(button.offsetLeft + button.offsetWidth / 2, { immediate })
  }
  function readRange(immediate = false) {
    if (!input) return
    const min = Number(input.min || 0), max = Number(input.max || 100)
    let ratio = max > min ? (Number(input.value) - min) / (max - min) : 0
    if (musicProgress) ratio = Number(group!.style.getPropertyValue('--music-progress') || ratio)
    ratio = Math.max(0, Math.min(1, ratio))
    const nativeSize = musicProgress ? 0 : input.classList.contains('music-range') ? 11 : 16
    const rtl = getComputedStyle(input).direction === 'rtl'
    const fraction = rtl ? 1 - ratio : ratio
    const travel = Math.max(0, input.clientWidth - nativeSize)
    const center = input.offsetLeft + nativeSize / 2 + fraction * travel
    targetY = input.offsetTop + input.offsetHeight / 2
    host.dataset.disabled = String(input.matches(':disabled'))
    position.set(center, { immediate: immediate || (musicProgress && pressedPointer === null) })
  }
  function refresh() {
    if (disposed) return
    if (slider) readRange(!initialized)
    else if (!dragged) target(selected(), !initialized)
    initialized = true
  }
  function release() {
    if (pressedPointer !== null && group!.hasPointerCapture?.(pressedPointer)) group!.releasePointerCapture(pressedPointer)
    pressedPointer = null; dragged = false; dragChoice = null; pressure.set(0)
  }
  function refreshQuality() {
    quality = currentGlassQuality(host.offsetWidth, host.offsetHeight, host.dataset.glassTheme, host)
    // Frost the sampled backdrop, not the selectable foreground labels.

    render()
  }

  const decoded = new MutationObserver(() => {
    if (ready || disposed || !lens.style.backdropFilter.includes('url(')) return
    ready = true
    clearTimeout(timeout)
    host.setAttribute('data-liquid-glass-control', '')
    host.setAttribute('data-liquid-glass-active', '')
    if (portaled) {
      lens.setAttribute('data-liquid-glass-control', '')
      lens.setAttribute('data-liquid-glass-active', '')
    }

    decoded.disconnect()
  })
  decoded.observe(lens, { attributes: true, attributeFilter: ['style'] })
  // Refract presentation without a fixed white fill. Frost belongs to the real
  // backdrop, so clarity affects the lens while foreground labels stay sharp.
  try {
    controller = engine.createGlass(lens, { mode: 'backdrop', refraction: slider ? 6 : navbar ? 8 : 5,
      bezel: slider ? .9 : navbar ? .6 : .35, curvature: slider || navbar ? 3 : 4,
      chroma: 0, specular: quality.specular * (slider ? 1 : .75), specularAmbient: quality.specularAmbient, specularWidth: 1,
      rimGlow: 0, boundedBezel: true,
      blur: quality.blur, mapScale: quality.mapScale, edgeSoftness: quality.edgeSoftness,
      maxFps: quality.maxFps, settleDelay: quality.settleDelay })
  } catch (error) { destroy(); throw error }
  resize = new ResizeObserver(() => { refresh(); queueAlign() })
  resize.observe(group)
  if (reveal) resize.observe(reveal)
  if (portaled) resize.observe(panel!)
  buttons.forEach(button => resize.observe(button))
  state = new MutationObserver(refresh)
  if (input) {
    state.observe(input, { attributes: true, attributeFilter: ['value', 'min', 'max', 'style', 'disabled'] })
    // Existing player RAF writes the fractional progress here. No second clock.
    if (musicProgress) state.observe(group, { attributes: true, attributeFilter: ['style'] })
    listen(input, 'input', () => readRange())
    listen(input, 'change', () => readRange())
    // Vue may update only the .value property; GlassRange signals its update hook.
    listen(group, 'inkroam:range-update', () => readRange())
  } else {
    buttons.forEach(button => {
      state!.observe(button, { attributes: true, childList: true, subtree: true,
        attributeFilter: ['aria-current', 'aria-pressed', 'aria-expanded', 'class', 'disabled'] })
    })
  }
  listen(group, 'pointerdown', e => {
    const event = e as PointerEvent
    const control = (event.target as Element)?.closest('input, button, a')
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !control || control.matches(':disabled')) return
    suppressClick = false
    pressedPointer = event.pointerId; pressure.set(1)
    if (!slider && buttons.includes(control as HTMLElement)) {
      dragStartX = event.clientX; dragStartY = event.clientY; dragged = false
    }
  })
  listen(group, 'pointermove', e => {
    const event = e as PointerEvent
    if (slider || event.pointerId !== pressedPointer) return
    const dx = event.clientX - dragStartX, dy = event.clientY - dragStartY
    if (!dragged && (Math.abs(dx) < 6 || Math.abs(dy) > Math.abs(dx))) return
    if (!dragged) {
      group!.setPointerCapture?.(event.pointerId)
      widthSpring.stop(); heightSpring.stop(); verticalSpring.stop()
    }
    dragged = true
    event.preventDefault()
    const box = group!.getBoundingClientRect()
    const local = (event.clientX - box.left) * group!.clientWidth / Math.max(1, box.width)
    const enabled = buttons.filter(b => !b.matches(':disabled') && b.getAttribute('aria-disabled') !== 'true')
    if (!enabled.length) return
    dragChoice = enabled.reduce((a, b) => Math.abs(a.offsetLeft + a.offsetWidth / 2 - local)
      <= Math.abs(b.offsetLeft + b.offsetWidth / 2 - local) ? a : b)
    // Do not resize when crossing a different-width candidate. Morph to its
    // actual dimensions only after release (target() drives size springs).
    const centers = enabled.map(b => b.offsetLeft + b.offsetWidth / 2)
    position.set(Math.max(Math.min(...centers), Math.min(Math.max(...centers), local)))
  })
  // Only completed drags synthesize selection. Taps retain the original click,
  // links retain modifiers, and vertical touch gestures can still scroll.
  const endPointer: EventListener = e => {
    if ((e as PointerEvent).pointerId !== pressedPointer) return
    const choice = dragChoice, commit = dragged && e.type === 'pointerup'
    if (dragged) {
      suppressClick = true
      clearTimeout(clickTimer)
      clickTimer = window.setTimeout(() => { suppressClick = false }, 400)
    }
    release()
    if (commit && choice && choice !== selected()) {
      choice.click()
      if (!disposed) target(choice)
    } else if (!slider) target(selected())
  }
  const cancelClick: EventListener = e => {
    if (suppressClick && e.isTrusted) { e.preventDefault(); e.stopImmediatePropagation() }
  }
  group.addEventListener('click', cancelClick, true)
  cleanups.push(() => group.removeEventListener('click', cancelClick, true))
  listen(window, 'pointerup', endPointer)
  listen(window, 'pointercancel', endPointer)
  listen(group, 'dragstart', e => { if (pressedPointer !== null && !slider) e.preventDefault() })
  listen(window, 'blur', () => { release(); if (!slider) target(selected()) })
  listen(group, 'keydown', e => {
    if ([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes((e as KeyboardEvent).key)
      && !(e.target as Element).matches(':disabled')) pressure.set(1)
  })
  listen(group, 'keyup', () => release())
  listen(group, 'focusout', () => release())
  refresh()
  refreshQuality()
  // Belt and braces for a slide that never reports transitionend: reduced
  // motion applies the same 12px offset for a single frame, and a rapid switch
  // can cancel the previous transition.
  settle = window.setTimeout(() => {
    if (disposed || !portaled) return
    refresh()
    queueAlign()
  }, 320)
  // A subpage attached while hidden has a zero-size box, so its lens cannot
  // flush and decode yet. Keep waiting instead of killing a surface that the
  // next switch needs; only a *rendered* control that still failed is broken.
  const armWatchdog = () => {
    clearTimeout(timeout)
    timeout = window.setTimeout(() => {
      if (ready || disposed) return
      if (host.offsetParent === null) { armWatchdog(); return }
      destroy()
    }, 4000)
  }
  armWatchdog()

  function destroy() {
    if (disposed) return
    disposed = true
    clearTimeout(timeout)
    clearTimeout(settle)
    clearTimeout(clickTimer)
    release()
    position.stop(); pressure.stop(); widthSpring.stop(); heightSpring.stop(); verticalSpring.stop()
    if (alignFrame) cancelAnimationFrame(alignFrame)
    if (followFrame) cancelAnimationFrame(followFrame)
    resize?.disconnect(); state?.disconnect(); decoded.disconnect()
    cleanups.forEach(cleanup => cleanup())
    controller?.destroy()
    if (portaled) lens.remove()

    host.removeAttribute('data-liquid-glass-active')
    host.removeAttribute('data-liquid-glass-control')
    host.style.removeProperty('--glass-press')
    for (const [name, value, priority] of oldStyles) {
      if (value) host.style.setProperty(name, value, priority)
      else host.style.removeProperty(name)
    }
  }
  function refreshLayout() {
    if (disposed) return
    if (slider) readRange(true)
    else if (!dragged) target(selected(), true)
    render()
  }
  return { destroy, refreshQuality, refreshLayout }
}
