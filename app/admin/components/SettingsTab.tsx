'use client'
import { useState } from 'react'
import { AlertTriangle, Download, Eye, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { backupFilename, buildBackup, downloadJson } from '@/lib/backup'
import { friendlyError } from '@/lib/errors'
import { fmt } from '@/lib/format'

type Scope = 'today' | 'all' | 'date'
type Preview = {
  shifts: number; orders: number; order_items: number; revenue: number
  stock_ins: number; write_offs: number; shift_reports: number; debtors: number; debt_payments: number
}

const CONFIRM_WORD = 'TOZALASH'
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function SettingsTab({ showToast, onPurged }: { showToast: (msg: string) => void; onPurged: () => void }) {
  const [scope, setScope] = useState<Scope>('today')
  const [dateStr, setDateStr] = useState(ymd(new Date()))
  const [includeDebtors, setIncludeDebtors] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [backedUp, setBackedUp] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'preview' | 'backup' | 'purge' | null>(null)
  const [error, setError] = useState('')

  // Tanlangan sanagacha (shu kun ham) yoki bugundan oldingi: shu vaqtdan oldin boshlangan yopiq smenalar o'chadi
  const cutoff = (): Date => {
    const today = startOfDay(new Date())
    if (scope === 'today') return today
    if (scope === 'all') return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, (m || 1) - 1, (d || 1) + 1)
  }

  const resetFlow = () => { setPreview(null); setBackedUp(false); setConfirmText(''); setError('') }

  const loadPreview = async () => {
    setBusy('preview'); setError('')
    const { data, error: e } = await supabase.rpc('purge_preview', { p_before: cutoff().toISOString(), p_include_debtors: includeDebtors })
    setBusy(null)
    if (e) { setError(friendlyError(e)); return }
    setPreview(data as Preview); setBackedUp(false); setConfirmText('')
  }

  const makeBackup = async () => {
    setBusy('backup'); setError('')
    try {
      downloadJson(backupFilename(), await buildBackup(cutoff(), includeDebtors))
      setBackedUp(true)
      showToast('Zaxira fayl yuklab olindi')
    } catch {
      setError("Zaxira yuklanmadi. Internetni tekshirib qayta urinib ko'ring. Zaxirasiz o'chirib bo'lmaydi.")
    }
    setBusy(null)
  }

  const purge = async () => {
    setBusy('purge'); setError('')
    const { data, error: e } = await supabase.rpc('purge_test_data', {
      p_owner_pin: password, p_before: cutoff().toISOString(), p_include_debtors: includeDebtors,
    })
    setBusy(null)
    if (e) { setError(friendlyError(e)); return }
    const r = data as Preview
    showToast(`Tozalandi: ${r.shifts} smena, ${r.orders} buyurtma`)
    setPassword(''); resetFlow()
    onPurged()
  }

  const empty = preview !== null && preview.shifts === 0 && preview.orders === 0 && preview.debtors === 0
  const canPurge = !!preview && !empty && backedUp && confirmText === CONFIRM_WORD && password.length > 0 && busy === null

  const field = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]'

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600"/>
          <div className="font-black text-sm text-red-700">Sinov ma&apos;lumotlarini tozalash</div>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Sinov paytida yozilgan smena, buyurtma, kirim va chiqimlarni o&apos;chiradi. <b>Menyu va xodimlar o&apos;chmaydi.</b>
            Ochiq smena hech qachon o&apos;chmaydi. O&apos;chirilgan ma&apos;lumotni qaytarib bo&apos;lmaydi, shuning uchun avval zaxira fayl yuklab olinadi.
          </p>

          <div>
            <div className="text-xs font-bold text-gray-500 mb-1.5">Qaysi smenalar o&apos;chadi</div>
            <div className="flex flex-col gap-1.5">
              {([['today', 'Bugundan oldingi yopilgan smenalar'], ['all', 'Barcha yopilgan smenalar (bugungilar ham)'], ['date', 'Tanlangan sanagacha (shu kun ham)']] as const).map(([id, label]) => (
                <label key={id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer text-sm font-bold ${scope === id ? 'border-[#C8860A] bg-[#FFF8E7]' : 'border-gray-200'}`}>
                  <input type="radio" name="purge-scope" checked={scope === id} onChange={() => { setScope(id); resetFlow() }} className="accent-[#C8860A]"/>
                  {label}
                </label>
              ))}
            </div>
            {scope === 'date' && (
              <input type="date" value={dateStr} onChange={e => { setDateStr(e.target.value); resetFlow() }} aria-label="Shu sanagacha" className={`${field} mt-2`}/>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={includeDebtors} onChange={e => { setIncludeDebtors(e.target.checked); resetFlow() }} aria-label="Qarzdorlar ro'yxatini ham tozalash" className="mt-0.5 w-5 h-5 accent-[#C8860A]"/>
            <span>
              <span className="block text-sm font-bold">Qarzdorlar ro&apos;yxatini ham tozalash</span>
              <span className="block text-[11px] text-gray-400">Faqat o&apos;chadigan buyurtmalardagi qarzdorlar o&apos;chadi; qolgan buyurtmasi borlar qoladi.</span>
            </span>
          </label>

          <button type="button" onClick={loadPreview} disabled={busy !== null}
            className="py-3 rounded-xl border-2 border-gray-200 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            <Eye size={16}/> {busy === 'preview' ? 'Hisoblanmoqda...' : "Nimalar o'chishini ko'rish"}
          </button>

          {preview && (
            <div data-testid="purge-preview" className="rounded-xl border border-red-200 bg-red-50 p-3">
              {empty ? (
                <div className="text-sm font-bold text-gray-500 text-center py-2">O&apos;chiriladigan narsa yo&apos;q</div>
              ) : (
                <>
                  <div className="text-xs font-black text-red-700 mb-2">Quyidagilar o&apos;chadi:</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-gray-600">Smenalar</span><b className="text-right">{preview.shifts} ta</b>
                    <span className="text-gray-600">Buyurtmalar</span><b className="text-right">{preview.orders} ta</b>
                    <span className="text-gray-600">Tushum (yozuvlarda)</span><b className="text-right">{fmt(Number(preview.revenue))} som</b>
                    <span className="text-gray-600">Kirimlar</span><b className="text-right">{preview.stock_ins} ta</b>
                    <span className="text-gray-600">Chiqimlar</span><b className="text-right">{preview.write_offs} ta</b>
                    {includeDebtors && <><span className="text-gray-600">Qarzdorlar</span><b className="text-right">{preview.debtors} ta</b></>}
                    {includeDebtors && <><span className="text-gray-600">Qarz to&apos;lovlari</span><b className="text-right">{preview.debt_payments} ta</b></>}
                  </div>
                </>
              )}
            </div>
          )}

          {preview && !empty && (
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
              <div>
                <div className="text-xs font-bold text-gray-500 mb-1.5">1-qadam: zaxira nusxa</div>
                <button type="button" onClick={makeBackup} disabled={busy !== null}
                  className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${backedUp ? 'bg-green-100 text-green-700' : 'bg-[#1A1208] text-[#F5C842]'}`}>
                  <Download size={16}/> {busy === 'backup' ? 'Tayyorlanmoqda...' : backedUp ? 'Zaxira yuklab olindi ✓' : 'Zaxira faylni yuklab olish'}
                </button>
                <div className="text-[11px] text-gray-400 mt-1">Faylni xavfsiz joyda saqlang: unda buyurtma va qarz ma&apos;lumotlari bor.</div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-500 mb-1.5">2-qadam: tasdiqlash</div>
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={`"${CONFIRM_WORD}" deb yozing`} aria-label="Tasdiqlash so'zi" disabled={!backedUp} className={`${field} mb-2 disabled:bg-gray-50`}/>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Rahbar paroli" aria-label="Rahbar paroli" disabled={!backedUp} className={`${field} disabled:bg-gray-50`}/>
              </div>

              <button type="button" onClick={purge} disabled={!canPurge}
                className="py-3.5 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                <Trash2 size={16}/> {busy === 'purge' ? "O'chirilmoqda..." : "Hammasini o'chirish"}
              </button>
            </div>
          )}

          {error && <div role="alert" className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</div>}
        </div>
      </div>
    </div>
  )
}
