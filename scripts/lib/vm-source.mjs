import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

// These isolated fixtures supply imported values in their own VM scope. Remove
// module declarations by syntax so multiline imports, strings and comments survive.
export function vmSource(source) {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true)
  const edits = []
  for (const node of file.statements) {
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause) throw new Error('A side-effect import needs an explicit fixture: ' + node.moduleSpecifier.text)
      edits.push([node.getStart(file), node.end])
    } else {
      const modifier = node.modifiers?.find(token => token.kind === ts.SyntaxKind.ExportKeyword)
      if (modifier) edits.push([modifier.getStart(file), modifier.end])
    }
  }
  for (const [start, end] of edits.reverse()) source = source.slice(0, start) + source.slice(end)
  return source
}

export function setupForVm(component) {
  const { descriptor, errors } = parse(component)
  if (errors.length) throw errors[0]
  return vmSource(descriptor.scriptSetup.content)
}
