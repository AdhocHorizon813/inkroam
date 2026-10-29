<script setup lang="ts">
import { vExperimentalGlass } from '~/utils/glass-surfaces'
import MusicArtwork from '~/components/MusicArtwork.vue'
import { musicTracks, musicTime, musicPreferences, loadMusicForPlay, MUSIC_STORAGE_KEY } from '~/utils/music'
import { listLocalMusic, localMusicFile, addLocalMusic, deleteLocalMusic, localMusicCover, saveMusicCover, prepareMusicCover } from '~/utils/local-music'
type Track = { id: string; title: string; english: string; mood: string; duration: number; local?: boolean; volume?: number }
const tracks = ref<Track[]>(musicTracks.map(track => ({ ...track })))
const managing = ref(false), importing = ref(false), libraryReady = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const orderKey = 'inkroam-music-order-v1'
const vol2MigrationKey = 'inkroam-music-vol2-added'
let objectUrl: string | null = null
const config = useRuntimeConfig()
const audio = ref<HTMLAudioElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false), playing = ref(false), loading = ref(false)
// A closed panel keeps its decoded lens for instant reopening, but must not
// composite its collapsed 100x44px backdrop over the page on mobile Chromium.
const glassDormant = ref(true)
let closeGlassTimer: ReturnType<typeof setTimeout> | undefined
const pendingSeek = ref<number | null>(null)
const hasPlayed = ref(false)
// Continuity is an intent, not evidence that the first play request succeeded.
const continuing = ref(false)
const showPause = computed(() => playing.value || continuing.value)
const expanded = ref(false)
const morphing = ref(false)
let morphSequence = 0
let morphAnimations: Animation[] = []
const viewScroll = { compact: 0, expanded: 0 }
const panel = ref<HTMLElement | null>(null), body = ref<HTMLElement | null>(null)
const fullscreenButton = ref<HTMLButtonElement | null>(null)
const panelHeight = ref<number | null>(null)
// True while the panel height is tweened: the scroller freezes so a transient
// overflow cannot flash a scrollbar, steal width, reflow the text and re-measure.
const resizing = ref(false)
let bodyObserver: ResizeObserver | undefined
let heightAnimation: Animation | undefined
let heightTarget = 0
const progressInput = ref<HTMLInputElement | null>(null)
const progressVisual = ref<HTMLElement | null>(null)
let progressFrame = 0, scrubbing = false
const coverInput = ref<HTMLInputElement | null>(null), coverSrc = ref(''), coverBusy = ref(false)
let coverRequest = 0, coverTarget = ''
let restoreModal: (() => void) | undefined
const labelMeasure = ref<HTMLElement | null>(null), labelWidth = ref(26)
let labelObserver: ResizeObserver | undefined
const index = ref(0), volume = ref(.35), repeat = ref(false)
const shuffle = ref(false)
const playHistory: string[] = []
const playbackModeLabel = computed(() => repeat.value ? '单曲循环' : shuffle.value ? '随机播放' : '顺序播放')
const elapsed = ref(0), actualDuration = ref(0), loaded = ref(false)
const message = ref('')
const current = computed<Track>(() => tracks.value[index.value] || { id: '', title: '选择一首音乐', english: '', mood: '', duration: 0 })
const dockTitle = computed(() => hasPlayed.value && current.value.id ? current.value.title : '音乐')
const knownDuration = computed(() => actualDuration.value || current.value.duration)
const duration = computed(() => knownDuration.value || 100)
// Progress is a 0..1 fraction: the rail scales and translates with it (subpixel),
// while the transparent native range only carries pointer, keyboard, focus and aria.
function progressFraction(time: number) {
  const total = duration.value
  if (!Number.isFinite(total) || total <= 0) return Math.min(1, Math.max(0, time / 100))
  return Math.min(1, Math.max(0, time / total))
}
const progressRatio = computed(() => progressFraction(elapsed.value))
let request = 0, disposed = false

