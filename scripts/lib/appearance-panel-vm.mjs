import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'
import * as glassDefaults from '../../app/utils/glass-defaults.ts'
import * as glassSettings from '../../app/utils/glass-settings.ts'
import * as appearanceStorage from '../../app/utils/appearance-storage.ts'
import * as appearanceDefaults from '../../app/utils/appearance-defaults.ts'

export const panel = readFileSync(new URL('../../app/components/AppearancePanel.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(panel, { filename: 'AppearancePanel.vue' })
if (errors.length) throw errors[0]
export const source = descriptor.scriptSetup.content
export const template = descriptor.template.content

// Compile the actual imports. A new runtime dependency must be supplied here.
const modules = new Map([
  ['~/utils/glass-defaults', glassDefaults],
  ['~/utils/glass-settings', glassSettings],
  ['~/utils/appearance-storage', appearanceStorage],
  ['~/utils/appearance-defaults', appearanceDefaults],
  ['~/utils/pdf-embed', { supportsEmbeddedPdf: () => false }],
  ['~/composables/usePageScrollable', { usePageScrollable: () => ({}) }],
  ['~/composables/useRadialShortcut', {
    useRadialShortcut: () => ({ recording: { value: false }, shortcut: { value: null } }),
  }],
])

export function compilePanel({ client }) {
  return ts.transpileModule(source.replaceAll('import.meta.client', String(client)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
}

export function createPanelContext(bindings) {
  return vm.createContext({
    ...bindings,
    window: {
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
      ...bindings.window,
    },
    onBeforeUnmount: bindings.onUnmounted,
    exports: {},
    require(id) {
      if (!modules.has(id)) throw new Error(`Missing AppearancePanel VM dependency: ${id}`)
      return modules.get(id)
    },
  })
}
