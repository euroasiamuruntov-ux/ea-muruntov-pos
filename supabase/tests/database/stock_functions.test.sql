begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- ---------------------------------------------------------------------------
-- Sinov ma'lumotlari
-- ---------------------------------------------------------------------------
insert into users (id, name, pin, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Kassir', '1111', 'worker');

insert into categories (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Sinov');

insert into products (id, name, price, category_id, unit_type, hissa_per_unit, kg_to_hissa, stock_mode) values
  ('00000000-0000-0000-0000-000000000b01', 'Cola',        8000,  '00000000-0000-0000-0000-0000000000c1', 'dona',  1, 21, 'strict'),
  ('00000000-0000-0000-0000-000000000b02', 'Somsa',       6000,  '00000000-0000-0000-0000-0000000000c1', 'dona',  1, 21, 'soft'),
  ('00000000-0000-0000-0000-000000000b03', 'Mastava',     15000, '00000000-0000-0000-0000-0000000000c1', 'dona',  1, 21, 'none'),
  ('00000000-0000-0000-0000-000000000b04', 'Osh butun',   40000, '00000000-0000-0000-0000-0000000000c1', 'hissa', 3, 21, 'soft'),
  ('00000000-0000-0000-0000-000000000b05', 'Osh yarim',   28000, '00000000-0000-0000-0000-0000000000c1', 'hissa', 2, 21, 'strict');

insert into shifts (id, opened_by, is_open) values
  ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000005f2', '00000000-0000-0000-0000-0000000000a1', false);

-- Boshlang'ich qoldiq: Cola 2, Somsa 2, Mastava 0; osh 3 hissa (bitta butun)
insert into shift_stock (shift_id, product_id, initial_qty) values
  ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-000000000b01', 2),
  ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-000000000b02', 2);
insert into osh_stock (shift_id, product_group, total_hissa) values
  ('00000000-0000-0000-0000-0000000005f1', 'osh', 3);

-- ---------------------------------------------------------------------------
-- Qat'iy rejim
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b01","qty":3}]')$$,
  'P0001', 'STOCK_SHORT', 'qat''iy: qoldiqdan ko''p sotib bo''lmaydi');
select is((select count(*)::int from orders where shift_id = '00000000-0000-0000-0000-0000000005f1'), 0,
  'qat''iy xato: buyurtma yozilmagan (rollback)');

select lives_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b01","qty":2}]')$$,
  'qat''iy: aynan qoldiqcha sotsa bo''ladi');
select is((select balance from shift_balances('00000000-0000-0000-0000-0000000005f1')
           where product_id = '00000000-0000-0000-0000-000000000b01'), 0::numeric, 'Cola qoldig''i 0');
select is((select count(*)::int from stock_ins
            where source = 'auto_extra' and shift_id = '00000000-0000-0000-0000-0000000005f1'), 0,
  'qat''iy: avto-kirim yozilmaydi');