function save() {
  try { localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ track: current.value.id, volume: volume.value, repeat: repeat.value, shuffle: shuffle.value })) } catch { /* Playback remains usable. */ }
}
onMounted(() => {
  try {
    const saved = musicPreferences(localStorage.getItem(MUSIC_STORAGE_KEY))
    index.value = saved.index; volume.value = saved.volume; repeat.value = saved.repeat
    shuffle.value = saved.shuffle
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
  document.addEventListener('visibilitychange', scheduleProgress)
  document.addEventListener('pointerup', finishScrub)
  document.addEventListener('pointercancel', finishScrub)
  window.addEventListener('resize', resizePanel)
  if (body.value) {
    bodyObserver = new ResizeObserver(resizePanel)
    bodyObserver.observe(body.value)
  }
  void restoreLibrary()
})
onBeforeUnmount(() => {
  if (closeGlassTimer !== undefined) window.clearTimeout(closeGlassTimer)
  disposed = true; request++
  morphSequence++
  morphAnimations.forEach(animation => animation.cancel())
  audio.value?.pause()
  audio.value?.removeAttribute('src')
  labelObserver?.disconnect()
  bodyObserver?.disconnect()
  heightAnimation?.cancel()
  cancelAnimationFrame(progressFrame)
  coverRequest++
  if (coverSrc.value) URL.revokeObjectURL(coverSrc.value)
  restoreModal?.()
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', keydown)
  document.removeEventListener('visibilitychange', scheduleProgress)
  document.removeEventListener('pointerup', finishScrub)
  document.removeEventListener('pointercancel', finishScrub)
  window.removeEventListener('resize', resizePanel)
})
const dock = ref<HTMLElement | null>(null)
// Keep the refractive panel visible through its existing 160ms close animation.
// Once visibility turns hidden, remove the *computed* backdrop filter (not the
// controller or its cached displacement map) to avoid a ghost glass rectangle.
function onPanelVisibilityTransition(event: TransitionEvent) {
  if (event.target !== panel.value || event.propertyName !== 'visibility' || open.value || expanded.value) return
  if (closeGlassTimer !== undefined) { window.clearTimeout(closeGlassTimer); closeGlassTimer = undefined }
  glassDormant.value = true
}
watch(open, value => {
  if (closeGlassTimer !== undefined) { window.clearTimeout(closeGlassTimer); closeGlassTimer = undefined }
  if (value) { glassDormant.value = false; return }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { glassDormant.value = true; return }
  // Fallback for browsers that omit transitionend on a hidden backdrop-filter.
  // The close transition is 160ms; retain its optics until after it finishes.
  closeGlassTimer = window.setTimeout(() => {
    closeGlassTimer = undefined
    if (!open.value && !expanded.value) glassDormant.value = true
  }, 240)
}, { flush: 'sync' })
watch([open, playing], scheduleProgress)
watch([elapsed, duration], () => {
  if (!playing.value || scrubbing || !progressFrame) paintProgress(elapsed.value)
}, { flush: 'post' })
// Opening must not reuse the height measured for the previous state of the library:
// measure once and place it before the first paint, with no tween.
watch(open, async value => {
  if (!value) return
  await nextTick()
  if (disposed || expanded.value || !panel.value || !body.value) return
  const target = quantizeHeight(compactHeight())
  heightTarget = target
  panelHeight.value = target
  resizing.value = false
})
watch([open, () => current.value.id, () => tracks.value.length], () => {
  if (!open.value) return
  void refreshCover()
  // Read local lengths while the panel is open; every track is guarded by its own
  // duration, so a probe runs at most once per file per session.
  void hydrateLocalTags()
  for (const track of tracks.value) void probeDuration(track)
})
// Content changes (track switch, management actions, status line) alter the natural
// height. Post-flush watchers run after the DOM update but before paint, so the panel
// resizes in the same frame; waiting for ResizeObserver would paint one overflowing
// frame first (scrollbar appears, steals width, text reflows, scrollbar disappears).
watch([() => current.value.id, managing, () => tracks.value.length, message], () => resizePanel(), { flush: 'post' })

// Only the range's visual position is sampled per frame. Vue text/list rendering
// stays on timeupdate, and hidden/closed/paused players have no animation loop.
function paintProgress(time: number) {
  const bounded = Math.min(duration.value, Math.max(0, time))
  // Native range thumbs can snap to whole pixels even with fractional values.
  // The transparent native input retains pointer/keyboard semantics; this rail
  // draws a subpixel thumb with transforms, not a stepped left/value position.
  progressVisual.value?.style.setProperty('--music-progress', String(progressFraction(bounded)))
  if (progressInput.value && !scrubbing) progressInput.value.value = String(bounded)
}
function scheduleProgress() {
  cancelAnimationFrame(progressFrame)
  progressFrame = 0
  if (disposed || !open.value || !playing.value || document.hidden || scrubbing || !audio.value || audio.value.paused || audio.value.readyState < 3) return
  if (pendingSeek.value === null) paintProgress(audio.value.currentTime)
  progressFrame = requestAnimationFrame(scheduleProgress)
}
function finishScrub() { scrubbing = false; scheduleProgress() }
function startScrub() { scrubbing = true; cancelAnimationFrame(progressFrame) }
function onPause() {
  // A queued pause from the old source must not undo a new playing event.
  if (!audio.value?.paused) return
  playing.value = false
  cancelAnimationFrame(progressFrame)
}
function onWaiting() { loading.value = !audio.value?.paused; cancelAnimationFrame(progressFrame) }

function compactHeight() {
  if (!panel.value || !body.value) return 0
  const style = getComputedStyle(panel.value)
  const border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
  const natural = body.value.getBoundingClientRect().height + border
  const limit = parseFloat(style.maxHeight)
  return Number.isFinite(limit) ? Math.min(natural, limit) : natural
}
// Layout rounds heights to whole device pixels; animating to a fractional target left
// a sub-pixel settle at the end that reads as a small jump.
function quantizeHeight(value: number) {
  const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1
  return Math.round(value * dpr) / dpr
}
function resizePanel() {
  if (disposed || expanded.value || morphing.value || !panel.value || !body.value) return
  const target = quantizeHeight(compactHeight())
  if (Math.abs(target - heightTarget) < 1 && panelHeight.value !== null) return
  const surface = panel.value
  // Read the currently displayed height before replacing an in-flight resize.
  const from = surface.getBoundingClientRect().height
  const initialized = panelHeight.value !== null
  heightAnimation?.cancel(); heightAnimation = undefined
  heightTarget = target
  panelHeight.value = target
  // Clamping the target FIRST avoids max-height swallowing most of a transition.
  if (!initialized || !open.value || Math.abs(from - target) < 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { resizing.value = false; return }
  resizing.value = true
  const animation = surface.animate([{ height: `${from}px` }, { height: `${target}px` }], {
    duration: 420,
    easing: getComputedStyle(surface).getPropertyValue('--ease-settle').trim() || 'cubic-bezier(.2,.82,.22,1)',
    fill: 'both',
  })
  heightAnimation = animation
  void animation.finished.then(() => {
    if (heightAnimation !== animation) return
    animation.cancel(); heightAnimation = undefined; resizing.value = false
  }, () => { if (heightAnimation === animation) { heightAnimation = undefined; resizing.value = false } })
}

async function refreshCover() {
  const token = ++coverRequest, id = current.value.id
  if (coverSrc.value) URL.revokeObjectURL(coverSrc.value)
  coverSrc.value = ''
  if (!id) return
  try {
    const file = await localMusicCover(id)
    if (disposed || token !== coverRequest || id !== current.value.id || !file) return
    coverSrc.value = URL.createObjectURL(file)
  } catch { /* Cover storage is optional; the original vector remains available. */ }
}
// Local files come out of IndexedDB without a duration, and the playback element only
// gets a src on a real play gesture (preload=none), so nothing knew the length before
// playing. A throwaway metadata-only probe reads it from the stored blob: no network,
// and the playable element still never loads before the user presses play.
const probing = new Set<string>()
async function probeDuration(track: Track) {
  if (!track.local || track.duration || probing.has(track.id)) return
  probing.add(track.id)
  let url = ''
  try {
    const file = await localMusicFile(track.id)
    if (!file || disposed) return
    url = URL.createObjectURL(file)
    const probe = new Audio()
    probe.preload = 'metadata'
    const duration = await new Promise<number>((resolve, reject) => {
      probe.addEventListener('loadedmetadata', () => resolve(probe.duration), { once: true })
      probe.addEventListener('error', () => reject(new Error('metadata')), { once: true })
      probe.src = url
    })
    if (disposed || !Number.isFinite(duration) || duration <= 0) return
    const target = tracks.value.find(item => item.id === track.id)
    if (target) target.duration = duration
    if (current.value.id === track.id) { actualDuration.value = duration; syncTime() }
  } catch { /* An undecodable file keeps the percentage fallback. */ }
  finally { probing.delete(track.id); if (url) URL.revokeObjectURL(url) }
}
// Embedded tags (title/artist/album/length) are read once per imported file. The
// parser is loaded on demand inside readMusicTags, so the page pays nothing until an
// import actually happens; an unreadable file keeps its filename-derived title.
async function applyTags(track: Track, file: File) {
  try {
    const { readMusicTags } = await import('~/utils/music-tags')
    const tags = await readMusicTags(file)
    if (disposed) return
    const target = tracks.value.find(item => item.id === track.id)
    if (!target) return
    if (tags.title) target.title = tags.title
    if (tags.duration) target.duration = tags.duration
    const credit = [tags.artist, tags.album].filter(Boolean).join(' · ')
    if (credit) target.english = credit
    // Persist what was parsed so a reload does not fall back to the filename.
    try {
      const { updateLocalMusic } = await import('~/utils/local-music')
      const patch: Parameters<typeof updateLocalMusic>[1] = {}
      if (tags.title) patch.title = tags.title
      if (tags.artist) patch.artist = tags.artist
      if (tags.album) patch.album = tags.album
      if (tags.duration) patch.duration = tags.duration
      if (Object.keys(patch).length) await updateLocalMusic(track.id, patch)
    } catch { /* In-memory tags still apply for this session. */ }
    // Embedded artwork goes through the same resize/store pipeline as a chosen cover.
    if (tags.cover) {
      try {
        const prepared = await prepareMusicCover(new File([tags.cover], 'cover', { type: tags.cover.type || 'image/jpeg' }))
        await saveMusicCover(track.id, prepared)
        if (!disposed && current.value.id === track.id) await refreshCover()
      } catch { /* Keep the built-in artwork when the picture cannot be stored. */ }
    }
    if (current.value.id === target.id && tags.duration) { actualDuration.value = tags.duration; syncTime() }
  } catch { /* Keep the filename-derived title when tags are unreadable. */ }
}
// Management mode only: dragging a row calls the same moveTrack path the arrow
// buttons use, so ordering, selection and persistence stay in one place.
const dragIndex = ref(-1), dropIndex = ref(-1)
function dragStart(position: number, event: DragEvent) {
  if (!managing.value) return
  dragIndex.value = position; dropIndex.value = position
  event.dataTransfer?.setData('text/plain', String(position))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function dragOver(position: number) {
  if (!managing.value || dragIndex.value < 0) return
  if (dropIndex.value !== position) dropIndex.value = position
}
function dropAt(position: number) {
  const from = dragIndex.value
  dragIndex.value = -1; dropIndex.value = -1
  if (!managing.value || from < 0 || from === position) return
  moveTrack(from, position - from)
}
function dragEnd() { dragIndex.value = -1; dropIndex.value = -1 }
// Persisted tags are hydrated once per session: the library merge only knows the file
// name, so stored title/artist/album/duration are applied to matching rows here.
let tagsHydrated = false
async function hydrateLocalTags() {
  if (tagsHydrated) return
  tagsHydrated = true
  try {
    const { listLocalMusic } = await import('~/utils/local-music')
    for (const local of await listLocalMusic()) {
      const target = tracks.value.find(item => item.id === local.id)
      if (!target) continue
      if (local.title) target.title = local.title
      if (local.duration) target.duration = local.duration
      const credit = [local.artist, local.album].filter(Boolean).join(' · ')
      if (credit) target.english = credit
      if (current.value.id === target.id && local.duration) { actualDuration.value = local.duration; syncTime() }
    }
  } catch { /* Storage may be blocked; rows keep their imported titles. */ }
}
// Pointer drag works on touch: the grip captures the pointer, rows are hit-tested by
// their boxes, and releasing applies the same moveTrack(from, delta) path as desktop DnD.
function gripDown(position: number, event: PointerEvent) {
  if (!managing.value || event.button !== 0) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  dragIndex.value = position; dropIndex.value = position
}
function gripMove(event: PointerEvent) {
  if (dragIndex.value < 0) return
  const rows = (event.currentTarget as HTMLElement).closest('ol')?.children
  if (!rows) return
  for (let index = 0; index < rows.length; index += 1) {
    const box = (rows[index] as HTMLElement).getBoundingClientRect()
    if (event.clientY >= box.top && event.clientY <= box.bottom) { dropIndex.value = index; return }
  }
}
function gripUp() {
  const from = dragIndex.value, to = dropIndex.value
  dragIndex.value = -1; dropIndex.value = -1
  if (from >= 0 && to >= 0 && from !== to) moveTrack(from, to - from)
}
function chooseCover() { coverTarget = current.value.id; coverInput.value?.click() }
async function importCover(event: Event) {
  const field = event.target as HTMLInputElement, file = field.files?.[0], id = coverTarget
  field.value = ''
  if (!file || !id || coverBusy.value) return
  coverBusy.value = true
  try {
    const cover = await prepareMusicCover(file)
    if (disposed || !tracks.value.some(track => track.id === id)) return
    await saveMusicCover(id, cover)
    if (!disposed && current.value.id === id) await refreshCover()
  } catch (error) { message.value = error instanceof Error ? error.message : '无法保存封面。' }
  finally { coverBusy.value = false }
}
async function resetCover() {
  const id = current.value.id
  if (!id || coverBusy.value) return
  coverBusy.value = true
  try {
    await saveMusicCover(id, null)
    if (!disposed && current.value.id === id) await refreshCover()
  } catch { message.value = '无法恢复默认封面。' }
  finally { coverBusy.value = false }
}

// A viewport-filling player, independent of the site's browser fullscreen mode.
// Keep the same DOM/audio; restore only the document state this view changed.
async function setExpanded(value: boolean, animate = true) {
  if (expanded.value === value) return
  const sequence = ++morphSequence
  const surface = panel.value
  const scroller = surface?.querySelector<HTMLElement>('.music-scroll')
  if (scroller && !morphing.value) viewScroll[expanded.value ? 'expanded' : 'compact'] = scroller.scrollTop
  // Measure the visible intermediate frame before cancelling a reversal.
  const from = surface?.getBoundingClientRect()
  const radius = surface ? getComputedStyle(surface).borderRadius : '0px'
  const oldBorder = surface ? parseFloat(getComputedStyle(surface).borderTopWidth) || 0 : 0
  const pieces = Array.from(surface?.querySelectorAll<HTMLElement>('[data-music-morph]') || [])
  const oldRects = pieces.map(element => element.getBoundingClientRect())
  heightAnimation?.cancel(); heightAnimation = undefined; resizing.value = false
  morphAnimations.forEach(animation => animation.cancel())
  morphAnimations = []
  morphing.value = true
  expanded.value = value
  restoreModal?.(); restoreModal = undefined
  if (value && dock.value) {
    const inertElements: Array<[HTMLElement, boolean]> = []
    let node: HTMLElement | null = dock.value
    while (node?.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
          inertElements.push([sibling, sibling.inert]); sibling.inert = true
        }
      }
      if (node.parentElement === document.body) break
      node = node.parentElement
    }
    const root = document.documentElement
    const overflow = root.style.overflow, padding = root.style.paddingRight
    const gutter = Math.max(0, window.innerWidth - root.clientWidth)
    const previousPadding = parseFloat(getComputedStyle(root).paddingRight) || 0
    root.style.overflow = 'hidden'
    if (gutter) root.style.paddingRight = `${previousPadding + gutter}px`
    restoreModal = () => {
      for (const [element, wasInert] of inertElements) element.inert = wasInert
      root.style.overflow = overflow; root.style.paddingRight = padding
    }
  }
  await nextTick()
  if (disposed || sequence !== morphSequence) return
  if (!value && body.value) {
    heightTarget = compactHeight()
    panelHeight.value = heightTarget
    await nextTick()
  }
  if (disposed || sequence !== morphSequence) return
  if (scroller) scroller.scrollTop = viewScroll[value ? 'expanded' : 'compact']
  const to = surface?.getBoundingClientRect()
  if (animate && surface && from?.width && from.height && to?.width && to.height && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const timing = { duration: value ? 520 : 380, easing: getComputedStyle(surface).getPropertyValue('--ease-settle').trim() || 'cubic-bezier(.2,.82,.22,1)', fill: 'both' as const }
    const newRadius = getComputedStyle(surface).borderRadius
    const newBorder = surface.clientTop
    // Animate actual bounds, never scale text. Interpolating parent scale and an
    // inverse child scale independently only cancels at endpoints, not in between.
    // Temporarily take the four content groups out of flow; each keeps a real
    // pixel width and moves within the same resizing surface without distortion.
    const destinations = pieces.map(element => element.getBoundingClientRect())
    if (scroller) {
      scroller.scrollTop = 0
      morphAnimations.push(scroller.animate([{ overflow: 'hidden' }, { overflow: 'hidden' }], timing))
    }
    const fixedBounds = { position: 'fixed', right: 'auto', bottom: 'auto', maxWidth: 'none', maxHeight: 'none', transform: 'none', clipPath: 'none' }
    morphAnimations.push(surface.animate([
      { ...fixedBounds, left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: radius, borderWidth: `${oldBorder}px` },
      { ...fixedBounds, left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: newRadius, borderWidth: `${newBorder}px` },
    ], timing))
    pieces.forEach((element, position) => {
      const a = oldRects[position]!, b = destinations[position]!
      if (!a.width || !a.height || !b.width || !b.height) return
      const independent = { position: 'absolute', margin: '0px', maxWidth: 'none', transform: 'none' }
      // Only artwork has a fixed animated height; text and controls wrap normally.
      const cover = element.classList.contains('music-cover-stack')
      morphAnimations.push(element.animate([
        { ...independent, left: `${a.left - from.left - oldBorder}px`, top: `${a.top - from.top - oldBorder}px`, width: `${a.width}px`, ...(cover ? { height: `${a.height}px` } : {}) },
        { ...independent, left: `${b.left - to.left - newBorder}px`, top: `${b.top - to.top - newBorder}px`, width: `${b.width}px`, ...(cover ? { height: `${b.height}px` } : {}) },
      ], timing))
    })
    await Promise.allSettled(morphAnimations.map(animation => animation.finished))
    if (disposed || sequence !== morphSequence) return
    morphAnimations.forEach(animation => animation.cancel())
    morphAnimations = []
    if (scroller) scroller.scrollTop = viewScroll[value ? 'expanded' : 'compact']
  }
  morphing.value = false
  if (!value) resizePanel()
  if (open.value) fullscreenButton.value?.focus({ preventScroll: true })
}
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
    // Introduce the new album once; keep old hidden tracks and user ordering.
    // Persist the order before the marker so an interrupted write is retryable.
    try {
      if (localStorage.getItem(vol2MigrationKey) !== '1') {
        for (const track of musicTracks) if (track.volume === 2 && !ids.includes(track.id)) ids.push(track.id)
        localStorage.setItem(orderKey, JSON.stringify(ids))
        localStorage.setItem(vol2MigrationKey, '1')
      }
    } catch { /* Storage may be unavailable; the session still has the new album. */ }
    const active = audio.value?.hasAttribute('src') || loading.value || pendingSeek.value !== null ? current.value.id : selected
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
  void applyTags({ id: track.id, title: track.title, english: '', mood: '本地音乐', duration: 0, local: true }, file)
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
  if (importing.value || coverBusy.value) return
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
async function close(restore = false) {
  morphSequence++; morphAnimations.forEach(animation => animation.cancel()); morphAnimations = []; morphing.value = false
  if (expanded.value) { await setExpanded(false); if (disposed || !open.value) return }
  open.value = false
  if (restore) void nextTick(() => trigger.value?.focus({ preventScroll: true }))
}
function outside(event: PointerEvent) { if (!expanded.value && open.value && event.target instanceof Node && !dock.value?.contains(event.target)) close() }
function keydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopImmediatePropagation()
    if (expanded.value) setExpanded(false)
    else close(true)
  }
  if (expanded.value && event.key === 'Tab') {
    const items = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') || []).filter(item => item.getClientRects().length)
    const first = items[0], last = items.at(-1)
    if (event.shiftKey && (document.activeElement === first || !panel.value?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || !panel.value?.contains(document.activeElement))) { event.preventDefault(); first?.focus() }
  }
}

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
    if (token === request && !disposed) { message.value = '暂时无法播放，请重试。'; loading.value = false; continuing.value = false; playing.value = false }
  }
}
function pause() { request++; audio.value?.pause(); playing.value = false; loading.value = false; continuing.value = false; cancelAnimationFrame(progressFrame) }
function togglePlay() { if (playing.value || loading.value) pause(); else void play() }
function cyclePlaybackMode() {
  if (repeat.value) { repeat.value = false; shuffle.value = true }
  else if (shuffle.value) shuffle.value = false
  else repeat.value = true
  playHistory.length = 0
  save()
}
function nextTrack(continuePlaying = showPause.value || loading.value) {
  const count = tracks.value.length
  if (!count) return
  // Uniform choice from all other tracks; no eager fetch of the chosen source.
  const next = shuffle.value && count > 1 ? (index.value + 1 + Math.floor(Math.random() * (count - 1))) % count : index.value + 1
  selectTrack(next, continuePlaying)
}
function previousTrack() {
  if (shuffle.value) {
    while (playHistory.length) {
      const id = playHistory.pop()
      const previous = tracks.value.findIndex(track => track.id === id)
      if (previous !== -1 && previous !== index.value) { selectTrack(previous, showPause.value || loading.value, false); return }
    }
  }
  selectTrack(index.value - 1, showPause.value || loading.value, false)
}
function selectTrack(next: number, continuePlaying = showPause.value || loading.value, remember = true) {
  if (!tracks.value.length) return
  const target = (next + tracks.value.length) % tracks.value.length
  if (target === index.value) return // Selecting the current row must not restart it.
  if (shuffle.value && remember) {
    playHistory.push(current.value.id)
    if (playHistory.length > 100) playHistory.shift()
  }
  continuing.value = continuePlaying && showPause.value
  cancelAnimationFrame(progressFrame)
  request++; audio.value?.pause(); playing.value = false
  index.value = target
  elapsed.value = 0; pendingSeek.value = null; actualDuration.value = 0; loaded.value = false; loading.value = false; message.value = ''
  // Remove the old resource; choosing a track while paused does not fetch it.
  clearResource()
  save()
  if (continuePlaying) void play()
}
function ended() {
  continuing.value = playing.value || hasPlayed.value
  playing.value = false
  if (repeat.value || tracks.value.length === 1) { if (audio.value) audio.value.currentTime = 0; void play() }
  else nextTrack(true)
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
function failed() { if (!audio.value?.error) return; loading.value = false; playing.value = false; continuing.value = false; cancelAnimationFrame(progressFrame); message.value = '音频未能加载，请重试。' }
function onPlaying() {
  if (!audio.value || audio.value.paused) return
  playing.value = true; continuing.value = false; loading.value = false; hasPlayed.value = true
  scheduleProgress()
}
</script>

<template>
  <div ref="dock" class="music-dock" :class="{ 'is-expanded': expanded, 'is-morphing': morphing }">
    <!-- No src/source/autoplay: initial HTML and hydration cannot request music. -->
    <audio ref="audio" preload="none" @playing="onPlaying" @pause="onPause" @waiting="onWaiting" @loadedmetadata="metadata" @timeupdate="syncTime" @ended="ended" @error="failed" />
    <!-- Like AppearancePanel: a persistent surface clips from its trigger.
         Animate the material itself, not a height-collapsing backdrop ancestor. -->
    <section id="music-panel" v-experimental-glass="true" data-glass-module="music" ref="panel" class="music-panel music-surface" :class="{ 'is-open': open, 'is-expanded': expanded, 'is-morphing': morphing, 'is-resizing': resizing, 'is-glass-dormant': glassDormant }" @transitionend="onPanelVisibilityTransition" :style="{ height: expanded ? undefined : panelHeight === null ? undefined : `${panelHeight}px` }" :role="expanded ? 'dialog' : undefined" :aria-modal="expanded ? true : undefined" :aria-hidden="!open" :inert="!open" aria-label="音乐播放器">
      <div class="music-scroll">
        <div ref="body" class="music-body">
            <header data-music-morph><span class="music-kicker">{{ current.local ? 'MY MUSIC' : 'PAPER HOURS · VOL. ' + (current.volume || 1) }}</span><div class="music-header-actions"><button ref="fullscreenButton" type="button" :aria-label="expanded ? '退出全屏音乐' : '全屏音乐'" :aria-pressed="expanded" @click="setExpanded(!expanded)"><svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="expanded" d="M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5" /><path v-else d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5" /></svg></button><button type="button" aria-label="关闭音乐面板" @click="close(true)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div></header>
          <div class="music-content">
            <div class="music-now">
              <div class="music-cover-stack" data-music-morph><Transition name="music-cover"><MusicArtwork :key="current.id + coverSrc" :track-id="current.id" :src="coverSrc" /></Transition></div>
              <div class="music-info-stack" data-music-morph aria-live="polite" aria-atomic="true"><Transition name="music-info"><div :key="current.id" class="music-info"><h2 class="music-title">{{ current.title }}</h2><p class="music-subtitle"><template v-if="current.english">{{ current.english }}<br></template>{{ current.mood }}</p></div></Transition></div>
              <div v-if="managing && current.id" class="music-cover-actions" data-music-morph><button type="button" :disabled="coverBusy" @click="chooseCover">{{ coverBusy ? '保存封面…' : '更换封面' }}</button><button v-if="coverSrc" type="button" :disabled="coverBusy" @click="resetCover">恢复默认</button></div>
            </div>
            <div class="music-controls" data-music-morph>
            <p v-if="message" class="music-status" role="status">{{ message }}</p>
            <div class="music-transport">
              <button type="button" aria-label="上一首" :disabled="!tracks.length" @click="previousTrack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14m14-14L8 12l11 7Z" /></svg></button>
              <button class="music-play" type="button" :disabled="!tracks.length" :aria-label="loading ? '取消加载' : showPause ? '暂停' : '播放'" :aria-busy="loading" @click="togglePlay"><Transition name="music-icon" mode="out-in"><svg :key="showPause ? 'pause' : 'play'" viewBox="0 0 24 24" aria-hidden="true"><path v-if="showPause" d="M8 5v14M16 5v14" /><path v-else d="m8 4 12 8-12 8Z" /></svg></Transition></button>
              <button type="button" aria-label="下一首" :disabled="!tracks.length" @click="nextTrack()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v14M5 5l11 7-11 7Z" /></svg></button>
              <button class="music-repeat" :class="{ 'is-active': repeat || shuffle }" type="button" :title="playbackModeLabel" :aria-label="`${playbackModeLabel}，点击切换${repeat ? '随机播放' : shuffle ? '顺序播放' : '单曲循环'}`" @click="cyclePlaybackMode"><Transition name="music-icon" mode="out-in"><svg :key="playbackModeLabel" viewBox="0 0 24 24" aria-hidden="true"><path v-if="shuffle" d="M3 6h2c5 0 9 12 14 12h2m-4-4 4 4-4 4M3 18h2c2 0 4-3 6-6s5-6 8-6h2m-4-4 4 4-4 4" /><template v-else><path d="m16 3 4 4-4 4M4 11V9a2 2 0 0 1 2-2h14M8 21l-4-4 4-4m12 0v2a2 2 0 0 1-2 2H4" /><path v-if="repeat" d="m11 11 1-1v5" /></template></svg></Transition></button>
            </div>
            <label class="visually-hidden" for="music-progress">播放进度</label>
            <!-- Subpixel rail: the native range keeps focus, pointer, keyboard, aria and
                 dragging but is transparent; the visible track, fill and ball are painted
                 with transforms so the thumb cannot snap to whole pixels each frame. -->
            <div ref="progressVisual" class="music-progress" :style="{ '--music-progress': progressRatio }">
              <span class="music-progress__track" aria-hidden="true"><span class="music-progress__fill"></span><span class="music-progress__ball-layer"><span v-experimental-glass="true" data-glass-module="thumb" class="music-progress__ball"></span></span></span>
              <input id="music-progress" ref="progressInput" class="music-progress__input" type="range" min="0" :max="duration" step="0.01" :value="elapsed" :disabled="!tracks.length" :aria-valuetext="knownDuration ? `${musicTime(elapsed)}，共 ${musicTime(duration)}` : `预选 ${Math.round(elapsed)}%`" @pointerdown="startScrub" @keydown="startScrub" @keyup="finishScrub" @blur="finishScrub" @input="seek">
            </div>
            <div class="music-times"><span>{{ knownDuration ? musicTime(elapsed) : `${Math.round(elapsed)}%` }}</span><span>{{ knownDuration ? musicTime(duration) : '—:—' }}</span></div>
            <div class="music-library-actions">
              <span class="music-library-label">播放列表<span>{{ tracks.length }}</span></span>
              <div class="music-library-buttons"><button type="button" :disabled="importing || !libraryReady" @click="fileInput?.click()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{{ importing ? '处理中…' : '导入音乐' }}</button><button type="button" :aria-expanded="managing" aria-controls="music-track-list" @click="managing = !managing">{{ managing ? '完成' : '管理列表' }}</button></div>
            </div>
            <input ref="fileInput" class="music-file" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm" multiple aria-label="导入本地音乐" @change="importFiles">
            <input ref="coverInput" class="music-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择当前歌曲封面" @change="importCover">
            <ol id="music-track-list" class="music-tracks" aria-label="曲目列表">
              <li v-for="(track, position) in tracks" :key="track.id" :draggable="managing" :class="{ 'is-dragging': dragIndex === position, 'is-drop-target': dropIndex === position && dragIndex >= 0 && dragIndex !== position }" @dragstart="dragStart(position, $event)" @dragover.prevent="dragOver(position)" @drop.prevent="dropAt(position)" @dragend="dragEnd">
                <span v-if="managing" class="music-grip" aria-hidden="true" @pointerdown.prevent="gripDown(position, $event)" @pointermove="gripMove($event)" @pointerup="gripUp" @pointercancel="gripUp">⠿</span>
                <button class="music-track" type="button" :aria-current="position === index ? 'true' : undefined" @click="selectTrack(position)"><span class="music-number">{{ String(position + 1).padStart(2,'0') }}</span><span class="music-track-title">{{ track.title }}</span><span class="music-duration">{{ track.duration ? musicTime(track.duration) : '本地' }}</span></button>
                <div v-if="managing" class="music-track-actions">
                  <button type="button" :disabled="position === 0 || importing" :aria-label="`上移 ${track.title}`" @click="moveTrack(position, -1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6" /></svg></button>
                  <button type="button" :disabled="position === tracks.length - 1 || importing" :aria-label="`下移 ${track.title}`" @click="moveTrack(position, 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6" /></svg></button>
                  <button type="button" :disabled="importing || coverBusy" :aria-label="`从列表移除 ${track.title}`" @click="removeTrack(track.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg></button>
                </div>
              </li>
            </ol>
            <button v-if="managing" class="music-restore" type="button" :disabled="importing" @click="restoreBuiltins">恢复内置曲目</button>
            <a v-if="managing && current.volume === 2" class="music-credits" :href="`${config.app.baseURL}audio/lofi-vol02/CREDITS.txt`" target="_blank" rel="noopener">音乐制作与采样署名 ↗</a>
            <label class="music-volume" for="music-volume"><span>音量</span><GlassRange><input id="music-volume" class="music-range" :style="{ '--range-progress': `${volume * 100}%` }" type="range" min="0" max="1" step="0.01" :value="volume" :aria-valuetext="`${Math.round(volume * 100)}%`" @input="changeVolume"></GlassRange><output for="music-volume">{{ Math.round(volume * 100) }}%</output></label>
            </div>
          </div>
        </div>
      </div>
    </section>
    <span ref="labelMeasure" class="music-measure" aria-hidden="true">{{ dockTitle }}</span>
    <div class="music-pill" :class="{ 'music-surface': hasPlayed, 'is-unplayed': !hasPlayed }" :inert="expanded" :aria-hidden="expanded" :style="{ width: `${labelWidth + 64 + (hasPlayed ? 40 : 0)}px`, '--music-label-width': `${labelWidth}px` }">
      <button ref="trigger" class="music-trigger" :class="{ 'music-surface': !hasPlayed }" type="button" :aria-expanded="open" aria-controls="music-panel" @click="open ? close() : open = true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" /></svg><span class="music-name"><Transition name="music-name"><span :key="dockTitle">{{ dockTitle }}</span></Transition></span></button>
      <Transition name="music-control"><button v-if="hasPlayed" class="music-quick-play" type="button" :disabled="!tracks.length" :aria-busy="loading" :aria-label="loading ? '取消加载音乐' : showPause ? '暂停音乐' : '播放音乐'" @click="togglePlay"><Transition name="music-icon" mode="out-in"><svg :key="showPause ? 'pause' : 'play'" viewBox="0 0 24 24" aria-hidden="true"><path v-if="showPause" d="M8 6v12M16 6v12" /><path v-else d="m8 4 12 8-12 8Z" /></svg></Transition></button></Transition>
    </div>
  </div>
</template>

<style scoped>
.music-dock { position: fixed; z-index: 45; left: max(24px, env(safe-area-inset-left)); bottom: max(24px, env(safe-area-inset-bottom)); color: var(--ink); font: 13px/1.6 var(--sans); }
.music-pill { position: relative; z-index: 2; display: flex; max-width: calc(100vw - 130px); align-items: center; padding: 0 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); transition: width 360ms var(--ease-settle); }
.music-trigger { min-width: 0; flex: 1; }.music-trigger > svg { flex: none; }
/* A single idle action owns its entire surface, like AppearancePanel's button.
   Move the border and 10px shell padding onto that same button, not a hit-area
   pseudo-element. Outer width, content inset and 42/46px height stay unchanged. */
