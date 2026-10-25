export interface LocalMusicTrack {
  id: string
  title: string
  filename: string
  size: number
  added: number
}

// Metadata and audio bytes live separately: listing the library never reads
// every music file. Blob reads and object URLs are deferred until explicit play.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false
    const request = indexedDB.open('inkroam-music-library', 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
      if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers')
    }
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => { blocked = true; reject(new Error('音乐库暂时被其它页面占用，请关闭旧版本页面后刷新。')) }
  })
}

async function read<T>(store: string, id?: string): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const objectStore = tx.objectStore(store)
    const request = id === undefined ? objectStore.getAll() : objectStore.get(id)
    let result: T
    request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onabort = () => { db.close(); reject(tx.error || new Error('读取音乐库失败')) }
    tx.onerror = () => { /* onabort settles the operation. */ }
  })
}

export const listLocalMusic = () => read<LocalMusicTrack[]>('tracks')
export const localMusicFile = (id: string) => read<Blob | undefined>('files', id)
// Artwork is independent of audio: opening a player may read one cover, never a song.
export const localMusicCover = (id: string) => read<Blob | undefined>('covers', id)

async function change(action: (tx: IDBTransaction) => void) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['tracks', 'files', 'covers'], 'readwrite')
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error || new Error('无法保存音乐，请检查浏览器存储空间')) }
    tx.onerror = () => { /* onabort settles the operation. */ }
    try { action(tx) } catch (error) { tx.abort(); reject(error) }
  })
}

export async function addLocalMusic(file: File): Promise<LocalMusicTrack> {
  const track = { id: `local-${crypto.randomUUID()}`, title: file.name.replace(/\.[^.]+$/, ''), filename: file.name, size: file.size, added: Date.now() }
  await change(tx => { tx.objectStore('tracks').put(track); tx.objectStore('files').put(file, track.id) })
  return track
}

export const deleteLocalMusic = (id: string) => change(tx => {
  tx.objectStore('tracks').delete(id)
  tx.objectStore('files').delete(id)
  tx.objectStore('covers').delete(id)
})

export const saveMusicCover = (id: string, file: Blob | null) => change(tx => {
  if (file) tx.objectStore('covers').put(file, id)
  else tx.objectStore('covers').delete(id)
})

/** Decode only the explicitly chosen image and store a bounded thumbnail. */
export async function prepareMusicCover(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) {
    throw new Error('请选择不超过 12 MB 的 JPG、PNG 或 WebP 图片。')
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const side = Math.min(960, image.naturalWidth, image.naturalHeight)
    if (!side) throw new Error('图片无法读取。')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = side
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法处理封面图片。')
    const crop = Math.min(image.naturalWidth, image.naturalHeight)
    context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, 0, 0, side, side)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法保存封面。')), 'image/webp', .88))
  } finally { URL.revokeObjectURL(url) }
}
