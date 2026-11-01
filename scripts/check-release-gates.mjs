import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Contract checks, not an execution of GitHub Actions or a YAML interpreter.
const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8')
const steps = ['npm ci', 'npm run typecheck', 'npm run check\n', 'npm run generate', 'npm run check -- --built-only', 'actions/upload-pages-artifact@']
let previous = -1
for (const step of steps) {
  const position = workflow.replaceAll('\r\n', '\n').indexOf(step)
  assert(position > previous, `Release step missing or out of order: ${step}`)
  previous = position
}
assert.match(workflow, /build:\s+ runs-on: ubuntu-latest\s+env:\s+BASE_PATH: \/\$\{\{ github.event.repository.name \}\}\//)
assert.match(workflow, /deploy:\s+needs: build/)
assert.doesNotMatch(workflow, /continue-on-error:|if:\s*\$?\{?\{?\s*always\(|\|\|\s*(true|exit 0)/)

// Inject failures into the real runner without changing any product/test file.
const runner = readFileSync('scripts/check-all.mjs', 'utf8')
  .replace(/^import .*$/gm, '')
  .replaceAll('import.meta.url', JSON.stringify(new URL('./check-all.mjs', import.meta.url).href))
function runSelection(args, secondResult = { status: 0 }) {
  const processMock = { argv: ['node', 'check-all.mjs', ...args], execPath: process.execPath }
  const calls = []
  vm.runInNewContext(runner, {
    process: processMock, URL, fileURLToPath: () => '.', console: { log() {}, error() {} },
    spawnSync: (_exec, args) => {
      calls.push(Array.from(args))
      return calls.length === 2 ? secondResult : { status: 0 }
    },
  })
  return { processMock, calls }
}
for (const result of [{ status: 0 }, { status: 1 }, { status: null, signal: 'SIGTERM' }, { error: new Error('spawn failed') }]) {
  const { processMock, calls } = runSelection(['--built-only'], result)
  assert(calls.length > 2, 'Runner continues collecting regression results')
  assert.equal(processMock.exitCode, result.status === 0 ? 0 : 1, 'Any failed suite must fail the release command')
}
const artifact = runSelection(['--built-only']).calls
assert.equal(artifact.length, 11, 'Every generated-content branch remains selected')
assert(artifact.every(args => args.includes('--built')))
assert(!artifact.some(args => args.includes('scripts/check-glass-controls.mjs')), 'Do not repeat source-only optics checks after generate')
const source = runSelection([]).calls
assert.equal(source.length, 37, 'Four small source suites consolidated without dropping their assertions')
assert(!source.some(args => args.includes('scripts/check-notes.mjs')), 'Default checks do not require generated output')
const glass = runSelection(['--group=glass']).calls
assert.equal(glass.length, 5)
assert(glass.every(args => args[1].startsWith('scripts/check-glass-')))
assert.equal(runSelection(['--group=glass', '--group=glass']).calls.length, 5, 'Repeated group flags never duplicate a process')
assert.equal(runSelection(['--built']).calls.length, 41, 'Legacy --built still includes source and artifact checks')
const live = runSelection(['--live-only']).calls
assert.equal(live.length, 5)
assert(live.find(args => args[1] === 'scripts/check-reading-polish.mjs').includes('--live'), 'Existing live reading checks receive their flag')
const combined = runSelection(['--built-only', '--live-only']).calls
assert(combined.find(args => args[1] === 'scripts/check-pdf-embed.mjs').includes('--built'), 'Combined stages retain PDF artifact assertions')
assert.equal(runSelection(['--list']).calls.length, 0, 'Listing never spawns a check')
assert.equal(runSelection(['--help']).calls.length, 0)
assert.throws(() => runSelection(['--group=missing']), /Unknown group/)
assert.throws(() => runSelection(['--group=music', '--built-only']), /No checks match/)
console.log('PASS: release order, stage/group selection, dry listing and failure propagation. Hosted Actions not executed.')
