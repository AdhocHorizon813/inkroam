<script setup lang="ts">
import { musicTracks, musicTime, musicPreferences, loadMusicForPlay, MUSIC_STORAGE_KEY } from '~/utils/music'
import { listLocalMusic, localMusicFile, addLocalMusic, deleteLocalMusic } from '~/utils/local-music'
type Track = { id: string; title: string; english: string; mood: string; duration: number; local?: boolean }
const tracks = ref<Track[]>(musicTracks.map(track => ({ ...track })))
const managing = ref(false), importing = ref(false), libraryReady = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const orderKey = 'inkroam-music-order-v1'
let objectUrl: string | null = null
const config = useRuntimeConfig()
const audio = ref<HTMLAudioElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false), playing = ref(false), loading = ref(false)
const hasOpened = ref(false), pendingSeek = ref<number | null>(null)
const hasPlayed = ref(false)
const labelMeasure = ref<HTMLElement | null>(null), labelWidth = ref(26)
let labelObserver: ResizeObserver | undefined
const index = ref(0), volume = ref(.35), repeat = ref(false)
const elapsed = ref(0), actualDuration = ref(0), loaded = ref(false)
const message = ref('')
const current = computed<Track>(() => tracks.value[index.value] || { id: '', title: '选择一首音乐', english: '', mood: '', duration: 0 })
const dockTitle = computed(() => hasPlayed.value && current.value.id ? current.value.title : '音乐')
const knownDuration = computed(() => actualDuration.value || current.value.duration)
const duration = computed(() => knownDuration.value || 100)
const progress = computed(() => `${Math.min(100, Math.max(0, elapsed.value / duration.value * 100))}%`)
let request = 0, disposed = false

function save() {
  try { localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ track: current.value.id, volume: volume.value, repeat: repeat.value })) } catch { /* Playback remains usable. */ }
}
onMounted(() => {
  try {
    const saved = musicPreferences(localStorage.getItem(MUSIC_STORAGE_KEY))
    index.value = saved.index; volume.value = saved.volume; repeat.value = saved.repeat
  } catch { /* Storage can be blocked. */ }
  if (audio.value) audio.value.volume = volume.value
  if (labelMeasure.value) {
    const measure = () => { if (labelMeasure.value) labelWidth.value = Math.ceil(labelMeasure.value.getBoundingClientRect().width) }
    measure()
    labelObserver = new ResizeObserver(measure)
    labelObserver.observe(labelMeasure.value)
  }
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', keydown)
  void restoreLibrary()
})
onBeforeUnmount(() => {
  disposed = true; request++
  audio.value?.pause()
  audio.value?.removeAttribute('src')
  labelObserver?.disconnect()
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', keydown)
})
const dock = ref<HTMLElement | null>(null)
async function restoreLibrary() {
  try {
    const local = await listLocalMusic()
    if (disposed) return
    const all: Track[] = [...musicTracks.map(track => ({ ...track })), ...local.map(track => ({ id: track.id, title: track.title, english: '', mood: '本地音乐', duration: 0, local: true }))]
    let order: unknown, selected: unknown
    try { order = JSON.parse(localStorage.getItem(orderKey) || 'null'); selected = JSON.parse(localStorage.getItem(MUSIC_STORAGE_KEY) || '{}')?.track } catch { /* Use library order. */ }
    const ids = Array.isArray(order) ? [...new Set(order.filter((id): id is string => typeof id === 'string'))] : all.map(track => track.id)
    // A local file saved before a failed preference write must remain discoverable.
    for (const track of all) if (track.local && !ids.includes(track.id)) ids.push(track.id)
    const active = audio.value?.hasAttribute('src') ? current.value.id : selected
    tracks.value = ids.map(id => all.find(track => track.id === id)).filter((track): track is Track => !!track)
    index.value = Math.max(0, tracks.value.findIndex(track => track.id === active))
  } catch { message.value = '本地音乐库不可用，内置音乐仍可播放。' }
  finally { libraryReady.value = true }
}
function saveOrder() {
  try { localStorage.setItem(orderKey, JSON.stringify(tracks.value.map(track => track.id))) } catch { message.value = '列表顺序未能保存，当前页面仍可使用。' }
}
async function importFiles(event: Event) {
  const field = event.target as HTMLInputElement
  const files = Array.from(field.files || [])
  field.value = ''
  if (importing.value || !libraryReady.value) return
  importing.value = true; message.value = ''
  let rejected = 0
  try {
    for (const file of files) {
      if (disposed) break
      if (!file.size || !/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i.test(file.name)) { rejected++; continue }
      const track = await addLocalMusic(file)
      if (disposed) break
      tracks.value.push({ id: track.id, title: track.title, english: '', mood: '本地音乐', duration: 0, local: true })
      saveOrder()
    }
    if (rejected) message.value = `${rejected} 个空文件或不支持的文件未导入。`
  } catch { message.value = '部分音乐未能保存，请检查浏览器存储空间或权限。' }
  finally { importing.value = false }
}
function moveTrack(position: number, direction: number) {
  const target = position + direction
  if (target < 0 || target >= tracks.value.length) return
  const active = current.value.id
  const item = tracks.value.splice(position, 1)[0]!
  tracks.value.splice(target, 0, item)
  index.value = tracks.value.findIndex(track => track.id === active)
  saveOrder()
}
async function removeTrack(id: string) {
  if (importing.value) return
  const track = tracks.value.find(track => track.id === id)
  if (!track) return
  importing.value = true
  try {
    if (track.local) await deleteLocalMusic(id)
    if (disposed) return
    const active = current.value.id
    if (id === active) { pause(); clearResource(); elapsed.value = 0; pendingSeek.value = null; actualDuration.value = 0; loaded.value = false }
    tracks.value = tracks.value.filter(track => track.id !== id)
    index.value = id === active ? Math.min(index.value, Math.max(0, tracks.value.length - 1)) : Math.max(0, tracks.value.findIndex(track => track.id === active))
    saveOrder(); save()
  } catch { message.value = '无法移除这首音乐，请重试。' }
  finally { importing.value = false }
}
function restoreBuiltins() {
  for (const track of musicTracks) if (!tracks.value.some(item => item.id === track.id)) tracks.value.push({ ...track })
  saveOrder()
}
function clearResource() {
  if (audio.value?.hasAttribute('src')) { audio.value.removeAttribute('src'); audio.value.load() }
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null }
}
function close(restore = false) { open.value = false; if (restore) trigger.value?.focus({ preventScroll: true }) }
function outside(event: PointerEvent) { if (open.value && event.target instanceof Node && !dock.value?.contains(event.target)) close() }
function keydown(event: KeyboardEvent) { if (open.value && event.key === 'Escape') { event.preventDefault(); close(true) } }

