// Shared wire protocol with scripts/encrypt-note.py. No keys in Nuxt state/storage.
export const encryptedNoteLimit = 5 * 1024 * 1024

export async function loadEncryptedNote(baseURL: string, documentId: string, signal?: AbortSignal): Promise<unknown> {
  if (!/^[a-f0-9]{32}$/.test(documentId)) throw new Error('Invalid document')
  const response = await fetch(`${baseURL.replace(/\/$/, '')}/encrypted-notes/${documentId}.json`, {
    signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
  })
  if (!response.ok) throw new Error('Unable to load encrypted document')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > Math.ceil((encryptedNoteLimit + 16) / 3) * 4 + 1024) {
      await reader.cancel()
      throw new Error('Document too large')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder().decode(bytes))
}

function decodeBase64(value: unknown): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Invalid encoding')
  }
  return Uint8Array.from(atob(value), character => character.charCodeAt(0))
}

export async function decryptNote(envelope: unknown, encodedKey: string, documentId: string): Promise<string> {
  if (!crypto.subtle) throw new Error('Web Crypto unavailable')
  if (!envelope || typeof envelope !== 'object' || !/^[a-f0-9]{32}$/.test(documentId)) throw new Error('Invalid document')
  const item = envelope as Record<string, unknown>
  if (item.version !== 1 || item.algorithm !== 'AES-256-GCM' || item.id !== documentId) throw new Error('Invalid document')
  const rawKey = decodeBase64(encodedKey.trim())
  if (rawKey.byteLength !== 32) throw new Error('Invalid key')
  const iv = decodeBase64(item.iv)
  if (iv.byteLength !== 12 || typeof item.ciphertext !== 'string' || item.ciphertext.length > Math.ceil((encryptedNoteLimit + 16) / 3) * 4) {
    rawKey.fill(0)
    throw new Error('Invalid document')
  }
  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
  } finally {
    rawKey.fill(0)
  }
  const data = decodeBase64(item.ciphertext)
  if (data.byteLength < 16) throw new Error('Invalid ciphertext')
  const plaintext = new Uint8Array(await crypto.subtle.decrypt({
    name: 'AES-GCM', iv, tagLength: 128,
    additionalData: new TextEncoder().encode(`inkroam-note:v1:AES-256-GCM:${documentId}`),
  }, key, data))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } finally {
    plaintext.fill(0)
  }
}
