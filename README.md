# 🍽️ EA Muruntov — Kafe POS Tizimi

> Bitta planshetda ishlaydigan takeaway kafe boshqaruv tizimi.
> Next.js + Supabase + Vercel asosida qurilgan.

---

## 🌐 Muhim havolalar

| | |
|--|--|
| **Live URL** | https://ea-muruntov-pos.vercel.app |
| **GitHub** | https://github.com/euroasiamuruntov-ux/ea-muruntov-pos |
| **Supabase** | etllsvlxtdumbwugxvia.supabase.co (Frankfurt, Free) |
| **Vercel** | ea-muruntov-s-projects (Hobby) |

---

## 👤 Kirish ma'lumotlari

| Rol | Kirish usuli | Yo'nalish |
|-----|-------------|-----------|
| Egasi / Rahbar | Parol: Supabase `users` jadvalidagi `pin` (role='owner') | `/admin` |
| Kassir | PIN: Supabase `users` jadvalidagi `pin` (role='worker') | `/cashier` |

> **Parolni o'zgartirish:** Supabase → SQL Editor:
> ```sql
> UPDATE users SET pin = 'yangi_parol' WHERE role = 'owner';
> ```

---

## 🎨 Brend

| Token | Qiymat |
|-------|--------|
| Oltin | `#C8860A` |
| Och oltin | `#F5C842` |
| Qoʻngʻir fon | `#1A1208`, `#2C200A`, `#3D2E10` |
| Yashil | `#1E7B47` |
| Qizil | `#B83232` |
| Ikonlar | Lucide React |

---

## 🧰 Stack

| Texnologiya | Versiya |
|-------------|---------|
| Next.js | 16.2.6 |
| React | 19.2.4 |
| TypeScript | ^5 |
| Tailwind CSS | ^4 |
| Supabase JS | ^2.105.4 |
| jsPDF | latest |

---

## 🗄️ Supabase jadvallari (14 ta)

```
users            — egasi va xodimlar
categories       — kategoriyalar
products         — mahsulotlar
shifts           — smenalar
shift_stock      — smena boshlangich miqdori
shift_reports    — smena yopish hisoboti (system_qty, actual_qty, diff, note)
shift_summary    — VIEW: smena moliyaviy xulosasi
osh_stock        — osh hissa hisobi
orders           — buyurtmalar (actual_paid, payment_note, debtor_id)
order_items      — buyurtma tarkibi
write_offs       — chiqimlar
stock_ins        — kirimlar
debtors          — qarzdorlar bazasi
debt_payments    — qarz tolov tarixi
```

**Muhim ustunlar:**
- `products`: `is_unlimited`, `litr_per_unit`, `unit_type`, `hissa_per_unit`, `kg_to_hissa`
- `orders`: `actual_paid`, `payment_note`, `debtor_id`, `debt_paid`

---

## 📁 Fayl strukturasi

```
ea-muruntov-pos/
├── app/
│   ├── page.tsx                    — Login (PIN + parol)
│   ├── admin/
│   │   └── page.tsx               — Rahbar paneli (mobil, iPhone)
│   └── cashier/
│       ├── page.tsx               — Kassir paneli (planshet landscape)
│       └── components/
│           └── DebtorCard.tsx     — Qarzdor kartasi
├── lib/
│   └── supabase.ts
└── README.md
```

---

## 📦 Mahsulot turlari

| Tur | Misollar | Hisob |
|-----|----------|-------|
| Chekli (dona) | Somsa, Cola, Salat | Boshlangich + Kirim - Sotilgan - Chiqim |
| Cheksiz | Mastava, Jarkoe | Taxminiy qoldiq |
| Hissa (kg) | Osh butun, Osh yarim | 1kg = 21 hissa, butun = 3h, yarim = 2h |
| Litr → stakan | Kampot | 1 stakan = 0.42L, DBda stakan saqlanadi |

---

