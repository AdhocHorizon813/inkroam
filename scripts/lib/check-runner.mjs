import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkStages } from './check-stages.mjs'

// One entry point grouped by product area. Keep process isolation because
// some suites replace globals or execute their own VM harnesses.
const groups = {
  glass: ['check-glass-settings', 'check-glass-surfaces', 'check-glass-adapter', 'check-glass-controls', 'check-glass-boundary', 'check-glass-built'],
  appearance: ['check-appearance-mode', 'check-reading-appearance', 'check-display-mode', 'check-depth', 'check-depth-receivers', 'check-css-cascade'],
  reading: ['check-reading-links', 'check-reading-polish', 'check-recent-counts', 'check-copy-link', 'check-passage-link', 'check-article-images', 'check-article-tools', 'check-encrypted-notes'],
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

export function runChecks(args, { spawn = spawnSync, output = console } = {}) {
  const flags = new Set(), selectedGroups = new Set()
  for (const arg of args) {
    if (arg.startsWith('--group=')) {
      const group = arg.slice('--group='.length)
      if (!Object.hasOwn(groups, group)) throw new Error(`Unknown group: ${group}. Choose: ${Object.keys(groups).join(', ')}`)
      selectedGroups.add(group)
    } else if (['--built', '--live', '--built-only', '--live-only', '--list', '--help'].includes(arg)) flags.add(arg)
    else throw new Error(`Unknown flag: ${arg}. Use --help.`)
  }
  const { source, built, live } = checkStages([...flags])
  const suites = [...new Set(Object.entries(groups)
    .filter(([group]) => !selectedGroups.size || selectedGroups.has(group))
    .flatMap(([, names]) => names))].filter(name =>
    (source && !artifactOnly.has(name) && !liveOnly.has(name))
    || (built && artifactSuites.has(name)) || (live && liveSuites.has(name)))

  if (flags.has('--help')) {
    output.log(`Usage: npm run check -- [--group=NAME] [--built | --built-only] [--live | --live-only] [--list]
Groups: ${Object.keys(groups).join(', ')}
Default: source checks. --built includes generated output; --built-only omits source-only suites.
--live requires localhost:3000. --live-only omits unrelated source suites.
Repeat --group for several areas. --list prints the plan without executing it.
No mode builds the site, starts a server or opens a browser.`)
    return 0
  }
  if (!suites.length) throw new Error('No checks match the selected groups and stages.')
  if (flags.has('--list')) {
    output.log(suites.join('\n'))
    output.log(`${suites.length} suites selected; nothing executed.`)
    return 0
  }
  let failed = 0
  for (const suite of suites) {
    output.log(`\n[${suite}]`)
    const result = spawn(process.execPath, [
      '--experimental-strip-types', `scripts/${suite}.mjs`,
      ...(built && (artifactSuites.has(suite) || suite === 'check-pdf-embed') ? [source ? '--built' : '--built-only'] : []),
      ...(live && liveSuites.has(suite) ? [source ? '--live' : '--live-only'] : []),
    ], { cwd: fileURLToPath(new URL('../..', import.meta.url)), stdio: 'inherit', timeout: 120_000 })
    if (result.error || result.status !== 0) {
      failed++
      output.error(result.error?.message || `${suite} failed (${result.signal || result.status})`)
    }
  }
  output.log(`\n${suites.length - failed}/${suites.length} suites passed. Browser visual checks are not included.`)
  return failed ? 1 : 0
}
