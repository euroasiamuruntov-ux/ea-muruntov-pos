# Sinash va deploy qilish tartibi

Asosiy qoida: **jonli bazaga hech qachon to'g'ridan-to'g'ri sinov qilmaymiz.** Avval lokal (Docker) bazada
sinaymiz, keyin jonliga o'tkazamiz.

## 1. Bir martalik sozlash

1. Docker Desktop'ni ishga tushiring (pastki o'ng burchakda kit belgisi "Running" bo'lguncha kuting).
2. Loyiha papkasida:
   ```
   npm install
   npm run db:start      # lokal baza (birinchi marta bir necha daqiqa, keyin tez)
   ```
3. `npm run db:start` oxirida lokal manzillar chiqadi. Foydali: Studio (bazani ko'rish) http://127.0.0.1:54323

`npm run dev` doim **lokal** bazaga ulanadi (`.env.development.local`), jonli bazaga emas.

## 2. Har bir o'zgarishdan keyin

```
npm run check
```

Bu ketma-ket bajaradi: tip tekshiruvi, mantiq testlari, baza testlari (pgTAP), brauzer testlari (Playwright).
**Bittasi qizil bo'lsa — deploy qilmaymiz.**

Alohida ishlatish:

| Buyruq | Nima tekshiradi |
|---|---|
| `npm test` | qoldiq mantig'i va xato xabarlari (sekundlarda) |
| `npm run test:db` | bazadagi funksiyalar: qoldiq, avto-kirim, qarz, takrorlanish |
| `npm run test:e2e` | haqiqiy brauzerda: kirish, smena, sotuv, rahbar sozlamasi |
| `npm run db:reset` | lokal bazani tozalab, sinov ma'lumotlarini qayta yuklaydi |

Eslatma: brauzer testlari **lokal** bazadagi smena va buyurtmalarni tozalaydi (jonli bazaga tegmaydi).
Next 16 bitta papkada faqat bitta `dev` server ishlatadi: `npm run dev` yoqilgan bo'lsa, testlar shuni ishlatadi.

Qo'lda ko'rish: `npm run dev` → http://localhost:3000. Lokal kirish: **Rahbar paroli `9999`, Kassir PIN `1234`**.

## 3. Jonli bazaga o'tkazish (tartib muhim)

Smena **yopiq** vaqtda qiling (kafe ishlamayotganda), kassirlar sahifani ochmagan bo'lsin.

1. **Zaxira.** Supabase **bepul** rejasida avtomatik zaxira yo'q (u pullik rejalarda), shuning uchun
   o'zingiz oling (Docker yoqilgan bo'lishi kerak; birinchi marta `npx supabase login` va `link` kerak):
   ```
   npx supabase db dump -f zaxira-sxema.sql
   npx supabase db dump --data-only -f zaxira-malumot.sql
   ```
   Ikkala fayl ham yaratilganini tekshiring, so'ng davom eting. Zaxirasiz davom etmang.
2. **Avval SQL (migratsiya), keyin kod.** `supabase/migrations/` ichidagi yangi fayllar eski kod bilan ham
   mos yozilgan, shuning uchun SQL ni oldin ishga tushirish xavfsiz.
   - **Faqat birinchi marta:** `20260101000000_remote_baseline.sql` jonli bazada allaqachon mavjud, uni
     "qo'llangan" deb belgilang (**faqat shu bittasini**, boshqalarni emas):
     ```
     npx supabase migration repair --status applied 20260101000000
     ```
     CLI xato xabarida uchala faylni belgilashni taklif qilishi mumkin. Buni **qilmang**: qolgan
     migratsiyalar jonli bazada hali qo'llanmagan, ularni belgilasangiz `db push` ularni o'tkazib yuboradi.
   - Qaysi migratsiyalar kutayotganini ko'rish (hech narsa o'zgarmaydi): `npx supabase db push --dry-run`
   - Qo'llash: `npx supabase db push`, yoki Supabase → SQL Editor'ga fayllarni tartib bilan nusxalab
     ishga tushiring (bu holda baseline faylni ishga tushirmang).
