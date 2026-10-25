import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Tizim sog'lig'i: sayt ishlayaptimi va baza javob beryaptimi.
//
// 1) Vercel cron (vercel.json) kuniga bir marta chaqiradi. Supabase bepul loyihasi 1 hafta
//    faoliyatsiz qolsa to'xtatiladi (pause); shu so'rov buning oldini oladi.
//    DIQQAT: allaqachon to'xtatilgan loyihani bu so'rov uyg'ota OLMAYDI, uni faqat
//    Supabase paneldan "Restore project" bilan tiklash mumkin.
// 2) Tashqi monitoring (masalan UptimeRobot) shu manzilni tekshirib, 503 bo'lsa egasiga xabar beradi.
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const started = Date.now()
  try {
    const { error } = await supabase
      .from('categories')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(8000))
    if (error) throw error
    return Response.json({ ok: true, ms: Date.now() - started }, { headers: NO_STORE })
  } catch {
    // Ichki xato tafsilotlarini tashqariga chiqarmaymiz
    return Response.json({ ok: false, error: 'db_unreachable' }, { status: 503, headers: NO_STORE })
  }
}
