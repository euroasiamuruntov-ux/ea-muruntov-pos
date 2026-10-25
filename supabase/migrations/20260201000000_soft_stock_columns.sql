-- Yumshoq qoldiq: mahsulotga qoldiq rejimi va kirimga manba belgisi qo'shiladi.
--
-- Bu migratsiya ESKI kod bilan ham mos (hech narsa o'chirilmaydi, yangi ustunlar
-- default qiymatli), shuning uchun avval shuni ishga tushirib, keyin yangi kodni
-- deploy qilish xavfsiz.

-- 1) Qoldiq rejimi:
--    strict - qoldiq 0 bo'lsa sotilmaydi (Cola, shisha ichimlik)
--    soft   - qoldiq 0 bo'lsa ham sotiladi, farq avtomatik "qo'shimcha tayyorlandi"
--             kirimi sifatida yoziladi (osh, somsa, mastava...)
--    none   - qoldiq tekshirilmaydi (eski is_unlimited)
alter table products add column if not exists stock_mode text not null default 'strict';

alter table products drop constraint if exists products_stock_mode_check;
alter table products add constraint products_stock_mode_check
  check (stock_mode in ('strict', 'soft', 'none'));

-- Eski "cheksiz" mahsulotlar yangi rejimda ham cheksiz bo'lib qoladi
update products set stock_mode = 'none' where is_unlimited = true;

-- 2) Kirim miqdori jonli bazada `integer`. Osh kirimi kg bilan yoziladi, avto-kirim esa kasr kg
--    bo'lishi mumkin (masalan 3 hissa = 0.1428 kg), shuning uchun `numeric` ga kengaytiramiz.
--    Butun sonlar o'zgarmaydi, eski kod bilan to'liq mos.
alter table stock_ins alter column qty type numeric;

-- 3) Kirim manbasi: qo'lda (manual) yoki sotuv paytida avtomatik (auto_extra)
alter table stock_ins add column if not exists source text not null default 'manual';
alter table stock_ins add column if not exists note text;

alter table stock_ins drop constraint if exists stock_ins_source_check;
alter table stock_ins add constraint stock_ins_source_check
  check (source in ('manual', 'auto_extra'));

-- 4) Buyurtma takrorlanmasligi uchun kalit: internet uzilib, kassir "Tasdiqlash"ni
--    qayta bossa ham, bir xil kalit bilan faqat bitta buyurtma yoziladi.
alter table orders add column if not exists request_id uuid;
create unique index if not exists orders_request_id_key
  on orders (request_id) where request_id is not null;
