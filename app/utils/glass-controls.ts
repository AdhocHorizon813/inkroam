import type { GlassController } from '../vendor/liquidglass/liquid-glass.js'
import { currentGlassQuality } from './glass-quality-dom'

type Engine = typeof import('../vendor/liquidglass/liquid-glass.js')

// Portaled optics share one scheduler per panel. It runs only while an
// animated subpage/accordion owns motion; incoming AND outgoing lenses follow.
type PanelMotion = {
  owners: Map<HTMLElement, Set<() => void>>
  moving: Set<HTMLElement>
  frame: number
  onStart: EventListener
  onEnd: EventListener
}
const panelMotions = new WeakMap<HTMLElement, PanelMotion>()
let nextOpticAnchor = 0

function findAppearanceSubpage(host: HTMLElement, panel: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = host
  while (node && node !== panel) {
    if (node.parentElement?.classList.contains('appearance-subpages')) return node
    node = node.parentElement
  }
  return null
}

function followOpticalMotion(panel: HTMLElement, owners: HTMLElement[], align: () => void) {
  let motion = panelMotions.get(panel)
  if (!motion) {
    const state: PanelMotion = { owners: new Map(), moving: new Set(), frame: 0,
      onStart: () => {}, onEnd: () => {} }
    const alignMoving = () => {
      const callbacks = new Set<() => void>()
      for (const owner of state.moving) {
        for (const callback of state.owners.get(owner) ?? []) callbacks.add(callback)
      }
      callbacks.forEach(callback => callback())
    }
    const tick = () => {
      state.frame = 0
      alignMoving()
      for (const owner of state.moving) {
        if (!owner.isConnected || !(owner.getAnimations?.() ?? []).some(animation =>
          animation.playState === 'running' || animation.pending)) state.moving.delete(owner)
      }
      if (state.moving.size) state.frame = requestAnimationFrame(tick)
    }
    state.onStart = event => {
      const owner = event.target as HTMLElement
      if (!state.owners.has(owner)) return
      state.moving.add(owner)
      alignMoving()
      if (!state.frame) state.frame = requestAnimationFrame(tick)
    }
    state.onEnd = event => {
      if (!state.moving.has(event.target as HTMLElement)) return
      // Multiple properties can end independently; the next frame checks the
      // browser's remaining animations, including cancelled/reversed motion.
      alignMoving()
      if (!state.frame) state.frame = requestAnimationFrame(tick)
    }
    for (const name of ['transitionrun', 'transitionstart', 'animationstart']) panel.addEventListener(name, state.onStart)
    for (const name of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) panel.addEventListener(name, state.onEnd)
    panelMotions.set(panel, state)
    motion = state
  }
  for (const owner of owners) {
    let callbacks = motion.owners.get(owner)
    if (!callbacks) { callbacks = new Set(); motion.owners.set(owner, callbacks) }
    callbacks.add(align)
  }
  return () => {
    const state = panelMotions.get(panel)
    if (!state) return
    for (const owner of owners) {
      const callbacks = state.owners.get(owner)
      callbacks?.delete(align)
      if (!callbacks?.size) { state.owners.delete(owner); state.moving.delete(owner) }
    }
    if (state.owners.size) return
    cancelAnimationFrame(state.frame)
    for (const name of ['transitionrun', 'transitionstart', 'animationstart']) panel.removeEventListener(name, state.onStart)
    for (const name of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) panel.removeEventListener(name, state.onEnd)
    panelMotions.delete(panel)
  }
}

