import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// One entry point grouped by product area. Keep process isolation because
// some suites replace globals or execute their own VM harnesses.
const groups = {
  glass: ['check-glass-settings', 'check-glass-surfaces', 'check-glass-adapter', 'check-glass-controls', 'check-glass-boundary', 'check-glass-built'],
  appearance: ['check-appearance-mode', 'check-reading-appearance', 'check-display-mode', 'check-depth', 'check-depth-receivers', 'check-css-cascade'],
  reading: ['check-reading-links', 'check-reading-polish', 'check-recent-counts', 'check-copy-link', 'check-passage-link', 'check-article-images', 'check-article-tools'],
  content: ['check-c2-note', 'check-competition-algebra', 'check-technical-prose', 'check-about-resident', 'check-topics', 'check-roam', 'check-notes', 'check-search-math'],
  navigation: ['check-page-scroll', 'check-nav-sticky-offset', 'check-scroll-writes', 'check-scroll-lifecycle', 'check-error-page'],
  search: ['check-search-filters', 'check-filter-select', 'check-calendar', 'check-search-popover', 'check-note-search'],
  pdf: ['check-pdf-controls', 'check-pdf-search', 'check-pdf-embed'],
  music: ['check-music-player'],
  release: ['check-release-gates', 'check-built-links'],
}
const artifactOnly = new Set(['check-notes', 'check-search-math', 'check-built-links', 'check-glass-built'])
const liveOnly = new Set(['check-note-search', 'check-pdf-embed'])
const artifactSuites = new Set([
  ...artifactOnly, 'check-competition-algebra', 'check-reading-links', 'check-technical-prose',
  'check-about-resident', 'check-error-page', 'check-topics', 'check-reading-polish',
])
const liveSuites = new Set([...liveOnly, 'check-error-page', 'check-search-filters', 'check-reading-polish'])

const flags = new Set(), selectedGroups = new Set()
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--group=')) {
    const group = arg.slice('--group='.length)
    if (!Object.hasOwn(groups, group)) throw new Error(`Unknown group: ${group}. Choose: ${Object.keys(groups).join(', ')}`)
    selectedGroups.add(group)
  } else if (['--built', '--live', '--built-only', '--live-only', '--list', '--help'].includes(arg)) flags.add(arg)
  else throw new Error(`Unknown flag: ${arg}. Use --help.`)
}
const built = flags.has('--built') || flags.has('--built-only')
const live = flags.has('--live') || flags.has('--live-only')
// Existing flags remain inclusive. Only modes omit unrelated source suites.
const source = !flags.has('--built-only') && !flags.has('--live-only')
const suites = [...new Set(Object.entries(groups)
  .filter(([group]) => !selectedGroups.size || selectedGroups.has(group))
  .flatMap(([, names]) => names))].filter(name =>
  (source && !artifactOnly.has(name) && !liveOnly.has(name))
  || (built && artifactSuites.has(name)) || (live && liveSuites.has(name)))

if (flags.has('--help')) {
  console.log(`Usage: npm run check -- [--group=NAME] [--built | --built-only] [--live | --live-only] [--list]
Groups: ${Object.keys(groups).join(', ')}
Default: source checks. --built includes generated output; --built-only omits source-only suites.
--live requires localhost:3000. --live-only omits unrelated source suites.
Repeat --group for several areas. --list prints the plan without executing it.
No mode builds the site, starts a server or opens a browser.`)
} else {
  if (!suites.length) throw new Error('No checks match the selected groups and stages.')
  if (flags.has('--list')) {
    console.log(suites.join('\n'))
    console.log(`${suites.length} suites selected; nothing executed.`)
  } else {
    let failed = 0
    for (const suite of suites) {
      console.log(`\n[${suite}]`)
      const result = spawnSync(process.execPath, [
        '--experimental-strip-types', `scripts/${suite}.mjs`,
        ...(built && (artifactSuites.has(suite) || suite === 'check-pdf-embed') ? ['--built'] : []),
        ...(live && liveSuites.has(suite) ? ['--live'] : []),
      ], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit', timeout: 120_000 })
      if (result.error || result.status !== 0) {
        failed++
        console.error(result.error?.message || `${suite} failed (${result.signal || result.status})`)
      }
    }
    console.log(`\n${suites.length - failed}/${suites.length} suites passed. Browser visual checks are not included.`)
    process.exitCode = failed ? 1 : 0
  }
}
