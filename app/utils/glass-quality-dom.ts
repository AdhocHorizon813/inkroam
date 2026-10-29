import { effectiveGlassPreference } from './glass-settings'
import { componentGlassQuality } from './glass-quality'

export function currentGlassQuality(width: number, height: number, colorMode: string | undefined, host: HTMLElement) {
  const data = document.documentElement.dataset
  return componentGlassQuality(effectiveGlassPreference(host, data), width, height,
    (colorMode || data.colorMode) === 'light', window.devicePixelRatio || 1)
}
