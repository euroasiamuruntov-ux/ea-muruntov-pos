// Bazadan kelgan xatoni kassirga tushunarli o'zbekcha xabarga aylantiradi.

export type DbError = { message?: string | null; details?: string | null } | null | undefined

const NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

export function isNetworkError(err: DbError): boolean {
  return !!err?.message && NETWORK_RE.test(err.message)
}

export function friendlyError(err: DbError): string {
  if (!err) return "Noma'lum xato"
  if (isNetworkError(err)) return "Internet bilan aloqa yo'q. Savat saqlangan, aloqa tiklangach qayta urinib ko'ring."

  const name = err.details ? `"${err.details}"` : 'Mahsulot'
  switch ((err.message || '').trim()) {
    case 'STOCK_SHORT': return `${name} tugagan. Avval kirim qiling yoki savatdan olib tashlang.`
    case 'PRODUCT_UNAVAILABLE': return `${name} hozir sotuvda yo'q (Yo'q qilingan). Savatdan olib tashlang.`
    case 'PRODUCT_NOT_FOUND': return "Mahsulot topilmadi. Sahifani yangilang."
    case 'SHIFT_CLOSED': return "Smena yopilgan. Sahifani yangilab, yangi smena oching."
    case 'EMPTY_ORDER': return "Savat bo'sh."
    case 'BAD_QTY': return "Miqdor noto'g'ri."
    case 'BAD_PAY_TYPE': return "To'lov turi noto'g'ri."
    case 'DEBTOR_REQUIRED': return "Qarzga berish uchun mijoz ismini kiriting yoki tanlang."
    case 'DEBTOR_NOT_FOUND': return "Qarzdor topilmadi. Qaytadan tanlang."
    case 'ADJUST_TOO_LARGE': return "Moslashuvchan to'lov farqi 1000 so'mdan oshmasligi kerak."
    case 'REASON_REQUIRED': return "Izoh yozish majburiy."
    default: return `Xatolik: ${err.message || "noma'lum"}`
  }
}
