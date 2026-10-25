import { supabase } from './supabase'

// O'chirishdan oldin zaxira: o'chiriladigan ma'lumotlar JSON fayl sifatida yuklab olinadi.
// Supabase bir so'rovda ko'pi bilan 1000 qator qaytaradi, shuning uchun sahifalab olinadi.
const PAGE = 1000
const CHUNK = 50

type Result = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
type Row = Record<string, unknown>

async function fetchPages(build: (from: number, to: number) => Result): Promise<Row[]> {
  const all: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all.push(...((data || []) as Row[]))
    if (!data || data.length < PAGE) break
  }
  return all
}

export async function buildBackup(before: Date, includeDebtors: boolean) {
  const shifts = await fetchPages((f, t) =>
    supabase.from('shifts').select('*').eq('is_open', false).lt('opened_at', before.toISOString()).order('opened_at').range(f, t))
  const ids = shifts.map(s => String(s.id))

  const byShift = async (table: string, select = '*') => {
    const rows: Row[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      rows.push(...await fetchPages((f, t) => supabase.from(table).select(select).in('shift_id', chunk).range(f, t)))
    }
    return rows
  }

  const backup: Record<string, unknown> = {
    app: 'ea-muruntov-pos',
    created_at: new Date().toISOString(),
    before: before.toISOString(),
    shifts,
    orders: await byShift('orders', '*, order_items(*)'),
    stock_ins: await byShift('stock_ins'),
    write_offs: await byShift('write_offs'),
    shift_stock: await byShift('shift_stock'),
    shift_reports: await byShift('shift_reports'),
    osh_stock: await byShift('osh_stock'),
  }
  if (includeDebtors) {
    backup.debtors = await fetchPages((f, t) => supabase.from('debtors').select('*').range(f, t))
    backup.debt_payments = await fetchPages((f, t) => supabase.from('debt_payments').select('*').range(f, t))
  }
  return backup
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const backupFilename = () => `zaxira-${new Date().toISOString().slice(0, 10)}.json`
