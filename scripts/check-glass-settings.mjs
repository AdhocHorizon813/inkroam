import { readFileSync } from 'node:fs'
import { createDefaultGlassGlobal, createDefaultGlassPreferences } from '../app/utils/glass-defaults.ts'
import assert from 'node:assert/strict'
import { GLASS_GROUPS, normalizeGlassPreferences, normalizeGlassGlobal, effectiveGlassPreference, glassSurfaceEnabled, glassMaterialKey } from '../app/utils/glass-settings.ts'
import { componentGlassQuality } from '../app/utils/glass-quality.ts'
import { glassOptics } from '../app/utils/glass-optics.ts'

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

// Splitting the article toolbar from its panels must preserve both old storage
// and its optical recipe, while allowing independent/global changes afterward.
const previousTools = { ...createDefaultGlassPreferences().tools, clarity: 29, antialias: false, resolution: .25, enabled: false }
const migrated = normalizeGlassPreferences({ tools: previousTools })
assert.deepEqual(migrated['tools-track'], previousTools)
assert.notEqual(migrated['tools-track'], migrated.tools)
assert.deepEqual(glassOptics('tools-track'), glassOptics('tools'), 'Track retains the previous refraction profile')
migrated['tools-track'].enabled = true
migrated['tools-track'].clarity = 62
assert.equal(migrated.tools.clarity, 29, 'Track controls cannot alter find/export panels')
const trackData = { ...data, dropdownMaterial: 'liquid', glassComponents: JSON.stringify(migrated) }
assert.equal(glassMaterialKey(host('tools-track')), 'dropdownMaterial')
assert(glassSurfaceEnabled(host('tools-track'), trackData))
assert(!glassSurfaceEnabled(host('tools'), trackData))
assert.equal(effectiveGlassPreference(host('tools-track'), trackData).clarity, 62)
assert.equal(normalizeGlassPreferences(migrated)['tools-track'].clarity, 62, 'Explicit track settings survive reload')
trackData.glassGlobal = JSON.stringify({ enabled: true, settings: { clarity: 18, enabled: false } })
assert.equal(effectiveGlassPreference(host('tools-track'), trackData).clarity, 18)
assert(!glassSurfaceEnabled(host('tools-track'), trackData), 'Global off includes the article toolbar track')
trackData.glassGlobal = JSON.stringify({ enabled: false })
assert(glassSurfaceEnabled(host('tools-track'), trackData))
assert.equal(effectiveGlassPreference(host('tools-track'), trackData).clarity, 62, 'Global override preserves the saved track preference')

const p = { ...legacy.navbar, resolution: 1, antialias: false, aaScale: 2, pixelBudget: 1.5 }
const quarter = normalizeGlassPreferences({ indicator: { resolution: .25 } }).indicator
assert.equal(quarter.resolution, .25, 'Quarter-resolution preference survives normalization')
assert.equal(normalizeGlassGlobal({ settings: { resolution: .25 } }).settings.resolution, .25)
assert.equal(componentGlassQuality(quarter, 100, 32, false, 2).mapScale, .25, 'Explicit quarter scale is not replaced with DPR')
assert.equal(componentGlassQuality({ ...quarter, antialias: true, aaScale: 2 }, 100, 32, false, 2).mapScale, .5, 'AA multiplies quarter scale')
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
assert.deepEqual(createDefaultGlassPreferences(), { ...capture.components, 'tools-track': capture.components.tools })
const trackDefaults = createDefaultGlassPreferences()
trackDefaults['tools-track'].clarity = 0
assert.equal(trackDefaults.tools.clarity, 75)
assert.deepEqual(createDefaultGlassPreferences()['tools-track'], capture.components.tools, 'Track defaults retain the existing toolbar parameters')
assert.deepEqual(createDefaultGlassGlobal().settings, capture.global.settings)
assert.equal(createDefaultGlassGlobal().enabled, false, 'New visitors still opt into global override')
const customized = createDefaultGlassPreferences()
customized.music.clarity = 0
assert.equal(createDefaultGlassPreferences().music.clarity, 50, 'Defaults must not share mutable objects')
const customGlobal = createDefaultGlassGlobal()
customGlobal.settings.clarity = 0
assert.equal(createDefaultGlassGlobal().settings.clarity, 100)
// Lazy true-glass cards must begin with the exact same tint as the decoded
// optical lens. This is limited to experimental content mode only.
const panelSource = readFileSync('app/components/AppearancePanel.vue', 'utf8')
const glassCss = readFileSync('app/components/ExperimentalGlass.client.vue', 'utf8')
const appSource = readFileSync('app/app.vue', 'utf8')
const articleToolsSource = readFileSync('app/components/ArticleTools.vue', 'utf8')
assert.match(articleToolsSource, /data-glass-module="tools-track" class="article-tools__actions"/)
assert.match(articleToolsSource, /id="article-find-panel"[^>]+data-glass-module="tools"/)
assert.match(articleToolsSource, /id="article-export-panel"[^>]+data-glass-module="tools"/)
assert.match(panelSource, /root\.dataset\.glassContentPreview = root\.dataset\.experimentalLiquidGlass === 'on'/)
assert.match(panelSource, /state\.contentMaterial === 'liquid' && contentGlassEnabled && blink/)
assert.match(glassCss, /data-glass-content-preview='on'/)
assert.match(glassCss, /:not\(\[data-liquid-glass-content\]\)/)
assert.match(glassCss, /rgb\(17 24 39 \/ \.20\) !important/)
assert.match(glassCss, /rgb\(250 250 248 \/ \.22\) !important/)
assert.match(glassCss, /@media not \(prefers-reduced-transparency: reduce\)/)
assert.match(glassCss, /\[data-liquid-glass-content\] \{\s*background: transparent !important/)
// The tint handover flips a transitioned property. Without suppressing it for
// that single assignment the card double-tints for ~215ms after a route change,
// which is the亮度闪烁 this suite guards against.
const contentGlassSource = readFileSync('app/utils/glass-content.ts', 'utf8')
assert.match(contentGlassSource, /host\.style\.transition = 'none'/, 'Tint handover must not animate')
assert.match(contentGlassSource, /void host\.offsetWidth/, 'The suppressed swap is flushed in the same frame')
assert.match(appSource, /targets\.forEach\(target => target\.style\.opacity = '0'\)/, 'The existing route motion remains unchanged')
// Interaction state must not tear down optics while the animated owner leaves.
const musicSource = readFileSync('app/components/MusicPlayer.vue', 'utf8')
const surfacesSource = readFileSync('app/utils/glass-surfaces.ts', 'utf8')
const engineSource = readFileSync('app/utils/experimental-glass.ts', 'utf8')
assert.match(musicSource, /id="music-panel" v-experimental-glass="open" v-glass-presence="open"/)
assert.match(surfacesSource, /afterGlassMotion/)
assert.doesNotMatch(surfacesSource, /setTimeout/)
assert.match(glassCss, /\[data-liquid-glass-dormant\] \{\s*backdrop-filter: none !important/)
assert.doesNotMatch(engineSource, /!host\.closest\?\.\('\[inert\]'\)/)
assert.match(surfacesSource, /el\.dataset\.glassPresence = open \? 'open' : 'closed'/)
console.log('Glass settings: migration, isolation, material gates, sampling budgets and captured defaults passed.')
