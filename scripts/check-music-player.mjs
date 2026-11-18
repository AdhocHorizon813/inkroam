import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { readFileSync, statSync } from 'node:fs'
import { Window } from 'happy-dom'
import { compileScript, parse, compileStyle } from '@vue/compiler-sfc'
import postcss from 'postcss'
import * as music from '../app/utils/music.ts'

const window = new Window({ url: 'http://localhost/inkroam/' })
const { document, localStorage } = window
// Vue's DOM renderer captures document at module initialization.
Object.assign(globalThis, { window, document, Element: window.Element, SVGElement: window.SVGElement })
const vue = await import('vue')
const passThrough = { inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() }
const localTracks = new Map(), storedFiles = new Map(), covers = new Map()
const preparedCover = new window.Blob(['thumbnail'], { type: 'image/webp' })
const library = {
  listLocalMusic: async () => [...localTracks.values()],
  localMusicFile: async id => storedFiles.get(id),
  localMusicCover: async id => covers.get(id),
  async addLocalMusic(file) {
    const track = { id: 'local-fixture', title: file.name }
    localTracks.set(track.id, track)
    storedFiles.set(track.id, file)
    return track
  },
  async updateLocalMusic(id, patch) { Object.assign(localTracks.get(id), patch) },
  prepareMusicCover: async file => { assert(file.size > 0); return preparedCover },
  async saveMusicCover(id, cover) { covers.set(id, cover) },
}
const objectUrls = new Map()
let nextUrl = 0
const blobUrls = {
  createObjectURL(blob) {
    const url = 'blob:fixture/' + ++nextUrl
    objectUrls.set(url, blob)
    return url
  },
  revokeObjectURL(url) { objectUrls.delete(url) },
}
const probes = []
class MetadataAudio extends window.EventTarget {
  duration = 93
  set src(url) {
    probes.push({ preload: this.preload, file: objectUrls.get(url) })
    queueMicrotask(() => this.dispatchEvent(new window.Event('loadedmetadata')))
  }
}
const tags = { title: 'Imported title', artist: 'Local artist', album: 'Fixture album', cover: new window.Blob(['image']) }
const modules = new Map([
  ['vue', { ...vue, Transition: passThrough }],
  ['~/utils/music', music],
  ['~/utils/music-tags', { readMusicTags: async () => tags }],
  ['~/utils/glass-surfaces', { vExperimentalGlass: {}, vGlassPresence: {} }],
  ['~/components/MusicArtwork.vue', { render: () => null }],
  ['~/utils/local-music', library],
])
const source = readFileSync('app/components/MusicPlayer.vue', 'utf8')
const { descriptor, errors } = parse(source, { filename: 'MusicPlayer.vue' })
assert.deepEqual(errors, [])
const component = compileScript(descriptor, { id: 'music', inlineTemplate: true })
const compiled = ts.transpileModule(component.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const exports = {}
vm.runInNewContext(compiled, {
  exports, require(id) {
    assert(modules.has(id), 'Unconfigured player dependency: ' + id)
    return modules.get(id)
  },
  ref: vue.ref, computed: vue.computed, watch: vue.watch, nextTick: vue.nextTick,
  onMounted: vue.onMounted, onBeforeUnmount: vue.onBeforeUnmount,
  useRuntimeConfig: () => ({ app: { baseURL: '/inkroam/' } }),
  window, document, localStorage, ResizeObserver: window.ResizeObserver,
  getComputedStyle: window.getComputedStyle.bind(window), URL: blobUrls, Audio: MetadataAudio, File: window.File,
  HTMLElement: window.HTMLElement, Node: window.Node,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
}, { filename: 'MusicPlayer.vue' })

let loads = 0, plays = 0, pauses = 0, paused = true, rejectPlay = false
Object.defineProperties(window.HTMLMediaElement.prototype, {
  load: { value() { loads++ } },
  play: { async value() { plays++; if (rejectPlay) throw new Error('Playback blocked') } },
  pause: { value() { pauses++; paused = true } },
  paused: { get: () => paused },
  duration: { get: () => 148.455 },
})
const listenerTypes = new Set(['pointerdown', 'keydown', 'visibilitychange', 'pointerup', 'pointercancel'])
const listeners = new Map([...listenerTypes].map(type => [type, new Set()]))
for (const method of ['addEventListener', 'removeEventListener']) {
  const original = document[method].bind(document)
  document[method] = (type, listener, ...options) => {
    if (listenerTypes.has(type)) {
      if (method === 'addEventListener') listeners.get(type).add(listener)
      else listeners.get(type).delete(listener)
    }
    return original(type, listener, ...options)
  }
}
const { musicTracks, musicPreferences, musicTime, loadMusicForPlay, MUSIC_STORAGE_KEY } = music
localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ track: musicTracks[1].id, volume: .2, playing: true, autoplay: true }))
const host = document.body.appendChild(document.createElement('main'))
const app = vue.createApp(exports.default)
app.component('GlassRange', passThrough)
const find = selector => {
  const element = host.querySelector(selector)
  assert(element, 'Missing player control: ' + selector)
  return element
}
const label = selector => find(selector).getAttribute('aria-label')
async function click(element) { element.click(); await vue.nextTick() }
async function settle() {
  await new Promise(resolve => setImmediate(resolve))
  await vue.nextTick()
}
async function input(selector, value) {
  const el = find(selector)
  el.value = String(value)
  el.dispatchEvent(new window.Event('input', { bubbles: true }))
  await vue.nextTick()
}
const rows = () => host.querySelectorAll('.music-track')
async function checkPlayback() {
  app.mount(host)
  const audio = find('audio')
  try {
    await vue.nextTick()
    assert.equal(rows()[1].getAttribute('aria-current'), 'true')
    assert.equal(find('#music-panel').hasAttribute('inert'), true)
    assert.equal(audio.preload, 'none')
    assert.equal(audio.autoplay, false)
    assert.equal(audio.querySelector('source'), null)
    assert.equal(find('#music-progress').disabled, false)
    assert.equal(find('.music-progress').style.getPropertyValue('--music-progress'), '0')
    assert.equal(audio.volume, .2)
    assert.equal(audio.getAttribute('src'), null)
    await click(find('.music-trigger'))
    assert.equal(find('#music-panel').hasAttribute('inert'), false)
    assert.equal(find('.music-trigger').textContent.trim(), '音乐')
    assert.equal(host.querySelector('.music-quick-play'), null)
    await click(rows()[2])
    await input('#music-progress', 45)
    assert.equal(find('#music-progress').value, '45')
    assert.equal(audio.getAttribute('src'), null)
    assert.equal(loads, 0)
    assert.equal(plays, 0)
    const idleIcon = find('.music-play svg path').getAttribute('d')
    await click(find('.music-play'))
    assert.equal(find('.music-play svg path').getAttribute('d'), idleIcon, 'Loading the first track keeps the play icon')
    assert.equal(loads, 1)
    assert.equal(plays, 1)
    assert.equal(audio.getAttribute('src'), '/inkroam/audio/lofi-vol01/03_a_lemma_after_midnight.v2.mp3')
    assert.equal(label('.music-play'), '取消加载')
    assert.equal(host.querySelector('.music-quick-play'), null)
    assert.equal(find('.music-trigger').textContent.trim(), '音乐')
    paused = false
    audio.dispatchEvent(new window.Event('playing'))
    audio.dispatchEvent(new window.Event('loadedmetadata'))
    await vue.nextTick()
    assert.equal(audio.currentTime, 45)
    assert.equal(find('.music-trigger').textContent.trim(), musicTracks[2].title)
    assert.notEqual(find('.music-play svg path').getAttribute('d'), idleIcon)
    assert.equal(label('.music-play'), '暂停')
    assert.equal(label('.music-quick-play'), '暂停音乐')
    await click(rows()[2])
    assert.equal(audio.currentTime, 45)
    await click(find('.music-quick-play'))
    assert.equal(label('.music-play'), '播放')
    await click(find('.music-play'))
    assert.equal(loads, 1, 'Resuming reuses the current source')
    paused = false
    audio.dispatchEvent(new window.Event('playing'))
    await input('#music-progress', 30)
    assert.equal(audio.currentTime, 30)
    assert(Math.abs(Number(find('.music-progress').style.getPropertyValue('--music-progress')) - 30 / audio.duration) < .00001)
    await click(rows()[rows().length - 1])
    await click(find('[aria-label="下一首"]'))
    assert.equal(rows()[0].getAttribute('aria-current'), 'true')
    assert.equal(audio.getAttribute('src'), '/inkroam/audio/lofi-vol01/01_rain_on_the_margin.v2.mp3')
    await click(find('.music-play')) // Cancel the pending switch.
    await click(rows()[1])
    assert.equal(audio.getAttribute('src'), null)
    await input('#music-progress', 35)
    await click(rows()[0])
    assert.equal(find('#music-progress').value, '0', 'Switching clears the pending seek')
    const panel = find('#music-panel')
    const body = find('.music-body')
    body.getBoundingClientRect = () => new window.DOMRect(0, 0, 320, find('#music-panel').querySelector('[role="status"]') ? 120 : 80)
    const heightChanges = []
    let finishHeight
    panel.animate = frames => {
      heightChanges.push(frames.map(frame => frame.height))
      return { finished: new Promise(resolve => { finishHeight = resolve }), cancel() {} }
    }
    rejectPlay = true
    await click(find('.music-play'))
    // The media promise settles across the VM boundary before Vue renders the error.
    await settle()
    assert(find('[role="status"]').textContent.trim())
    assert.equal(heightChanges.at(-1).at(-1), '120px', 'Status text resizes the panel without waiting for a ResizeObserver')
    assert(panel.classList.contains('is-resizing'))
    finishHeight()
    await settle()
    assert(!panel.classList.contains('is-resizing'))
    body.getBoundingClientRect = () => new window.DOMRect()

    assert.equal(label('.music-play'), '播放')
    await input('#music-volume', 0)
    assert.equal(audio.volume, 0)
    const saved = JSON.parse(localStorage.getItem(MUSIC_STORAGE_KEY))
    assert(!('playing' in saved) && !('autoplay' in saved))
    // Import metadata, cover and duration without playing the stored file.
    const playsBeforeImport = plays
    const imported = new window.File(['fixture'], 'track.mp3', { type: 'audio/mpeg' })
    const fileInput = find('[aria-label="导入本地音乐"]')
    Object.defineProperty(fileInput, 'files', { value: [imported] })
    fileInput.dispatchEvent(new window.Event('change'))
    await settle()
    const localRow = [...rows()].at(-1)
    assert(localRow.textContent.includes(tags.title))
    assert(localRow.textContent.includes('1:33'))
    assert.equal(localTracks.get('local-fixture').artist, tags.artist)
    assert.equal(covers.get('local-fixture'), preparedCover)
    assert.equal(probes.length, 1)
    assert.equal(probes[0].file, imported)
    assert.equal(probes[0].preload, 'metadata')
    assert.equal(plays, playsBeforeImport)
    assert.equal(objectUrls.size, 0, 'Metadata probe releases its temporary blob URL')

    // Both drag interactions reorder the same persisted list and keep selection.
    const list = find('#music-track-list')
    const titleAt = index => list.children[index].querySelector('.music-track-title').textContent
    const firstTitle = titleAt(0)
    assert.equal(list.firstElementChild.getAttribute('draggable'), 'false')
    await click(find('[aria-controls="music-track-list"]'))
    assert.equal(list.firstElementChild.getAttribute('draggable'), 'true')
    list.children[0].dispatchEvent(new window.Event('dragstart', { bubbles: true }))
    list.children[1].dispatchEvent(new window.Event('drop', { bubbles: true }))
    await vue.nextTick()
    assert.equal(titleAt(1), firstTitle)
    assert.equal(JSON.parse(localStorage.getItem('inkroam-music-order-v1'))[1], musicTracks[0].id)
    const grip = list.children[1].querySelector('.music-grip')
    grip.setPointerCapture = () => {}
    list.children[0].getBoundingClientRect = () => ({ top: 0, bottom: 20 })
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      grip.dispatchEvent(new window.PointerEvent(type, { bubbles: true, button: 0, clientY: 10, pointerId: 1 }))
    }
    await vue.nextTick()
    assert.equal(titleAt(0), firstTitle)
    assert.equal(JSON.parse(localStorage.getItem('inkroam-music-order-v1'))[0], musicTracks[0].id)

    // A completed opening morph and a still-running closing morph are distinct states.
    const size = () => panel.classList.contains('is-expanded') ? 900 : 320
    panel.getBoundingClientRect = () => new window.DOMRect(0, 0, size(), 400)
    let finishMotion
    const bounds = []
    panel.animate = frames => {
      bounds.push(frames.map(frame => frame.width))
      return { finished: new Promise(resolve => { finishMotion = resolve }), cancel() {} }
    }
    find('.music-scroll').animate = () => ({ finished: Promise.resolve(), cancel() {} })
    await click(find('[aria-label="全屏音乐"]'))
    await settle()
    assert.deepEqual(Array.from(bounds[0]), ['320px', '900px'])
    finishMotion()
    await settle()
    await click(find('[aria-label="关闭音乐面板"]'))
    await settle()
    assert.deepEqual(Array.from(bounds[1]), ['900px', '320px'])
    assert.equal(panel.getAttribute('aria-hidden'), 'false')
    finishMotion()
    await settle()
    assert.equal(panel.getAttribute('aria-hidden'), 'true')
  } finally {
    app.unmount()
  }
  assert.equal(audio.getAttribute('src'), null)
  for (const [type, callbacks] of listeners) assert.equal(callbacks.size, 0, 'Remove listener: ' + type)
  assert(pauses > 0)
  assert.throws(() => loadMusicForPlay(audio, '../bad', '/'))
}

