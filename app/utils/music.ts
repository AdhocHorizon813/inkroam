export const musicTracks = [
  { id: '01_rain_on_the_margin', title: '雨窗演算', english: 'Rain on the Margin', mood: '雨天 · 电钢琴', duration: 129.316, volume: 1, file: 'lofi-vol01/01_rain_on_the_margin.v2.mp3' },
  { id: '02_lamplight_and_paper', title: '纸页微光', english: 'Lamplight & Paper', mood: '暖灯 · 木质拨弦', duration: 140.143, volume: 1, file: 'lofi-vol01/02_lamplight_and_paper.v2.mp3' },
  { id: '03_a_lemma_after_midnight', title: '凌晨的引理', english: 'A Lemma After Midnight', mood: '深夜 · 毛毡钢琴', duration: 148.455, volume: 1, file: 'lofi-vol01/03_a_lemma_after_midnight.v2.mp3' },
  { id: '01_a_blank_afternoon', title: '午后的空白', english: 'A Blank Afternoon', mood: '柔和钢琴 · 简单的晴天旋律', duration: 157.579, volume: 2, file: 'lofi-vol02/01_a_blank_afternoon.r2.mp3' },
  { id: '02_along_the_river', title: '沿河慢行', english: 'Along the River', mood: '温暖电钢琴 · 稳定律动', duration: 150, volume: 2, file: 'lofi-vol02/02_along_the_river.r2.mp3' },
  { id: '03_a_light_left_on', title: '灯还留着', english: 'A Light Left On', mood: '三拍钢琴 · 安静的短句', duration: 145.355, volume: 2, file: 'lofi-vol02/03_a_light_left_on.r2.mp3' },
] as const

export const MUSIC_STORAGE_KEY = 'inkroam-music-v1'
export function musicTime(value: number) {
  const seconds = Math.floor(Number.isFinite(value) ? Math.max(0, value) : 0)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
export function musicPreferences(raw: string | null) {
  let saved: { track?: unknown; volume?: unknown; repeat?: unknown; shuffle?: unknown } = {}
  try { saved = JSON.parse(raw || '{}') || {} } catch { /* Use quiet defaults. */ }
  return {
    index: Math.max(0, musicTracks.findIndex(track => track.id === saved.track)),
    volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : .35,
    repeat: saved.repeat === true,
    shuffle: saved.repeat !== true && saved.shuffle === true,
  }
}

/** Called only by an explicit play request (or its user-started playlist).
 * Never call on mount/open/track selection: preload=none alone is not the gate.
 */
export function loadMusicForPlay(audio: HTMLAudioElement, id: string, baseURL: string) {
  const track = musicTracks.find(track => track.id === id)
  if (!track) throw new Error('未知曲目')
  const path = `${baseURL.replace(/\/$/, '')}/audio/${track.file}`
  if (audio.getAttribute('src') !== path) {
    audio.setAttribute('src', path)
    audio.load()
  }
}
