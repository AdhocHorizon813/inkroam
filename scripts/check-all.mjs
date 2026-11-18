import { runChecks } from './lib/check-runner.mjs'

process.exitCode = runChecks(process.argv.slice(2))
