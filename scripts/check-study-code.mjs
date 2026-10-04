// Compile the actual teaching blocks, not a second copy that can drift.
import { readdirSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const flags = new Set(process.argv.slice(2))
for (const flag of flags) if (flag !== '--write-outputs') throw new Error(`Unknown flag: ${flag}`)
const writeOutputs = flags.has('--write-outputs')
const course = 'content/notes/data-structures'
mkdirSync('tmp', { recursive: true })
const output = mkdtempSync(join('tmp', 'study-code-'))
let count = 0
const updates = [], results = []
const compiler = spawnSync('gcc', ['--version'], { encoding: 'utf8', timeout: 10000 })
if (compiler.error || compiler.status !== 0) throw new Error(`GCC unavailable: ${compiler.error || compiler.stderr}`)
for (const name of readdirSync(course).filter(name => name.endsWith('.md')).sort()) {
  let index = 0
  const original = readFileSync(join(course, name), 'utf8').replaceAll('\r\n', '\n')
  let cursor = 0, updated = ''
  for (const block of original.matchAll(/^```c\n([\s\S]*?)^```/gm)) {
    const path = join(output, `${name.replace('.md', '')}-${++index}`)
    if (!/\bint main\(void\)/.test(block[1])) throw new Error(`Incomplete C example: ${name}:${index}`)
    writeFileSync(`${path}.c`, block[1])
    const binary = `${path}${process.platform === 'win32' ? '.exe' : '.bin'}`
    // Older MinGW defaults to MSVCRT formatting; enable its ISO printf implementation.
    const platformFlags = process.platform === 'win32' ? ['-D__USE_MINGW_ANSI_STDIO=1'] : []
    const build = spawnSync('gcc', ['-std=c17', ...platformFlags, '-Wall', '-Wextra', '-Wpedantic', '-Werror', `${path}.c`, '-o', binary], { encoding: 'utf8', timeout: 30000 })
    if (build.error || build.status !== 0) throw new Error(`${name}: ${build.error || build.stderr}`)
    const run = spawnSync(join(process.cwd(), binary), [], { encoding: 'utf8', timeout: 5000 })
    if (run.error || run.status !== 0) throw new Error(`${name}: ${run.error || run.stderr || run.stdout}`)
    if (writeOutputs) {
      // These examples promise deterministic output; never publish an isolated capture glitch.
      const again = spawnSync(join(process.cwd(), binary), [], { encoding: 'utf8', timeout: 5000 })
      if (again.error || again.status !== 0 || again.stdout !== run.stdout || again.stderr !== run.stderr)
        throw new Error(`${name}:${index}: repeated executions disagree; no outputs were updated`)
    }
    const digest = createHash('sha256').update(block[1]).digest('hex')
    const stdout = run.stdout.replaceAll('\r\n', '\n').trimEnd()
    if (stdout.includes('```')) throw new Error(`${name}: output contains a Markdown fence`)
    const rendered = `\n\n<!-- study-run:BEGIN sha256=${digest} -->\n本段代码的实测输出（GCC，C17；不代表所有输入）：\n\n\`\`\`text\n${stdout || '（程序正常退出，无标准输出）'}\n\`\`\`\n<!-- study-run:END -->`
    const end = block.index + block[0].length
    const existing = original.slice(end).match(/^\n\n<!-- study-run:BEGIN sha256=[a-f0-9]{64} -->\n[\s\S]*?<!-- study-run:END -->/)
    if (!writeOutputs && existing?.[0] !== rendered) {
      throw new Error(`${name}:${index}: missing/stale code output; review the change then run --write-outputs`)
    }
    updated += original.slice(cursor, end) + rendered
    cursor = end + (existing?.[0].length || 0)
    results.push({ file: name, block: index, sha256: digest, stdout, stderr: run.stderr, exitCode: run.status })
    console.log(`${name} [${index}]: ${run.stdout.trim()}`)
    count++
  }
  updated += original.slice(cursor)
  if (writeOutputs && updated !== original) updates.push([join(course, name), updated])
}
if (count !== 42) throw new Error(`Expected 42 complete programs; found ${count}`)
// Do not rewrite any teaching page unless every block compiled and ran successfully.
for (const [file, text] of updates) writeFileSync(file, text)
writeFileSync(join(output, 'execution-report.json'), JSON.stringify({
  compiler: compiler.stdout.split(/\r?\n/)[0], standard: 'C17', results,
}, null, 2))
console.log(`PASS: ${count} C17 programs compiled with warnings as errors and passed sample assertions. Output: ${output}`)