.music-pill.is-unplayed { padding: 0; border: 0; background: transparent; }
.music-pill.is-unplayed > .music-trigger { width: 100%; min-height: 42px; padding-inline: 18px; border-width: 1px; border-style: solid; border-radius: inherit; }
:where(.music-trigger).music-surface { background: var(--paper); border-color: var(--line); }
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
.music-panel { position: absolute; bottom: calc(100% + 10px); left: 0; width: min(350px, calc(100vw - 32px)); max-height: calc(100dvh - 110px); overflow: hidden; border: 1px solid var(--line); border-radius: var(--nav-radius, 12px); background: var(--paper); visibility: hidden; pointer-events: none; transform: translate3d(0, 50px, 0); transform-origin: bottom left; clip-path: inset(calc(100% - 44px) calc(100% - 100px) 0 0 round var(--nav-radius, 12px)); transition: transform 160ms var(--ease-exit), clip-path 160ms var(--ease-exit), visibility 0s step-end 160ms; }
.music-panel.is-open { visibility: visible; pointer-events: auto; transform: translate3d(0,0,0); clip-path: inset(0 round var(--nav-radius, 12px)); transition: transform 240ms var(--ease-panel), clip-path 240ms var(--ease-panel), visibility 0s step-start; }
.music-scroll { height: 100%; max-height: inherit; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--line) transparent; scrollbar-gutter: stable; }
/* A height tween must never show a transient scrollbar: it would steal width, reflow
   the text and change the very height being measured. */
