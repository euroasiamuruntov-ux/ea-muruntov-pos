'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { RefreshCw, WifiOff } from 'lucide-react'

// Aloqa muammosi bo'lsa ekranda tushunarli xabar chiqaradi (internet yo'q, server yoki baza ishlamayapti).
// /api/health har daqiqada tekshiriladi (bu bazani uyg'oq ham saqlaydi).
type Status = 'ok' | 'offline' | 'server' | 'db'

const MESSAGES: Record<Exclude<Status, 'ok'>, { title: string; hint: string }> = {
  offline: {
    title: "Internet yo'q",
    hint: "Savat saqlanadi. Aloqa tiklangach davom eting.",
  },
  server: {
    title: 'Server bilan aloqa yo\'q',
    hint: "Biroz kuting va qayta tekshiring. Muammo davom etsa rahbarga ayting.",
  },
  db: {
    title: 'Ma\'lumotlar bazasi javob bermayapti',
    hint: "Sotuvni hozircha yozib qo'ying. Rahbarga ayting: Supabase loyihasi to'xtab qolgan bo'lishi mumkin (panelda \"Restore project\").",
  },
}

export default function ConnectionBanner() {
  const [status, setStatus] = useState<Status>('ok')
  const [recovered, setRecovered] = useState(false)
  const previous = useRef<Status>('ok')
  const pathname = usePathname()

  const check = useCallback(async () => {
    await Promise.resolve()
    let next: Status
    if (!navigator.onLine) {
      next = 'offline'
    } else {
      try {
        const res = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        next = res.ok ? 'ok' : res.status === 503 ? 'db' : 'server'
      } catch {
        next = navigator.onLine ? 'server' : 'offline'
      }
    }
    if (previous.current !== 'ok' && next === 'ok') {
      setRecovered(true)
      window.setTimeout(() => setRecovered(false), 3000)
    }
    previous.current = next
    setStatus(next)
  }, [])

  useEffect(() => {
    const onOnline = () => { void check() }
    const onOffline = () => { previous.current = 'offline'; setStatus('offline') }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = window.setInterval(() => { if (!document.hidden) void check() }, 60_000)
    void check()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(timer)
    }
  }, [check])

  // Rahbar panelida pastki menyu bor, uning ustida ko'rsatiladi
  const bottom = pathname.startsWith('/admin') ? 'bottom-20' : 'bottom-4'

  if (status === 'ok' && !recovered) return null

  if (status === 'ok') {
    return (
      <div role="status" className={`fixed ${bottom} left-1/2 -translate-x-1/2 z-[80] bg-green-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg`}>
        Aloqa tiklandi
      </div>
    )
  }

  const m = MESSAGES[status]
  return (
    <div role="alert" data-testid="connection-banner" data-status={status}
      className={`fixed ${bottom} left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[28rem] z-[80] bg-red-600 text-white rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3`}>
      <WifiOff size={20} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-black text-sm">{m.title}</div>
        <div className="text-xs opacity-90 leading-snug mt-0.5">{m.hint}</div>
      </div>
      <button type="button" onClick={() => void check()} aria-label="Aloqani qayta tekshirish"
        className="flex-shrink-0 bg-white/20 hover:bg-white/30 rounded-xl px-3 py-2 text-xs font-black flex items-center gap-1.5">
        <RefreshCw size={13} /> Tekshirish
      </button>
    </div>
  )
}
