import { describe, expect, it } from 'vitest'
import {
  availableQty, canSetQty, extraQty, extraSummary, isVisible, stockInfo, stockModeOf, toBalances,
} from './stock'
import { friendlyError, isNetworkError } from './errors'

describe('stockModeOf', () => {
  it("stock_mode bo'lsa o'shani oladi", () => {
    expect(stockModeOf({ stock_mode: 'soft', is_unlimited: true })).toBe('soft')
  })
  it("stock_mode yo'q bo'lsa is_unlimited ga qaraydi (eski baza)", () => {
    expect(stockModeOf({ is_unlimited: true })).toBe('none')
    expect(stockModeOf({ is_unlimited: false })).toBe('strict')
    expect(stockModeOf({})).toBe('strict')
  })
})

describe('canSetQty', () => {
  it("qat'iy: qoldiqdan ko'p qo'shib bo'lmaydi", () => {
    expect(canSetQty('strict', 3, 3)).toBe(true)
    expect(canSetQty('strict', 3, 4)).toBe(false)
    expect(canSetQty('strict', 0, 1)).toBe(false)
    expect(canSetQty('strict', -2, 1)).toBe(false)
  })
  it("yumshoq va cheksiz: har doim mumkin", () => {
    expect(canSetQty('soft', 0, 10)).toBe(true)
    expect(canSetQty('none', -5, 10)).toBe(true)
  })
})

describe('extraQty', () => {
  it("yumshoq: tizimdan oshgan qism", () => {
    expect(extraQty('soft', 2, 5)).toBe(3)
    expect(extraQty('soft', 5, 5)).toBe(0)
    expect(extraQty('soft', 0, 2)).toBe(2)
    expect(extraQty('soft', -3, 2)).toBe(2)
  })
  it("qat'iy va cheksiz: avto-kirim yo'q", () => {
    expect(extraQty('strict', 0, 5)).toBe(0)
    expect(extraQty('none', 0, 5)).toBe(0)
  })
})

describe('isVisible', () => {
  it("yo'q qilingan mahsulot ko'rinmaydi", () => {
    expect(isVisible({ is_available: false }, 'soft', 10)).toBe(false)
  })
  it("hide_when_empty bo'lmasa doim ko'rinadi", () => {
    expect(isVisible({ is_available: true, hide_when_empty: false }, 'strict', 0)).toBe(true)
  })
  it("qat'iy + hide_when_empty: tugaganda yashiriladi", () => {
    expect(isVisible({ is_available: true, hide_when_empty: true }, 'strict', 0)).toBe(false)
    expect(isVisible({ is_available: true, hide_when_empty: true }, 'strict', 2)).toBe(true)
  })
  it("yumshoq mahsulot tizimda tugasa ham yashirilmaydi", () => {
    expect(isVisible({ is_available: true, hide_when_empty: true }, 'soft', 0)).toBe(true)
  })
})

describe('stockInfo', () => {
  it('oddiy holatlar', () => {
    expect(stockInfo('strict', 12)).toEqual({ level: 'ok', text: 'Qoldiq: 12 ta' })
    expect(stockInfo('strict', 4)).toEqual({ level: 'low', text: 'Qoldiq: 4 ta' })
    expect(stockInfo('strict', 0)).toEqual({ level: 'empty', text: 'Tugadi!' })
  })
  it("yumshoq tugaganda 'Tugadi' demaydi, sotish mumkinligini bildiradi", () => {
    expect(stockInfo('soft', 0)).toEqual({ level: 'extra', text: 'Tizimda tugagan' })
    expect(stockInfo('soft', -2)?.level).toBe('extra')
  })
  it('cheksiz: faqat taxminiy qoldiq', () => {
    expect(stockInfo('none', 7)).toEqual({ level: 'muted', text: '~7 ta' })
    expect(stockInfo('none', 0)).toEqual({ level: 'muted', text: 'Cheksiz' })
  })
  it('birlik nomi (stakan)', () => {
    expect(stockInfo('strict', 9, 'stakan')?.text).toBe('Qoldiq: 9 stakan')
  })
})

describe('boshqa yordamchilar', () => {
  it('availableQty minusni 0 qiladi, kasrni tushiradi', () => {
    expect(availableQty(-3)).toBe(0)
    expect(availableQty(2.9)).toBe(2)
  })
  it('toBalances numeric qatorlarni songa aylantiradi', () => {
    const b = toBalances([{
      product_id: 'a', initial_qty: '2' as unknown as number, kirim_qty: 0, auto_qty: 0,
      sold_qty: 1, writeoff_qty: 0, balance: '1' as unknown as number,
    }])
    expect(b.a.balance).toBe(1)
    expect(b.a.initial_qty).toBe(2)
    expect(toBalances(null)).toEqual({})
  })
  it('extraSummary', () => {
    expect(extraSummary([{ product_id: '1', name: 'Osh butun', qty: 2 }, { product_id: '2', name: 'Somsa', qty: 3 }]))
      .toBe('Osh butun +2, Somsa +3')
    expect(extraSummary(undefined)).toBe('')
  })
})

describe('friendlyError', () => {
  it('bazadagi kodlarni tushunarli qiladi', () => {
    expect(friendlyError({ message: 'STOCK_SHORT', details: 'Cola' })).toContain('"Cola" tugagan')
    expect(friendlyError({ message: 'SHIFT_CLOSED' })).toContain('Smena yopilgan')
  })
  it('internet xatosini aniqlaydi', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true)
    expect(friendlyError({ message: 'Failed to fetch' })).toContain('Internet')
  })
  it("noma'lum xatoni ko'rsatadi", () => {
    expect(friendlyError({ message: 'boom' })).toBe('Xatolik: boom')
  })
})
