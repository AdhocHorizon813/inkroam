import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { runChecks } from './lib/check-runner.mjs'
import { parse } from 'yaml'
import { checkStages } from './lib/check-stages.mjs'

const workflow = parse(readFileSync('.github/workflows/deploy.yml', 'utf8'))
const { build, deploy } = workflow.jobs
assert.equal(build['runs-on'], 'ubuntu-latest')
assert.equal(build.env.BASE_PATH, '/${{ github.event.repository.name }}/')
assert.equal(deploy.needs, 'build')
const commands = build.steps.map(step => step.run?.trim() || step.uses?.split('@')[0])
let previous = -1
for (const command of ['npm ci', 'npm run typecheck', 'npm run check', 'npm run generate', 'npm run check -- --built-only', 'actions/upload-pages-artifact']) {
  const position = commands.indexOf(command)
  assert(position > previous, `Release step missing or out of order: ${command}`)
  previous = position
}
for (const job of [build, deploy]) {
  for (const step of [job, ...job.steps]) {
    assert(!step['continue-on-error'], 'Release failures must propagate')
    assert.doesNotMatch(String(step.if ?? ''), /\balways\(/)
    assert.doesNotMatch(step.run ?? '', /\|\|\s*(true|exit 0)/)
  }
}

function runSelection(args, secondResult = { status: 0 }) {
  const calls = []
  const exitCode = runChecks(args, {
    output: { log() {}, error() {} },
    spawn(_exec, args) {
      calls.push(args)
      return calls.length === 2 ? secondResult : { status: 0 }
    },
  })
  return { exitCode, calls }
}
for (const result of [{ status: 0 }, { status: 1 }, { status: null, signal: 'SIGTERM' }, { error: new Error('spawn failed') }]) {
  const { exitCode, calls } = runSelection(['--built-only'], result)
  assert(calls.length > 2, 'Runner continues collecting regression results')
  assert.equal(exitCode, result.status === 0 ? 0 : 1, 'Any failed suite must fail the release command')
}
const suiteName = args => args[1].slice('scripts/check-'.length, -'.mjs'.length)
function names(calls) {
  const files = calls.map(suiteName)
  assert.equal(new Set(files).size, files.length, 'Start each suite once per command')
  return new Set(files)
}
const manual = ['all', 'css-cleanup', 'study-code', 'quick-radial', 'nsga-ii']
const builtOnly = ['notes', 'search-math', 'built-links', 'glass-built']
const liveOnly = ['note-search', 'pdf-embed']
const expectedSource = readdirSync('scripts')
  .filter(file => /^check-.*\.mjs$/.test(file))
  .map(file => file.slice('check-'.length, -'.mjs'.length))
  .filter(name => ![...manual, ...builtOnly, ...liveOnly].includes(name))
const source = names(runSelection([]).calls)
assert.deepEqual(source, new Set(expectedSource), 'Each automatic source suite is registered')
assert(source.has('encrypted-notes'), 'The source gate protects encrypted notes')

const artifactCalls = runSelection(['--built-only']).calls
const artifact = names(artifactCalls)
assert.deepEqual(artifact, new Set([...builtOnly, 'reading-polish', 'reading-links', 'topics',
  'error-page', 'competition-algebra', 'technical-prose', 'about-resident']))
assert(artifactCalls.every(args => args.includes('--built-only')))
const liveCalls = runSelection(['--live-only']).calls
const live = names(liveCalls)
assert.deepEqual(live, new Set([...liveOnly, 'error-page', 'search-filters', 'reading-polish']))
assert(liveCalls.every(args => args.includes('--live-only')))

for (const [flag, extra] of [['--built', artifact], ['--live', live]]) {
  const calls = runSelection([flag]).calls
  assert.deepEqual(names(calls), new Set([...source, ...extra]))
  for (const args of calls) {
    assert(checkStages(args).source, 'Inclusive modes retain source assertions')
    assert.equal(args.includes(flag), extra.has(suiteName(args)))
  }
}
const glass = names(runSelection(['--group=glass']).calls)
assert.deepEqual(glass, new Set([...source].filter(name => name.startsWith('glass-'))))
assert.deepEqual(names(runSelection(['--group=glass', '--group=glass']).calls), glass)
const combined = runSelection(['--built-only', '--live-only']).calls
assert.deepEqual(names(combined), new Set([...artifact, ...live]))
for (const args of combined) {
  const name = suiteName(args)
  assert.deepEqual(checkStages(args), {
    source: false, built: artifact.has(name) || name === 'pdf-embed', live: live.has(name),
  }, name)
}
assert.equal(runSelection(['--list']).calls.length, 0, 'Listing never spawns a check')
assert.equal(runSelection(['--help']).calls.length, 0)
assert.throws(() => runSelection(['--group=missing']), /Unknown group/)
assert.throws(() => runSelection(['--group=music', '--built-only']), /No checks match/)
console.log('PASS: release order, stage/group selection, dry listing and failure propagation. Hosted Actions not executed.')