async function play() {
  const element = audio.value
  if (!element || !current.value.id) return
  const token = ++request
  loading.value = true; message.value = ''
  try {
    // This is the only path assigning src. Merely mounting or opening does not.
    if (current.value.local) {
      if (!element.hasAttribute('src')) {
        const file = await localMusicFile(current.value.id)
        if (disposed || token !== request) return
        if (!file) throw new Error('本地音乐已不存在')
        objectUrl = URL.createObjectURL(file)
        element.src = objectUrl; element.load()
      }
    } else loadMusicForPlay(element, current.value.id, config.app.baseURL)
    element.volume = volume.value
    await element.play()
  } catch {
    if (token === request && !disposed) { message.value = '暂时无法播放，请重试。'; loading.value = false }
  }
}
function pause() { request++; audio.value?.pause(); playing.value = false; loading.value = false }
function togglePlay() { if (playing.value || loading.value) pause(); else void play() }
function selectTrack(next: number, continuePlaying = playing.value || loading.value) {
  if (!tracks.value.length) return
  if (next === index.value) return // Selecting the current row must not restart it.
  request++; audio.value?.pause(); playing.value = false
  index.value = (next + tracks.value.length) % tracks.value.length
  elapsed.value = 0; pendingSeek.value = null; actualDuration.value = 0; loaded.value = false; loading.value = false; message.value = ''
  // Remove the old resource; choosing a track while paused does not fetch it.
  clearResource()
  save()
  if (continuePlaying) void play()
}
function ended() {
  playing.value = false
  if (repeat.value || tracks.value.length === 1) { if (audio.value) audio.value.currentTime = 0; void play() }
  else selectTrack(index.value + 1, true)
}
function syncTime() {
  if (!audio.value) return
  if (pendingSeek.value === null) elapsed.value = audio.value.currentTime
  if (Number.isFinite(audio.value.duration)) actualDuration.value = audio.value.duration
}
function metadata() {
  loaded.value = true
  if (audio.value && pendingSeek.value !== null && Number.isFinite(audio.value.duration)) {
    const target = current.value.duration ? pendingSeek.value : pendingSeek.value / 100 * audio.value.duration
    audio.value.currentTime = Math.min(target, audio.value.duration)
    pendingSeek.value = null
  }
  syncTime()
}
function seek(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  elapsed.value = Math.min(duration.value, Math.max(0, value))
  if (loaded.value && audio.value) { audio.value.currentTime = elapsed.value; pendingSeek.value = null }
  else pendingSeek.value = elapsed.value // Store intent, never load metadata just to seek.
}
function changeVolume(event: Event) {
  volume.value = Number((event.target as HTMLInputElement).value)
  if (audio.value) audio.value.volume = volume.value
  save()
}
function failed() { loading.value = false; playing.value = false; message.value = '音频未能加载，请重试。' }
function onPlaying() {
  if (!audio.value || audio.value.paused) return
  playing.value = true; loading.value = false; hasPlayed.value = true
}
</script>