// Adapted from gentpan/liquidglass LgSegmented/LgNavbar/LgSlider (MIT, pinned
// 068ad226). Original controls keep all text and hit targets. Appearance-panel
// indicators use a sibling optical lens outside the panel backdrop root so the
// moving pill samples the actual composited track AND page, not just glyphs.
export function attachGlassControl(host: HTMLElement, engine: Engine) {
  const slider = host.dataset.glassModule === 'thumb'
  const group = slider ? host.closest<HTMLElement>('.glass-range, .music-progress') : host.parentElement
  if (!group) return { destroy() {} }
  const input = slider ? group.querySelector<HTMLInputElement>('input[type="range"]') : null
  const musicProgress = group.classList.contains('music-progress')
  const navbar = group.classList.contains('main-nav')
  // Navigation already sits on the header glass; it needs no second rail.
  const hasTrack = !slider && !navbar
  const buttons = slider ? [] : Array.from(group.children).filter((child): child is HTMLElement =>
    child instanceof HTMLElement && (child.tagName === 'BUTTON' || child.tagName === 'A')
    && !child.classList.contains('theme-toggle'))
  if (slider ? !input : !buttons.length) return { destroy() {} }

  const oldStyles = ['left', 'top', 'width', 'height', 'transform', 'margin-left', 'border-radius', 'transition', 'filter', 'backdrop-filter', '-webkit-backdrop-filter', 'anchor-name', 'visibility']
    .map(name => [name, host.style.getPropertyValue(name), host.style.getPropertyPriority(name)] as const)
  const oldGroupStyles = ['anchor-name', 'translate'].map(name =>
    [name, group.style.getPropertyValue(name), group.style.getPropertyPriority(name)] as const)
  // Two optical stages
  // samples the page outside the scroll mask; the pressed indicator stays ABOVE
  // the real labels inside the mask, so it can actually refract their pixels.
  const panel = host.closest<HTMLElement>('.appearance-panel, .music-panel')
  const scroller = panel ? host.closest<HTMLElement>('.appearance-panel__scroll, .music-scroll') : null
  const reveal = host.closest<HTMLElement>('.glass-settings__reveal')
  const subpage = panel ? findAppearanceSubpage(host, panel) : null
  // A moving indicator inside the filtered appearance panel cannot see the
  // ambient page: both the panel backdrop-filter and scroll mask isolate it.
  // A sibling of the panel in the same fixed dock samples the finished panel,
  // track and page without copying background images or moving the real buttons.
  const indicatorDock = !slider && panel?.classList.contains('appearance-panel')
    ? panel.closest<HTMLElement>('.appearance-dock') : null
  // A thumb must sample the rail painted immediately underneath it. Portaling
  // it before the masked scroller puts that rail ABOVE the lens, so its SVG URL
  // remains active but cannot refract the control it belongs to. Keep thumbs
  // inline, as in the original working slider path; their DOM follows scroll,
  // clipping, opacity and fullscreen motion without any position follower.
  const portaled = Boolean(panel && scroller && hasTrack)
  // A JavaScript scroll handler + rAF follows one composited frame behind touch
  // scrolling. On Blink, CSS anchor positioning lets the compositor tether an
  // out-of-scroller indicator lens directly to its real source.
  // Keep the measured-position path for browsers without native anchors.
  const nativeAnchored = portaled && typeof CSS !== 'undefined'
    && CSS.supports('anchor-name: --inkroam-optic-probe')
    && CSS.supports('position-anchor: --inkroam-optic-probe')
    && CSS.supports('top: anchor(top)')
    && CSS.supports('position-visibility: anchors-visible')
  const lens = hasTrack ? document.createElement('span') : host
  if (hasTrack) {
    lens.className = 'glass-control-optics glass-track-optics'
    lens.dataset.glassModule = 'track'
    lens.setAttribute('aria-hidden', 'true')
    if (nativeAnchored) {
      const anchor = `--inkroam-optic-${++nextOpticAnchor}`
      group.style.setProperty('anchor-name', anchor)
      lens.style.setProperty('position-anchor', anchor)
      lens.style.setProperty('left', 'anchor(left)')
      lens.style.setProperty('top', 'anchor(top)')
      lens.style.setProperty('width', 'anchor-size(width)')
      lens.style.setProperty('height', 'anchor-size(height)')
      lens.style.setProperty('position-visibility', 'anchors-visible')
    }
    if (portaled) panel!.insertBefore(lens, panel!.firstChild)
    else group.insertBefore(lens, group.firstChild)
  }
  const movingLens = indicatorDock && portaled ? document.createElement('span') : null
  if (movingLens) {
    movingLens.className = 'glass-control-optics glass-indicator-optics'
    movingLens.dataset.glassModule = 'indicator'
    movingLens.setAttribute('aria-hidden', 'true')
    if (nativeAnchored) {
      const anchor = `--inkroam-optic-${++nextOpticAnchor}`
      host.style.setProperty('anchor-name', anchor)
      movingLens.style.setProperty('position-anchor', anchor)
      movingLens.style.setProperty('left', 'anchor(left)')
      movingLens.style.setProperty('top', 'anchor(top)')
      movingLens.style.setProperty('width', 'anchor-size(width)')
      movingLens.style.setProperty('height', 'anchor-size(height)')
      movingLens.style.setProperty('position-visibility', 'anchors-visible')
    }
    indicatorDock!.appendChild(movingLens)
  }
  const opticalTarget = movingLens ?? host

  let controller: GlassController | undefined
  let trackController: GlassController | undefined
  let sleepingFilter = '', sleepingTrackFilter = ''
  let trackOrigin = 0
  let ready = false, disposed = false, initialized = false
  let x = 0, velocity = 0, press = 0, targetWidth = 0, targetHeight = 0, targetY = 0
  let pressedPointer: number | null = null
  let dragStartX = 0, dragStartY = 0, dragged = false, suppressClick = false
  let clickTimer = 0
  let dragChoice: HTMLElement | null = null
  let releasePending = false, releaseFrame = 0
  let inflationX = 1, inflationY = 1
  let quality = currentGlassQuality(host.offsetWidth, host.offsetHeight, host.dataset.glassTheme, host)
  let timeout = 0
  let resize: ResizeObserver | undefined
  let state: MutationObserver | undefined
  const cleanups: (() => void)[] = []
  const listen = (el: EventTarget, name: string, fn: EventListener) => {
    el.addEventListener(name, fn)
    cleanups.push(() => el.removeEventListener(name, fn))
  }
  const position = engine.createSpring(0, (value, speed) => { x = value; velocity = speed; render(); finishRelease() },
    { stiffness: slider ? 900 : 1000, damping: slider ? 50 : 2 * Math.sqrt(1000) })
  const pressure = engine.createSpring(0, value => { press = value; render() },
    { stiffness: slider ? 520 : 1000, damping: slider ? 32 : 2 * Math.sqrt(1000) })
  const widthSpring = engine.createSpring(0, value => { targetWidth = value; render() }, { stiffness: 380, damping: 32 })
  const heightSpring = engine.createSpring(0, value => { targetHeight = value; render() }, { stiffness: 380, damping: 32 })
  const verticalSpring = engine.createSpring(0, value => { targetY = value; render() }, { stiffness: 380, damping: 32 })
  // Separate underdamped axes reproduce the lifted, soft lens
  // DampedDragAnimation. Stiffness/damping ratios converted to unit-mass springs.
  const inflationSpringX = engine.createSpring(1, value => { inflationX = value; render() }, { stiffness: 250, damping: 2 * .6 * Math.sqrt(250) })
  const inflationSpringY = engine.createSpring(1, value => { inflationY = value; render() }, { stiffness: 250, damping: 2 * .7 * Math.sqrt(250) })
  function pressIndicator() {
    if (pressedPointer === null || press < .01) trackOrigin = x
    releasePending = false
    pressure.set(1)
    if (!slider) { inflationSpringX.set(78 / 56); inflationSpringY.set(78 / 56) }
  }
  function finishRelease() {
    if (!releasePending || disposed || pressedPointer !== null) return
    const centers = buttons.map(button => button.offsetLeft + button.offsetWidth / 2)
    const threshold = Math.max(1, (Math.max(...centers) - Math.min(...centers)) * .025)
    if (Math.abs(x - position.target) > threshold) return
    releasePending = false
    pressure.set(0)
    inflationSpringX.set(1); inflationSpringY.set(1)
  }
  let alignFrame = 0
  function alignOptics() {
    if (!portaled || disposed) return
    // Native anchors transfer bounds, not paint geometry. Without the same
    // CSS radius, Blink composites a pale rectangular backdrop outside the
    // rounded source even though the SVG displacement map itself is rounded.
    const trackRadius = parseFloat(getComputedStyle(group!).borderTopLeftRadius) || 14
    lens.style.borderRadius = `${trackRadius}px`
    // inert and data-glass-page-hidden express intent, not optical absence.
    // Only the completed lifecycle may hide a portaled lens.
    if (host.closest('[data-glass-presence="closed"]') || host.offsetParent === null) {
      lens.style.visibility = 'hidden'
      return
    }
    // Portals inherit panel opacity/transform, but not subpage/reveal opacity.
    // Multiply just the escaped ancestors, so parent fading is applied once.
    let opacity = 1
    for (const node of [subpage, reveal]) {
      if (node) opacity *= Number(getComputedStyle(node).opacity || 1)
    }
    lens.style.opacity = String(opacity)
    if (nativeAnchored && ![subpage, reveal].some(owner =>
      owner?.dataset.glassPresence === 'opening' || owner?.dataset.glassPresence === 'closing')) {
      // Do not pin visibility to an old scroll rect: Blink follows the anchor
      // asynchronously. JS clipping is needed only during escaped owner motion.
      lens.style.visibility = ''
      lens.style.clipPath = ''
      return
    }
    const box = group!.getBoundingClientRect(), frame = panel!.getBoundingClientRect()
    const view = scroller!.getBoundingClientRect()
    // Portaled optics must follow the accordion's clipping as it opens/closes.
    const revealBox = reveal?.getBoundingClientRect()
    const viewTop = Math.max(view.top, revealBox?.top ?? view.top)
    const viewBottom = Math.min(view.bottom, revealBox?.bottom ?? view.bottom)
    const sx = frame.width / Math.max(1, panel!.offsetWidth)
    const sy = frame.height / Math.max(1, panel!.offsetHeight)
    if (!nativeAnchored) {
      lens.style.left = `${(box.left - frame.left) / sx - panel!.clientLeft}px`
      lens.style.top = `${(box.top - frame.top) / sy - panel!.clientTop}px`
      lens.style.width = `${group!.clientWidth}px`
      lens.style.height = `${group!.offsetHeight}px`
    }
    // `v-show` keeps the other appearance subpage mounted but not rendered, so a
    // lens that was visible a moment ago must not keep painting at its stale rect.
    const rendered = host.offsetParent !== null && box.width >= 1 && box.height >= 1
    lens.style.visibility = !rendered || box.bottom <= viewTop || box.top >= viewBottom ? 'hidden' : ''
    // Respect the scroll viewport without inheriting its backdrop-root mask.
    lens.style.clipPath = `inset(${Math.max(0, viewTop - box.top) / sy}px ${Math.max(0, box.right - view.right) / sx}px ${Math.max(0, box.bottom - viewBottom) / sy}px ${Math.max(0, view.left - box.left) / sx}px round ${trackRadius}px)`
  }
  function alignMovingOptics() {
    if (!movingLens || !indicatorDock || !scroller || !panel || disposed) return
    const source = host.getBoundingClientRect()
    const view = scroller.getBoundingClientRect()
    const frame = panel.getBoundingClientRect()
    const revealBox = reveal?.getBoundingClientRect()
    // The subpage carousel and expanding glass-settings section also clip the
    // original control. Keep the escaped optical surface in those viewports.
    const subpageBox = subpage?.parentElement?.getBoundingClientRect()
    const bounds = [view, frame, revealBox, subpageBox].filter((box): box is DOMRect => Boolean(box))
    const left = Math.max(...bounds.map(box => box.left))
    const top = Math.max(...bounds.map(box => box.top))
    const right = Math.min(...bounds.map(box => box.right))
    const bottom = Math.min(...bounds.map(box => box.bottom))
    if (!nativeAnchored) {
      const dock = indicatorDock.getBoundingClientRect()
      const sx = dock.width / Math.max(1, indicatorDock.offsetWidth)
      const sy = dock.height / Math.max(1, indicatorDock.offsetHeight)
      movingLens.style.left = `${(source.left - dock.left) / sx}px`
      movingLens.style.top = `${(source.top - dock.top) / sy}px`
      movingLens.style.width = `${host.offsetWidth}px`
      movingLens.style.height = `${host.offsetHeight}px`
    }
    if (host.closest('[data-glass-presence="closed"]') || host.offsetParent === null
      || source.width < 1 || source.height < 1
      || source.right <= left || source.left >= right || source.bottom <= top || source.top >= bottom) {
      movingLens.style.visibility = 'hidden'
      return
    }
    // The overlay is a sibling of the panel, so it must explicitly follow
    // panel/subpage/reveal opacity during exit and return transitions.
    let opacity = 1
    for (const owner of [panel, subpage, reveal]) {
      if (owner) opacity *= Number(getComputedStyle(owner).opacity || 1)
    }
    movingLens.style.opacity = String(opacity)
    movingLens.style.visibility = ''
    const insetTop = Math.max(0, top - source.top)
    const insetRight = Math.max(0, source.right - right)
    const insetBottom = Math.max(0, source.bottom - bottom)
    const insetLeft = Math.max(0, left - source.left)
    const radius = parseFloat(host.style.borderRadius) || 10
    movingLens.style.clipPath = (insetTop || insetRight || insetBottom || insetLeft)
      ? `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px round ${radius}px)`
      : ''
  }
  function alignAllOptics() {
    alignOptics()
    alignMovingOptics()
  }
  const queueAlign = () => {
    if (!alignFrame) alignFrame = requestAnimationFrame(() => { alignFrame = 0; alignAllOptics() })
  }
  if (portaled && (!nativeAnchored || movingLens)) {
    // Native CSS anchors follow scrolling without a JS position follower.
    // The escaped indicator still needs a scroll-time CLIP update.
    listen(scroller!, 'scroll', queueAlign)
  }
  if (portaled) cleanups.push(followOpticalMotion(panel!,
    [movingLens ? panel : null, subpage, reveal].filter((owner): owner is HTMLElement => Boolean(owner)),
    alignAllOptics))
  function render() {
    if (!controller || disposed || host.hasAttribute('data-liquid-glass-dormant')) return
    // Motion stretches the lens, never the original text or hit targets.
    const stretch = quality.deform === false || (!slider && dragged) ? 0 : Math.min(slider ? 10 : 14, Math.abs(velocity) * .02)
    const deformation = quality.deform !== false ? press : 0
    const progress = Math.max(0, Math.min(1, press))
    const speed = velocity / Math.max(1, group!.clientWidth) / 10
    const clampSpeed = (v: number) => Math.max(-.2, Math.min(.2, v))
    // Lift slightly past the rail, without a fixed 24px vertical expansion.
    // Use fixed-pixel
    // horizontal growth so wide labels do not create an excessively wide lens.
    const liftX = (inflationX - 1) / (78 / 56 - 1)
    const liftY = (inflationY - 1) / (78 / 56 - 1)
    const extraWidth = quality.deform === false ? 0 : Math.max(-2, Math.min(26,
      20 * liftX + 16 * clampSpeed(speed * .75)))
    const verticalLift = navbar ? targetHeight * .22 : Math.min(targetHeight * .34,
      Math.max(targetHeight * .22, group!.offsetHeight - targetHeight + 4))
    const extraHeight = quality.deform === false ? 0 : verticalLift * liftY
    const sy = quality.deform === false ? 1 : 1 - clampSpeed(speed * .25)
    const w = slider ? 28 + deformation * 14 + stretch : Math.max(1, targetWidth + extraWidth)
    const h = slider ? 18 + deformation * 10 - stretch * .2 : Math.max(16, (targetHeight + extraHeight) * sy)
    const left = x - w / 2
    const top = targetY - h / 2
    // Navbar uses Inkroam's existing compact 9px corner, not a half-height pill.
    const radius = slider ? h / 2 : Math.min(navbar ? 9 : 10, h / 2)
    quality = currentGlassQuality(w, h, host.dataset.glassTheme, host)
    controller.update({ x: 0, y: 0, width: w, height: h, radius,
      blur: quality.blur, mapScale: quality.mapScale,
      maxFps: quality.maxFps, settleDelay: quality.settleDelay,
      edgeSoftness: quality.edgeSoftness, rimGlow: 0, boundedBezel: true,
      specular: slider ? quality.specular : .5,
      specularAmbient: quality.specularAmbient,
      ...(!slider ? {
        opticalProfile: 'circular' as const,
        // Relative to the current short side, never a fixed-pixel depth or a
        // half-height dome on small controls. Pressure gradually forms the rim.
        refractionHeight: Math.max(.5, Math.min(w, h) * .22 * progress),
        refraction: Math.min(w, h) * .26 * progress,
        rimOpacity: progress,
      } : {}) })
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
    host.style.setProperty('--glass-press', String(progress))
    if (movingLens) movingLens.style.borderRadius = `${radius}px`
    if (trackController) {
      const fraction = Math.max(-1, Math.min(1, (x - trackOrigin) / Math.max(1, group!.clientWidth)))
      const shift = quality.deform === false ? 0 : Math.sign(fraction) * 4 * (1 - (1 - Math.abs(fraction)) ** 3) * progress
      group!.style.setProperty('translate', `${shift}px 0`)
      const growth = quality.deform === false ? 0 : 2 * progress
      const gw = group!.clientWidth, gh = group!.offsetHeight
      // A small lift of the whole rail, independent of the selected tab width.
      lens.style.transform = `scale(${1 + growth / Math.max(1, gw)}, ${1 + growth / Math.max(1, gh)})`
      if (!portaled) {
        lens.style.left = '0'; lens.style.top = '0'
        lens.style.width = `${gw}px`; lens.style.height = `${gh}px`
        lens.style.borderRadius = `${parseFloat(getComputedStyle(group!).borderTopLeftRadius) || 14}px`
      }
      const trackQuality = currentGlassQuality(gw, gh, host.dataset.glassTheme, host)
      // The previous fixed light tint stayed hazy even at 100% clarity.
      // Blur controls diffusion; this complementary low-alpha tint controls
      // the rail's visible frosting without changing the displacement map.
      // At 0% clarity keep the original tint; at 100% retain only 12% of it.
      const frost = Math.max(0, Math.min(1, trackQuality.blur / 24))
      const tintStrength = `${Math.round((.12 + .88 * frost) * 1000) / 10}%`
      if (lens.style.getPropertyValue('--glass-track-tint-strength') !== tintStrength) {
        lens.style.setProperty('--glass-track-tint-strength', tintStrength)
      }
      trackController.update({ width: gw, height: gh,
        radius: parseFloat(getComputedStyle(group!).borderTopLeftRadius) || 14,
        ...trackQuality,
      })
    }
    alignAllOptics()
  }

  function selected() {
    return buttons.find(b => b.getAttribute('aria-expanded') === 'true'
      || b.getAttribute('aria-current') === 'page'
      || b.getAttribute('aria-pressed') === 'true' || b.classList.contains('active')
      || b.classList.contains('router-link-active')) ?? buttons[0]!
  }
  function target(button: HTMLElement, immediate = false) {
    const center = button.offsetLeft + button.offsetWidth / 2
    if (!slider && initialized && !immediate && Math.abs(center - position.target) > .5) {
      pressIndicator()
      releasePending = pressedPointer === null
    }
    widthSpring.set(button.offsetWidth, { immediate })
    heightSpring.set(button.offsetHeight, { immediate })
    verticalSpring.set(button.offsetTop + button.offsetHeight / 2, { immediate })
    position.set(center, { immediate })
  }
  function readRange(immediate = false) {
    if (!input || host.hasAttribute('data-liquid-glass-dormant')) return
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
    if (disposed || host.hasAttribute('data-liquid-glass-dormant')) return
    if (slider) readRange(!initialized)
    else if (!dragged) target(selected(), !initialized)
    initialized = true
  }
  function release() {
    if (pressedPointer !== null && group!.hasPointerCapture?.(pressedPointer)) group!.releasePointerCapture(pressedPointer)
    pressedPointer = null; dragged = false; dragChoice = null
    if (disposed) return
    if (slider) pressure.set(0)
    else {
      releasePending = true
      cancelAnimationFrame(releaseFrame)
      // Native click selection lands after pointerup. Wait one frame before
      // checking arrival; do not deflate while still travelling to the new tab.
      releaseFrame = requestAnimationFrame(() => { releaseFrame = 0; finishRelease() })
    }
  }
  function refreshQuality() {
    if (host.hasAttribute('data-liquid-glass-dormant')) return
    quality = currentGlassQuality(host.offsetWidth, host.offsetHeight, host.dataset.glassTheme, host)
    render()
  }

  const decoded = new MutationObserver(() => {
    if (disposed || !opticalTarget.style.backdropFilter.includes('url(')) return
    ready = true
    clearTimeout(timeout)
    host.setAttribute('data-liquid-glass-control', '')
    host.setAttribute('data-liquid-glass-active', '')
    if (movingLens) {
      movingLens.setAttribute('data-liquid-glass-control', '')
      movingLens.setAttribute('data-liquid-glass-active', '')
    }
    if (hasTrack && lens.style.backdropFilter.includes('url(')) {
      lens.setAttribute('data-liquid-glass-control', '')
      lens.setAttribute('data-liquid-glass-active', '')
      group!.setAttribute('data-glass-track-active', '')
    }

    if (!hasTrack || lens.style.backdropFilter.includes('url(')) decoded.disconnect()
  })
  decoded.observe(opticalTarget, { attributes: true, attributeFilter: ['style'] })
  if (hasTrack) decoded.observe(lens, { attributes: true, attributeFilter: ['style'] })
  // The dock sibling samples the already-painted panel, real rail and ambient
  // page. Other indicators and range thumbs retain their original inline path.
  try {
    controller = engine.createGlass(opticalTarget, { mode: 'backdrop', refraction: slider ? 6 : navbar ? 8 : 5,
      bezel: slider ? .9 : navbar ? .6 : .35, curvature: slider || navbar ? 3 : 4,
      chroma: 0, specular: slider ? quality.specular : .5, specularAmbient: quality.specularAmbient, specularWidth: 1,
      ...(!slider ? { opticalProfile: 'circular' as const, lightAngle: 45, refraction: 0, refractionHeight: .5, rimOpacity: 0 } : {}),
      rimGlow: 0, boundedBezel: true,
      blur: quality.blur, mapScale: quality.mapScale, edgeSoftness: quality.edgeSoftness,
      maxFps: quality.maxFps, settleDelay: quality.settleDelay })
    if (hasTrack) trackController = engine.createGlass(lens, {
      mode: 'backdrop', opticalProfile: 'circular', refractionHeight: 8,
      refraction: 12, chroma: 0, lightAngle: 45,
      // quality already supplies rimGlow: 0 and boundedBezel: true.
      ...quality,
    })
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
    pressedPointer = event.pointerId; pressIndicator()
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
      && !(e.target as Element).matches(':disabled')) pressIndicator()
  })
  listen(group, 'keyup', () => release())
  listen(group, 'focusout', () => release())
  refresh()
  refreshQuality()
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
    clearTimeout(clickTimer)
    release()
    position.stop(); pressure.stop(); widthSpring.stop(); heightSpring.stop(); verticalSpring.stop()
    inflationSpringX.stop(); inflationSpringY.stop(); cancelAnimationFrame(releaseFrame)
    if (alignFrame) cancelAnimationFrame(alignFrame)
    resize?.disconnect(); state?.disconnect(); decoded.disconnect()
    cleanups.forEach(cleanup => cleanup())
    controller?.destroy()
    trackController?.destroy()
    movingLens?.remove()
    if (hasTrack) lens.remove()
    group!.removeAttribute('data-glass-track-active')
    for (const [name, value, priority] of oldGroupStyles) {
      if (value) group!.style.setProperty(name, value, priority)
      else group!.style.removeProperty(name)
    }

    host.removeAttribute('data-liquid-glass-dormant')
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
    if (host.closest('[data-glass-presence="closed"]')) {
      if (portaled) lens.style.visibility = 'hidden'
      if (movingLens) movingLens.style.visibility = 'hidden'
      return
    }
    if (host.closest('[data-glass-presence="closing"]')) { alignAllOptics(); return }
    if (slider) readRange(true)
    else if (!dragged) target(selected(), true)
    render()
  }
  function setDormant(value: boolean) {
    if (value) {
      sleepingFilter = opticalTarget.style.backdropFilter
      sleepingTrackFilter = lens.style.backdropFilter
      position.stop(); pressure.stop(); widthSpring.stop(); heightSpring.stop(); verticalSpring.stop()
      inflationSpringX.stop(); inflationSpringY.stop(); cancelAnimationFrame(releaseFrame)
      releasePending = false
    }
    controller?.update({ hidden: value })
    controller?.flush()
    trackController?.update({ hidden: value }); trackController?.flush()
    if (!value && !opticalTarget.style.backdropFilter && sleepingFilter) opticalTarget.style.backdropFilter = sleepingFilter
    if (!value && !lens.style.backdropFilter && sleepingTrackFilter) lens.style.backdropFilter = sleepingTrackFilter
    for (const element of new Set([host, lens, movingLens].filter((el): el is HTMLElement => Boolean(el)))) {
      if (value) element.setAttribute('data-liquid-glass-dormant', '')
      else element.removeAttribute('data-liquid-glass-dormant')
    }
    if (value) {
      lens.style.visibility = 'hidden'
      if (movingLens) movingLens.style.visibility = 'hidden'
      velocity = 0
      pressure.set(0, { immediate: true })
      inflationSpringX.set(1, { immediate: true }); inflationSpringY.set(1, { immediate: true })
    }
    else {
      const originalVisibility = hasTrack ? undefined : oldStyles.find(([name]) => name === 'visibility')
      if (originalVisibility?.[1]) lens.style.setProperty('visibility', originalVisibility[1], originalVisibility[2])
      else lens.style.removeProperty('visibility')
      if (movingLens) movingLens.style.removeProperty('visibility')
      refreshLayout()
    }
  }
  return { destroy, refreshQuality, refreshLayout, setDormant }
}
