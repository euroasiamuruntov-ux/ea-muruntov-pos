-- LOKAL sinov ma'lumotlari (faqat `supabase db reset` da yuklanadi, jonli bazaga tegmaydi).
-- Kirish: Rahbar paroli = 9999, Kassir PIN = 1234

insert into users (id, name, pin, role) values
  ('00000000-0000-0000-0000-00000000a001', 'Rahbar', '9999', 'owner'),
  ('00000000-0000-0000-0000-00000000a002', 'Sinov kassir', '1234', 'worker');

insert into categories (id, name, order_num) values
  ('00000000-0000-0000-0000-00000000c001', 'Birinchi taom', 1),
  ('00000000-0000-0000-0000-00000000c002', 'Ikkinchi taom', 2),
  ('00000000-0000-0000-0000-00000000c003', 'Ichimlik', 3);

insert into products (id, name, price, category_id, unit_type, hissa_per_unit, kg_to_hissa, litr_per_unit, stock_mode, is_unlimited) values
  ('00000000-0000-0000-0000-00000000b001', 'Mastava',   15000, '00000000-0000-0000-0000-00000000c001', 'dona',  1, 21, null, 'none',   true),
  ('00000000-0000-0000-0000-00000000b002', 'Somsa',      6000, '00000000-0000-0000-0000-00000000c002', 'dona',  1, 21, null, 'soft',   false),
  ('00000000-0000-0000-0000-00000000b003', 'Osh butun', 40000, '00000000-0000-0000-0000-00000000c002', 'hissa', 3, 21, null, 'soft',   false),
  ('00000000-0000-0000-0000-00000000b004', 'Osh yarim', 28000, '00000000-0000-0000-0000-00000000c002', 'hissa', 2, 21, null, 'soft',   false),
  ('00000000-0000-0000-0000-00000000b005', 'Cola 1L',   12000, '00000000-0000-0000-0000-00000000c003', 'dona',  1, 21, null, 'strict', false),
  ('00000000-0000-0000-0000-00000000b006', 'Kampot',     3000, '00000000-0000-0000-0000-00000000c003', 'dona',  1, 21, 0.42, 'strict', false);