3. **SQL ni tekshiring** (SQL Editor):
   ```sql
   select count(*) from products where stock_mode is not null;   -- mahsulotlar soniga teng bo'lishi kerak
   select * from shift_balances('<ochiq smena id>') limit 3;     -- xatosiz qaytishi kerak
   ```
4. **Kodni deploy qiling:** o'zgarishlarni GitHub'da `main` ga qo'shing (Pull Request → Merge).
   Vercel avtomatik deploy qiladi (1-2 daqiqa).
5. **Jonli tekshiruv (5 daqiqa):** Rahbar sifatida kiring → Menyu → kerakli taomlarni **Yumshoq** qiling →
   kassir sifatida smena oching → bitta yumshoq taomni qoldiqsiz sotib ko'ring → Rahbar hisobotida
   "avto" yozuvini ko'ring → sinov buyurtmasini keyin tozalang.
6. **Orqaga qaytarish kerak bo'lsa:** Vercel → Deployments → oldingi (yashil) deploy → "Promote to Production".
   Bazani ortga qaytarish shart emas (yangi ustun va funksiyalar eski kodga xalaqit bermaydi).

## 4. Supabase loyihasi to'xtab qolsa ("project is paused")

Bepul rejada loyiha **1 hafta davomida so'rov bo'lmasa avtomatik to'xtatiladi**. To'xtatilgan loyihada
sayt ishlamaydi (kirish ham, sotuv ham), `supabase link` esa `project is paused` xatosini beradi.

- **Tiklash faqat paneldan:** https://supabase.com/dashboard/project/etllsvlxtdumbwugxvia → **Restore project**
  → 1-5 daqiqa kuting. Buyruq (CLI, ping, cron) to'xtatilgan loyihani uyg'ota **olmaydi**; ular faqat
  to'xtab qolishining *oldini* oladi.
- Bepul loyiha uzoq vaqt to'xtab tursa (taxminan 90 kun) tiklab bo'lmaydi, faqat zaxira fayl yuklab olinadi.
  Shuning uchun to'xtatilganini sezgach darrov tiklang.
- **Oldini olish:** [vercel.json](../vercel.json) kuniga bir marta `/api/health` ni chaqiradi, u bazaga oddiy
  so'rov yuboradi. Bu faqat sayt Vercel'da ishlab turganda ishlaydi, shuning uchun deploydan keyin
  Vercel → Project → Settings → Cron Jobs bo'limida yoqilganini tekshiring.
- **Xabar olish:** UptimeRobot'da (bepul) `https://ea-muruntov-pos.vercel.app/api/health` ni 5 daqiqada bir
  tekshiradigan monitor oching. `{"ok":true}` kelmasa (503) sizga Telegram/email xabar boradi.
- Kafe ishlayotgan bo'lsa, ishonchli yechim — Supabase pullik reja (to'xtatilmaydi, zaxira bor).
- Supabase shartlari (7 kun, 90 kun, zaxira) o'zgarib turadi; amaldagisini Supabase → Billing / Pricing
  sahifasidan tekshiring.

## 5. Diqqat

- **Vercel "Preview" deploylari jonli bazaga ulanadi** (bir xil o'zgaruvchilar). Shuning uchun sinovni
  Preview'da emas, lokal bazada qiling. Kelajakda alohida sinov Supabase loyihasi ochish mumkin.
- Kalitlarni (`.env.local`, `SUPABASE_SECRET_KEY`) hech qachon GitHub'ga yubormang. `.env*` fayllar
  `.gitignore` da.
- Sxema o'zgarishi faqat `supabase/migrations/` ga yangi fayl qo'shish orqali qilinadi (eski fayllar
  tahrirlanmaydi). Fayl nomi sana bilan boshlanadi: `YYYYMMDDHHMMSS_nom.sql`.
- `20260101000000_remote_baseline.sql` — jonli bazaning haqiqiy sxemasi (2026-10-25 da `db dump` bilan olingan).
  Tahrirlanmaydi. Jonli sxema keyinchalik qo'lda o'zgartirilgan bo'lsa, `npx supabase db diff --linked`
  bilan farqni ko'ring.
