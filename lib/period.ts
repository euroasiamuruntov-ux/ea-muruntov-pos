// Hisobot davrlari: bugun, kecha, hafta (dushanbadan), oy, yoki tanlangan sanalar.

export type PeriodFilter = 'bugun' | 'kecha' | 'hafta' | 'oy' | 'custom'

export const PERIOD_LABELS: { id: PeriodFilter; label: string }[] = [
  { id: 'bugun', label: 'Bugun' },
  { id: 'kecha', label: 'Kecha' },
  { id: 'hafta', label: 'Hafta' },
  { id: 'oy', label: 'Oy' },
  { id: 'custom', label: 'Muddat' },
]

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

/** Davr chegaralari (mahalliy vaqt). Muddat tanlangan-u, boshlanish sanasi yo'q bo'lsa null (cheklovsiz). */
export function periodRange(
  filter: PeriodFilter,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): { from: Date; to: Date } | null {
  const today = startOfDay(now)
  switch (filter) {
    case 'bugun':
      return { from: today, to: endOfDay(now) }
    case 'kecha': {
      const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      return { from: y, to: endOfDay(y) }
    }
    case 'hafta': {
      const sinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1
      return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - sinceMonday), to: endOfDay(now) }
    }
    case 'oy':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) }
    default: {
      if (!customFrom) return null
      const from = new Date(`${customFrom}T00:00:00`)
      const to = customTo ? new Date(`${customTo}T23:59:59.999`) : endOfDay(now)
      return { from, to }
    }
  }
}