## ✅ Barcha imkoniyatlar

### Login
- PIN orqali kassir kirishi
- Parol orqali egasi kirishi

### Kassir paneli (planshet, landscape)
- Smena yopiq holda faqat "Smena ochish" ko'rinadi
- Smena ochilganda o'tgan smena qoldiqlari ko'rsatiladi — tasdiqlash yoki o'zgartirish mumkin
- "Qoldiqsiz boshlash" — barcha o'tgan qoldiqlar chiqit sifatida yoziladi
- Kategoriya tablari bo'yicha mahsulotlar
- Chekli mahsulotlar — qoldiq ko'rsatiladi, tugaganda bosilmaydi
- Cheksiz mahsulotlar — taxminiy qoldiq
- Kampot — litrda kirim, stakanda ko'rsatiladi
- Osh — kg kirim, hissa tizimi (butun/yarim)
- Osh chiqimida osh_stock hissasi ham avtomatik ayiriladi
- 5 tagacha parallel hisob (savat)
- Moslashuvchan to'lov (±1000 so'm chegarasi)
- To'lov turlari: naqd / click / karta / qarz / ichki
- Qarz — mavjud qarzdor qidirish yoki yangi qo'shish
- Ichki iste'mol — tushum hisobiga kirmaydi
- Mahsulot kirim (kg / litr / dona)
- Mahsulot chiqim (izoh majburiy)
- Qoldiq realtime hisob (boshlangich + kirim - sotilgan - chiqim)
- Smena yopish — kassir sanaydi, farq ko'rsatiladi, izoh kiritiladi, PDF avtomatik yuklanadi
- Qarzdorlar bazasi — qidirish, to'lov tarixi, 3 turda to'lash
- Menyu boshqaruvi — kategoriya va mahsulot qo'shish, o'chirish, bor/yo'q

### Rahbar paneli (mobil, iPhone)
- **Hisobot tab:** joriy smena ma'lumoti, moliyaviy statistika, moslashuvchan to'lovlar, mahsulot hisobi (B/K/S/Ch/Q), osh qoldig'i, ichki iste'mol, chiqimlar, kirimlar, PDF yuklab olish
- **Tarix tab:** sana filtri (bugun/hafta/oy/custom), davriy umumiy statistika (qora fon), smena ro'yxati, har bir smena → moliyaviy kartochkalar + mahsulot hisoboti + izohlar va hodisalar bo'limi
- **Qarzlar tab:** barcha qarzdorlar, qidirish, to'lov tarixi, to'lash
- **Menyu tab:** kategoriya va mahsulot qo'shish/o'chirish, bor/yo'q
- **Xodim tab:** xodim qo'shish/o'chirish (PIN bilan)

---

## 💰 Shartnoma

| | |
|--|--|
| Jami | $1,300 |
| 50% oldindan | $650 ✅ olindi |
| 50% topshirishda | $650 |
| Platforma | Kassir — planshet landscape / Rahbar — iPhone |

---

---

# 📘 RAHBAR QO'LLANMASI

## Kirish

1. Telefoningizda brauzer oching (Safari yoki Chrome)
2. Manzil: **https://ea-muruntov-pos.vercel.app**
3. "Egasi" tabini bosing
4. Parolingizni kiriting va "Kirish" tugmasini bosing

> **Maslahat:** Saytni telefon ekraniga ilova sifatida qo'shing.
> Safari → "Share" (ulashish) → "Add to Home Screen" → "Add"
> Shundan keyin ilova kabi ochiladi.

---

## Hisobot tab

Sahifaga kirganingizda birinchi ko'rinadigan tab. Bu yerda joriy smena ma'lumotlari ko'rsatiladi.

**Moliyaviy kartochkalar:**
- Jami tushum — barcha to'lovlar yig'indisi
- Buyurtmalar — shu smena davomida berilgan buyurtmalar soni
- Naqd — naqd pul tushumi
- Click — Click orqali tushum
- Karta — karta orqali tushum
- Qarz — qarzga berilgan summa
- Ichki — xodim yegan taomlar soni

