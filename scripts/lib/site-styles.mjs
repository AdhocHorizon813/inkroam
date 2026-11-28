import { readFileSync } from 'node:fs'
import postcss from 'postcss'

// Follow the same ordered global imports as Nuxt. Component-scoped styles
// and the separately audited depth overlay have their own cascade boundaries.
export function readSiteStyles() {
  const entry = new URL('../../app/assets/css/site.css', import.meta.url)
  const imports = postcss.parse(readFileSync(entry, 'utf8')).nodes
  return imports.filter(node => node.type !== 'comment').map(node => {
    const file = /^'([.][/][\w-]+\.css)'$/.exec(node.params)
    if (node.type !== 'atrule' || node.name !== 'import' || !file) {
      throw new Error(`Expected an unconditional local stylesheet import in site.css: ${node}`)
    }
    return readFileSync(new URL(file[1], entry), 'utf8')
  }).join('\n')
}
