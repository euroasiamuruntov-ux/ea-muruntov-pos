import { describe, expect, it } from 'vitest'
import {
  formatEquivalents, formatKg, formatPortions, hissaFromKg, initialOshHissa, portionLabel, portionsToHissa,
  summarizeOsh, type OshProduct,
} from './osh'

const BUTUN: OshProduct = { id: 'butun', name: 'Osh (butun)', hissa_per_unit: 3, kg_to_hissa: 21 }
const YARIM: OshProduct = { id: 'yarim', name: 'Osh (yarim)', hissa_per_unit: 2, kg_to_hissa: 21 }
const products = [YARIM, BUTUN]

describe('initialOshHissa', () => {
  it("butun bor bo'lsa shuni oladi (smena ochish qoidasi)", () => {
    expect(initialOshHissa(products, { butun: 2, yarim: 5 })).toBe(6)
  })
  it("butun yo'q bo'lsa yarimni oladi", () => {
    expect(initialOshHissa(products, { butun: 0, yarim: 4 })).toBe(8)
  })
  it("hech narsa yo'q bo'lsa 0", () => {
    expect(initialOshHissa(products, {})).toBe(0)
  })
})

describe('summarizeOsh', () => {
  it("foydalanuvchi sinovi: butun x10 (yozuvsiz), 1 kg kirim, yarim x12, 3 hissa avto-kirim", () => {
    const s = summarizeOsh({
      products,
      initialQty: {},
      stockIns: [
        { product_id: 'butun', qty: 1, source: 'manual' },
        { product_id: 'yarim', qty: 3 / 21, source: 'auto_extra' },
      ],
      soldItems: [{ product_id: 'butun', qty: 10 }, { product_id: 'yarim', qty: 12 }],
      writeOffs: [],
      poolHissa: 0,
    })
    expect(s.kirimHissa).toBe(21)
    expect(s.kirimKg).toBe(1)
    expect(s.auto).toBe(3)
    expect(s.soldHissa).toBe(30 + 24)
    expect(s.sold.map(r => [r.name, r.qty, r.hissa])).toEqual([['Osh (butun)', 10, 30], ['Osh (yarim)', 12, 24]])
    // 21 + 3 - 54 = -30, qozon 0 -> 30 hissa yozuvsiz sotilgan
    expect(s.unexplained).toBe(30)
    expect(s.remaining).toBe(0)
  })

  it("hamma narsa yozilgan bo'lsa farq 0", () => {
    const s = summarizeOsh({
      products,
      initialQty: { butun: 2 },
      stockIns: [{ product_id: 'butun', qty: 1, source: 'manual' }],
      soldItems: [{ product_id: 'yarim', qty: 3 }],
      writeOffs: [{ product_id: 'butun', qty: 1, reason: "To'kildi" }],
      poolHissa: 6 + 21 - 6 - 3,
    })
    expect(s.initial).toBe(6)
    expect(s.writeOff).toBe(3)
    expect(s.unexplained).toBe(0)
    expect(s.remaining).toBe(18)
    expect(s.portions).toEqual([
      { id: 'butun', name: 'Osh (butun)', qty: 6 },
      { id: 'yarim', name: 'Osh (yarim)', qty: 9 },
    ])
  })

  it("smena boshidagi chiqindi chiqimga qo'shilmaydi, alohida ko'rsatiladi", () => {
    const s = summarizeOsh({
      products,
      initialQty: { butun: 1 },
      stockIns: [],
      soldItems: [],
      writeOffs: [{ product_id: 'butun', qty: 2, reason: 'Smena boshida chiqindi' }],
      poolHissa: 3,
    })
    expect(s.discarded).toBe(6)
    expect(s.writeOff).toBe(0)
    expect(s.unexplained).toBe(0)
  })

  it("osh bo'lmagan mahsulotlar e'tiborga olinmaydi", () => {
    const s = summarizeOsh({
      products,
      initialQty: {},
      stockIns: [{ product_id: 'cola', qty: 5, source: 'manual' }],
      soldItems: [{ product_id: 'cola', qty: 5 }],
      writeOffs: [],
      poolHissa: 0,
    })
    expect(s.hasActivity).toBe(false)
  })
})


describe("ko'rsatish: kg va porsiya (hissa ko'rsatilmaydi)", () => {
  it('portionLabel nomdan qisqa nom oladi', () => {
    expect(portionLabel({ id: '1', name: 'Osh (butun)' })).toBe('butun')
    expect(portionLabel({ id: '2', name: 'Osh yarim' })).toBe('yarim')
    expect(portionLabel({ id: '3', name: 'Osh' })).toBe('osh')
  })
  it('formatKg', () => {
    expect(formatKg(21, products)).toBe('1 kg')
    expect(formatKg(3, products)).toBe('0.14 kg')
    expect(formatKg(0, products)).toBe('0 kg')
    expect(formatKg(54, products)).toBe('2.57 kg')
  })
  it('formatPortions kattasidan boshlab ajratadi', () => {
    expect(formatPortions(20, products)).toBe('6 butun + 1 yarim')
    expect(formatPortions(3, products)).toBe('1 butun')
    expect(formatPortions(2, products)).toBe('1 yarim')
    expect(formatPortions(0, products)).toBe('0')
  })
  it('formatEquivalents bir xil porsiyada', () => {
    expect(formatEquivalents(21, products)).toBe('7 butun yoki 10 yarim')
    expect(formatEquivalents(0, products)).toBe('0 butun yoki 0 yarim')
  })
  it('portionsToHissa va hissaFromKg', () => {
    expect(portionsToHissa([{ product: BUTUN, qty: 5 }, { product: YARIM, qty: 4 }])).toBe(23)
    expect(hissaFromKg(1, BUTUN)).toBe(21)
    expect(hissaFromKg(0.5, BUTUN)).toBe(11)
  })
})