-- ---------------------------------------------------------------------------
-- Yumshoq rejim
-- ---------------------------------------------------------------------------
select is(
  (select (create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b02","qty":5}]'))->'extra'->0->>'qty'),
  '3', 'yumshoq: 2 ta bor, 5 ta sotildi -> 3 ta avto-kirim');
select is((select qty from stock_ins where source = 'auto_extra'
            and product_id = '00000000-0000-0000-0000-000000000b02'), 3::numeric, 'avto-kirim stock_ins da yozildi');
select is((select balance from shift_balances('00000000-0000-0000-0000-0000000005f1')
           where product_id = '00000000-0000-0000-0000-000000000b02'), 0::numeric, 'yumshoq: qoldiq minusga tushmadi');
select is((select sold_qty from shift_balances('00000000-0000-0000-0000-0000000005f1')
           where product_id = '00000000-0000-0000-0000-000000000b02'), 5::numeric, 'sotilgan soni to''liq yozildi');
select is((select auto_qty from shift_balances('00000000-0000-0000-0000-0000000005f1')
           where product_id = '00000000-0000-0000-0000-000000000b02'), 3::numeric, 'auto_qty hisobotda ko''rinadi');

-- Qoldiq umuman yo'q yumshoq mahsulot ham sotiladi
select is(
  (select (create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b02","qty":1}]'))->'extra'->0->>'qty'),
  '1', 'yumshoq: qoldiq 0 bo''lsa ham sotiladi');

-- ---------------------------------------------------------------------------
-- Cheksiz rejim
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":4}]')$$,
  'cheksiz: tekshirilmaydi');
select is((select count(*)::int from stock_ins where product_id = '00000000-0000-0000-0000-000000000b03'), 0,
  'cheksiz: avto-kirim yozilmaydi');

-- ---------------------------------------------------------------------------
-- Osh (hissa): butun = 3 hissa, yarim = 2 hissa, umumiy qoldiq 3 hissa
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b05","qty":2}]')$$,
  'P0001', 'STOCK_SHORT', 'osh yarim (qat''iy): hissa yetmasa sotilmaydi');
select is((select total_hissa::numeric from osh_stock where shift_id = '00000000-0000-0000-0000-0000000005f1'), 3::numeric, 'xatodan keyin osh qoldig''i o''zgarmagan');

-- 2 ta butun = 6 hissa, 3 hissa bor -> 3 hissa yetmaydi
select is(
  (select (create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b04","qty":2}]'))->'extra'->0->>'qty'),
  '1', 'osh butun (yumshoq): 3 hissa yetmadi -> 1 porsiya avto-kirim');
select is((select total_hissa::numeric from osh_stock where shift_id = '00000000-0000-0000-0000-0000000005f1'), 0::numeric, 'osh qoldig''i 0 (minus emas)');
select is((select round(qty * 21) from stock_ins where source = 'auto_extra'
            and product_id = '00000000-0000-0000-0000-000000000b04'), 3::numeric, 'osh avto-kirim kg ko''rinishida (3 hissa)');
select is((select balance from shift_balances('00000000-0000-0000-0000-0000000005f1')
           where product_id = '00000000-0000-0000-0000-000000000b04'), 0::numeric, 'osh butun qoldig''i 0');

-- Kirim: 1 kg = 21 hissa
select is((select (add_stock_in('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-000000000b04', 2, 'sinov'))->>'hissa'), '42', '2 kg osh = 42 hissa');
select is((select total_hissa::numeric from osh_stock where shift_id = '00000000-0000-0000-0000-0000000005f1'), 42::numeric, 'kirimdan keyin osh qoldig''i 42');
select is((select balance from shift_balances('00000000-0000-0000-0000-0000000005f1')
           where product_id = '00000000-0000-0000-0000-000000000b05'), 21::numeric, '42 hissa = 21 yarim');

-- Chiqim: 1 butun = 3 hissa
select lives_ok(
  $$select add_write_off('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-000000000b04', 1, 'to''kildi')$$, 'osh chiqimi');
select is((select total_hissa::numeric from osh_stock where shift_id = '00000000-0000-0000-0000-0000000005f1'), 39::numeric, 'chiqimdan keyin osh qoldig''i 39');
select throws_ok(
  $$select add_write_off('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-000000000b04', 1, '   ')$$,
  'P0001', 'REASON_REQUIRED', 'chiqimda izoh majburiy');

-- ---------------------------------------------------------------------------
-- Qarz
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'qarz',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":2}]',
      null, 'Aliyev', '901234567')$$, 'yangi qarzdor bilan qarz buyurtmasi');
select is((select total_debt::numeric from debtors where name = 'Aliyev'), 30000::numeric, 'yangi qarzdorga 30000 yozildi');
select lives_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'qarz',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":1}]',
      (select id from debtors where name = 'Aliyev'))$$, 'mavjud qarzdorga qarz');
select is((select total_debt::numeric from debtors where name = 'Aliyev'), 45000::numeric, 'qarz atomik oshdi');
select throws_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'qarz',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":1}]')$$,
  'P0001', 'DEBTOR_REQUIRED', 'qarzda qarzdor ko''rsatilishi shart');

-- ---------------------------------------------------------------------------
-- Boshqa tekshiruvlar
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f2', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":1}]')$$,
  'P0001', 'SHIFT_CLOSED', 'yopiq smenaga buyurtma yozib bo''lmaydi');

select throws_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":1}]', null, null, null, 5000)$$,
  'P0001', 'ADJUST_TOO_LARGE', 'moslashuvchan to''lov 1000 dan oshmasligi kerak');

-- Takrorlanmaslik kaliti: bir xil request_id ikkinchi buyurtma yaratmaydi
select lives_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":1}]', null, null, null, null, null,
      '00000000-0000-0000-0000-00000000aaaa')$$, 'request_id bilan birinchi urinish');
select is(
  (select (create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":1}]', null, null, null, null, null,
      '00000000-0000-0000-0000-00000000aaaa'))->>'duplicate'),
  'true', 'request_id takrorlansa duplicate qaytadi');
select is((select count(*)::int from orders where request_id = '00000000-0000-0000-0000-00000000aaaa'), 1,
  'takrorlangan so''rov ikkinchi buyurtma yaratmadi');

-- ---------------------------------------------------------------------------
-- Jonli sxema: miqdor ustunlari `integer`, shuning uchun kasr dona qabul qilinmaydi
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select create_order('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'naqd',
      '[{"product_id":"00000000-0000-0000-0000-000000000b03","qty":1.5}]')$$,
  'P0001', 'BAD_QTY', 'buyurtmada kasr miqdor rad etiladi');
select throws_ok(
  $$select add_stock_in('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-000000000b01', 1.5)$$,
  'P0001', 'BAD_QTY', 'dona mahsulot kirimida kasr rad etiladi');
select is((select (add_stock_in('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-000000000b04', 0.5))->>'hissa'), '11', 'osh kirimida kasr kg qabul qilinadi (0.5 kg = 11 hissa)');
select throws_ok(
  $$select add_write_off('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-000000000b04', 1.5, 'sinov')$$,
  'P0001', 'BAD_QTY', 'chiqimda kasr rad etiladi');

select * from finish();
rollback;
