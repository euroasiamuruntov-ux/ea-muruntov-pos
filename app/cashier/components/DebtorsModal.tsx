'use client'
import { useState } from 'react'
import { Search } from 'lucide-react'
import Modal from '@/components/Modal'
import { matchesQuery } from '@/lib/search'
import type { Debtor, Product } from '@/lib/types'
import DebtorCard from './DebtorCard'

// Qarzdorlar ro'yxati: qidirish, to'lov tarixi, qarz to'lash
export default function DebtorsModal({
  debtors, products, onUpdate, onClose,
}: { debtors: Debtor[]; products: Product[]; onUpdate: (id: string, newDebt: number) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const found = debtors.filter(d => matchesQuery(d.name, search) || (d.phone || '').includes(search.trim()))

  return (
    <Modal title="Qarzdorlar" variant="center" onClose={onClose}>
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
          <input type="text" placeholder="Ism yoki telefon..." aria-label="Qarzdor qidirish" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
        </div>
      </div>
      {found.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-300"><div className="text-3xl mb-2">🔍</div><div className="text-sm font-bold">Topilmadi</div></div>
      ) : found.map(d => <DebtorCard key={d.id} debtor={d} products={products} onUpdate={onUpdate}/>)}
    </Modal>
  )
}
