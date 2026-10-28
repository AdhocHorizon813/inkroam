import type { GlassController } from '../vendor/liquidglass/liquid-glass.js'
import { glassSurfaces, GLASS_SURFACES_CHANGED } from './glass-surfaces'
import { glassOptics } from './glass-optics'
import { attachGlassControl } from './glass-controls'
import { currentGlassQuality } from './glass-quality'

type EngineModule = typeof import('../vendor/liquidglass/liquid-glass.js')
type Surface = { destroy: () => void; refreshQuality?: () => void }

// One owner for docks and explicitly registered floating surfaces. No DOM cloning.
// This function is called only after the app and its persistent docks have mounted.
export function mountExperimentalGlass() {
  const root = document.documentElement
  const reduceTransparency = matchMedia('(prefers-reduced-transparency: reduce)')
  const surfaces = new Map<HTMLElement, Surface>()
  let modulePromise: Promise<EngineModule> | undefined
  let sequence = 0
  let disposed = false
  const wantsGlass = () => root.dataset.experimentalLiquidGlass === 'on'
    && root.dataset.visual === 'modern' && !reduceTransparency.matches

  const candidates = () => [...document.querySelectorAll<HTMLElement>(
    '.appearance-trigger, .music-pill.music-surface, .music-pill.is-unplayed > .music-trigger.music-surface',
  ), ...glassSurfaces].filter(host => host.isConnected
    && !(root.dataset.displayMode === 'focus'
      && (host.dataset.glassModule === 'navbar' || host.closest?.('.site-header'))))

  function detachAll() {
    surfaces.forEach(surface => surface.destroy())
    surfaces.clear()
  }

  function attach(host: HTMLElement, engine: EngineModule): Surface {
    if (host.dataset.glassModule === 'indicator' || host.dataset.glassModule === 'thumb') {
      return attachGlassControl(host, engine)
    }
    const panel = Boolean(host.dataset.glassModule)
    // Panels have animated clip paths and scrollable content. Their own backdrop
    // filter samples outside that backdrop root and never filters foreground text.
    // Dock controls retain the separate decorative layer from the first rollout.
    const lens = panel ? host : document.createElement('i')
    if (!panel) {
      lens.className = 'experimental-glass-surface'
      lens.setAttribute('aria-hidden', 'true')
      host.appendChild(lens)
    }
    let controller: GlassController | undefined
    let ready = false
    let destroyed = false
    let timeout = 0
    let geometry: ResizeObserver | undefined
    const original = (panel ? ['filter', 'backdrop-filter', '-webkit-backdrop-filter'] : ['position', 'z-index']).map(property => ({
      property, value: host.style.getPropertyValue(property), priority: host.style.getPropertyPriority(property),
    }))
    const originalReady = host.getAttribute('data-liquid-glass-active')
    // z-index establishes the local stacking context without an isolation/opacity
    // backdrop root. The lens can sit at -1, behind glyphs but above page content.
    const computed = getComputedStyle(host)
    if (!panel && computed.position === 'static') host.style.position = 'relative'
    if (!panel && computed.zIndex === 'auto') host.style.zIndex = '0'

    function destroy() {
      if (destroyed) return
      destroyed = true
      clearTimeout(timeout)
      readiness.disconnect()
      geometry?.disconnect()
      controller?.destroy()
      if (!panel) lens.remove()
      if (originalReady === null) host.removeAttribute('data-liquid-glass-active')
      else host.setAttribute('data-liquid-glass-active', originalReady)
      for (const { property, value, priority } of original) {
        if (value) host.style.setProperty(property, value, priority)
        else host.style.removeProperty(property)
      }
    }

    const readiness = new MutationObserver(() => {
      if (destroyed || !lens.style.backdropFilter.includes('url(')) return
      if (ready) return
      // Upstream sets the URL only after its map has decoded. Until then the
      // original host material stays visible; the decorative layer is hidden.
      ready = true
      clearTimeout(timeout)
      host.setAttribute('data-liquid-glass-active', '')
      readiness.disconnect()
    })
    readiness.observe(lens, { attributes: true, attributeFilter: ['style'] })

    function measure() {
      if (destroyed) return
      const radius = panel ? parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0 : 999
      controller?.update({ radius, ...currentGlassQuality(host.clientWidth, host.clientHeight) })
    }
    try {
      controller = engine.createGlass(lens, {
        mode: 'backdrop', fit: true,
        // Both dock controls are capsules. Upstream clamps this radius against
        // the live half-height/half-width, including desktop/mobile resizing.
        radius: 999,
        ...glassOptics(host.dataset.glassModule), ...currentGlassQuality(host.clientWidth, host.clientHeight),
      })
      if (panel) {
        measure()
        geometry = new ResizeObserver(measure)
        geometry.observe(host)
      }
      // Failure must leave a usable old-material control, never a blank surface.
      timeout = window.setTimeout(() => {
        if (!ready) { destroy(); surfaces.delete(host) }
      }, 4000)
    } catch (error) {
      destroy()
      throw error
    }
    return { destroy, refreshQuality: measure }
  }

  async function sync() {
    const current = ++sequence
    if (disposed || !wantsGlass() || candidates().length === 0) { detachAll(); return }
    try {
      modulePromise ??= import('../vendor/liquidglass/liquid-glass.js')
      const engine = await modulePromise
      if (disposed || current !== sequence || !wantsGlass()) return
      // Do not replace existing materials with the library's fallback blur.
      if (engine.engine !== 'blink') { detachAll(); return }
      const targets = new Set(candidates())
      for (const [host, surface] of surfaces) {
        if (!targets.has(host)) { surface.destroy(); surfaces.delete(host) }
      }
      for (const host of targets) if (!surfaces.has(host)) surfaces.set(host, attach(host, engine))
      surfaces.forEach(surface => surface.refreshQuality?.())
    } catch (error) {
      if (disposed || current !== sequence) return
      detachAll()
      modulePromise = undefined
      console.warn('[Inkroam] Experimental glass unavailable; original material retained.', error)
    }
  }

  const preferences = new MutationObserver(() => { void sync() })
  preferences.observe(root, { attributes: true, attributeFilter: ['data-experimental-liquid-glass', 'data-visual', 'data-display-mode', 'data-glass-clarity', 'data-glass-antialias', 'data-color-mode'] })
  const music = new MutationObserver(() => { void sync() })
  const pill = document.querySelector('.music-pill')
  // Playback transfers surface ownership from the idle button to the whole pill.
  if (pill) music.observe(pill, { attributes: true, attributeFilter: ['class'] })
  reduceTransparency.addEventListener('change', sync)
  window.addEventListener(GLASS_SURFACES_CHANGED, sync)
  void sync()
  return () => {
    disposed = true
    sequence++
    preferences.disconnect()
    music.disconnect()
    reduceTransparency.removeEventListener('change', sync)
    window.removeEventListener(GLASS_SURFACES_CHANGED, sync)
    detachAll()
  }
}
