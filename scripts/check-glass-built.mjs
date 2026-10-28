import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const manifestFile = ['node_modules/.cache/nuxt/.nuxt/dist/server/client.manifest.mjs', '.nuxt/dist/server/client.manifest.mjs'].find(existsSync)
assert(manifestFile, 'Generate the static site before this check')
const { default: manifest } = await import(pathToFileURL(resolve(manifestFile)).href)
const engine = Object.values(manifest).find(chunk => chunk.src?.replaceAll('\\', '/').endsWith('vendor/liquidglass/liquid-glass.js'))
assert(engine?.isDynamicEntry, 'Optics must remain a separate dynamic chunk')
assert.equal(engine.prefetch, false, 'Disabled experiment must not prefetch optics')
assert.equal(engine.preload, false)
const root = '.output/public', scripts = join(root, '_nuxt')
assert(existsSync(join(scripts, engine.file)), 'Dynamic engine chunk must still be deployable')
const referenced = readdirSync(scripts).filter(file => file.endsWith('.js') && file !== engine.file)
assert(referenced.some(file => readFileSync(join(scripts, file), 'utf8').includes(`import("./${engine.file}")`)), 'Enabling the feature must retain its runtime import')
let pages = 0
function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, entry.name)
    if (entry.isDirectory()) { if (!['_nuxt', 'audio', 'images', 'pdfs'].includes(entry.name)) walk(file); continue }
    if (!entry.name.endsWith('.html')) continue
    pages++
    const tags = readFileSync(file, 'utf8').match(/<(?:link|script)\b[^>]*>/gi) || []
    assert(!tags.some(tag => tag.includes(engine.file)), `Unexpected eager optics request in ${file}`)
  }
}
walk(root)
assert(pages > 0)
console.log(`PASS: ${pages} HTML pages have no eager glass-engine request; ${engine.file} remains dynamically importable. No browser network capture.`)
