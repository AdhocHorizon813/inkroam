import { readFileSync } from 'node:fs'
import { createDefaultGlassGlobal, createDefaultGlassPreferences } from '../app/utils/glass-defaults.ts'
import assert from 'node:assert/strict'
import { GLASS_GROUPS, normalizeGlassPreferences, normalizeGlassGlobal, effectiveGlassPreference, glassSurfaceEnabled, glassMaterialKey } from '../app/utils/glass-settings.ts'
import { componentGlassQuality } from '../app/utils/glass-quality.ts'

const legacy = normalizeGlassPreferences(undefined, 42, true)
assert.equal(Object.keys(legacy).length, GLASS_GROUPS.length)
assert(Object.values(legacy).every(p => p.clarity === 42 && p.antialias && p.enabled))
legacy.music.clarity = 8
assert.equal(legacy.navbar.clarity, 42, 'Groups cannot share mutable preferences')
const corrupt = normalizeGlassPreferences({ music: { clarity: Infinity, resolution: -9, pixelBudget: 900, aaScale: 10, enabled: false } })
assert.deepEqual(corrupt.music, { clarity: 86, resolution: 0, pixelBudget: 1.5, aaScale: 1, enabled: false, antialias: false,
  maxSide: 4096, maxFps: 0, settleDelay: 0, deform: true })

const host = (module, context = '') => ({ dataset: { glassModule: module }, matches: () => false,
  closest: selector => context && selector.includes(context) ? {} : null })
const data = { navMaterial: 'liquid', musicMaterial: 'mica', dropdownMaterial: 'acrylic', material: 'liquid', glassComponents: JSON.stringify(normalizeGlassPreferences()) }
assert(glassSurfaceEnabled(host('navbar'), data))
assert(!glassSurfaceEnabled(host('music'), data), 'Mica must not be overridden')
assert(!glassSurfaceEnabled(host('dropdown'), data), 'Acrylic must not be overridden')
assert.equal(glassMaterialKey(host('thumb', '.music-panel')), 'musicMaterial')
assert(!glassSurfaceEnabled(host('thumb', '.music-panel'), data))
assert(glassSurfaceEnabled(host('indicator', '.site-header'), data))
const disabled = normalizeGlassPreferences()
disabled.indicator.enabled = false
assert(!glassSurfaceEnabled(host('indicator'), { ...data, glassComponents: JSON.stringify(disabled) }))
assert(glassSurfaceEnabled(host('navbar'), { ...data, glassComponents: JSON.stringify(disabled) }))
const overridden = { ...data, glassComponents: JSON.stringify(disabled), glassGlobal: JSON.stringify({ enabled: true, settings: { clarity: 18, enabled: true } }) }
assert(glassSurfaceEnabled(host('indicator'), overridden), 'Global enable overrides component disable')
assert.equal(effectiveGlassPreference(host('navbar'), overridden).clarity, 18)
assert(!glassSurfaceEnabled(host('music'), overridden), 'Even global override cannot replace mica')
overridden.glassGlobal = JSON.stringify({ enabled: true, settings: { enabled: false } })
assert(!glassSurfaceEnabled(host('navbar'), overridden), 'Global true-glass off destroys all eligible lenses')
overridden.glassGlobal = JSON.stringify({ enabled: false })
assert(!glassSurfaceEnabled(host('indicator'), overridden), 'Disabling global restores saved component off')
assert(glassSurfaceEnabled(host('navbar'), overridden))
assert.equal(normalizeGlassGlobal({ enabled: 'true' }).enabled, false)

const p = { ...legacy.navbar, resolution: 1, antialias: false, aaScale: 2, pixelBudget: 1.5 }
assert.equal(componentGlassQuality(p, 100, 50, false, 2).mapScale, 1, 'AA multiplier has no effect when off')
const aa = componentGlassQuality({ ...p, antialias: true }, 100, 50, false, 2)
assert.equal(aa.mapScale, 2)
assert(aa.edgeSoftness > 0)
const big = componentGlassQuality({ ...p, antialias: true, pixelBudget: .5 }, 2000, 1600, false, 3)
assert(big.mapScale < 1)
assert(Math.abs(big.mapScale ** 2 * 2000 * 1600 - 500_000) < .01, 'Budget includes AA')
const narrow = componentGlassQuality({ ...p, maxSide: 1024 }, 4000, 100, false, 2)
assert.equal(narrow.mapScale * 4000, 1024, 'Long textures obey side limit')
const throttle = componentGlassQuality({ ...p, maxFps: 30, settleDelay: 160, deform: false }, 100, 100, false, 1)
assert.equal(throttle.maxFps, 30)
assert.equal(throttle.settleDelay, 160)
assert.equal(throttle.deform, false)
assert(componentGlassQuality({ ...p, clarity: 0 }, 100, 50, false, 1).blur > componentGlassQuality({ ...p, clarity: 100 }, 100, 50, false, 1).blur)

const capture = JSON.parse(readFileSync(new URL('../docs/liquid-glass-tuned-2026-10-29.json', import.meta.url), 'utf8'))
assert.deepEqual(createDefaultGlassPreferences(), capture.components)
assert.deepEqual(createDefaultGlassGlobal().settings, capture.global.settings)
assert.equal(createDefaultGlassGlobal().enabled, false, 'New visitors still opt into global override')
const customized = createDefaultGlassPreferences()
customized.music.clarity = 0
assert.equal(createDefaultGlassPreferences().music.clarity, 50, 'Defaults must not share mutable objects')
const customGlobal = createDefaultGlassGlobal()
customGlobal.settings.clarity = 0
assert.equal(createDefaultGlassGlobal().settings.clarity, 100)
console.log('Glass settings: migration, isolation, material gates, sampling budgets and captured defaults passed.')
