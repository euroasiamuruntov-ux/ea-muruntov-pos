'use client'
import { useEffect } from 'react'
import { clearStoredUser } from '@/lib/session'

// Sahifada kutilmagan xato bo'lsa oq ekran o'rniga tushunarli xabar ko'rsatiladi
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="min-h-screen bg-[#1A1208] flex items-center justify-center p-6">
      <div role="alert" className="bg-[#2C200A] border border-[#3D2E10] rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-[#F5C842] font-black text-lg mb-2">Nimadir xato ketdi</h1>
        <p className="text-gray-400 text-sm mb-6">
          Sahifani qayta yuklab ko&apos;ring. Savatdagi mahsulotlar saqlanib qoladi.
          Muammo takrorlansa, rahbarga ayting.
        </p>
        <button type="button" onClick={() => unstable_retry()}
          className="w-full py-3 rounded-xl bg-[#C8860A] text-[#1A1208] font-black text-sm mb-3">Qayta urinish</button>
        <button type="button" onClick={() => { clearStoredUser(); window.location.href = '/' }}
          className="w-full py-3 rounded-xl border border-[#3D2E10] text-gray-400 font-bold text-sm">Boshidan kirish</button>
        {error.digest && <div className="text-[10px] text-gray-600 mt-4">Xato kodi: {error.digest}</div>}
      </div>
    </div>
  )
}
