import type { GlassOptions } from '../vendor/liquidglass/liquid-glass.js'

// gentpan/liquidglass 068ad226: lib/components.js LGButton/LGPanel/LGMenu/LGNavbar.
// Its Surface.attach() explicitly uses chroma: 0 for arbitrary-DOM backdrop mode.
// Keep these distinct from the Playground's image-lens demonstration preset.
export function glassOptics(module?: string): GlassOptions {
  const common = { ior: 1.5, lightAngle: -120, chroma: 0 }
  if (module === 'navbar') return {
    ...common, refraction: 16, bezel: 0.8, curvature: 3,
    blur: 1, specular: 0.55, specularWidth: 1.5,
  }
  if (module === 'dropdown') return {
    ...common, refraction: 22, bezel: 0.35, curvature: 3,
    blur: 6, specular: 0.8, specularWidth: 2.5,
  }
  if (module) return {
    ...common, refraction: 24, bezel: 0.3, curvature: 4,
    blur: 2, specular: 0.5, specularWidth: 2,
  }
  return {
    ...common, refraction: 14, bezel: 0.8, curvature: 3,
    blur: 0, specular: 0.6, specularWidth: 1.5,
  }
}
