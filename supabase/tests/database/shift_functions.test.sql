begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Lokal bazada boshqa ochiq smena bo'lsa halal bermasin (tranzaksiya oxirida bekor qilinadi)
update shifts set is_open = false where is_open;

insert into users (id, name, pin, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Kassir', '7771', 'worker');
insert into categories (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Sinov');
insert into products (id, name, price, category_id, unit_type, hissa_per_unit, kg_to_hissa, stock_mode) values
  ('00000000-0000-0000-0000-000000000b01', 'Cola',      8000,  '00000000-0000-0000-0000-0000000000c1', 'dona',  1, 21, 'strict'),
  ('00000000-0000-0000-0000-000000000b02', 'Somsa',     6000,  '00000000-0000-0000-0000-0000000000c1', 'dona',  1, 21, 'soft'),
  ('00000000-0000-0000-0000-000000000b04', 'Osh butun', 40000, '00000000-0000-0000-0000-0000000000c1', 'hissa', 3, 21, 'soft'),
  ('00000000-0000-0000-0000-000000000b05', 'Osh yarim', 28000, '00000000-0000-0000-0000-0000000000c1', 'hissa', 2, 21, 'soft');

-- ---------------------------------------------------------------------------
-- open_shift
-- ---------------------------------------------------------------------------
select is((select (open_shift('00000000-0000-0000-0000-0000000000a1',
  '[{"product_id":"00000000-0000-0000-0000-000000000b01","qty":3,"qty_original":5,"note":"sinib qolgan"},
    {"product_id":"00000000-0000-0000-0000-000000000b02","qty":4,"qty_original":4,"note":""},
    {"product_id":"00000000-0000-0000-0000-000000000b04","qty":2,"qty_original":2,"note":""},
    {"product_id":"00000000-0000-0000-0000-000000000b05","qty":9,"qty_original":9,"note":""}]'))->>'existing'),
  'false', 'smena ochildi');

select is((select count(*)::int from shifts where is_open), 1, 'bitta ochiq smena');

select is((select count(*)::int from shift_stock s join shifts h on h.id = s.shift_id where h.is_open),
  (select count(*)::int from products), 'hamma mahsulot uchun boshlang''ich qoldiq yozildi');
select is((select initial_qty::numeric from shift_stock s join shifts h on h.id = s.shift_id
            where h.is_open and s.product_id = '00000000-0000-0000-0000-000000000b01'), 3::numeric, 'Cola boshlang''ich 3');

select is((select qty::numeric from write_offs w join shifts h on h.id = w.shift_id
            where h.is_open and w.product_id = '00000000-0000-0000-0000-000000000b01'), 2::numeric, 'kamaytirilgan 2 ta chiqim bo''lib yozildi');
select is((select reason from write_offs w join shifts h on h.id = w.shift_id
            where h.is_open and w.product_id = '00000000-0000-0000-0000-000000000b01'),
  'Smena boshida chiqindi: sinib qolgan', 'chiqim sababi: ''Smena boshida chiqindi'' + kassir izohi');
select is((select count(*)::int from write_offs w join shifts h on h.id = w.shift_id where h.is_open), 1,
  'o''zgarmagan mahsulotlar uchun chiqim yozilmadi');

-- Osh qozoni: butun qoldig'i (2 ta = 6 hissa) olinadi, yarimniki (9) hisobga olinmaydi
select is((select total_hissa::numeric from osh_stock o join shifts h on h.id = o.shift_id where h.is_open), 6::numeric,
  'osh qozoni butun bo''yicha: 2 x 3 = 6 hissa');

-- Ikkinchi marta ochishga urinish mavjud smenani qaytaradi (ikkita smena bo'lmaydi)
select is((select (open_shift('00000000-0000-0000-0000-0000000000a1', '[]'))->>'existing'), 'true', 'ikkinchi urinish: mavjud smena');
select is((select count(*)::int from shifts where is_open), 1, 'ikkinchi smena ochilmadi');
select throws_ok(
  $$insert into shifts (opened_by, is_open) values ('00000000-0000-0000-0000-0000000000a1', true)$$,
  '23505', null, 'bazaning o''zi ham ikkinchi ochiq smenani rad etadi');

-- ---------------------------------------------------------------------------
-- close_shift
-- ---------------------------------------------------------------------------
-- Savdo: Somsa 6 ta (qoldiq 4 -> 2 avto-kirim)
select create_order((select id from shifts where is_open), '00000000-0000-0000-0000-0000000000a1', 'naqd',
  '[{"product_id":"00000000-0000-0000-0000-000000000b02","qty":6}]');

-- Cola: tizimda 3, kassir 2 sanadi, izoh yo'q -> rad etiladi
select throws_ok(
  $$select close_shift((select id from shifts where is_open), '00000000-0000-0000-0000-0000000000a1',
      '[{"product_id":"00000000-0000-0000-0000-000000000b01","actual_qty":2,"note":""}]')$$,
  'P0001', 'NOTE_REQUIRED', 'farq bo''lsa izoh majburiy');
select is((select count(*)::int from shifts where is_open), 1, 'rad etilgach smena ochiq qoladi');
select is((select count(*)::int from shift_reports r join shifts h on h.id = r.shift_id where h.is_open), 0,
  'rad etilgach hisobot qatorlari yozilmaydi (rollback)');

select is((select (close_shift((select id from shifts where is_open), '00000000-0000-0000-0000-0000000000a1',
      '[{"product_id":"00000000-0000-0000-0000-000000000b01","actual_qty":2,"note":"1 ta yo''qolgan"}]')) -> 'rows' -> 0 ->> 'diff') is not null,
  true, 'farq izoh bilan smena yopildi');

select is((select count(*)::int from shifts where is_open), 0, 'smena yopildi');
select is((select count(*)::int from shift_reports r where r.shift_id = (select id from shifts order by closed_at desc nulls last limit 1)),
  (select count(*)::int from products), 'hamma mahsulot uchun hisobot qatori yozildi');
select is((select diff::numeric from shift_reports where product_id = '00000000-0000-0000-0000-000000000b01'
            and shift_id = (select id from shifts order by closed_at desc nulls last limit 1)), -1::numeric, 'Cola farqi -1 (server hisoblagan tizim qoldig''i 3, sanalgan 2)');
select is((select system_qty::numeric from shift_reports where product_id = '00000000-0000-0000-0000-000000000b01'
            and shift_id = (select id from shifts order by closed_at desc nulls last limit 1)), 3::numeric, 'tizim qoldig''i serverda hisoblangan');
select is((select actual_qty::numeric from shift_reports where product_id = '00000000-0000-0000-0000-000000000b02'
            and shift_id = (select id from shifts order by closed_at desc nulls last limit 1)), 0::numeric, 'sanalmagan mahsulot: haqiqiy = tizim (0)');
select is((select closed_by from shifts order by closed_at desc nulls last limit 1), '00000000-0000-0000-0000-0000000000a1'::uuid, 'kim yopgani yozildi');

select throws_ok(
  $$select close_shift((select id from shifts order by closed_at desc nulls last limit 1), '00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'SHIFT_CLOSED', 'yopilgan smenani qayta yopib bo''lmaydi');

-- Yopilgandan keyin yangi smena ochish mumkin
select is((select (open_shift('00000000-0000-0000-0000-0000000000a1', '[]'))->>'existing'), 'false', 'yopilgandan keyin yangi smena ochiladi');

-- ---------------------------------------------------------------------------
-- pay_debt
-- ---------------------------------------------------------------------------
insert into debtors (id, name, total_debt) values ('00000000-0000-0000-0000-0000000000d1', 'Aliyev', 50000);

select is((select (pay_debt('00000000-0000-0000-0000-0000000000d1', 20000, 'click'))->>'total_debt'), '30000', 'qarz 20000 ga kamaydi');
select is((select count(*)::int from debt_payments where debtor_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'to''lov tarixi yozildi');
select throws_ok(
  $$select pay_debt('00000000-0000-0000-0000-0000000000d1', 30001)$$, 'P0001', 'OVERPAY', 'qarzdan ko''p to''lab bo''lmaydi');
select throws_ok(
  $$select pay_debt('00000000-0000-0000-0000-0000000000d1', 0)$$, 'P0001', 'BAD_QTY', 'nol summa rad etiladi');
select throws_ok(
  $$select pay_debt('00000000-0000-0000-0000-0000000000d1', 100, 'qarz')$$, 'P0001', 'BAD_PAY_TYPE', 'to''lov turi noto''g''ri');

select * from finish();
rollback;
