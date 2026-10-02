import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('app/components/ArticleReader.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const file = ts.createSourceFile('article.ts', script, ts.ScriptTarget.Latest, true)
const names = ['collectImages', 'openLightbox', 'onContentClick', 'onContentKeydown', 'enhanceContentImages']
const declarations = file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
assert.equal(declarations.length, names.length)
class Image {
  constructor(src, interactive = false) { this.src = src; this.alt = src; this.interactive = interactive; this.attributes = new Map() }
  closest(selector) { assert.equal(selector, 'a, button'); return this.interactive ? {} : null }
  setAttribute(key, value) { this.attributes.set(key, value) }
}
const images = [new Image('first.png'), new Image('linked.png', true), new Image('button.png', true), new Image('second.png')]
images[3].currentSrc = 'second-large.png'
const lightboxOpen = { value: false }, lightboxIndex = { value: 0 }, lightboxImages = { value: [] }
const context = vm.createContext({
  HTMLImageElement: Image, lightboxOpen, lightboxIndex, lightboxImages,
  articleContent: { value: { querySelectorAll: () => images } },
})
vm.runInContext(ts.transpile(declarations.map(node => node.getText(file)).join('\n'), { target: ts.ScriptTarget.ES2022 }), context)
context.enhanceContentImages()
assert.equal(images[0].attributes.get('role'), 'button')
assert.equal(images[3].attributes.get('tabindex'), '0')
assert.equal(images[1].attributes.size, 0, 'Link images keep the parent link semantics')
assert.equal(images[2].attributes.size, 0, 'Button images keep the parent button semantics')
function dispatch(handler, target, options = {}) {
  let prevented = false
  lightboxOpen.value = false
  context[handler]({ target, button: 0, key: 'Enter', preventDefault() { prevented = true }, ...options })
  return { prevented, open: lightboxOpen.value }
}
for (const target of [images[1], images[2], {}]) {
  assert.deepEqual(dispatch('onContentClick', target), { prevented: false, open: false })
  assert.deepEqual(dispatch('onContentKeydown', target), { prevented: false, open: false })
}
for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'defaultPrevented']) {
  assert.equal(dispatch('onContentClick', images[0], { [modifier]: true }).prevented, false)
  assert.equal(dispatch('onContentKeydown', images[0], { [modifier]: true }).open, false)
}
assert.equal(dispatch('onContentClick', images[0], { button: 1 }).open, false)
assert.equal(dispatch('onContentKeydown', images[0], { isComposing: true }).open, false)
assert.equal(dispatch('onContentKeydown', images[0], { key: 'Escape' }).open, false)
assert.deepEqual(dispatch('onContentClick', images[3]), { prevented: true, open: true })
assert.equal(lightboxIndex.value, 1, 'Index matches the eligible image gallery')
assert.deepEqual(Array.from(lightboxImages.value, item => item.src), ['first.png', 'second-large.png'])
assert.deepEqual(dispatch('onContentKeydown', images[0], { key: ' ' }), { prevented: true, open: true })
assert.equal(lightboxIndex.value, 0)
assert.match(source, /@click="onContentClick"/)
assert.match(source, /@keydown="onContentKeydown"/)
console.log('PASS: unlinked image lightbox, native linked/button images, modifiers, keyboard activation and gallery indexing (DOM stand-ins).')
