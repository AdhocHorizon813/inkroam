/** Last-resort compatibility path, confined to copying and preserving selection.
 * execCommand is deprecated: ordinary copies always use Async Clipboard first.
 */
function copySynchronously(text: string): boolean {
  const doc = document
  const active = doc.activeElement as HTMLElement | null
  const selection = doc.getSelection()
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : []
  const field = doc.createElement('textarea')
  field.value = text
  field.readOnly = true
  field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none'
  field.setAttribute('aria-label', '复制链接临时字段')
  let copied = false
  try {
    doc.body.append(field)
    field.focus({ preventScroll: true }); field.select()
    copied = doc.execCommand?.('copy') === true
  } catch { /* Continue to Async Clipboard if synchronous copy is unsupported. */ }
  finally {
    field.remove()
    active?.focus?.({ preventScroll: true })
    if (selection) { selection.removeAllRanges(); for (const range of ranges) selection.addRange(range) }
  }
  return copied
}

/** A debugger/focus-dependent pending write must not lock the button forever.
 * The native promise cannot be cancelled; a late settlement has no UI handler.
 */
export async function copyTextOnGesture(text: string): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Clipboard timed out')), 3500) }),
    ])
  } catch (error) {
    if (!copySynchronously(text)) throw error
  } finally { clearTimeout(timeout) }
}
