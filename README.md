# 🍽️ EA Muruntov — Kafe POS Tizimi

> Bitta planshetda ishlaydigan takeaway kafe boshqaruv tizimi.
> Next.js + Supabase + Vercel asosida qurilgan.

---

## 🌐 Live URL

**https://ea-muruntov-pos.vercel.app**

- GitHub: https://github.com/euroasiamuruntov-ux/ea-muruntov-pos
- Supabase: etllsvlxtdumbwugxvia.supabase.co (Frankfurt, Free)
- Vercel: ea-muruntov-s-projects (Hobby)

---

## 🎨 Brend

| Token | Qiymat |
|-------|--------|
| Oltin | `#C8860A` |
| Och oltin | `#F5C842` |
| Qoʻngʻir fon | `#1A1208`, `#2C200A`, `#3D2E10` |
| Yashil | `#1E7B47` |
| Qizil | `#B83232` |
| Font | Nunito 700/800/900 |
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
| Lucide React | latest |
| jsPDF | latest |

---

## 👤 Kirish

| Rol | Kirish | Yo'nalish |
|-----|--------|-----------|
| Egasi/Rahbar | Parol: `6661` | `/admin` |
| Kassir Jasur | PIN: `1234` | `/cashier` |

---

## 🗄️ Supabase jadvallari (14 ta)

```
users            — egasi va xodimlar
categories       — kategoriyalar
products         — mahsulotlar
shifts           — smenalar
shift_stock      — smena boshlang'ich miqdori
shift_reports    — smena yopish hisoboti (system_qty, actual_qty, diff, note)
shift_summary    — VIEW: smena moliyaviy xulosasi
osh_stock        — osh hissa hisobi
orders           — buyurtmalar (actual_paid, payment_note, debtor_id)
order_items      — buyurtma tarkibi
write_offs       — chiqimlar
stock_ins        — kirimlar
debtors          — qarzdorlar bazasi
debt_payments    — qarz to'lov tarixi
```

**Muhim ustunlar:**
- `products`: `is_unlimited`, `litr_per_unit`, `unit_type`, `hissa_per_unit`, `kg_to_hissa`
- `orders`: `actual_paid`, `payment_note`, `debtor_id`, `debt_paid`

---

## 📁 Fayl strukturasi

```
ea-muruntov-pos/
├── app/
│   ├── page.tsx                      ✅ Login (PIN + parol)
│   ├── admin/
│   │   └── page.tsx                 ✅ Rahbar paneli (mobil, iPhone 17)
│   └── cashier/
│       ├── page.tsx                 ✅ Kassir paneli (planshet landscape)
│       └── components/
│           └── DebtorCard.tsx       ✅ Qarzdor kartasi
├── lib/
│   └── supabase.ts
└── README.md
```

---

## ✅ Bajarilgan ishlar (to'liq)

### Login
- [x] Kassir — 4 xonali PIN
- [x] Egasi — parol

### Kassir paneli
- [x] Smena yopiq → faqat "Smena ochish" ko'rinadi
- [x] Smena boshi — o'tgan qoldiqlarni ko'rish, tasdiqlash yoki o'zgartirish
- [x] Kategoriya tablari
- [x] Chekli mahsulotlar — qoldiq ko'rsatiladi, tugaganda bosilmaydi
- [x] Cheksiz mahsulotlar (Osh, Mastava, Jarkoe) — taxminiy qoldiq
- [x] Kampot — litrda kirim, stakanda ko'rsatiladi (1 stakan = 0.42L), sotilganda stakan ayiriladi
- [x] Osh — kg kirim, hissa tizimi (1kg=21hissa, butun=3, yarim=2)
- [x] Multi-hisob (5 tagacha parallel savat)
- [x] Moslashuvchan to'lov (±1000 so'm chegarasi)
- [x] To'lov turlari: naqd / click / karta / qarz / ichki
- [x] Qarz — mavjud qarzdor qidirish yoki yangi qo'shish
- [x] Ichki iste'mol (tushum hisobiga kirmaydi)
- [x] Mahsulot kirim (kg/litr/dona)
- [x] Mahsulot chiqim (izoh majburiy)
- [x] Qoldiq realtime (boshlang'ich + kirim - sotilgan - chiqim)
- [x] Smena yopish hisoboti (kassir sanaydi → farq → izoh → PDF avtomatik)
- [x] Qarzdorlar bazasi (qidirish, tarix, to'lov 3 turda)

### Rahbar paneli (mobil, iPhone 17)
- [x] Bottom navigation (5 tab)
- [x] Hisobot tab: smena info, moliyaviy statistika, moslashuvchan to'lovlar, mahsulot hisobi, osh qoldig'i, ichki iste'mol, chiqimlar, kirimlar, faol qarzlar, PDF
- [x] Tarix tab: oxirgi 30 smena, bosish → to'liq hisobot (B/K/S/Ch/Q/Farq)
- [x] Qarzlar tab: barcha qarzdorlar, qidirish, to'lov tarixi, to'lash
- [x] Menyu tab: kategoriya/mahsulot qo'shish/o'chirish
- [x] Xodim tab: xodim qo'shish/o'chirish

---

## 📦 Mahsulot turlari

| Tur | Misollar | Hisob |
|-----|----------|-------|
| Chekli (dona) | Somsa, Cola, Salat | B + K − S − Ch |
| Cheksiz | Osh, Mastava, Jarkoe | Taxminiy |
| Hissa (kg) | Osh butun, Osh yarim | 1kg=21h, butun=3h, yarim=2h |
| Litr → stakan | Kampot | 1 stakan=0.42L, DB da stakan saqlanadi |

---

## 💰 Shartnoma

- **Jami:** $1,300
- **50% oldindan:** $650 ✅ olindi
- **50% topshirishda:** $650
- **Platform:** Kassir — planshet landscape | Rahbar — iPhone 17

---

## 🔲 Keyingi (ixtiyoriy)

- [ ] Telegram bot (chiqim xabari rahbarga)
- [ ] Mahsulotga rasm yuklash

---

## 📞 Ishlab chiquvchi

**Zarafshon Dasturchilari**
Telegram: [@zarafshon_dasturchilari](https://t.me/zarafshon_dasturchilari)