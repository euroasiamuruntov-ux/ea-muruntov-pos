# 🍽️ EA Muruntov — Kafe POS Tizimi

> Bitta planshetda ishlaydigan takeaway kafe boshqaruv tizimi.
> Next.js 16 + Supabase + Vercel asosida qurilgan.

---

## 🌐 Live URL

**https://ea-muruntov-pos.vercel.app**

- GitHub: https://github.com/euroasiamuruntov-ux/ea-muruntov-pos (Public)
- Supabase: etllsvlxtdumbwugxvia.supabase.co (Frankfurt, Free)
- Vercel: ea-muruntov-s-projects (Hobby plan)

---

## 🎨 Brend

- **Asosiy rang:** `#C8860A` (oltin)
- **Ochiq oltin:** `#F5C842`
- **Fon qoʻng'ir:** `#1A1208`, `#2C200A`, `#3D2E10`
- **Yashil:** `#1E7B47`
- **Qizil:** `#B83232`
- **Font:** Nunito (700, 800, 900)
- **Ikonlar:** Lucide React

---

## 🧰 Texnologiyalar

| Texnologiya | Versiya | Maqsad |
|-------------|---------|--------|
| Next.js | 16.2.6 | Frontend + API |
| React | 19.2.4 | UI |
| TypeScript | ^5 | Tip xavfsizligi |
| Tailwind CSS | ^4 | Stil |
| Supabase JS | ^2.105.4 | DB client |
| Lucide React | latest | Ikonalar |
| jsPDF | latest | PDF hisobot |
| Supabase | Free tier | PostgreSQL DB |
| Vercel | Hobby (bepul) | Hosting |

---

## 🌐 Muhit ma'lumotlari (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://etllsvlxtdumbwugxvia.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

- **GitHub username:** `euroasiamuruntov-ux`
- **Gmail:** `euroasiamuruntov@gmail.com`
- **Collaborator:** `Shohruh459`

---

## 👤 Rollar va kirish tizimi

| Rol | Kirish usuli | Yo'nalish |
|-----|-------------|-----------|
| Egasi (owner) | "Egasi" tab → parol (email yo'q) | `/admin` |
| Xodim (worker) | 4 xonali PIN kod | `/cashier` |

**Kirish ma'lumotlari:**
- Egasi parol: `6661`
- Xodim Jasur: PIN `1234`

---

## 🗄️ Supabase jadvallari

```
users          — egasi va xodimlar (role: owner | worker)
categories     — taom kategoriyalari
products       — taomlar (narx, kategoriya, mavjudlik)
shifts         — smenalar (ochilgan/yopilgan)
shift_stock    — smena boshidagi mahsulot miqdori
orders         — buyurtmalar (pay_type: naqd | click | karta | qarz)
order_items    — buyurtma tarkibi
```

---

## 📁 Loyiha strukturasi

```
ea-muruntov-pos/
├── app/
│   ├── page.tsx           ✅ Login (PIN + egasi parol)
│   ├── admin/
│   │   └── page.tsx       ✅ Admin paneli
│   ├── cashier/
│   │   └── page.tsx       ✅ Kassir paneli
│   └── layout.tsx
├── lib/
│   └── supabase.ts        ✅ Supabase client
├── .env.local             ✅ Muhit o'zgaruvchilari
└── README.md
```

---

## ✅ Bajarilgan ishlar

### Infratuzilma
- [x] Gmail: `euroasiamuruntov@gmail.com`
- [x] GitHub: `euroasiamuruntov-ux` (Public repo)
- [x] Vercel: Hobby plan, deploy qilindi
- [x] Supabase: Frankfurt, Free tier
- [x] 7 ta jadval yaratildi
- [x] Haqiqiy mahsulotlar kiritildi (chekdan, sigaretlarsiz)

### Kod
- [x] `app/page.tsx` — Login (PIN + egasi faqat parol)
- [x] `app/cashier/page.tsx` — Kassir paneli:
  - [x] Kategoriya tablari
  - [x] Katta mahsulot kartalar (landscape)
  - [x] Savat (+/- boshqaruv)
  - [x] To'lov modal (naqd/click/karta/qarz — 4 ta)
  - [x] DB ga saqlash
  - [x] Lucide ikonalar
- [x] `app/admin/page.tsx` — Admin paneli:
  - [x] Smena ochish/yopish
  - [x] Mahsulot miqdori (sklad)
  - [x] Mavjudlik belgisi (bor/yo'q)
  - [x] Kategoriya qo'shish/o'chirish
  - [x] Mahsulot qo'shish/o'chirish
  - [x] Xodim qo'shish/o'chirish + PIN
  - [x] Hisobot (naqd/click/karta/qarz statistika)
  - [x] PDF yuklab olish
  - [x] Lucide ikonalar
- [x] GitHub push ✅
- [x] Vercel deploy ✅ LIVE

---

## 🔲 Qolgan ishlar

- [ ] Mahsulotlarga rasm yuklash (admin paneldan)
- [ ] Smena yopilganda qoldiq miqdor kiritish (farq hisobi)
- [ ] Egasi o'z mahsulotlarini qo'shishi (demo video)

---

## 📦 Kategoriyalar (DB da)

1. Issiq taomlar
2. Somsa & Non
3. Shirinliklar
4. Ichimliklar
5. Sharbatlar
6. Salatlar
7. Boshqa

> ⚠️ Sigaretlar qo'shilmagan — egasi o'zi qo'shadi (demo video uchun)

---

## 🖥️ Lokal ishga tushirish

```bash
git clone https://github.com/euroasiamuruntov-ux/ea-muruntov-pos.git
cd ea-muruntov-pos
npm install
# .env.local yarating
npm run dev
```

---

## 💰 Shartnoma

- **Jami:** $1,300 (~16,640,000 so'm)
- **50% oldindan:** $650
- **50% topshirishda:** $650
- **Platform:** Planshet brauzer (landscape)

---

## 📞 Ishlab chiquvchi

**Zarafshon Dasturchilari**
Telegram: [@zarafshon_dasturchilari](https://t.me/zarafshon_dasturchilari)

---

*EA Muruntov POS — oddiy, tez, ishonchli.*