import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { readFileSync, statSync } from 'node:fs'
import { ref, computed } from 'vue'
import { parse, compileStyle } from '@vue/compiler-sfc'
import postcss from 'postcss'
import { musicTracks, musicPreferences, musicTime, loadMusicForPlay, MUSIC_STORAGE_KEY } from '../app/utils/music.ts'

const source = readFileSync('app/components/MusicPlayer.vue', 'utf8')
const { descriptor } = parse(source)
const script = ts.transpile(descriptor.scriptSetup.content.replace(/^import .*$/gm, ''), { target: ts.ScriptTarget.ES2022 })
const mounted = [], cleanup = [], events = new Map()
let src = null, loads = 0, plays = 0, pauses = 0, stored, rejectPlay = false
const media = {
  volume: 1, currentTime: 0, duration: NaN,
  getAttribute: () => src, hasAttribute: () => src !== null,
  setAttribute: (key, value) => { assert.equal(key, 'src'); src = value },
  removeAttribute: () => { src = null },
  load: () => { loads++ },
  play: () => { plays++; return rejectPlay ? Promise.reject(new Error('blocked')) : Promise.resolve() },
  pause: () => { pauses++ },
}
const context = vm.createContext({ ref, computed, musicTracks, musicPreferences, musicTime, loadMusicForPlay, MUSIC_STORAGE_KEY,
  // Minimal browser surface: the component reads layout, schedules frames and
  // observes sizes; none of it may reject on undefined globals before assertions.
  watch: () => () => {}, nextTick: async () => {},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  getComputedStyle: () => ({ borderTopWidth: '1px', borderBottomWidth: '1px', maxHeight: '', borderRadius: '12px', getPropertyValue: () => '' }),
  URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
  window: { innerWidth: 1200, innerHeight: 900, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) },
  useRuntimeConfig: () => ({ app: { baseURL: '/inkroam/' } }),
  onMounted: fn => mounted.push(fn), onBeforeUnmount: fn => cleanup.push(fn),
  animateArticleTool: () => () => {},
  document: { hidden: false, documentElement: { style: {}, clientWidth: 1200 }, addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) },
  localStorage: { getItem: () => JSON.stringify({ track: musicTracks[1].id, volume: .2, playing: true, autoplay: true }), setItem: (_key, value) => { stored = JSON.parse(value) } },
})
vm.runInContext(`${script}\nglobalThis.test = { audio, open, hasPlayed, dockTitle, index, volume, repeat, shuffle, playing, loading, elapsed, pendingSeek, loaded, message, play, pause, selectTrack, seek, changeVolume, ended, metadata };`, context)
const player = context.test
player.audio.value = media
mounted.forEach(fn => fn())
assert.equal(player.index.value, 1)
assert.equal(media.volume, .2)
assert.equal(src, null); assert.equal(loads, 0); assert.equal(plays, 0)
player.open.value = true
assert.equal(player.dockTitle.value, '音乐', 'Opening is not playback')
player.selectTrack(2, false)
assert.equal(src, null); assert.equal(loads, 0); assert.equal(plays, 0, 'Open/list browsing never requests audio')
player.seek({ target: { value: '45' } })
assert.equal(player.elapsed.value, 45)
assert.equal(player.pendingSeek.value, 45)
assert.equal(src, null); assert.equal(loads, 0, 'Preselecting progress must not load metadata or audio')
await player.play()
assert.equal(player.dockTitle.value, '音乐', 'A resolved play request alone does not stand in for the playing event')
player.hasPlayed.value = true
assert.equal(player.dockTitle.value, musicTracks[2].title)
assert.equal(src, '/inkroam/audio/lofi-vol01/03_a_lemma_after_midnight.v2.mp3')
assert.equal(loads, 1); assert.equal(plays, 1)
media.duration = 148.455; player.metadata()
assert.equal(media.currentTime, 45, 'First metadata applies pending seek')
assert.equal(player.pendingSeek.value, null)
player.selectTrack(2)
assert.equal(loads, 1); assert.equal(media.currentTime, 45, 'Clicking current track never resets progress')
player.pause()
await player.play()
assert.equal(loads, 1, 'Resume reuses current resource')
player.loaded.value = true; media.duration = 148.455; player.metadata()
player.seek({ target: { value: '30' } }); assert.equal(media.currentTime, 30)
player.playing.value = true; player.selectTrack(musicTracks.length)
await Promise.resolve()
assert.equal(player.index.value, 0)
assert.equal(src, '/inkroam/audio/lofi-vol01/01_rain_on_the_margin.v2.mp3')
player.pause(); player.playing.value = false; player.selectTrack(1, false)
assert.equal(src, null)
player.seek({ target: { value: '35' } }); player.selectTrack(0, false)
assert.equal(player.pendingSeek.value, null, 'Selecting another track clears pending position')
rejectPlay = true; await player.play()
assert(player.message.value); assert.equal(player.loading.value, false)
player.changeVolume({ target: { value: '0' } }); assert.equal(media.volume, 0)
assert(!('playing' in stored) && !('autoplay' in stored))
cleanup.forEach(fn => fn()); assert.equal(src, null); assert.equal(events.size, 0); assert(pauses > 0)
assert.equal(musicPreferences('{broken').volume, .35)
assert.equal(musicPreferences('{"volume":9}').volume, 1)
assert.equal(musicPreferences('{"volume":-1}').volume, 0)
assert.equal(musicTime(129.316), '2:09'); assert.equal(musicTime(NaN), '0:00')
assert.throws(() => loadMusicForPlay(media, '../bad', '/'))
for (const track of musicTracks) {
  const file = `public/audio/${track.file}`
  assert(statSync(file).size < 4_000_000)
  assert(readFileSync(file).subarray(0, 3).toString() === 'ID3')
}
assert.match(descriptor.template.content, /<audio\s+ref="audio"\s+preload="none"/)
assert(!/<audio[^>]*\s(?::?src|autoplay|:autoplay)=|<source\b/.test(descriptor.template.content))
assert.match(descriptor.template.content, /id="music-progress"[^>]*:disabled="!tracks\.length"/, 'Progress stays available before loading: only an empty library disables it')
// Three animation fixes from the 2026-10-25 checkpoint.
assert.match(descriptor.template.content, /ref="progressVisual" class="music-progress"/, 'The progress rail owns the subpixel painting')
assert.match(descriptor.template.content, /'--music-progress': progressRatio/, 'The initial render is driven by a 0..1 fraction')
assert.match(descriptor.scriptSetup.content, /setProperty\('--music-progress', String\(progressFraction\(bounded\)\)\)/, 'The painter writes the fraction, never a pixel value')
const styleText = descriptor.styles.map(style => style.content).join('\n')
assert.match(styleText, /\.music-progress__fill \{[^}]*transform: scaleX\(var\(--music-progress/, 'Fill advances with a transform instead of a stepped value')
assert.match(styleText, /\.music-progress__ball-layer \{[^}]*translate3d\(calc\(var\(--music-progress, 0\) \* 100%\), 0, 0\)/, 'The ball rides the full track width so it can sit between pixels')
assert.match(styleText, /\.music-progress__input \{[^}]*opacity: 0/, 'The native range stays transparent while keeping pointer, keyboard and aria')
assert.match(styleText, /\.music-controls \{[^}]*display: flow-root/, 'Controls establish a formatting root so the 22px transport margin cannot collapse away')
assert.match(descriptor.template.content, /'is-resizing': resizing/, 'The scroller freezes while the panel height tweens')
assert.match(descriptor.scriptSetup.content, /watch\(\[\(\) => current\.value\.id, managing, \(\) => tracks\.value\.length, message\], \(\) => resizePanel\(\), \{ flush: 'post' \}\)/, 'Content changes resize before paint, so no frame shows a scrollbar')
assert.match(styleText, /\.music-scroll \{[^}]*scrollbar-gutter: stable/, 'The gutter is reserved so a scrollbar can never reflow the text')
assert.match(styleText, /\.music-panel\.is-resizing \.music-scroll \{[^}]*overflow-y: hidden/, 'Transient overflow is clipped during the height tween')
assert.match(descriptor.scriptSetup.content, /probe\.preload = 'metadata'/, 'Local lengths are probed with metadata only')
assert.match(descriptor.scriptSetup.content, /localMusicFile\(track\.id\)/, 'The probe reads the stored blob, never a remote URL')
assert.ok(!/probe\.play\(/.test(descriptor.scriptSetup.content), 'The metadata probe never starts playback')
assert.match(descriptor.scriptSetup.content, /await setExpanded\(false\)/, 'Closing from fullscreen collapses with the morph instead of snapping')
assert.ok(!/setExpanded\(false, false\)/.test(descriptor.scriptSetup.content), 'No caller may skip the collapse animation')
assert.ok(!/\.music-panel[^{]*\{[^}]*transition:[^;]*\bheight\b/.test(styleText), 'Height is owned by the WAAPI resize, never by CSS as well')
assert.match(descriptor.template.content, /:draggable="managing"/, 'Rows are draggable only while managing')
assert.match(descriptor.template.content, /@drop\.prevent="dropAt\(position\)"/, 'Dropping routes through dropAt')
assert.match(descriptor.scriptSetup.content, /moveTrack\(from, position - from\)/, 'Drag drop reuses the persisted reorder path')
assert.match(descriptor.scriptSetup.content, /prepareMusicCover\(new File\(\[tags\.cover\]/, 'Embedded artwork is resized before storage')
assert.match(descriptor.scriptSetup.content, /saveMusicCover\(track\.id, prepared\)/, 'Embedded artwork goes through the stored cover pipeline')
assert.match(descriptor.scriptSetup.content, /updateLocalMusic\(track\.id, patch\)/, 'Parsed tags are persisted, not only kept in memory')
assert.match(descriptor.scriptSetup.content, /await hydrateLocalTags\(\)|void hydrateLocalTags\(\)/, 'Stored tags are re-applied on the next session')
assert.match(descriptor.template.content, /class="music-grip"[\s\S]{0,140}gripDown\(position, \$event\)/, 'A grip starts pointer dragging so touch can reorder too')
assert.match(descriptor.scriptSetup.content, /moveTrack\(from, to - from\)/, 'Pointer drag reuses the persisted reorder path')
assert.match(readFileSync('app/utils/local-music.ts', 'utf8'), /export async function updateLocalMusic/, 'The library exposes a tag write API')
{
  // Latin-1 mojibake of UTF-8 bytes, and GBK bytes declared as ISO-8859-1.
  const { repairTagText } = await import('../app/utils/music-tags.ts')
  assert.equal(repairTagText('\u00e6\u00b5\u008b\u00e8\u00af\u0095'), '\u6d4b\u8bd5', 'UTF-8 read as Latin-1 is repaired')
  assert.equal(repairTagText('\u00d3\u00ea\u00b4\u00b0\u00d1\u00dd\u00cb\u00e3'), '\u96e8\u7a97\u6f14\u7b97', 'GBK read as Latin-1 is repaired')
  assert.equal(repairTagText('\u6d4b\u8bd5'), '\u6d4b\u8bd5', 'Correct Unicode is untouched')
  assert.equal(repairTagText('Rain on the Margin'), 'Rain on the Margin', 'ASCII is untouched')
  assert.equal(repairTagText(''), undefined, 'Empty tags stay empty')
}
// A closed but pre-mounted glass panel must not leak its clipped backdrop
// onto the mobile page underneath the music pill.
assert.match(descriptor.scriptSetup.content, /const glassDormant = ref\(true\)/, 'Closed panel starts without compositing a glass backdrop')
assert.match(descriptor.scriptSetup.content, /if \(value\) \{ glassDormant\.value = false; return \}/, 'Reopening re-enables the existing lens immediately')
assert.match(descriptor.scriptSetup.content, /event\.propertyName !== 'visibility'/, 'Glass sleeps only after close visibility transition')
assert.match(descriptor.template.content, /'is-glass-dormant': glassDormant/, 'Dormancy is scoped to the panel surface, not the music trigger')
const experimentalGlassStyle = readFileSync('app/components/ExperimentalGlass.client.vue', 'utf8')
assert.match(experimentalGlassStyle, /\.music-panel\.is-glass-dormant\s*\{[^}]*backdrop-filter: none !important;[^}]*-webkit-backdrop-filter: none !important;/s, 'Dormant glass suppresses both backdrop filters')
assert.match(descriptor.template.content, /:inert="!open"/)
assert.match(descriptor.template.content, /v-if="hasPlayed" class="music-quick-play"/)
for (const style of descriptor.styles) {
  const compiled = compileStyle({ source: style.content, filename: 'MusicPlayer.vue', id: 'data-v-music-test', scoped: style.scoped })
  assert.deepEqual(compiled.errors, [])
  postcss.parse(compiled.code).walkRules(rule => {
    if (rule.selector.includes(':root')) assert(rule.selector.includes('.music-dock .dropdown-surface'), `Global root leak: ${rule.selector}`)
  })
}
assert.match(readFileSync('app/app.vue', 'utf8'), /<MusicPlayer\s*\/>/)
console.log('PASS: no src/load/play on mount/open/paused selection; explicit play only, base path, resume, switching, rejection, volume, preference bounds, teardown and real assets. No browser playback or listening validation.')
