// Compile the actual teaching blocks, not a second copy that can drift.
import { readdirSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const course = 'content/notes/data-structures'
mkdirSync('tmp', { recursive: true })
const output = mkdtempSync(join('tmp', 'study-code-'))
let count = 0
for (const name of readdirSync(course).filter(name => name.endsWith('.md')).sort()) {
  let index = 0
  for (const block of readFileSync(join(course, name), 'utf8').matchAll(/^```c\r?\n([\s\S]*?)^```/gm)) {
    const path = join(output, `${name.replace('.md', '')}-${++index}`)
    if (!/\bint main\(void\)/.test(block[1])) throw new Error(`Incomplete C example: ${name}:${index}`)
    writeFileSync(`${path}.c`, block[1])
    const binary = `${path}${process.platform === 'win32' ? '.exe' : '.bin'}`
    const build = spawnSync('gcc', ['-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-Werror', `${path}.c`, '-o', binary], { encoding: 'utf8', timeout: 30000 })
    if (build.error || build.status !== 0) throw new Error(`${name}: ${build.error || build.stderr}`)
    const run = spawnSync(join(process.cwd(), binary), [], { encoding: 'utf8', timeout: 5000 })
    if (run.error || run.status !== 0) throw new Error(`${name}: ${run.error || run.stderr || run.stdout}`)
    console.log(`${name} [${index}]: ${run.stdout.trim()}`)
    count++
  }
}
if (count !== 10) throw new Error(`Expected 10 complete programs; found ${count}`)
console.log(`PASS: ${count} C17 programs compiled with warnings as errors and passed sample assertions. Output: ${output}`)
