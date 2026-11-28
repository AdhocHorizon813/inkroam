type MaterialMode = 'liquid' | 'acrylic' | 'mica'

export interface AppearanceDefaults {
  navMaterial: MaterialMode
  musicMaterial: MaterialMode
  contentMaterial: MaterialMode
  codeMaterial: MaterialMode
  dropdownMaterial: MaterialMode
  backgroundMaterial: MaterialMode
  navBlur: number
  musicBlur: number
  contentBlur: number
  codeBlur: number
  dropdownBlur: number
  backgroundBlur: number
  backgroundOverlay: number
  diagramScale: number
}

// Migration fallback for v5 visitors with missing keys. Keep these values stable.
export const LEGACY_DEFAULTS: Readonly<AppearanceDefaults> = {
  musicMaterial: 'mica',
  musicBlur: 12,
  codeMaterial: 'mica',
  codeBlur: 10,
  navMaterial: 'mica',
  contentMaterial: 'mica',
  dropdownMaterial: 'mica',
  backgroundMaterial: 'mica',
  navBlur: 12,
  contentBlur: 10,
  dropdownBlur: 12,
  backgroundBlur: 4,
  backgroundOverlay: 40,
  /* 图表尺寸是新控件：老访客缺这个键时落到这里，与两套出厂值同值（75）。 */
  diagramScale: 75,
}

// Modern dark mode starts with the v5 palette. Future changes belong here.
export const DARK_DEFAULTS: Readonly<AppearanceDefaults> = { ...LEGACY_DEFAULTS }

const LIGHT_DEFAULTS: Readonly<AppearanceDefaults> = {
  musicMaterial: 'liquid',
  musicBlur: 14,
  codeMaterial: 'liquid',
  codeBlur: 5,
  navMaterial: 'liquid',
  contentMaterial: 'liquid',
  dropdownMaterial: 'liquid',
  backgroundMaterial: 'liquid',
  navBlur: 14,
  contentBlur: 5,
  dropdownBlur: 4,
  backgroundBlur: 0,
  backgroundOverlay: 40,
  diagramScale: 75,
}

export function appearanceDefaults(mode: 'dark' | 'light') {
  return mode === 'dark' ? DARK_DEFAULTS : LIGHT_DEFAULTS
}
