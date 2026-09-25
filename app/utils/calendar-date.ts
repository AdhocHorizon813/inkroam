export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
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
