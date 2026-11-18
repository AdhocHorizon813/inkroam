// Direct suite invocations and the group runner use the same stage semantics.
export function checkStages(args = process.argv.slice(2)) {
  const onlyBuilt = args.includes('--built-only')
  const onlyLive = args.includes('--live-only')
  return {
    source: !onlyBuilt && !onlyLive,
    built: onlyBuilt || args.includes('--built'),
    live: onlyLive || args.includes('--live'),
  }
}