<template>
  <div ref="dock" class="music-dock">
    <!-- No src/source/autoplay: initial HTML and hydration cannot request music. -->
    <audio ref="audio" preload="none" @playing="onPlaying" @pause="playing = false" @waiting="loading = !audio?.paused" @loadedmetadata="metadata" @timeupdate="syncTime" @ended="ended" @error="failed" />
    <!-- Like AppearancePanel: a persistent surface clips from its trigger.
         Animate the material itself, not a height-collapsing backdrop ancestor. -->
    <section id="music-panel" class="music-panel music-surface" :class="{ 'is-open': open }" :aria-hidden="!open" :inert="!open" aria-label="音乐播放器">
      <div class="music-scroll">
            <header><span class="music-kicker">{{ current.local ? 'MY MUSIC' : 'PAPER HOURS · VOL. 1' }}</span><button type="button" aria-label="关闭音乐面板" @click="close(true)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
            <h2 class="music-title">{{ current.title }}</h2>
            <p class="music-subtitle"><template v-if="current.english">{{ current.english }}<br></template>{{ current.mood }}</p>
            <p v-if="message" class="music-status" role="status">{{ message }}</p>
            <div class="music-transport">
              <button type="button" aria-label="上一首" :disabled="!tracks.length" @click="selectTrack(index - 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14m14-14L8 12l11 7Z" /></svg></button>
              <button class="music-play" type="button" :disabled="!tracks.length" :aria-label="loading ? '取消加载' : playing ? '暂停' : '播放'" :aria-busy="loading" @click="togglePlay"><Transition name="music-icon" mode="out-in"><svg :key="playing ? 'pause' : 'play'" viewBox="0 0 24 24" aria-hidden="true"><path v-if="playing" d="M8 5v14M16 5v14" /><path v-else d="m8 4 12 8-12 8Z" /></svg></Transition></button>
              <button type="button" aria-label="下一首" :disabled="!tracks.length" @click="selectTrack(index + 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v14M5 5l11 7-11 7Z" /></svg></button>
              <button class="music-repeat" type="button" :aria-pressed="repeat" :title="repeat ? '单曲循环' : '列表循环'" :aria-label="repeat ? '单曲循环，点击切换列表循环' : '列表循环，点击切换单曲循环'" @click="repeat = !repeat; save()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 4 4-4 4M4 11V9a2 2 0 0 1 2-2h14M8 21l-4-4 4-4m12 0v2a2 2 0 0 1-2 2H4" /><path v-if="repeat" d="m11 11 1-1v5" /></svg></button>
            </div>
            <label class="visually-hidden" for="music-progress">播放进度</label>
            <input id="music-progress" class="music-range" :style="{ '--range-progress': progress }" type="range" min="0" :max="duration" step="0.1" :value="elapsed" :aria-valuetext="knownDuration ? `${musicTime(elapsed)}，共 ${musicTime(duration)}` : `预选 ${Math.round(elapsed)}%`" @input="seek">
            <div class="music-times"><span>{{ knownDuration ? musicTime(elapsed) : `${Math.round(elapsed)}%` }}</span><span>{{ knownDuration ? musicTime(duration) : '—:—' }}</span></div>
            <div class="music-library-actions">
              <button type="button" :disabled="importing || !libraryReady" @click="fileInput?.click()">{{ importing ? '正在处理…' : '导入音乐' }}</button>
              <button type="button" :aria-expanded="managing" @click="managing = !managing">{{ managing ? '完成' : '管理列表' }}</button>
            </div>
            <input ref="fileInput" class="music-file" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm" multiple aria-label="导入本地音乐" @change="importFiles">
            <ol class="music-tracks" aria-label="曲目列表">
              <li v-for="(track, position) in tracks" :key="track.id">
                <button class="music-track" type="button" :aria-current="position === index ? 'true' : undefined" @click="selectTrack(position)"><span class="music-number">{{ String(position + 1).padStart(2,'0') }}</span><span class="music-track-title">{{ track.title }}</span><span class="music-duration">{{ track.duration ? musicTime(track.duration) : '本地' }}</span></button>
                <div v-if="managing" class="music-track-actions">
                  <button type="button" :disabled="position === 0 || importing" :aria-label="`上移 ${track.title}`" @click="moveTrack(position, -1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6" /></svg></button>
                  <button type="button" :disabled="position === tracks.length - 1 || importing" :aria-label="`下移 ${track.title}`" @click="moveTrack(position, 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6" /></svg></button>
                  <button type="button" :disabled="importing" :aria-label="`从列表移除 ${track.title}`" @click="removeTrack(track.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg></button>
                </div>
              </li>
            </ol>
            <button v-if="managing" class="music-restore" type="button" :disabled="importing" @click="restoreBuiltins">恢复内置曲目</button>
            <label class="music-volume" for="music-volume"><span>音量</span><input id="music-volume" class="music-range" :style="{ '--range-progress': `${volume * 100}%` }" type="range" min="0" max="1" step="0.01" :value="volume" :aria-valuetext="`${Math.round(volume * 100)}%`" @input="changeVolume"><output for="music-volume">{{ Math.round(volume * 100) }}%</output></label>
      </div>
    </section>
    <span ref="labelMeasure" class="music-measure" aria-hidden="true">{{ dockTitle }}</span>
    <div class="music-pill music-surface" :style="{ width: `${labelWidth + 64 + (hasPlayed ? 40 : 0)}px`, '--music-label-width': `${labelWidth}px` }">
      <button ref="trigger" class="music-trigger" type="button" :aria-expanded="open" aria-controls="music-panel" @click="open = !open; hasOpened = true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" /></svg><span class="music-name"><Transition name="music-name"><span :key="dockTitle">{{ dockTitle }}</span></Transition></span></button>
      <Transition name="music-control"><button v-if="hasPlayed" class="music-quick-play" type="button" :disabled="!tracks.length" :aria-busy="loading" :aria-label="loading ? '取消加载音乐' : playing ? '暂停音乐' : '播放音乐'" @click="togglePlay"><Transition name="music-icon" mode="out-in"><svg :key="playing ? 'pause' : 'play'" viewBox="0 0 24 24" aria-hidden="true"><path v-if="playing" d="M8 6v12M16 6v12" /><path v-else d="m8 4 12 8-12 8Z" /></svg></Transition></button></Transition>
    </div>
  </div>
