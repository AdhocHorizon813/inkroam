import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { ref, computed, watch, nextTick, effectScope } from 'vue'
import { chooseRoamPath, readRoamHistory, rememberRoamPath, roamPaths } from '../app/utils/roam.ts'

const entries = [
  { path: '/posts/a' }, { path: '/posts/b' }, { path: '/notes/pde/c' },
  { path: '/posts/a' }, { path: '/posts/draft', draft: true },
  ...['https://example.com', '//example.com', '/archive', '/notes/pde', '/posts/a?q=x', '/posts/a#part', '/posts/a/b', '/posts/a\\b'].map(path => ({ path })),
]
const paths = roamPaths(entries)
assert.deepEqual(paths, ['/posts/a', '/posts/b', '/notes/pde/c'])
let history = [], last
for (let cycle = 0; cycle < 20; cycle++) {
  const selected = []
  for (let i = 0; i < paths.length; i++) {
    const path = chooseRoamPath(paths, history, () => cycle % 2 ? .99999 : 0)
    assert.notEqual(path, last, 'No immediate repeat at a cycle boundary')
    selected.push(path)
    history = rememberRoamPath(paths, history, path)
    last = path
  }
  assert.equal(new Set(selected).size, paths.length, 'Every cycle visits every candidate once')
  assert.ok(history.length <= paths.length)
}
assert.equal(chooseRoamPath([], [], () => 0), undefined)
assert.equal(chooseRoamPath(['/posts/a'], ['/posts/a'], () => 0), '/posts/a')
assert.deepEqual(rememberRoamPath(paths, ['/posts/deleted', '/posts/a'], '/archive'), ['/posts/a'])
assert.equal(chooseRoamPath(paths, ['/posts/deleted', '/posts/a', '/posts/b'], () => 0), '/notes/pde/c')
for (const raw of [null, '', '{bad', '{}', '1', '[1]', '[null]']) assert.equal(readRoamHistory(raw), null)
assert.deepEqual(readRoamHistory('["/posts/a"]'), ['/posts/a'])

const component = readFileSync('app/components/RoamLink.vue', 'utf8')
const script = component.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/import[^\n]+\n/, '')
const code = ts.transpile(script, { target: ts.ScriptTarget.ES2022 })
async function mount({ raw = null, blocked = false, memory = ref([]), items = entries } = {}) {
  let mounted, saved, rolls = 0
  const scope = effectScope()
  const context = vm.createContext({
    ref, computed, watch, defineProps: () => ({ entries: items }), useState: () => memory,
    onMounted: callback => { mounted = callback },
    roamPaths, readRoamHistory, rememberRoamPath,
    chooseRoamPath: (candidates, seen) => { rolls++; return chooseRoamPath(candidates, seen, () => .99999) },
    sessionStorage: {
      getItem: () => { if (blocked) throw new Error('Unavailable'); return raw },
      setItem: (key, value) => { if (blocked) throw new Error('Unavailable'); saved = { key, value } },
    },
  })
  scope.run(() => vm.runInContext(`${code}\nglobalThis.exposed = { target, remember };`, context))
  assert.equal(rolls, 0, 'No randomness/storage read during setup or SSR')
  assert.equal(context.exposed.target.value, roamPaths(items)[0])
  mounted(); await nextTick()
  return { ...context.exposed, memory, saved: () => saved, stop: () => scope.stop() }
}
const instance = await mount({ raw: '["/notes/pde/c"]' })
try {
  assert.equal(instance.target.value, '/posts/b')
  instance.remember({ button: 2 })
  assert.equal(instance.saved(), undefined, 'Context menu alone is not a visit')
  instance.remember({ button: 0, defaultPrevented: true })
  assert.equal(instance.saved(), undefined)
  instance.remember({ button: 0, ctrlKey: true })
  assert.equal(instance.target.value, '/posts/b', 'Activation never swaps href under a native link')
  assert.deepEqual(JSON.parse(instance.saved().value), ['/notes/pde/c', '/posts/b'])
  const revisit = await mount({ raw: instance.saved().value })
  try { assert.equal(revisit.target.value, '/posts/a') } finally { revisit.stop() }
} finally { instance.stop() }
const memory = ref([])
const blocked = await mount({ blocked: true, memory })
try {
  blocked.remember({ button: 0 })
  assert.deepEqual(Array.from(memory.value), ['/notes/pde/c'])
  const revisit = await mount({ blocked: true, memory })
  try { assert.equal(revisit.target.value, '/posts/b') } finally { revisit.stop() }
} finally { blocked.stop() }
const empty = await mount({ items: [] })
try { assert.equal(empty.target.value, undefined); empty.remember({ button: 0 }) } finally { empty.stop() }
assert.match(component, /<NuxtLink v-if="target"/)
assert.match(component, /:prefetch="false"/)
assert.match(component, /@click\.capture="remember"/, 'Record before RouterLink prevents the bubbling click')
assert.doesNotMatch(component, /\.prevent|navigateTo\(/)
console.log('PASS: roaming cycles, drafts/route filtering, SSR stability, session persistence, blocked storage, native links and empty collections.')
