/** Minimal types for the pinned upstream API consumed by Inkroam. */
export interface GlassOptions {
  mode?: 'content' | 'backdrop'
  fit?: boolean
  clip?: boolean
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  refraction?: number
  bezel?: number
  curvature?: number
  ior?: number
  chroma?: number
  blur?: number
  specular?: number
  specularWidth?: number
  lightAngle?: number
  mapScale?: number
  edgeSoftness?: number
  specularAmbient?: number
  hidden?: boolean
}
export interface GlassController {
  update(options: GlassOptions): void
  flush(): void
  readonly filterId: string
  destroy(): void
}
export const engine: 'blink' | 'webkit' | 'gecko' | 'unknown'
export function createGlass(target: HTMLElement, options?: GlassOptions): GlassController
export interface GlassSpring {
  set(value: number, options?: { immediate?: boolean }): void
  readonly value: number
  readonly target: number
  stop(): void
}
export function createSpring(initial: number, update: (value: number, velocity: number) => void,
  options?: { stiffness?: number; damping?: number; mass?: number }): GlassSpring
