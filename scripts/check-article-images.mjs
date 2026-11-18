import { Window } from 'happy-dom'
import { parse } from '@vue/compiler-sfc'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('app/components/ArticleReader.vue', 'utf8')
const script = parse(source).descriptor.scriptSetup.content
const file = ts.createSourceFile('article.ts', script, ts.ScriptTarget.Latest, true)
const names = ['collectImages', 'openLightbox', 'onContentClick', 'onContentKeydown', 'enhanceContentImages']
const declarations = file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
assert.equal(declarations.length, names.length)
const { document, HTMLImageElement } = new Window({ url: 'https://example.test/' })
const article = document.createElement('article')
article.innerHTML = '<img src="first.png"><a><img src="linked.png"></a><button><img src="button.png"></button><img src="second.png">'
const images = article.querySelectorAll('img')
Object.defineProperty(images[3], 'currentSrc', { value: 'https://example.test/second-large.png' })
const lightboxOpen = { value: false }, lightboxIndex = { value: 0 }, lightboxImages = { value: [] }
const context = vm.createContext({
  HTMLImageElement, lightboxOpen, lightboxIndex, lightboxImages,
  articleContent: { value: article },
})
vm.runInContext(ts.transpile(declarations.map(node => node.getText(file)).join('\n'), { target: ts.ScriptTarget.ES2022 }), context)
context.enhanceContentImages()
assert.equal(images[0].getAttribute('role'), 'button')
assert.equal(images[3].getAttribute('tabindex'), '0')
assert.equal(images[1].getAttributeNames().join(','), 'src', 'Link images keep the parent link semantics')
assert.equal(images[2].getAttributeNames().join(','), 'src', 'Button images keep the parent button semantics')
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
assert.deepEqual(Array.from(lightboxImages.value, item => item.src), ['https://example.test/first.png', 'https://example.test/second-large.png'])
assert.deepEqual(dispatch('onContentKeydown', images[0], { key: ' ' }), { prevented: true, open: true })
assert.equal(lightboxIndex.value, 0)
assert.match(source, /@click="onContentClick"/)
assert.match(source, /@keydown="onContentKeydown"/)
console.log('PASS: unlinked image lightbox, native linked/button images, modifiers, keyboard activation and gallery indexing.')
