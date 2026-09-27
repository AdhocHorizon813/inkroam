/** Pure storage decoding. Keep v5 precedence and v4 blur migration unchanged.
 * Parsing errors intentionally propagate to the component's existing fallback.
 * No DOM, storage access, theme resolution or visual defaults belong here.
 */
export function decodeAppearanceStorage(saved: string | null, legacy: string | null): unknown {
  if (saved) return JSON.parse(saved)
  if (!legacy) return null
  const { blur, ...previous } = JSON.parse(legacy)
  if (typeof blur !== 'number') return previous
  return { ...previous, navBlur: blur, contentBlur: blur, dropdownBlur: blur }
}
