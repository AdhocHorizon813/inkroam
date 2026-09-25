import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const flags = new Set(process.argv.slice(2))
for (const flag of flags) {
  if (!['--built', '--live'].includes(flag)) throw new Error(`Unknown flag: ${flag}`)
}
const built = flags.has('--built')
const suites = [
  'check-about-resident', 'check-copy-link', 'check-error-page',
  'check-recent-counts', 'check-toc-active', 'check-topics', 'check-reading-polish',
  'check-reading-appearance',
  'check-page-scroll',
  'check-search-grouping',
  'check-search-filters', 'check-pdf-controls',
  'check-filter-select', 'check-calendar', 'check-search-popover',
]
if (built) suites.push('check-notes', 'check-search-math', 'check-built-links')
if (flags.has('--live')) suites.push('check-note-search', 'check-pdf-embed')
let failed = 0
for (const suite of suites) {
  console.log(`\n[${suite}]`)
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', `scripts/${suite}.mjs`, ...(built ? ['--built'] : []),
    ...(flags.has('--live') && ['check-error-page', 'check-search-filters'].includes(suite) ? ['--live'] : []),
  ], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit', timeout: 120_000 })
  if (result.error || result.status !== 0) {
    failed++
    console.error(result.error?.message || `${suite} failed (${result.signal || result.status})`)
  }
}
console.log(`\n${suites.length - failed}/${suites.length} suites passed. Browser visual checks are not included.`)
process.exitCode = failed ? 1 : 0
