import { defaultRadialSlots } from '~/utils/radial-actions'
export interface RadialShortcut { enabled: boolean; codes: string[]; label: string; slots: string[] }
export const isRadialCode = (code: unknown): code is string => typeof code === 'string' && /^(Tab|Key[A-Z]|Digit[0-9]|Backquote|Space|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(code)
export const defaultRadialShortcut = (): RadialShortcut => ({ enabled: true, codes: ['Tab', 'KeyQ'], label: 'Tab + Q', slots: defaultRadialSlots() })
export function useRadialShortcut() {
  const shortcut = useState<RadialShortcut>('radial-shortcut', defaultRadialShortcut)
  const recording = useState('radial-shortcut-recording', () => false)
  return { shortcut, recording }
}
