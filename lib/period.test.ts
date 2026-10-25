import { describe, expect, it } from 'vitest'
import { periodRange } from './period'

// 2026-10-25 yakshanba (kun tartibi: getDay() === 0)
const NOW = new Date(2026, 9, 25, 15, 30, 0)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('periodRange', () => {
  it('bugun', () => {
    const r = periodRange('bugun', '', '', NOW)!
    expect(ymd(r.from)).toBe('2026-10-25')
    expect(r.from.getHours()).toBe(0)
    expect(ymd(r.to)).toBe('2026-10-25')
  })
  it('kecha', () => {
    const r = periodRange('kecha', '', '', NOW)!
    expect(ymd(r.from)).toBe('2026-10-24')
    expect(ymd(r.to)).toBe('2026-10-24')
    expect(r.to.getHours()).toBe(23)
  })
  it('hafta dushanbadan boshlanadi (yakshanba - 6 kun oldin)', () => {
    expect(ymd(periodRange('hafta', '', '', NOW)!.from)).toBe('2026-10-19')
    // chorshanba 2026-10-21 -> dushanba 10-19
    expect(ymd(periodRange('hafta', '', '', new Date(2026, 9, 21, 9, 0))!.from)).toBe('2026-10-19')
  })
  it('oy 1-sanadan', () => {
    expect(ymd(periodRange('oy', '', '', NOW)!.from)).toBe('2026-10-01')
  })
  it('muddat: sanalar yoki cheklovsiz', () => {
    const r = periodRange('custom', '2026-10-01', '2026-10-10', NOW)!
    expect(ymd(r.from)).toBe('2026-10-01')
    expect(ymd(r.to)).toBe('2026-10-10')
    expect(r.to.getHours()).toBe(23)
    expect(periodRange('custom', '', '', NOW)).toBeNull()
    expect(ymd(periodRange('custom', '2026-10-01', '', NOW)!.to)).toBe('2026-10-25')
  })
})
