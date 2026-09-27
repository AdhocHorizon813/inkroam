import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import postcss from 'postcss'

// One-time, whole-file structural proof for this bounded cleanup. Not a visual
// test or a general optimizer. Run against the documented pre-cleanup commit.
const baseline = process.argv[2]
assert(baseline && /^[a-f0-9]{7,40}$/.test(baseline), 'Pass the pre-cleanup commit SHA')
const path = 'app/assets/css/main.css'
// Subsequent asset-only migration: explicitly map the two CSS image URLs.
const before = postcss.parse(execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n')
  .replaceAll('/images/modern-dream-city.png', '/images/backgrounds/modern-dream-city.png')
  .replaceAll('/images/yuzoramachi.png', '/images/backgrounds/yuzoramachi.png'))
const after = postcss.parse(readFileSync(path, 'utf8').replaceAll('\r\n', '\n'))
const targets = [
  [":root[data-visual='modern'] .ambient-backdrop", 'background'],
  [':root', '--ease-fluid'],
  [':root', '--ease-settle'],
  [":root[data-visual='modern'][data-color-mode='light'][data-background='flat'] .ambient-backdrop", 'background'],
  // Batch 2: same CSS capabilities in old/new values; retain the separate
  // plain-colour backdrop fallback before the later color-mix gradient.
  [":root[data-visual='modern'][data-color-mode='light'] body", 'background'],
  [":root[data-visual='modern'][data-color-mode='light'] .ambient-image", 'filter'],
  [":root[data-visual='modern'][data-color-mode='light'] .ambient-image", 'opacity'],
  [":root[data-visual='modern'][data-color-mode='light'] .ambient-aurora", 'opacity'],
  [":root[data-visual='modern'][data-color-mode='light'][data-background='aurora'] .ambient-aurora", 'opacity'],
  [":root[data-visual='modern'][data-color-mode='light'] .ambient-vignette::before", 'opacity'],
  [":root[data-visual='modern'][data-color-mode='light'] .ambient-vignette::before", 'background'],
]
targets.push(...JSON.parse(readFileSync(new URL('./css-cleanup-targets.json', import.meta.url), 'utf8')))
let removed = 0
for (const [selector, prop] of targets) {
  // Only unconditional top-level rules with identical selectors and importance.
  // Do not optimize media queries, layers, shorthands vs longhands, or fallbacks.
  const declarations = before.nodes.filter(n => n.type === 'rule' && n.selector === selector)
    .flatMap(rule => rule.nodes.filter(n => n.type === 'decl' && n.prop === prop))
  assert(declarations.length >= 2, `${selector}: expected superseding declarations for ${prop}`)
  const effective = declarations.at(-1)
  const obsolete = declarations.slice(0, -1)
  assert(obsolete.every(d => !!d.important === !!effective.important))
  console.log(`Removed ${selector} / ${prop}; retained later value: ${effective.value}`)
  obsolete.forEach(d => { d.remove(); removed++ })
}
// Compare all remaining nodes in order, including at-rules and declarations.
// Ignore comments/formatting and rule shells emptied by the approved removal.
function semantic(node) {
  if (node.type === 'comment') return null
  if (node.type === 'decl') return ['decl', node.prop, node.value, !!node.important]
  const children = (node.nodes || []).map(semantic).filter(Boolean)
  if (node.type === 'rule' && children.length === 0) return null
  if (node.type === 'rule') return ['rule', node.selector, children]
  if (node.type === 'atrule') return ['at', node.name, node.params, children]
  return ['root', children]
}
assert.deepEqual(semantic(after), semantic(before), 'No unapproved CSS change or reordering allowed')
console.log(`PASS: exactly ${removed} shadowed declarations removed; every remaining CSS rule/value/order unchanged. Browser rendering not tested.`)
