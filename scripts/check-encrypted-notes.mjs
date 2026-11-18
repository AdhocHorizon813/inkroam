import { vmSource } from './lib/vm-source.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes, webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { shallowRef } from 'vue'
import { parseNoteKeys } from '../app/utils/note-keys.ts'
import { decryptNote } from '../app/utils/encrypted-note.ts'
import { assertEncryptedNotes } from './lib/encrypted-notes-guard.ts'
import { zipSync, strToU8 } from 'fflate'

// Nuxt resolves extensionless TS imports; Node's strip-types loader does not.
// Adapt only this check harness rather than changing application TS settings.
const require = createRequire(import.meta.url)
const importExports = {}
const importCode = ts.transpileModule(readFileSync('app/utils/import-note-keys.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
new Function('require', 'exports', importCode)(
  name => name === './note-keys' ? { parseNoteKeys } : require(name), importExports,
)
const { importNoteKeyFiles } = importExports

// Synthetic keys only: checks must never read a contributor's private backups.
const keys = [randomBytes(32), randomBytes(32)].map(bytes => bytes.toString('base64'))
assert.deepEqual(parseNoteKeys(keys.join('\n')), keys)
assert.deepEqual(parseNoteKeys(keys.join(', ')), keys)
assert.deepEqual(parseNoteKeys(JSON.stringify({ keys: [...keys, keys[0]] })), keys)
assert.throws(() => parseNoteKeys('not a key'))
assert.equal(parseNoteKeys('x'.repeat(512 * 1024 + 1) + '\n' + keys[0]).length, 1)
assert.equal(parseNoteKeys(Array.from({ length: 256 }, () => randomBytes(32).toString('base64')).join('\n')).length, 256)
const archive = new File([zipSync({
  'nested/deep/one.key': strToU8(keys[0]), 'nested/two.json': strToU8(JSON.stringify({ key: keys[1] })),
  'unrelated.txt': strToU8('no key here'), 'ignored.md': strToU8(keys[0]),
})], 'keys.zip')
const imported = new Set()
const result = await importNoteKeyFiles([archive, new File([keys[0]], 'three.key')], new AbortController().signal,
  values => values.forEach(value => imported.add(value)), () => {})
assert.equal(result.matched, 3)
assert.equal(result.failed, 0)
assert.equal(imported.size, 2)
const broken = await importNoteKeyFiles([new File(['invalid ZIP'], 'bad.zip')], new AbortController().signal, () => {}, () => {})
assert.equal(broken.failed, 1)
const stopped = new AbortController(); stopped.abort()
await assert.rejects(importNoteKeyFiles([archive], stopped.signal, () => {}, () => {}), { name: 'AbortError' })
for (let index = 0; index < keys.length; index++) {
  const id = String(index + 1).repeat(32)
  const key = await webcrypto.subtle.importKey('raw', Buffer.from(keys[index], 'base64'), 'AES-GCM', false, ['encrypt'])
  const iv = randomBytes(12)
  const plaintext = `synthetic confidential note ${index}`
  const bytes = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128,
    additionalData: new TextEncoder().encode(`inkroam-note:v1:AES-256-GCM:${id}`),
  }, key, new TextEncoder().encode(plaintext))
  const envelope = { version: 1, algorithm: 'AES-256-GCM', id, iv: iv.toString('base64'), ciphertext: Buffer.from(bytes).toString('base64') }
  assert.equal(await decryptNote(envelope, keys[index], id), plaintext)
  await assert.rejects(decryptNote(envelope, keys[1 - index], id))
  const damaged = Buffer.from(bytes); damaged[0] ^= 1
  await assert.rejects(decryptNote({ ...envelope, ciphertext: damaged.toString('base64') }, keys[index], id))
}

const listeners = new Map()
const context = vm.createContext({ shallowRef, window: { addEventListener: (event, callback) => listeners.set(event, callback) } })
const source = vmSource(readFileSync('app/composables/useUnlockedNotes.ts', 'utf8')).replaceAll('import.meta.client', 'true')
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }) + '\nglobalThis.session = useUnlockedNotes()', context)
const session = context.session
const original = { path: '/notes/demo/a', title: 'Encrypted note' }
session.remember({ id: 'a', path: original.path, source: 'synthetic', metadata: { title: 'Unlocked title' } })
assert.equal(session.displayEntry(original).title, 'Unlocked title')
assert.equal(original.title, 'Encrypted note', 'Public Content object must not be mutated')
session.lock('a')
assert.equal(session.displayEntry(original).title, 'Encrypted note')
session.remember({ id: 'a', path: original.path, source: 'synthetic', metadata: {} })
const before = session.revision()
listeners.get('pagehide')()
assert.equal(Object.keys(session.documents.value).length, 0)
assert(session.revision() > before, 'Page exit invalidates in-flight batches')
assertEncryptedNotes(process.cwd())
console.log('PASS: unlimited key counts, nested ZIP imports, duplicates, invalid archives, cancellation, authenticated decryption, memory overlays and publication guard.')
