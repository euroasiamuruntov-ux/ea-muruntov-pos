'use client'
import { formatEquivalents, formatKg, formatPortions, portionLabel, type OshProduct, type OshSummary } from '@/lib/osh'

// Osh hisobi: butun va yarim bitta qozondan olinadi, shuning uchun bitta karta.
// Foydalanuvchiga hissa ko'rsatilmaydi: kg va porsiya (butun/yarim) bilan yoziladi.
export default function OshCard({ summary: s, products }: { summary: OshSummary; products: OshProduct[] }) {
  const kg = (h: number) => formatKg(h, products)
  const labelOf = (id: string) => {
    const p = products.find(x => x.id === id)
    return p ? portionLabel(p) : ''
  }

  const rows = [
    {
      label: "Boshlang'ich", val: kg(s.initial), color: '#6b7280',
      note: [s.initial > 0 ? formatPortions(s.initial, products) : '', s.discarded > 0 ? `${formatPortions(s.discarded, products)} smena boshida tashlangan` : ''].filter(Boolean).join(' · '),
    },
    { label: 'Kirim', val: s.kirimHissa > 0 ? `+${kg(s.kirimHissa)}` : '—', color: '#16a34a', note: s.kirimHissa > 0 ? `= ${formatEquivalents(s.kirimHissa, products)}` : '' },
    {
      label: 'Avto-kirim', val: s.auto > 0 ? `+${kg(s.auto)}` : '—', color: '#d97706',
      note: s.auto > 0 ? `= ${formatEquivalents(s.auto, products)} · oshpaz yozilganidan ko'p qilgan (tizimda yo'q edi)` : '',
    },
    { label: 'Sotildi', val: s.soldHissa > 0 ? `-${kg(s.soldHissa)}` : '—', color: '#C8860A', note: s.sold.map(x => `${x.qty} ${labelOf(x.id)}`).join(' + ') },
    { label: 'Chiqim', val: s.writeOff > 0 ? `-${kg(s.writeOff)}` : '—', color: '#ef4444', note: s.writeOff > 0 ? formatPortions(s.writeOff, products) : '' },
  ]

  return (
    <div data-testid="osh-card" style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
      <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6'}}>
        <div style={{fontWeight:900, fontSize:'14px'}}>Osh (umumiy qozon)</div>
        <div style={{fontSize:'11px', color:'#9ca3af', marginTop:'2px'}}>Butun va yarim bitta qozondan olinadi. Hisob kg va porsiyada</div>
      </div>
      <div style={{padding:'8px 16px'}}>
        {rows.map(r => (
          <div key={r.label} style={{display:'flex', alignItems:'baseline', gap:'8px', padding:'6px 0', borderBottom:'1px solid #f9fafb', fontSize:'13px'}}>
            <div style={{width:'92px', color:'#6b7280', fontWeight:700, flexShrink:0}}>{r.label}</div>
            <div style={{width:'76px', textAlign:'right', fontWeight:900, color:r.color, flexShrink:0}}>{r.val}</div>
            <div style={{flex:1, fontSize:'11px', color:'#9ca3af'}}>{r.note}</div>
          </div>
        ))}
        <div style={{display:'flex', alignItems:'baseline', gap:'8px', padding:'10px 0 6px', fontSize:'14px'}}>
          <div style={{width:'92px', fontWeight:900}}>Qoldiq</div>
          <div style={{width:'76px', textAlign:'right', fontWeight:900, color:'#1A1208', flexShrink:0}}>{kg(s.remaining)}</div>
          <div style={{flex:1, fontSize:'11px', color:'#6b7280'}}>= {formatEquivalents(s.remaining, products)}</div>
        </div>
        {s.unexplained !== 0 && (
          <div style={{marginTop:'4px', marginBottom:'8px', backgroundColor:'#fffbeb', border:'1px solid #fde68a', borderRadius:'10px', padding:'8px 10px', fontSize:'11px', color:'#92400e', lineHeight:1.5}}>
            {s.unexplained > 0
              ? `${kg(s.unexplained)} (${formatPortions(s.unexplained, products)}) tizimga yozilmagan holda sotilgan (osh "Cheksiz" rejimida bo'lganda yoki kirim kiritilishidan oldin). Qozonda bor edi, tizimda yo'q edi.`
              : `Tizimdagi qoldiq hisoblanganidan ${kg(-s.unexplained)} (${formatPortions(-s.unexplained, products)}) kam: yozilmagan chiqim bo'lishi mumkin.`}
          </div>
        )}
      </div>
    </div>
  )
}
