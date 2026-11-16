import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Fail closed if a managed stub was replaced with its private Markdown original. */
export function assertEncryptedNotes(root: string) {
  const manifestPath = resolve(root, 'encrypted-notes.json')
  if (!existsSync(manifestPath)) throw new Error('Missing encrypted-notes.json registry')
  const registry: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new Error('Invalid encrypted note registry')
  for (const [path, id] of Object.entries(registry)) {
    if (!/^content\/(?:notes\/[a-z0-9-]+|posts)\/[a-z0-9-]+\.md$/.test(path)
      || typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid encrypted note registration')
    const stub = readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')
    const expected = new RegExp(`^---\\ntitle: 加密笔记\\ndescription: 输入密钥后阅读。\\ndate: \\d{4}-\\d{2}-\\d{2}\\nreadingTime: —\\ntags: \\[\\]\\nencryptedDocument: ${id}\\n---\\n\\n此文档已在本地加密。\\n$`)
    if (!expected.test(stub)) throw new Error(`Private note publication blocked: ${path}. Edit the ignored original and run encrypt-note.py refresh.`)
    const envelope = JSON.parse(readFileSync(resolve(root, 'public/encrypted-notes', `${id}.json`), 'utf8'))
    if (envelope.version !== 1 || envelope.algorithm !== 'AES-256-GCM' || envelope.id !== id
      || typeof envelope.iv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(envelope.iv)
      || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length < 24
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext)) throw new Error(`Invalid encrypted payload: ${path}`)
  }
}
