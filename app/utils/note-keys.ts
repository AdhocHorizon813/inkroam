/** Accept bare keys, lines, comma-separated text, or JSON containing key strings. */
export function parseNoteKeys(text: string): string[] {
  const matches = text.match(/(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{43}=(?![A-Za-z0-9+/=])/g) || []
  const keys = [...new Set(matches)]
  if (!keys.length) throw new Error('未识别到有效密钥，请使用文档生成的完整 Base64 密钥。')
  return keys
}
