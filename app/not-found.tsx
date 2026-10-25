import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#1A1208] flex items-center justify-center p-6">
      <div className="bg-[#2C200A] border border-[#3D2E10] rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h1 className="text-[#F5C842] font-black text-lg mb-2">Sahifa topilmadi</h1>
        <p className="text-gray-400 text-sm mb-6">Manzil noto&apos;g&apos;ri yoki sahifa o&apos;chirilgan.</p>
        <Link href="/" className="block w-full py-3 rounded-xl bg-[#C8860A] text-[#1A1208] font-black text-sm">Bosh sahifaga</Link>
      </div>
    </div>
  )
}