</template>

<style scoped>
.music-dock { position: fixed; z-index: 45; left: max(24px, env(safe-area-inset-left)); bottom: max(24px, env(safe-area-inset-bottom)); color: var(--ink); font: 13px/1.6 var(--sans); }
.music-pill { position: relative; z-index: 2; display: flex; max-width: calc(100vw - 130px); align-items: center; padding: 0 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); transition: width 360ms var(--ease-settle); }
.music-trigger { min-width: 0; flex: 1; }.music-trigger > svg { flex: none; }
.music-measure { position: absolute; width: max-content; visibility: hidden; pointer-events: none; white-space: nowrap; }
.music-name { display: inline-grid; min-width: 0; width: var(--music-label-width); overflow: hidden; transition: width 360ms var(--ease-settle); }
.music-name > span { grid-area: 1 / 1; overflow: hidden; text-overflow: clip; white-space: nowrap; }
.music-name-enter-active, .music-control-enter-active { transition: opacity 280ms var(--ease-fluid), transform 360ms var(--ease-settle); }
.music-name-leave-active, .music-control-leave-active { transition: opacity 120ms var(--ease-exit), transform 160ms var(--ease-exit); }
.music-name-enter-from { opacity: 0; transform: translateY(5px); }.music-name-leave-to { opacity: 0; transform: translateY(-5px); }
.music-control-enter-from, .music-control-leave-to { opacity: 0; transform: scale(.85); }
button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 40px; min-height: 40px; padding: 8px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; transition: color 200ms var(--ease-fluid), transform 160ms var(--ease-settle); }
button:active { transform: scale(.97); }button[aria-pressed='true'],button[aria-current] { color: var(--accent); }
button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.music-quick-play { border-left: 1px solid var(--line); min-width: 40px; flex: 0 0 40px; }
.music-panel { position: absolute; bottom: calc(100% + 10px); left: 0; width: min(330px, calc(100vw - 32px)); max-height: calc(100dvh - 110px); overflow: hidden; border: 1px solid var(--line); border-radius: var(--nav-radius, 12px); background: var(--paper); visibility: hidden; pointer-events: none; transform: translate3d(0, 50px, 0); transform-origin: bottom left; clip-path: inset(calc(100% - 44px) calc(100% - 100px) 0 0 round var(--nav-radius, 12px)); transition: transform 160ms var(--ease-exit), clip-path 160ms var(--ease-exit), visibility 0s step-end 160ms; }
.music-panel.is-open { visibility: visible; pointer-events: auto; transform: translate3d(0,0,0); clip-path: inset(0 round var(--nav-radius, 12px)); transition: transform 240ms var(--ease-panel), clip-path 240ms var(--ease-panel), visibility 0s step-start; }
.music-scroll { max-height: inherit; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding: 20px; }
header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }header button { flex: none; padding: 0; }
.music-kicker { font-size: 9px; letter-spacing: .17em; color: var(--muted); }
.music-title { margin: 14px 0 4px; font: 550 23px/1.4 var(--sans); letter-spacing: -.025em; }.music-subtitle { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.8; }
.music-transport { position: relative; display: flex; justify-content: center; align-items: center; gap: 10px; margin: 22px 0 10px; padding-inline: 40px; }.music-play { border: 1px solid var(--line); border-radius: 50%; flex: none; width: 48px; height: 48px; background: var(--line); }.music-repeat { position: absolute; right: 0; }
.music-range { display: block; width: 100%; height: 24px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; cursor: pointer; }
.music-range::-webkit-slider-runnable-track { height: 3px; border-radius: 99px; background: linear-gradient(to right, var(--accent) 0 var(--range-progress, 0%), var(--line) var(--range-progress, 0%) 100%); }
.music-range::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 11px; height: 11px; margin-top: -4px; border-radius: 50%; background: var(--ink); }
.music-range::-moz-range-track { height: 3px; border-radius: 99px; background: var(--line); }
.music-range::-moz-range-progress { height: 3px; border-radius: 99px; background: var(--accent); }
.music-range::-moz-range-thumb { width: 11px; height: 11px; border: 0; border-radius: 50%; background: var(--ink); }
.music-range:disabled { opacity: .4; cursor: default; }.music-times { display: flex; justify-content: space-between; color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.music-tracks { padding: 0; margin: 0 0 18px; list-style: none; border-top: 1px solid var(--line); }.music-tracks li { border-bottom: 1px solid var(--line); }.music-track { width: 100%; justify-content: flex-start; padding: 10px 0; text-align: left; }.music-number { flex: 0 0 24px; color: var(--muted); font-size: 10px; }.music-track-title { min-width: 0; overflow-wrap: anywhere; }.music-duration { margin-left: auto; flex: none; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--muted); }
.music-library-actions { display: flex; justify-content: space-between; margin-top: 12px; color: var(--muted); font-size: 12px; }
.music-file { display: none; }.music-track-actions { display: flex; justify-content: flex-end; padding-bottom: 4px; gap: 4px; }.music-restore { margin: -8px 0 12px; font-size: 12px; color: var(--muted); }button:disabled { cursor: default; opacity: .4; }
.music-volume { display: flex; gap: 12px; align-items: center; color: var(--muted); font-size: 11px; }.music-volume input { flex: 1; min-width: 0; }.music-volume output { min-width: 30px; text-align: right; }
.music-status { margin: 14px 0 0; min-height: 1.6em; font-size: 11px; color: var(--muted); }
.music-icon-enter-active { transition: opacity 220ms var(--ease-fluid), transform 220ms var(--ease-settle); }
.music-icon-leave-active { transition: opacity 100ms var(--ease-exit), transform 100ms var(--ease-exit); }
.music-icon-enter-from, .music-icon-leave-to { opacity: 0; transform: scale(.8); }
:is(button,input):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
/* .music-surface shares AppearancePanel's material rules in main.css. */
@media(hover:hover) and (pointer:fine) { button:hover { color: var(--accent); } }
@media(max-width:767.98px) { .music-dock { left: max(16px, env(safe-area-inset-left)); bottom: max(16px, env(safe-area-inset-bottom)); }button { min-height: 44px; } }
@media(prefers-reduced-motion:reduce) { button, .music-icon-enter-active, .music-icon-leave-active, .music-name, .music-pill, .music-name-enter-active, .music-name-leave-active, .music-control-enter-active, .music-control-leave-active { transition-duration: .01ms; }.music-panel, .music-panel.is-open { transition: none; } }
@media print { .music-dock { display: none; } }
</style>
