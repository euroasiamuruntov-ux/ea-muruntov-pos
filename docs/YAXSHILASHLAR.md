# Yaxshilashlar ro'yxati

Foydalanuvchi sinovlari va takliflari asosida. Holat: ✅ tayyor · 🔧 jarayonda · 📋 rejada · ❓ qaror kerak.

## Jonli sinov natijalari (2026-10-25)

| # | Sinov | Natija |
|---|---|---|
| 1 | Qat'iy taom tugaganda | ✅ "Tugadi!" deb sotilmaydi (kutilgandek) |
| 2 | Cheksiz taom | ✅ sotiladi (kutilgandek) |
| 3 | Yumshoq taom, qoldiq 0 | ✅ sotiladi, avto-kirim yoziladi |
| 4 | Rahbar → Hisobot → Mahsulot hisobi (osh) | ✅ tuzatildi: butun va yarim bitta "Osh (umumiy qozon)" kartasida ko'rsatiladi |

## Rahbar paneli

- 📋 **Menyu: tez topish.** Mahsulot ko'p (57 ta). Nom bo'yicha qidiruv, kategoriya filtri, "faqat Yo'q / faqat Yumshoq" kabi filtrlar.
- 📋 **Menyu: mahsulotni tahrirlash.** Nom, narx, kategoriya, qoldiq rejimi, "tugaganda yashir" bitta joyda (hozir tahrirlash yo'q, faqat qo'shish/o'chirish).
- 📋 **Hisobot va Tarix: bo'limlarni yig'ish/yoyish.** Har bo'lim (moliya, mahsulot hisobi, osh, chiqimlar, kirimlar, izohlar) bosilganda ochiladi/yopiladi.
- 📋 **Hisobot: davr tanlash.** Qaysi ma'lumot qaysi davr uchun kerakligini tanlash (smena, kun, hafta, oy). Kam ishlatiladigan hisobotlar tugmalar orqali ochiladi, asosiy sahifa sodda qoladi.
- 📋 **Tarix: osh ham bitta qozon sifatida.** Hozir faqat Hisobot tabida tuzatilgan.

## Kassir paneli

- 📋 **Taomni tez topish.** Qidiruv maydoni, "tez-tez sotiladiganlar" (osh, non, choy, salat) tepada, kategoriyalar tugmalari katta va planshetda qulay.
- 📋 **Sonni tez kiritish.** Kartani bosganda +1, bosib turganda yoki alohida tugmada raqam paneli (5, 10, 20 ...), savatda ham katta +/- tugmalari.
- 📋 **Qoldiqni aniqroq ko'rsatish.** Qoldiq har taomda ko'rinsin (Yumshoq va Cheksiz taomda ham), kam qolganda rang bilan ogohlantirish.

## Texnik (rejalashtirilgan bosqichlar)

1. ✅ Yumshoq qoldiq, avto-kirim, atomik buyurtma
2. 📋 Rahbar uchun sinov ma'lumotlarini tozalash (oldindan zaxira, tasdiqlash so'zi)
3. 📋 Xatolik va to'xtash xabarlari (internet yo'q banneri, nosozlik ekrani), monitoring
4. 📋 Ishonchlilik: smena ochish/yopishni xavfsiz qilish, ikkita ochiq smenaning oldini olish, katta ro'yxatlarni sahifalab yuklash
5. 📋 Frontendni soddalashtirish (katta fayllarni bo'laklarga ajratish, umumiy tugma/oyna)
6. 📋 Xavfsizlik: PIN'larni hash qilish, kirishni serverda tekshirish, RLS (hozir jonli bazada himoya yo'q)
