export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
/* 日期输入框边打边成型：只留数字，按 4-2-2 补横线（20260925 → 2026-09-25，
   20260 → 2026-0）。补满正好 10 个字符，输入框自己的 maxlength="10" 顺手把
   多余的按键挡在外面——所以这里不需要「格式不对」的提示语。 */
export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return digits
}
export function shiftCalendarDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999 ? value : date.toISOString().slice(0, 10)
}
export function shiftCalendarMonth(value: string, offset: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + offset)
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return value
  const end = new Date(date)
  end.setUTCMonth(end.getUTCMonth() + 1, 0)
  date.setUTCDate(Math.min(day, end.getUTCDate()))
  return date.toISOString().slice(0, 10)
}
export function calendarDays(value: string): string[] {
  const first = `${value.slice(0, 7)}-01`
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(`${first}T00:00:00Z`)
    date.setUTCDate(1 - offset + index)
    return date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999 ? '' : date.toISOString().slice(0, 10)
  })
}
export function withinDateRange(value: string, min = '', max = ''): boolean {
  return validCalendarDate(value) && (!min || value >= min) && (!max || value <= max)
}
