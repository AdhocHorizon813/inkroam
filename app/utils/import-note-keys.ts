import { parseNoteKeys } from './note-keys'

const keyFile = /\.(key|txt|json)$/i
// Byte limits protect archive extraction; there is no key/file/document count limit.
const textLimit = 2 * 1024 * 1024
const zipLimit = 32 * 1024 * 1024
const expandedLimit = 64 * 1024 * 1024

async function unzipKeys(file: File, signal: AbortSignal): Promise<Record<string, Uint8Array>> {
  if (file.size > zipLimit) throw new Error('ZIP 文件超过 32 MB，请拆分压缩包。')
  const { unzip } = await import('fflate')
  const bytes = new Uint8Array(await file.arrayBuffer())
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    let total = 0
    let unsafe = false
    let stop: (() => void) | undefined
    const abort = () => { stop?.(); reject(new DOMException('Import cancelled', 'AbortError')) }
    signal.addEventListener('abort', abort, { once: true })
    stop = unzip(bytes, {
      filter: entry => {
        if (!keyFile.test(entry.name)) return false
        total += entry.originalSize
        if (!Number.isFinite(entry.originalSize) || entry.originalSize > textLimit || total > expandedLimit) { unsafe = true; return false }
        return true
      },
    }, (error, files) => {
      signal.removeEventListener('abort', abort)
      if (signal.aborted) { reject(new DOMException('Import cancelled', 'AbortError')); return }
      if (error || unsafe) { reject(new Error('ZIP 损坏、格式不支持或密钥文本解压体积过大。')); return }
      resolve(files)
    })
  })
}

export async function importNoteKeyFiles(files: File[], signal: AbortSignal, onKeys: (keys: string[]) => void, onProgress: (count: number) => void) {
  let scanned = 0, failed = 0, matched = 0
  function consume(text: string) {
    signal.throwIfAborted()
    scanned++
    try { const keys = parseNoteKeys(text); onKeys(keys); matched++ } catch { /* Unrelated text/JSON files are ignored. */ }
    onProgress(scanned)
  }
  for (const file of files) {
    signal.throwIfAborted()
    try {
      if (/\.zip$/i.test(file.name)) {
        const entries = await unzipKeys(file, signal)
        // Paths inside ZIP can have any folder depth. Never extract them to disk.
        for (const [name, bytes] of Object.entries(entries)) {
          signal.throwIfAborted()
          if (bytes.byteLength > textLimit) { failed++; continue }
          consume(new TextDecoder().decode(bytes))
          delete entries[name]
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      } else if (keyFile.test(file.name)) {
        if (file.size > textLimit) { failed++; continue }
        consume(await file.text())
      }
    } catch (error) {
      signal.throwIfAborted()
      failed++
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  return { scanned, matched, failed }
}
