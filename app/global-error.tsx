'use client'

// Eng yuqori darajadagi xato (umumiy maket yiqilsa). O'z <html> va <body> ini chizadi,
// shuning uchun stillar ichida yozilgan.
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="uz">
      <body style={{ margin: 0, minHeight: '100vh', background: '#1A1208', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <title>EA Muruntov POS - xatolik</title>
        <div role="alert" style={{ background: '#2C200A', border: '1px solid #3D2E10', borderRadius: 16, padding: 32, maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ color: '#F5C842', fontSize: 18, fontWeight: 900, margin: '0 0 8px' }}>Tizimda nosozlik</h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 24px' }}>
            Sahifani qayta yuklab ko&apos;ring. Muammo davom etsa, rahbarga ayting.
          </p>
          <button type="button" onClick={() => unstable_retry()}
            style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: '#C8860A', color: '#1A1208', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  )
}
