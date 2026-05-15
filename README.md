# 🍽️ EA Muruntov — Kafe POS Tizimi

> Bitta planshetda ishlaydigan takeaway kafe boshqaruv tizimi.
> Next.js 16 + Supabase + Vercel asosida qurilgan.

---

## 🎨 Brend

- **Asosiy rang:** `#C8860A` (oltin)
- **Ochiq oltin:** `#F5C842`
- **Fon qoʻng'ir:** `#1A1208`, `#2C200A`, `#3D2E10`
- **Yashil (muvaffaqiyat):** `#1E7B47`
- **Qizil (xato/qarz):** `#B83232`
- **Font:** Nunito (700, 800, 900)

---

## 🧰 Texnologiyalar

| Texnologiya | Versiya | Maqsad |
|-------------|---------|--------|
| Next.js | 16.2.6 | Frontend + API |
| React | 19.2.4 | UI |
| TypeScript | ^5 | Tip xavfsizligi |
| Tailwind CSS | ^4 | Stil |
| Supabase JS | ^2.105.4 | DB client |
| Supabase | Free tier | PostgreSQL DB |
| Vercel | Hobby (bepul) | Hosting |

---

## 🌐 Muhit ma'lumotlari

```env
NEXT_PUBLIC_SUPABASE_URL=https://etllsvlxtdumbwugxvia.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

- **Supabase region:** Central EU (Frankfurt) `eu-central-1`
- **Supabase org:** `ea-muruntov-pos` (FREE)
- **GitHub account:** mijoz Gmail bilan ochilgan
- **Vercel account:** mijoz GitHub orqali (Hobby plan)

---

## 👤 Rollar va kirish tizimi

| Rol | Kirish usuli | Yo'nalish |
|-----|-------------|-----------|
| Egasi (owner) | Email + parol (PIN maydonida) | `/admin` |
| Xodim (worker) | 4 xonali PIN kod | `/cashier` |

**Test ma'lumotlar:**
- Egasi: `euroasiamuruntov@gmail.com` / parol: `6661`
- Xodim: Jasur — PIN: `1234`

---

## 🗄️ Supabase jadvallari

```
users          — egasi va xodimlar (role: owner | worker)
categories     — taom kategoriyalari
products       — taomlar (narx, kategoriya, mavjudlik)
shifts         — smenalar (ochilgan/yopilgan)
shift_stock    — smena boshidagi mahsulot miqdori
orders         — buyurtmalar (pay_type: naqd | karta | qarz)
order_items    — buyurtma tarkibi
```

---

## 📁 Loyiha strukturasi

```
ea-muruntov-pos/
├── app/
│   ├── page.tsx          ✅ Login sahifasi (PIN + egasi)
│   ├── admin/            🔲 Admin panel
│   │   └── page.tsx
│   ├── cashier/          🔲 Kassir panel
│   │   └── page.tsx
│   └── layout.tsx
├── lib/
│   └── supabase.ts       ✅ Supabase client
├── .env.local            ✅ Muhit o'zgaruvchilari
└── README.md
```

---

## ✅ Bajarilgan ishlar

### Infratuzilma
- [x] Gmail ochildi (mijoz uchun): `euroasiamuruntov@gmail.com`
- [x] GitHub ochildi (mijoz Gmail bilan)
- [x] Vercel ochildi (GitHub orqali, Hobby plan)
- [x] Supabase ochildi (Frankfurt, Free tier)
- [x] Supabase jadvallari yaratildi (7 ta)
- [x] Test ma'lumotlar kiritildi (egasi + xodim + kategoriyalar)

### Kod
- [x] Next.js 16 loyihasi yaratildi
- [x] Supabase JS o'rnatildi
- [x] `lib/supabase.ts` — Supabase client
- [x] `.env.local` — API kalitlar
- [x] `app/page.tsx` — Login sahifasi (PIN + egasi kirishi, DB bilan ulangan)

---

## 🔲 Keyingi ishlar (navbat bo'yicha)

### 1. Kassir paneli `/cashier`
- [ ] Kategoriya tablari
- [ ] Mahsulot kartalar (katta, landscape planshet uchun)
- [ ] Savat (o'ng panel)
- [ ] To'lov modal (naqd/karta/qarz)
- [ ] Ochiq hisoblar
- [ ] Qarzdorlar

### 2. Admin paneli `/admin`
- [ ] Smena ochish/yopish
- [ ] Mahsulot miqdori kiritish (smena boshi)
- [ ] Mavjudlik belgisi (bor/yo'q)
- [ ] Kategoriya qo'shish
- [ ] Taom qo'shish
- [ ] Xodim qo'shish + PIN berish
- [ ] Kunlik hisobot
- [ ] PDF yuborish (link)

### 3. Deploy
- [ ] GitHub'ga push
- [ ] Vercel'ga ulash
- [ ] Environment variables qo'shish

---

## 🖥️ Ishga tushirish

```bash
git clone https://github.com/...ea-muruntov-pos.git
cd ea-muruntov-pos
npm install
# .env.local faylini yarating (yuqoridagi kalitlar bilan)
npm run dev
```

---

## 💰 Loyiha narxi va shartnoma

- **Jami narx:** $1,300 (~16,640,000 so'm)
- **50% oldindan:** $650
- **50% topshirishda:** $650
- **Muddat:** 2–3 hafta
- **Platform:** Planshet brauzer (landscape rejim)

---

## 📞 Ishlab chiquvchi

**Zarafshon Dasturchilari**
Telegram: [@zarafshon_dasturchilari](https://t.me/zarafshon_dasturchilari)

---

*EA Muruntov POS — oddiy, tez, ishonchli.*