**Mahsulot hisobi (jadval):**
- B = Boshlangich (smena boshidagi qoldiq)
- K = Kirim (smena davomida qo'shilgan)
- S = Sotilgan
- Ch = Chiqim (yo'qolgan, buzilgan)
- Q = Qoldiq (hozir)

**PDF yuklab olish** — sahifa pastida tugma bor. Bosganda bugungi smena hisoboti PDF formatda yuklanadi.

---

## Tarix tab

O'tgan smenalarni ko'rish uchun.

**Filtr tugmalari:**
- Bugun — bugungi smenalar
- Hafta — shu haftadagi smenalar
- Oy — shu oydagi smenalar
- Muddat — siz belgilagan sanadan sanagacha

**Davriy statistika (qora fon):**
Filtr bo'yicha tanlangan davrdagi umumiy ko'rsatkichlar — jami tushum, buyurtmalar soni, to'lov turlari bo'yicha taqsimot.

**Smena ro'yxati:**
Har bir smena satriga bosing — quyidagilar ochiladi:
- Moliyaviy kartochkalar
- Mahsulot hisoboti (B/K/S/Ch/Q/Farq)
- Izohlar va hodisalar bo'limi:
  - ⚠️ Chiqimlar va sababi
  - 🍽️ Xodim ichki iste'moli
  - 🗑️ Smena boshida chiqindilar
  - 📊 Smena yopishda aniqlangan farqlar va izohi

---

## Qarzlar tab

**Qidirish:** Yuqoridagi qidiruv maydoniga ism yoki telefon raqam kiriting.

Har bir qarzdor kartasida:
- Ism va telefon
- Umumiy qarz summasi
- To'lov tarixi
- To'lash tugmasi (naqd / click / karta)

---

## Menyu tab

**Kategoriya qo'shish:**
- Nom yozing → "+" tugmasini bosing

**Kategoriya o'chirish:**
- Kategoriya yonidagi "x" ni bosing → tasdiqlang

**Mahsulot qo'shish:**
- Nom, narx va kategoriyani tanlang → "Qo'shish" tugmasini bosing

**Bor / Yo'q:**
- Mahsulot yonidagi yashil "Bor" yoki qizil "Yo'q" tugmasini bosing — kassir panelida ko'rinish o'zgaradi

**Mahsulot o'chirish:**
- "x" tugmasini bosing → tasdiqlang

---

## Xodim tab

**Yangi kassir qo'shish:**
- Ism kiriting
- 4 xonali PIN kiriting (kassir bu PIN bilan kiradi)
- "Xodim qo'shish" tugmasini bosing

**Kassirni o'chirish:**
- "x" tugmasini bosing → tasdiqlang

---

---

# 📗 KASSIR QO'LLANMASI

## Kirish

1. Planshetda brauzer oching
2. Manzil: **https://ea-muruntov-pos.vercel.app**
3. 4 xonali PIN kodingizni kiriting
4. Kassir paneli avtomatik ochiladi

---

## Smena ochish

Har kuni ishni boshlaganda smena ochish kerak.

1. Yuqori chap burchakdagi yashil/qizil soat belgisini bosing
2. "Smena ochish" tugmasini bosing
3. Agar oldingi smenada qoldiq bo'lsa — ro'yxat chiqadi:
   - Har bir mahsulotdagi qoldiq miqdorini tekshiring
   - Kerak bo'lsa o'zgartiring (masalan, 10 o'rniga 8 bo'lsa — 8 kiriting, izoh qoldiring)
   - "Tasdiqlash va smena ochish" tugmasini bosing
4. Agar qoldiq tekshirilmasa — "Qoldiqsiz boshlash" tugmasini bosing (barcha qoldiqlar chiqit sifatida yoziladi)

---

## Mahsulot sotish

1. Kerakli kategoriyani ustki qatordan tanlang
2. Mahsulot kartasini bosing — savatga qo'shiladi
3. Savat (o'ng tomonda) ko'rinadi
4. Miqdorni + / - tugmalar bilan o'zgartiring yoki raqamni bevosita kiriting
5. "Buyurtma berish" tugmasini bosing
6. To'lov turini tanlang: Naqd / Click / Karta / Qarz / Ichki
7. "Tasdiqlash" tugmasini bosing

**Bir vaqtda bir necha hisob:**
- Savat ustidagi "+" tugmasini bosib yangi hisob oching (maksimal 5 ta)
- Hisoblar orasida bosib o'ting

---

## To'lov turlari

| Tur | Qachon ishlatiladi |
|-----|-------------------|
| Naqd | Mijoz naqd pul bersa |
| Click | Click ilovasi orqali o'tkazsa |
| Karta | Bank kartasi bilan to'lasa |
| Qarz | Qarzga olsa — ism kiritiladi |
| Ichki | Xodim o'zi iste'mol qilsa (tushum hisobiga kirmaydi) |

**Moslashuvchan to'lov:**
Agar mijoz aniq summa bera olmasa (masalan, 47,500 so'm o'rniga 47,000 bersa):
- "Moslashuvchan to'lov" tugmasini bosing
- Berilgan summani kiriting
- ±1000 so'm chegarasida bo'lsa — qabul qilinadi

---

## Qarz kiritish

To'lov turida "Qarz" tanlagandan so'ng:

**Mavjud qarzdor bo'lsa:**
- Qidiruv maydoniga ism yoki telefon kiriting
- Ro'yxatdan tanlang

**Yangi qarzdor bo'lsa:**
- Qidiruv maydonini bo'sh qoldiring
- Quyidagi maydonga ism kiriting
- "Tasdiqlash" tugmasini bosing

---

## Mahsulot kirim qilish

Yangi mahsulot kelganda:

1. Yuqoridagi yashil kirim (quti+) tugmasini bosing
2. Mahsulotni tanlang
3. Miqdorni kiriting:
   - Oddiy mahsulot — dona
   - Kampot — litr (avtomatik stakanga o'giriladi)
   - Osh — kg (avtomatik hissaga o'giriladi)
4. "Kirim qilish" tugmasini bosing

---

## Mahsulot chiqim qilish

Mahsulot buzilgan, to'kilgan yoki yo'qolgan bo'lsa:

1. Yuqoridagi qizil chiqim (quti-) tugmasini bosing
2. Mahsulotni tanlang
3. Miqdorni kiriting
4. Izoh yozing (majburiy) — masalan: "Idish sinib to'kildi"
5. "Chiqim qilish" tugmasini bosing

---

## Menyu boshqaruvi

Yangi mahsulot yoki kategoriya qo'shish kerak bo'lsa:

1. Topbardagi binafsha menyu (vilka-pichoq) tugmasini bosing
2. Kategoriya yoki mahsulot qo'shing / o'chiring / bor-yo'qligini o'zgartiring

---

## Smena yopish

Ish tugaganda:

1. Yuqori chap burchakdagi soat belgisini bosing
2. "Smena yopish" tugmasini bosing
3. Hisobot oynasi ochiladi — har bir mahsulot uchun haqiqiy qoldiqni saning
4. Tizim hisobidan farq bo'lsa — sabab yozing (majburiy)
5. "Tasdiqlash va smena yopish" tugmasini bosing
6. PDF avtomatik yuklanadi — bu hisobot rahbarga topshiriladi

---

## Qarzdorlarni ko'rish

1. Yuqoridagi sariq qidiruv (luppa) tugmasini bosing
2. Ism yoki telefon orqali qidiring
3. Qarz to'lansa — "To'landi" tugmasini bosing va to'lov turini tanlang

---

## Xatolar va yechimlar

| Muammo | Yechim |
|--------|--------|
| Mahsulot bosilmayapti | Tugadi yoki "Yo'q" qilib qo'yilgan — kirim qiling yoki rahbarga xabar bering |
| Smena ochilmayapti | Internetni tekshiring |
| PIN kirmayapti | Rahbarga murojaat qiling |
| Sahifa yuklanmayapti | Brauzerni yangilang (F5) |

---

---

# 🛠️ ISHLAB CHIQUVCHI MA'LUMOTLARI

## Loyiha texnik tafsilotlari

**Arxitektura:**
- Frontend: Next.js 16 App Router, TypeScript, Tailwind CSS v4
- Backend: Supabase (PostgreSQL, Row Level Security o'chirilgan)
- Deploy: Vercel (avtomatik GitHub Push'dan)
- PDF: jsPDF (client-side, serverless)

**Muhim texnik qarorlar:**
- `smenaChiqim` (reason='Smena boshida chiqindi') va `oddiyChiqim` alohida hisoblanadi
- `realInitial = shift_stock.initial_qty + smenaChiqim` — asl boshlangich miqdor
- Osh uchun `qoldiq = r.actual_qty` (kassir kiritgan)
- `doOpenShift(customPrevStocks?)` — parametr qabul qiladi
- Savat `localStorage` da saqlanadi — refresh da yo'qolmaydi
- Smena yopilganda savat tozalanadi
- Savat `position: fixed, top: 48px` — topbar doim ko'rinadi

**shift_summary VIEW (Supabase):**
```sql
-- Bu VIEW mavjud bo'lishi shart, aks holda Tarix tab ishlamaydi
-- Ustunlar: id, opened_at, closed_at, is_open, opened_by_name, closed_by_name,
--           order_count, total_revenue, cash_revenue, click_revenue,
--           card_revenue, debt_revenue, ichki_count
SELECT * FROM shift_summary LIMIT 1;
```

## Yangilanishlar tarixi

### v1.0 — Asosiy tizim
- Login, kassir paneli, rahbar paneli
- Smena ochish/yopish, mahsulot sotish
- PDF hisobot

### v1.1 — Osh hissa tizimi
- Osh kg kirim, hissa bo'yicha hisob
- Kampot litr → stakan

### v1.2 — Moliyaviy boyitish
- Moslashuvchan to'lov (±1000 so'm)
- Qarzdorlar bazasi
- Multi-hisob (5 tagacha savat)
- Savat localStorage da saqlash

### v1.3 — Smena boshqaruvi
- O'tgan qoldiqlarni tasdiqlash oynasi
- "Qoldiqsiz boshlash" — qoldiqlar chiqit sifatida yoziladi
- Osh chiqimida osh_stock hissasi ham ayiriladi

### v1.4 — Kassir imkoniyatlari kengayishi
- Kassir panelida menyu boshqaruvi (kategoriya + mahsulot)
- Savat top: 48px — topbar doim ko'rinadi

### v1.5 — Rahbar paneli boyitildi
- Tarix tabida sana filtri (bugun/hafta/oy/custom)
- Davriy umumiy statistika (smena soni, jami tushum, to'lov turlari)
- Smena ro'yxati cheksiz (30 ta limit olib tashlandi)
- Izohlar va hodisalar bo'limi (chiqimlar, ichki iste'mol, farqlar)
- Hisobot tabidan faol qarzlar olib tashlandi (Qarzlar tabida bor)

## Keyingi ixtiyoriy funksiyalar

- [ ] Telegram bot — chiqim va smena yopilish xabari rahbarga
- [ ] Mahsulotga rasm yuklash
- [ ] Neon.tech + Vercel Pro (30+ mijoz uchun)

---

## Ishlab chiquvchi

**Zarafshon Dasturchilari**
Telegram: [@zarafshon_dasturchilari](https://t.me/zarafshon_dasturchilari)