import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Contract checks, not an execution of GitHub Actions or a YAML interpreter.
const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8')
const steps = ['npm ci', 'npm run typecheck', 'npm run check\n', 'npm run generate', 'npm run check -- --built', 'actions/upload-pages-artifact@']
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
for (const result of [{ status: 0 }, { status: 1 }, { status: null, signal: 'SIGTERM' }, { error: new Error('spawn failed') }]) {
  const processMock = { argv: ['node', 'check-all.mjs', '--built'], execPath: process.execPath }
  let calls = 0
  vm.runInNewContext(runner, {
    process: processMock, URL, fileURLToPath: () => '.', console: { log() {}, error() {} },
    spawnSync: () => ++calls === 2 ? result : { status: 0 },
  })
  assert(calls > 2, 'Runner continues collecting regression results')
  assert.equal(processMock.exitCode, result.status === 0 ? 0 : 1, 'Any failed suite must fail the release command')
}
console.log('PASS: release gate order, shared deployment prefix and runner failure propagation. Hosted Actions not executed.')