.music-panel.is-resizing .music-scroll { overflow-y: hidden; }
.music-body { padding: 16px 20px 20px; }
/* An explicit formatting root keeps the transport's 22px top margin inside the
   controls box. Without it the margin collapses through the parent in normal flow
   but not under the absolutely positioned morph, so the collapse end sat 22px low
   and snapped back when the animation finished. */
.music-content, .music-controls { min-width: 0; display: flow-root; }
.music-now { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 14px; margin-top: 16px; }
.music-cover-stack { position: relative; aspect-ratio: 1; border-radius: 8px; }
.music-cover-stack > * { position: absolute; inset: 0; }
.music-info-stack { position: relative; min-width: 0; }
.music-info { width: 100%; }
/* Leaving copy is taken out of flow so the new text defines one height target. */
.music-info-leave-active { position: absolute; inset: 0; }
.music-info-enter-active { transition: opacity 320ms var(--ease-fluid), transform 420ms var(--ease-settle); }
.music-info-leave-active { transition: opacity 130ms var(--ease-exit), transform 160ms var(--ease-exit); }
.music-info-enter-from { opacity: 0; transform: translateY(7px); }
.music-info-leave-to { opacity: 0; transform: translateY(-5px); }
.music-cover-enter-active { transition: opacity 420ms var(--ease-fluid); }
.music-cover-leave-active { transition: opacity 180ms var(--ease-exit); }
.music-cover-enter-from, .music-cover-leave-to { opacity: 0; }
.music-cover-actions { display: flex; gap: 12px; flex-wrap: wrap; grid-column: 1 / -1; color: var(--muted); font-size: 11px; }
.music-cover-actions button { padding-inline: 0; }
header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }header button { flex: none; padding: 0; }
.music-header-actions { display: flex; gap: 2px; }
.music-kicker { font-size: 9px; letter-spacing: .17em; color: var(--muted); }
.music-title { margin: 0 0 4px; font: 550 21px/1.4 var(--sans); letter-spacing: -.025em; overflow-wrap: anywhere; }.music-subtitle { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
.music-transport { position: relative; display: flex; justify-content: center; align-items: center; gap: 10px; margin: 22px 0 10px; padding-inline: 40px; }.music-play { border: 1px solid var(--line); border-radius: 50%; flex: none; width: 48px; height: 48px; background: var(--line); }.music-repeat { position: absolute; right: 0; }
/* Progress rail: fill scales from the left, the ball rides a full-width layer so a
   fractional position lands between pixels. The native range above them is
   transparent but still owns dragging, keyboard, focus ring and aria. */
.music-progress { position: relative; display: flex; align-items: center; height: 24px; margin: 0; }
.music-progress__track { position: relative; display: block; width: 100%; height: 3px; border-radius: 99px; background: var(--line); }
.music-progress__fill { position: absolute; inset: 0; border-radius: inherit; background: var(--accent); transform: scaleX(var(--music-progress, 0)); transform-origin: left center; }
.music-progress__ball-layer { position: absolute; inset: 0; transform: translate3d(calc(var(--music-progress, 0) * 100%), 0, 0); will-change: transform; }
.music-progress__ball { position: absolute; top: 50%; left: 0; width: 11px; height: 11px; margin-left: -5.5px; border-radius: 50%; background: var(--ink); transform: translateY(-50%); }
.music-progress__input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; opacity: 0; cursor: pointer; }
.music-range { display: block; width: 100%; height: 24px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; cursor: pointer; }
.music-range::-webkit-slider-runnable-track { height: 3px; border-radius: 99px; background: linear-gradient(to right, var(--accent) 0 var(--range-progress, 0%), var(--line) var(--range-progress, 0%) 100%); }
.music-range::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 11px; height: 11px; margin-top: -4px; border-radius: 50%; background: var(--ink); }
.music-range::-moz-range-track { height: 3px; border-radius: 99px; background: var(--line); }
.music-range::-moz-range-progress { height: 3px; border-radius: 99px; background: var(--accent); }
.music-range::-moz-range-thumb { width: 11px; height: 11px; border: 0; border-radius: 50%; background: var(--ink); }
.music-range:disabled { opacity: .4; cursor: default; }.music-times { display: flex; justify-content: space-between; color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.music-tracks { padding: 0; margin: 0 0 18px; list-style: none; border-top: 1px solid var(--line); }
.music-tracks li { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 4px; border-bottom: 1px solid var(--line); }
.music-tracks li > .music-track { grid-column: 2; }
.music-tracks li > .music-track-actions { grid-column: 1 / -1; }
.music-grip { grid-column: 1; grid-row: 1; display: inline-flex; align-items: center; justify-content: center; min-width: 26px; min-height: 44px; color: var(--muted); font-size: 13px; line-height: 1; cursor: grab; touch-action: none; user-select: none; }
.music-tracks li[draggable='true'] { cursor: grab; }
.music-tracks li.is-dragging { opacity: .45; }
.music-tracks li.is-drop-target { box-shadow: inset 0 2px 0 var(--accent); }.music-track { width: 100%; justify-content: flex-start; padding: 10px 0; text-align: left; }.music-number { flex: 0 0 24px; color: var(--muted); font-size: 10px; }.music-track-title { min-width: 0; overflow-wrap: anywhere; }.music-duration { margin-left: auto; flex: none; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--muted); }
.music-library-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; margin: 18px 0 4px; color: var(--muted); font-size: 11px; }
.music-library-label { display: inline-flex; align-items: baseline; gap: 7px; white-space: nowrap; }
.music-library-label > span { font-size: 10px; font-variant-numeric: tabular-nums; }
.music-library-buttons { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.music-library-buttons button { padding-inline: 0; gap: 3px; white-space: nowrap; }
.music-library-buttons svg { width: 14px; height: 14px; }
.music-file { display: none; }.music-track-actions { display: flex; justify-content: flex-end; padding-bottom: 4px; gap: 4px; }.music-restore { margin: -8px 0 12px; font-size: 12px; color: var(--muted); }button:disabled { cursor: default; opacity: .4; }
.music-credits { display: inline-block; margin-bottom: 12px; color: var(--muted); font-size: 12px; text-underline-offset: 3px; order: 5; }
.music-volume { display: flex; gap: 12px; align-items: center; color: var(--muted); font-size: 11px; }.music-volume input { flex: 1; min-width: 0; }.music-volume output { min-width: 30px; text-align: right; }
.music-status { margin: 14px 0 0; min-height: 1.6em; font-size: 11px; color: var(--muted); }
.music-icon-enter-active { transition: opacity 220ms var(--ease-fluid), transform 220ms var(--ease-settle); }
.music-icon-leave-active { transition: opacity 100ms var(--ease-exit), transform 100ms var(--ease-exit); }
.music-icon-enter-from, .music-icon-leave-to { opacity: 0; transform: scale(.8); }
:is(button,input):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
/* .music-surface uses the independent music material/blur channel in main.css. */
.music-dock.is-expanded, .music-dock.is-morphing { z-index: 200; }
.music-panel.is-open.is-morphing { transition: none; }
.music-repeat.is-active { color: inherit; }
.music-dock.is-expanded .music-pill { visibility: hidden; }
.music-panel.is-expanded { position: fixed; inset: 0; width: 100%; height: auto; max-height: none; border: 0; border-radius: 0; clip-path: none; transform: none; }
/* The material top highlight and drop shadow are removed in main.css (root-level
   selectors are not allowed in this component). */
.music-panel.is-expanded .music-scroll { max-height: 100%; }
.music-panel.is-expanded .music-body { max-width: 1140px; margin-inline: auto; padding: max(24px, env(safe-area-inset-top)) max(32px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(32px, env(safe-area-inset-left)); }
.music-panel.is-expanded .music-content { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(32px, 6vw, 100px); align-items: start; padding-top: clamp(24px, 6vh, 64px); }
.music-panel.is-expanded .music-now { grid-template-columns: minmax(0, 1fr); gap: 24px; margin: 0; }
.music-panel.is-expanded .music-cover-stack { width: min(100%, 44dvh); justify-self: center; border-radius: 14px; }
.music-panel.is-expanded .music-title { font-size: clamp(24px, 3vw, 36px); }
.music-panel.is-expanded .music-subtitle { font-size: 13px; }
.music-panel.is-expanded .music-controls { padding-top: 8px; }
/* Fullscreen only: put the seek bar and time labels above transport controls. */
.music-panel.is-expanded .music-controls { display: flex; flex-direction: column; }
.music-panel.is-expanded .music-progress { order: 1; }
.music-panel.is-expanded .music-times { order: 2; }
.music-panel.is-expanded .music-transport { order: 3; }
.music-panel.is-expanded .music-library-actions { order: 4; }
.music-panel.is-expanded .music-tracks { order: 5; }
.music-panel.is-expanded .music-volume { order: 6; }
.music-panel.is-expanded .music-transport { margin-top: 0; gap: 22px; }
.music-panel.is-expanded .music-play { width: 60px; height: 60px; }
.music-panel.is-expanded .music-tracks { max-height: 42dvh; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
@media(hover:hover) and (pointer:fine) { button:hover { color: var(--accent); } }
@media(max-width:767.98px) {
  .music-dock { left: max(16px, env(safe-area-inset-left)); bottom: max(16px, env(safe-area-inset-bottom)); }button { min-height: 44px; }
  .music-pill.is-unplayed > .music-trigger { min-height: 46px; }
  .music-panel.is-expanded .music-body { padding-inline: max(24px, env(safe-area-inset-left)) max(24px, env(safe-area-inset-right)); }
  .music-panel.is-expanded .music-content { grid-template-columns: minmax(0, 1fr); gap: 24px; padding-top: 16px; }
  .music-panel.is-expanded .music-now { gap: 20px; }
  .music-panel.is-expanded .music-cover-stack { width: min(72vw, 32dvh, 320px); }
  .music-panel.is-expanded .music-info { text-align: center; }
  .music-panel.is-expanded .music-cover-actions { justify-content: center; }
  .music-panel.is-expanded .music-tracks { max-height: none; }
}
@media(prefers-reduced-motion:reduce) { button, .music-icon-enter-active, .music-icon-leave-active, .music-name, .music-pill, .music-name-enter-active, .music-name-leave-active, .music-control-enter-active, .music-control-leave-active, .music-info-enter-active, .music-info-leave-active, .music-cover-enter-active, .music-cover-leave-active { transition-duration: .01ms; }.music-panel, .music-panel.is-open { transition: none; } }
@media print { .music-dock { display: none; } }
</style>
