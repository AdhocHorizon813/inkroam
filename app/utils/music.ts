export const musicTracks = [
  { id: '01_rain_on_the_margin', title: '雨窗演算', english: 'Rain on the Margin', mood: '雨天 · 电钢琴', duration: 129.316 },
  { id: '02_lamplight_and_paper', title: '纸页微光', english: 'Lamplight & Paper', mood: '暖灯 · 木质拨弦', duration: 140.143 },
  { id: '03_a_lemma_after_midnight', title: '凌晨的引理', english: 'A Lemma After Midnight', mood: '深夜 · 毛毡钢琴', duration: 148.455 },
] as const

export const MUSIC_STORAGE_KEY = 'inkroam-music-v1'
export function musicTime(value: number) {
  const seconds = Math.floor(Number.isFinite(value) ? Math.max(0, value) : 0)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
export function musicPreferences(raw: string | null) {
  let saved: { track?: unknown; volume?: unknown; repeat?: unknown } = {}
  try { saved = JSON.parse(raw || '{}') || {} } catch { /* Use quiet defaults. */ }
  return {
    index: Math.max(0, musicTracks.findIndex(track => track.id === saved.track)),
    volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : .35,
    repeat: saved.repeat === true,
  }
}

/** Called only by an explicit play request (or its user-started playlist).
 * Never call on mount/open/track selection: preload=none alone is not the gate.
 */
export function loadMusicForPlay(audio: HTMLAudioElement, id: string, baseURL: string) {
  if (!musicTracks.some(track => track.id === id)) throw new Error('未知曲目')
  const path = `${baseURL.replace(/\/$/, '')}/audio/lofi-vol01/${id}.v2.mp3`
  if (audio.getAttribute('src') !== path) {
    audio.setAttribute('src', path)
    audio.load()
  }
}
