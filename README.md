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
| Egasi/Rahbar | Parol | `/admin` |
| Xodim/Kassir | 4 xonali PIN | `/cashier` |

**Test:**
- Egasi parol: `6661`
- Xodim Jasur: PIN `1234`

---

## 🗄️ Supabase jadvallari (12 ta)

```
users          — egasi va xodimlar
categories     — kategoriyalar
products       — mahsulotlar (is_unlimited, litr_per_unit, unit_type, hissa_per_unit)
shifts         — smenalar (opened_by, closed_by)
shift_stock    — smena boshidagi miqdor
shift_reports  — smena yopish hisoboti (system_qty, actual_qty, diff, note)
osh_stock      — osh hissa hisobi
orders         — buyurtmalar (naqd|click|karta|qarz|ichki, actual_paid, payment_note)
order_items    — buyurtma tarkibi
write_offs     — chiqimlar (sabab bilan)
stock_ins      — kirimlar
debtors        — qarzdorlar bazasi (total_debt)
debt_payments  — qarz to'lov tarixi (pay_type, amount)
```

---

## 📁 Loyiha strukturasi

```
ea-muruntov-pos/
├── app/
│   ├── page.tsx                    ✅ Login
│   ├── admin/
│   │   └── page.tsx               ✅ Rahbar paneli
│   ├── cashier/
│   │   ├── page.tsx               ✅ Kassir paneli
│   │   └── components/
│   │       └── DebtorCard.tsx     ✅ Qarzdor kartasi
│   └── layout.tsx
├── lib/
│   └── supabase.ts                ✅ Supabase client
└── README.md
```

---

## ✅ Bajarilgan ishlar

### Login (`app/page.tsx`)
- [x] Egasi — parol bilan
- [x] Xodim — 4 xonali PIN
- [x] Trial tizimi o'chirildi

### Kassir paneli (`app/cashier/page.tsx`)
- [x] Smena yopiq → faqat "Smena ochish" ko'rinadi
- [x] Smena boshi — o'tgan qoldiqlarni ko'rish va tasdiqlash
- [x] Kategoriya tablari
- [x] Mahsulot kartalar (landscape, katta)
- [x] Chekli mahsulotlar — qoldiq ko'rsatiladi, tugaganda bosilmaydi
- [x] Cheksiz mahsulotlar (Osh, Mastava, Jarkoe, Kompot) — taxminiy qoldiq
- [x] Kampot — litrda kirim, stakanda ko'rsatiladi
- [x] Osh — kg kirim, hissa tizimi (butun=3, yarim=2)
- [x] Multi-hisob (5 tagacha parallel)
- [x] Savat (+/- boshqaruv)
- [x] Moslashuvchan to'lov (±1000 so'm chegarasi)
- [x] To'lov: naqd / click / karta / qarz / ichki
- [x] Qarz — mavjud qarzdor qidirish yoki yangi qo'shish
- [x] Ichki iste'mol (tushum hisobiga kirmaydi)
- [x] Mahsulot kirim (kg/litr/dona)
- [x] Mahsulot chiqim (izoh majburiy)
- [x] Qoldiq realtime (kirim + boshlang'ich - sotilgan - chiqim)
- [x] Smena yopish hisoboti (kassir sanaydi, farq bo'lsa izoh)
- [x] Qarzdorlar bazasi (qidirish, tarix, to'lov 3 turda)

### Rahbar paneli (`app/admin/page.tsx`)
- [x] Smena ma'lumoti (kim ochdi, kim yopdi)
- [x] Moliyaviy statistika (naqd/click/karta/qarz/ichki)
- [x] Moslashuvchan to'lov hisoboti (actual_paid)
- [x] Mahsulot hisobi jadvali (boshlang'ich/kirim/sotildi/chiqim/qoldiq)
- [x] Osh qoldig'i (hissa → butun/yarim)
- [x] Ichki iste'mol ro'yxati
- [x] Chiqimlar ro'yxati (izoh bilan)
- [x] Kirimlar ro'yxati
- [x] Qarzdorlar + yopish
- [x] Kengaytirilgan PDF hisobot
- [x] Kategoriya/mahsulot/xodim boshqaruvi
- [x] Sklad (boshlang'ich miqdor, bor/yo'q)

---

## 🔲 Keyingi ishlar

- [ ] Smena yopish PDF → Telegram jo'natish
- [ ] Rahbar paneli mobil optimizatsiya
- [ ] Rahbar qarzdorlar bazasi
- [ ] Kampot sotilganda stakan sifatida ayirish

---

## 📦 Mahsulot turlari

| Tur | Misollar | Hisob |
|-----|----------|-------|
| Chekli (dona) | Somsa, Cola, Salat | Kirim − Sotilgan − Chiqim |
| Cheksiz | Osh, Mastava, Jarkoe | Taxminiy ko'rsatiladi |
| Hissa (kg) | Osh butun, Osh yarim | 1kg=21hissa, butun=3, yarim=2 |
| Litr | Kompot | 1 stakan = 0.42 litr |

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