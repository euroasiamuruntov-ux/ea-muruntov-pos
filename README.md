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
| Vercel | Hobby (bepul) | Hosting |

---

## 🌐 Muhit (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://etllsvlxtdumbwugxvia.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

- **GitHub:** `euroasiamuruntov-ux` (collaborator: Shohruh459)
- **Gmail:** `euroasiamuruntov@gmail.com`

---

## 👤 Rollar

| Rol | Kirish | Yo'nalish |
|-----|--------|-----------|
| Egasi | Parol | `/admin` |
| Xodim | 4 xonali PIN | `/cashier` |

**Test:**
- Egasi parol: `6661`
- Xodim Jasur: PIN `1234`

---

## 🗄️ Supabase jadvallari (9 ta)

```
users          — egasi va xodimlar
categories     — kategoriyalar
products       — mahsulotlar
shifts         — smenalar (opened_by, closed_by)
shift_stock    — smena boshidagi miqdor
orders         — buyurtmalar (naqd|click|karta|qarz|ichki)
order_items    — buyurtma tarkibi
write_offs     — chiqimlar (sabab bilan)
stock_ins      — kirimlar
```

---

## 📁 Loyiha strukturasi

```
ea-muruntov-pos/
├── app/
│   ├── page.tsx           ✅ Login
│   ├── admin/
│   │   └── page.tsx       ✅ Admin paneli
│   ├── cashier/
│   │   └── page.tsx       ✅ Kassir paneli
│   └── layout.tsx
├── lib/
│   ├── supabase.ts        ✅ Supabase client
│   └── trial.ts           ✅ Trial timer (24s/3x/10min)
└── README.md
```

---

## ✅ Bajarilgan ishlar

### Infratuzilma
- [x] Gmail, GitHub, Vercel, Supabase sozlandi
- [x] 9 ta jadval yaratildi
- [x] Haqiqiy mahsulotlar kiritildi (chekdan, sigaretlarsiz)

### Login (`app/page.tsx`)
- [x] Egasi — parol bilan (email yo'q)
- [x] Xodim — 4 xonali PIN
- [x] Trial timer tekshiruvi (limit bo'lsa xato)

### Kassir paneli (`app/cashier/page.tsx`)
- [x] Smena ochish/yopish (kassir tomonidan)
- [x] Kategoriya tablari
- [x] Katta mahsulot kartalar (landscape)
- [x] Multi-hisob (5 tagacha parallel)
- [x] Savat (+/- boshqaruv)
- [x] To'lov: naqd / click / karta / qarz / ichki
- [x] Ichki iste'mol (tushum hisobiga kirmaydi)
- [x] Mahsulot kirim moduli
- [x] Mahsulot chiqim moduli (izoh bilan)
- [x] Trial timer (topbarda countdown)
- [x] DB ga saqlash

### Admin paneli (`app/admin/page.tsx`)
- [x] Smena holati ko'rish
- [x] Mahsulot miqdori (sklad)
- [x] Mavjudlik belgisi (bor/yo'q)
- [x] Kategoriya qo'shish/o'chirish
- [x] Mahsulot qo'shish/o'chirish
- [x] Xodim qo'shish/o'chirish + PIN
- [x] Hisobot (naqd/click/karta/qarz/ichki)
- [x] Qarzdorlar + yopish
- [x] PDF yuklab olish

### Trial tizimi (`lib/trial.ts`)
- [x] 24 soat ichida 3 marta
- [x] Har sessiya 10 daqiqa
- [x] Tugagach login sahifasiga qaytarish
- [x] `disableTrial()` — to'lov olgach o'chirish

---

## 🔲 Keyingi ishlar (2-bosqich)

### Rahbar kengaytirilgan hisoboti
- [ ] Smena: kim ochdi, kim yopdi, soat
- [ ] Kirimlar ro'yxati (kim, nima, qancha)
- [ ] Chiqimlar ro'yxati (kim, nima, izoh)
- [ ] Ichki iste'mol ro'yxati (kim nima yedi)
- [ ] Har mahsulotdan nechta sotildi
- [ ] Qoldiq hisobi: boshlang'ich − sotilgan − chiqim − ichki
- [ ] PDF ga kirim/chiqim qo'shish

### Kelajak
- [ ] Osh yarim/butun porsiya hisobi
- [ ] Telegram bot (chiqim xabari)
- [ ] Mahsulotga rasm yuklash

---

## 💰 Shartnoma

- **Jami:** $1,300
- **Platform:** Planshet brauzer (landscape)

---

## 📞 Ishlab chiquvchi

**Zarafshon Dasturchilari**
Telegram: [@zarafshon_dasturchilari](https://t.me/zarafshon_dasturchilari)

---

*EA Muruntov POS — oddiy, tez, ishonchli.*