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
    const request = indexedDB.open('inkroam-music-library', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('tracks', { keyPath: 'id' })
      db.createObjectStore('files')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('音乐库暂时被其它页面占用'))
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

async function change(action: (tx: IDBTransaction) => void) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['tracks', 'files'], 'readwrite')
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
})
