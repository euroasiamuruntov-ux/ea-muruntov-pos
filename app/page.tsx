'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, User } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'pin' | 'owner'>('pin')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePin = async (val: string) => {
    const newPin = pin + val
    setPin(newPin)
    if (newPin.length < 4) return
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('pin', newPin)
      .eq('role', 'worker')
      .single()
    if (error || !data) {
      setError("Noto'g'ri kod!")
      setPin('')
    } else {
      localStorage.setItem('pos_user', JSON.stringify(data))
      router.push('/cashier')
    }
    setLoading(false)
  }

  const handleOwner = async () => {
  setLoading(true)
  setError('')
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('pin', password)
    .eq('role', 'owner')
    .single()
  if (error || !data) {
    setError("Noto'g'ri parol!")
  } else {
    localStorage.setItem('pos_user', JSON.stringify(data))
    router.push('/admin')
  }
  setLoading(false)
}

  const dots = [0,1,2,3]

  return (
    <div className="min-h-screen bg-[#1A1208] flex items-center justify-center p-4">
      <div className="bg-[#2C200A] border border-[#3D2E10] rounded-2xl p-8 w-full max-w-sm">
        
        <div className="text-center mb-8">
          <div className="text-4xl font-black text-[#F5C842] tracking-widest">EA</div>
          <div className="text-xs text-gray-500 tracking-[4px] mt-1">MURUNTOV · POS</div>
        </div>

        {/* Tablar */}
        <div className="flex bg-[#3D2E10] rounded-xl p-1 mb-6 gap-1">
          <button
            onClick={() => { setTab('pin'); setPin(''); setError('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'pin' ? 'bg-[#C8860A] text-[#1A1208]' : 'text-gray-400'}`}
          >
            Xodim kodi
          </button>
          <button
            onClick={() => { setTab('owner'); setPin(''); setError('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'owner' ? 'bg-[#C8860A] text-[#1A1208]' : 'text-gray-400'}`}
          >
            Egasi
          </button>
        </div>

        {tab === 'pin' ? (
          <>
            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-6">
              {dots.map(i => (
                <div key={i} className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${i < pin.length ? 'bg-[#C8860A]/20 border-2 border-[#C8860A] text-[#F5C842]' : 'bg-[#3D2E10] border-2 border-[#3D2E10]'}`}>
                  {i < pin.length ? '●' : ''}
                </div>
              ))}
            </div>

            {/* Pinpad */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {['1','2','3','4','5','6','7','8','9'].map(n => (
                <button key={n} onClick={() => pin.length < 4 && handlePin(n)}
                  className="py-4 rounded-xl bg-[#3D2E10] text-[#F5C842] text-xl font-bold hover:bg-[#4D3E1A] transition-all">
                  {n}
                </button>
              ))}
              <div />
              <button onClick={() => pin.length < 4 && handlePin('0')}
                className="py-4 rounded-xl bg-[#3D2E10] text-[#F5C842] text-xl font-bold hover:bg-[#4D3E1A] transition-all">
                0
              </button>
              <button onClick={() => setPin(p => p.slice(0, -1))}
                className="py-4 rounded-xl bg-[#3D2E10] text-gray-400 text-sm font-bold hover:bg-[#4D3E1A] transition-all">
                ⌫
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3 mb-4">
  <div className="relative">
    <Lock className="absolute left-3 top-3 text-gray-600" size={18}/>
    <input
      type="password"
      placeholder="Parol"
      value={password}
      onChange={e => setPassword(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && handleOwner()}
      className="w-full bg-[#3D2E10] border border-[#3D2E10] rounded-xl pl-10 pr-4 py-3 text-[#F5C842] placeholder-gray-600 outline-none focus:border-[#C8860A] text-sm"
    />
  </div>
  <button
    onClick={handleOwner}
    disabled={loading}
    className="w-full py-3 bg-[#C8860A] text-[#1A1208] rounded-xl font-bold text-sm hover:bg-[#F5C842] transition-all disabled:opacity-50"
  >
    {loading ? 'Kirish...' : 'Kirish'}
  </button>
</div>
        )}

        {error && <p className="text-red-400 text-xs text-center mt-2">{error}</p>}
        {loading && tab === 'pin' && <p className="text-gray-500 text-xs text-center mt-2">Tekshirilmoqda...</p>}
      </div>
    </div>
  )
}