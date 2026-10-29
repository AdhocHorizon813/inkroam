import type { GlassController } from '../vendor/liquidglass/liquid-glass.js'
import { glassSurfaces, GLASS_SURFACES_CHANGED } from './glass-surfaces'
import { glassOptics } from './glass-optics'
import { attachGlassControl } from './glass-controls'
import { currentGlassQuality } from './glass-quality-dom'
import { attachGlassContent, GLASS_CONTENT_SELECTOR } from './glass-content'
import { glassSurfaceEnabled, effectiveGlassPreference } from './glass-settings'

type EngineModule = typeof import('../vendor/liquidglass/liquid-glass.js')
type Surface = { destroy: () => void; refreshQuality?: () => void; refreshLayout?: () => void }

// One owner for docks and explicitly registered floating surfaces. No DOM cloning.
// This function is called only after the app and its persistent docks have mounted.
export function mountExperimentalGlass() {
  const root = document.documentElement
  const reduceTransparency = matchMedia('(prefers-reduced-transparency: reduce)')
  const surfaces = new Map<HTMLElement, Surface>()
  const qualityStamps = new WeakMap<HTMLElement, string>()
  let modulePromise: Promise<EngineModule> | undefined
  let sequence = 0
  let disposed = false
  const wantsGlass = () => root.dataset.experimentalLiquidGlass === 'on'
    && root.dataset.visual === 'modern' && !reduceTransparency.matches

  const candidates = () => [...document.querySelectorAll<HTMLElement>(
    `.appearance-trigger, .music-pill.music-surface, .music-pill.is-unplayed > .music-trigger.music-surface, ${GLASS_CONTENT_SELECTOR}`,
  ), ...glassSurfaces].filter(host => host.isConnected && glassSurfaceEnabled(host, root.dataset)
    // Both appearance subpages are attached up front, while still hidden. Their
    // wrapper is the only inert ancestor we look through: building a lens on the
    // incoming page instead meant the native pill showed first and the glass then
    // slid into place from a stale rect, both visible to the eye. A closed music
    // panel stays excluded — it renders nothing to align against.
    && (!host.closest?.('[inert]') || Boolean(host.closest?.('[data-glass-page-hidden]')))
    && !(root.dataset.displayMode === 'focus'
      && (host.dataset.glassModule === 'navbar' || host.closest?.('.site-header'))))

  function detachAll() {
    surfaces.forEach(surface => surface.destroy())
    surfaces.clear()
  }

  function attach(host: HTMLElement, engine: EngineModule): Surface {
    if (host.matches?.(GLASS_CONTENT_SELECTOR)) return attachGlassContent(host, engine)
    if (host.dataset.glassModule === 'indicator' || host.dataset.glassModule === 'thumb') {
      return attachGlassControl(host, engine)
    }
    const panel = Boolean(host.dataset.glassModule)
    // All surfaces use their own backdrop. A dock child at z-index:-1 was trapped
    // by the host's backdrop root and could sample an empty/incorrect surface.
    // No injected flex item, no filtering or duplicating the label itself.
    const lens = host
    let controller: GlassController | undefined
    let ready = false
    let destroyed = false
    let timeout = 0
    let geometry: ResizeObserver | undefined
    const original = ['filter', 'backdrop-filter', '-webkit-backdrop-filter'].map(property => ({
      property, value: host.style.getPropertyValue(property), priority: host.style.getPropertyPriority(property),
    }))
    const originalReady = host.getAttribute('data-liquid-glass-active')

    function destroy() {
      if (destroyed) return
      destroyed = true
      clearTimeout(timeout)
      readiness.disconnect()
      geometry?.disconnect()
      controller?.destroy()
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
      controller?.update({ radius, ...currentGlassQuality(host.offsetWidth, host.offsetHeight, host.dataset.glassTheme, host) })
    }
    try {
      controller = engine.createGlass(lens, {
        mode: 'backdrop', fit: true,
        // Both dock controls are capsules. Upstream clamps this radius against
        // the live half-height/half-width, including desktop/mobile resizing.
        radius: 999,
        ...glassOptics(host.dataset.glassModule), ...currentGlassQuality(host.offsetWidth, host.offsetHeight, host.dataset.glassTheme, host),
      })
      measure()
      geometry = new ResizeObserver(measure)
      geometry.observe(host)
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
      // Only the active subpage needs a layout refresh. Hidden accordion
      // sections and the outgoing appearance page must never resync their
      // portaled lenses or start independent geometry work on a switch.
      for (const host of targets) {
        if (host.dataset.glassModule !== 'indicator' && host.dataset.glassModule !== 'thumb') continue
        if (host.closest?.('[data-glass-page-hidden="true"]')
          || host.closest?.('[inert]')
          || host.offsetParent === null) continue
        surfaces.get(host)?.refreshLayout?.()
      }
      // A slider in one group must not refresh every other control's filter.
      surfaces.forEach((surface, host) => {
        const stamp = JSON.stringify([root.dataset.colorMode, window.devicePixelRatio, effectiveGlassPreference(host, root.dataset)])
        if (qualityStamps.get(host) === stamp) return
        qualityStamps.set(host, stamp)
        surface.refreshQuality?.()
      })
    } catch (error) {
      if (disposed || current !== sequence) return
      detachAll()
      modulePromise = undefined
      console.warn('[Inkroam] Experimental glass unavailable; original material retained.', error)
    }
  }

  const preferences = new MutationObserver(() => { void sync() })
  preferences.observe(root, { attributes: true, attributeFilter: ['data-experimental-liquid-glass', 'data-visual', 'data-display-mode', 'data-glass-clarity', 'data-glass-antialias', 'data-glass-components', 'data-glass-global', 'data-nav-material', 'data-music-material', 'data-material', 'data-dropdown-material', 'data-color-mode'] })
  const music = new MutationObserver(() => { void sync() })
  const pill = document.querySelector('.music-pill')
  // Playback transfers surface ownership from the idle button to the whole pill.
  if (pill) music.observe(pill, { attributes: true, attributeFilter: ['class'] })
  // Both appearance subpages stay mounted and swap with `inert` plus
  // `data-glass-page-hidden`; that attribute is the only thing that changes on a
  // level-1 / level-2 switch. Without re-running the pass here, the hidden page's
  // portaled control lenses keep their last measured rect and stay visible — a
  // second shadowed indicator, offset from the real one, survives every switch.
  const pages = new MutationObserver(() => { void sync() })
  pages.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-glass-page-hidden', 'inert'] })
  reduceTransparency.addEventListener('change', sync)
  window.addEventListener(GLASS_SURFACES_CHANGED, sync)
  void sync()
  return () => {
    disposed = true
    sequence++
    preferences.disconnect()
    pages.disconnect()
    music.disconnect()
    reduceTransparency.removeEventListener('change', sync)
    window.removeEventListener(GLASS_SURFACES_CHANGED, sync)
    detachAll()
  }
}