async function checkReload() {
  // A new instance restores imported tags from storage before the local track plays.
  const reloaded = vue.createApp(exports.default)
  reloaded.component('GlassRange', passThrough)
  try {
    reloaded.mount(host)
    await settle()
    await click(find('.music-trigger'))
    await settle()
    await click([...rows()].find(row => row.textContent.includes(tags.title)))
    assert(find('.music-subtitle').textContent.includes(tags.artist + ' · ' + tags.album))
    assert.equal(find('audio').getAttribute('src'), null)
  } finally {
    reloaded.unmount()
  }
}

try {
  await checkPlayback()
  await checkReload()
} finally {
  await window.happyDOM.close()
}
assert.equal(musicPreferences('{broken').volume, .35)
assert.equal(musicPreferences('{"volume":9}').volume, 1)
assert.equal(musicPreferences('{"volume":-1}').volume, 0)
assert.equal(musicTime(129.316), '2:09'); assert.equal(musicTime(NaN), '0:00')
for (const track of musicTracks) {
  const file = `public/audio/${track.file}`
  assert(statSync(file).size < 4_000_000)
  assert(readFileSync(file).subarray(0, 3).toString() === 'ID3')
}
const styleText = descriptor.styles.map(style => style.content).join('\n')
assert.match(styleText, /\.music-progress__fill \{[^}]*transform: scaleX\(var\(--music-progress/, 'Fill advances with a transform instead of a stepped value')
assert.match(styleText, /\.music-progress__ball-layer \{[^}]*translate3d\(calc\(var\(--music-progress, 0\) \* 100%\), 0, 0\)/, 'The ball rides the full track width so it can sit between pixels')
assert.match(styleText, /\.music-progress__input \{[^}]*opacity: 0/, 'The native range stays transparent while keeping pointer, keyboard and aria')
assert.match(styleText, /\.music-controls \{[^}]*display: flow-root/, 'Controls establish a formatting root so the 22px transport margin cannot collapse away')
assert.match(styleText, /\.music-scroll \{[^}]*scrollbar-gutter: stable/, 'The gutter is reserved so a scrollbar can never reflow the text')
assert.match(styleText, /\.music-panel\.is-resizing \.music-scroll \{[^}]*overflow-y: hidden/, 'Transient overflow is clipped during the height tween')
assert.ok(!/\.music-panel[^{]*\{[^}]*transition:[^;]*\bheight\b/.test(styleText), 'Height is owned by the WAAPI resize, never by CSS as well')
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
assert.match(descriptor.template.content, /v-glass-presence="open"/, 'Animated owner controls optical lifetime')
assert.doesNotMatch(descriptor.scriptSetup.content, /closeGlassTimer/, 'No competing fixed-duration sleep timer')
const experimentalGlassStyle = readFileSync('app/components/ExperimentalGlass.client.vue', 'utf8')
assert.match(experimentalGlassStyle, /\[data-liquid-glass-dormant\]\s*\{[^}]*backdrop-filter: none !important;[^}]*-webkit-backdrop-filter: none !important;/s)
for (const style of descriptor.styles) {
  const compiled = compileStyle({ source: style.content, filename: 'MusicPlayer.vue', id: 'data-v-music-test', scoped: style.scoped })
  assert.deepEqual(compiled.errors, [])
  postcss.parse(compiled.code).walkRules(rule => {
    if (rule.selector.includes(':root')) assert(rule.selector.includes('.music-dock .dropdown-surface'), `Global root leak: ${rule.selector}`)
  })
}
assert.match(readFileSync('app/app.vue', 'utf8'), /<MusicPlayer\s*\/>/)
console.log('PASS: no src/load/play on mount/open/paused selection; explicit play only, base path, resume, switching, rejection, volume, preference bounds, teardown and real assets. No browser playback or listening validation.')
