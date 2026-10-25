begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

update shifts set is_open = false where is_open;

insert into users (id, name, pin, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Kassir', '7771', 'worker'),
  ('00000000-0000-0000-0000-0000000000a9', 'Egasi', 'egasi-parol', 'owner');
insert into categories (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Sinov');
insert into products (id, name, price, category_id, unit_type, stock_mode) values
  ('00000000-0000-0000-0000-000000000b01', 'Cola', 8000, '00000000-0000-0000-0000-0000000000c1', 'dona', 'soft');

-- Eski (yopilgan) ikki smena + bugungi ochiq smena
insert into shifts (id, opened_by, is_open, opened_at, closed_at) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000000a1', false, now() - interval '5 days', now() - interval '5 days' + interval '8 hours'),
  ('00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-0000000000a1', false, now() - interval '3 days', now() - interval '3 days' + interval '8 hours');
insert into shifts (id, opened_by, is_open, opened_at) values
  ('00000000-0000-0000-0000-0000000005e3', '00000000-0000-0000-0000-0000000000a1', true, now());

insert into debtors (id, name, total_debt) values
  ('00000000-0000-0000-0000-0000000000d1', 'Sinov qarzdor', 10000),     -- faqat eski buyurtmada
  ('00000000-0000-0000-0000-0000000000d2', 'Doimiy qarzdor', 5000);     -- bugungi buyurtmada ham bor

insert into orders (id, shift_id, worker_id, total, pay_type, debtor_id, debtor_name, debt_paid, created_at) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000000a1', 10000, 'naqd', null, null, true, now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-0000000000a1', 10000, 'qarz', '00000000-0000-0000-0000-0000000000d1', 'Sinov qarzdor', false, now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-0000000000a1', 0, 'ichki', null, null, true, now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000005e3', '00000000-0000-0000-0000-0000000000a1', 5000, 'qarz', '00000000-0000-0000-0000-0000000000d2', 'Doimiy qarzdor', false, now());
insert into order_items (order_id, product_id, qty, price) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000b01', 2, 5000),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000b01', 1, 10000),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000b01', 1, 10000),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000b01', 1, 5000);
insert into stock_ins (shift_id, product_id, qty, worker_id) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-000000000b01', 5, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000005e3', '00000000-0000-0000-0000-000000000b01', 9, '00000000-0000-0000-0000-0000000000a1');
insert into write_offs (shift_id, product_id, qty, reason, worker_id) values
  ('00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-000000000b01', 1, 'sindi', '00000000-0000-0000-0000-0000000000a1');
insert into shift_stock (shift_id, product_id, initial_qty) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-000000000b01', 3),
  ('00000000-0000-0000-0000-0000000005e3', '00000000-0000-0000-0000-000000000b01', 3);
insert into shift_reports (shift_id, product_id, system_qty, actual_qty, diff, note) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-000000000b01', 1, 1, 0, '');
insert into osh_stock (shift_id, product_group, total_hissa) values
  ('00000000-0000-0000-0000-0000000005e2', 'osh', 4),
  ('00000000-0000-0000-0000-0000000005e3', 'osh', 6);
insert into debt_payments (debtor_id, order_id, amount, pay_type) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f2', 2000, 'naqd'),
  ('00000000-0000-0000-0000-0000000000d2', null, 1000, 'naqd');

-- ---------------------------------------------------------------------------
-- Oldindan ko'rish: hech narsa o'zgarmaydi
-- ---------------------------------------------------------------------------
select is((purge_preview(date_trunc('day', now()))->>'shifts')::int, 2, 'ko''rish: 2 ta yopilgan eski smena');
select is((purge_preview(date_trunc('day', now()))->>'orders')::int, 3, 'ko''rish: 3 ta buyurtma');
select is((purge_preview(date_trunc('day', now()))->>'revenue')::numeric, 20000::numeric, 'ko''rish: tushum 20000 (naqd 10000 + qarz 10000, ichki hisobga kirmaydi)');
select is((purge_preview(date_trunc('day', now()))->>'debtors')::int, 0, 'ko''rish: qarzdorlar tegilmaydi (belgilanmagan)');
select is((purge_preview(date_trunc('day', now()), true)->>'debtors')::int, 1, 'ko''rish: faqat eski buyurtmalardagi qarzdor o''chadi, bugungisi qoladi');
select is((select count(*)::int from orders), 4, 'ko''rishdan keyin hech narsa o''chmagan');

-- ---------------------------------------------------------------------------
-- O'chirish
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select purge_test_data('noto''g''ri', date_trunc('day', now()), false)$$,
  'P0001', 'WRONG_PIN', 'noto''g''ri parol rad etiladi');
select throws_ok(
  $$select purge_test_data('7771', date_trunc('day', now()), false)$$,
  'P0001', 'WRONG_PIN', 'kassir PIN''i bilan o''chirib bo''lmaydi (faqat egasi)');
select is((select count(*)::int from orders), 4, 'xato parolda hech narsa o''chmadi');

select is((purge_test_data('egasi-parol', date_trunc('day', now()), true)->>'orders')::int, 3, 'o''chirildi: 3 ta buyurtma (natija ko''rsatilgan raqamga teng)');

select is((select count(*)::int from shifts), 1, 'faqat bugungi ochiq smena qoldi');
select is((select is_open from shifts), true, 'ochiq smena o''chmadi');
select is((select count(*)::int from orders), 1, 'bugungi buyurtma qoldi');
select is((select count(*)::int from order_items), 1, 'bugungi buyurtma tarkibi qoldi');
select is((select count(*)::int from stock_ins), 1, 'bugungi kirim qoldi');
select is((select count(*)::int from write_offs), 0, 'eski chiqim o''chdi');
select is((select count(*)::int from shift_reports), 0, 'eski hisobot o''chdi');
select is((select count(*)::int from shift_stock), 1, 'bugungi boshlang''ich qoldiq qoldi');
select is((select total_hissa::numeric from osh_stock), 6::numeric, 'faqat bugungi osh qozoni qoldi');
select is((select name from debtors), 'Doimiy qarzdor', 'bugungi buyurtmali qarzdor qoldi, sinov qarzdori o''chdi');
select is((select count(*)::int from debt_payments), 1, 'qolgan qarzdorning to''lovi qoldi');
select is((select count(*)::int from products where id = '00000000-0000-0000-0000-000000000b01') + (select count(*)::int from users where id = '00000000-0000-0000-0000-0000000000a9'), 2, 'menyu va xodimlar tegilmadi');

select * from finish();
rollback;
