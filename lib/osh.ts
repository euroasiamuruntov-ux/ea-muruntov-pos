import { isStartDiscard } from './discard'

// Osh hisobi. Butun va yarim osh BITTA umumiy qozondan olinadi (hissa bilan hisoblanadi),
// shuning uchun hisobotda ularni alohida mahsulot qatorlari sifatida emas, bitta qozon sifatida
// ko'rsatamiz: boshlang'ich + kirim + avto-kirim - sotildi - chiqim = qoldiq.

export type OshProduct = { id: string; name: string; hissa_per_unit?: number | null; kg_to_hissa?: number | null }

export type OshSummary = {
  /** Smena boshidagi qozon (hissa), boshida tashlangani ayrilgan */
  initial: number
  /** Smena boshida tashlangan (ma'lumot uchun, hisobga kirmaydi) */
  discarded: number
  /** Qo'lda kirim */
  kirimHissa: number
  kirimKg: number
  /** Sotuv paytida tizimda yetmagan, avtomatik yozilgan kirim */
  auto: number
  sold: { id: string; name: string; qty: number; hissa: number }[]
  soldHissa: number
  /** Chiqim (to'kildi, buzildi...) */
  writeOff: number
  /** Hozirgi qozon (hissa) */
  remaining: number
  /** Qoldiq nechta butun/yarim porsiyaga yetadi */
  portions: { id: string; name: string; qty: number }[]
  /** Hisobga olinmagan farq: 0 bo'lsa raqamlar mos; musbat bo'lsa shuncha hissa yozuvsiz sotilgan */
  unexplained: number
  /** Hisobotda ko'rsatishga arziydimi */
  hasActivity: boolean
}

const hps = (p: OshProduct) => p.hissa_per_unit || 1
const kgHissa = (p: OshProduct) => p.kg_to_hissa || 21

/** Smena ochilganda qozon qanday boshlanadi: eng katta porsiyali (butun) bor bo'lsa shu, bo'lmasa keyingisi */
export function initialOshHissa(products: OshProduct[], initialQty: Record<string, number>): number {
  const bySize = [...products].sort((a, b) => hps(b) - hps(a))
  for (const p of bySize) {
    const qty = initialQty[p.id] || 0
    if (qty > 0) return qty * hps(p)
  }
  return 0
}

export function summarizeOsh(input: {
  products: OshProduct[]
  initialQty: Record<string, number>
  stockIns: { product_id: string; qty: number; source?: string | null }[]
  soldItems: { product_id: string; qty: number }[]
  writeOffs: { product_id: string; qty: number; reason: string }[]
  poolHissa: number
}): OshSummary {
  const { products, initialQty, stockIns, soldItems, writeOffs, poolHissa } = input
  const byId = new Map(products.map(p => [p.id, p]))
  const mine = <T extends { product_id: string }>(rows: T[]) => rows.filter(r => byId.has(r.product_id))

  let kirimHissa = 0
  let kirimKg = 0
  let auto = 0
  for (const si of mine(stockIns)) {
    const hissa = Math.round(Number(si.qty) * kgHissa(byId.get(si.product_id)!))
    if (si.source === 'auto_extra') auto += hissa
    else { kirimHissa += hissa; kirimKg += Number(si.qty) }
  }

  // Ko'rsatishda katta porsiya (butun) birinchi
  const ordered = [...products].sort((a, b) => hps(b) - hps(a))
  const sold = ordered
    .map(p => {
      const qty = mine(soldItems).filter(i => i.product_id === p.id).reduce((s, i) => s + Number(i.qty), 0)
      return { id: p.id, name: p.name, qty, hissa: qty * hps(p) }
    })
    .filter(s => s.qty > 0)
  const soldHissa = sold.reduce((s, r) => s + r.hissa, 0)

  let writeOff = 0
  let discarded = 0
  for (const w of mine(writeOffs)) {
    const hissa = Number(w.qty) * hps(byId.get(w.product_id)!)
    if (isStartDiscard(w.reason)) discarded += hissa
    else writeOff += hissa
  }

  const initial = initialOshHissa(products, initialQty)
  const remaining = poolHissa
  const expected = initial + kirimHissa + auto - soldHissa - writeOff

  return {
    initial,
    discarded,
    kirimHissa,
    kirimKg,
    auto,
    sold,
    soldHissa,
    writeOff,
    remaining,
    portions: ordered.map(p => ({ id: p.id, name: p.name, qty: Math.floor(remaining / hps(p)) })),
    unexplained: remaining - expected,
    hasActivity: initial > 0 || discarded > 0 || kirimHissa > 0 || auto > 0 || soldHissa > 0 || writeOff > 0 || remaining > 0,
  }
}

// ---------------------------------------------------------------------------
// Ko'rsatish: foydalanuvchiga "hissa" ko'rsatilmaydi, faqat kg va porsiya (butun/yarim)
// ---------------------------------------------------------------------------

const bySizeDesc = (products: OshProduct[]) => [...products].sort((a, b) => hps(b) - hps(a))

/** "Osh (butun)" -> "butun", "Osh yarim" -> "yarim" */
export function portionLabel(p: OshProduct): string {
  const short = p.name.replace(/osh/gi, '').replace(/[()]/g, '').trim().toLowerCase()
  return short || p.name.toLowerCase()
}

export function kgOfHissa(hissa: number, products: OshProduct[]): number {
  return hissa / (products.length ? kgHissa(products[0]) : 21)
}

/** 21 -> "1 kg", 3 -> "0.14 kg" */
export function formatKg(hissa: number, products: OshProduct[]): string {
  return `${Number(kgOfHissa(hissa, products).toFixed(2))} kg`
}

/** Porsiyalarga ajratadi: 20 -> "6 butun + 1 yarim" (kattasidan boshlab) */
export function formatPortions(hissa: number, products: OshProduct[]): string {
  let rest = Math.round(hissa)
  const parts: string[] = []
  for (const p of bySizeDesc(products)) {
    const n = Math.floor(rest / hps(p))
    if (n > 0) { parts.push(`${n} ${portionLabel(p)}`); rest -= n * hps(p) }
  }
  return parts.length ? parts.join(' + ') : '0'
}

/** Faqat bir xil porsiyada: 21 -> "7 butun yoki 10 yarim" */
export function formatEquivalents(hissa: number, products: OshProduct[]): string {
  return bySizeDesc(products).map(p => `${Math.floor(hissa / hps(p))} ${portionLabel(p)}`).join(' yoki ')
}

/** Porsiya sonlaridan hissa: [{product, qty}] */
export function portionsToHissa(items: { product: OshProduct; qty: number }[]): number {
  return items.reduce((s, i) => s + i.qty * hps(i.product), 0)
}

/** Kg dan hissa (kirim oynasidagi ko'rinish uchun) */
export function hissaFromKg(kg: number, product: OshProduct): number {
  return Math.round(kg * kgHissa(product))
}
