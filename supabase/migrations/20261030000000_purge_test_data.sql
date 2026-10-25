-- Rahbar uchun sinov ma'lumotlarini tozalash.
--   purge_preview: nimalar o'chishini ko'rsatadi (hech narsa o'zgarmaydi)
--   purge_test_data: egasining paroli bilan o'chiradi (hammasi bitta tranzaksiyada)
-- Himoya: ochiq smena va tanlangan sanadan keyingi smenalar hech qachon o'chmaydi;
-- menyu (taom, kategoriya) va xodimlar o'chmaydi.
-- Eski kod bilan mos: faqat yangi funksiyalar.

create or replace function purge_preview(p_before timestamptz, p_include_debtors boolean default false)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_shifts uuid[];
  v_orders uuid[];
  v_debtors uuid[] := '{}';
begin
  select coalesce(array_agg(id), '{}') into v_shifts from shifts where not is_open and opened_at < p_before;
  select coalesce(array_agg(id), '{}') into v_orders from orders
   where shift_id = any(v_shifts) or (shift_id is null and created_at < p_before);
  if p_include_debtors then
    select coalesce(array_agg(d.id), '{}') into v_debtors from debtors d
     where not exists (select 1 from orders o where o.debtor_id = d.id and o.id <> all(v_orders));
  end if;

  return jsonb_build_object(
    'shifts', cardinality(v_shifts),
    'orders', cardinality(v_orders),
    'order_items', (select count(*) from order_items where order_id = any(v_orders)),
    'revenue', (select coalesce(sum(coalesce(actual_paid, total)) filter (where pay_type <> 'ichki'), 0)
                  from orders where id = any(v_orders)),
    'stock_ins', (select count(*) from stock_ins where shift_id = any(v_shifts) or (shift_id is null and created_at < p_before)),
    'write_offs', (select count(*) from write_offs where shift_id = any(v_shifts) or (shift_id is null and created_at < p_before)),
    'shift_reports', (select count(*) from shift_reports where shift_id = any(v_shifts)),
    'debtors', cardinality(v_debtors),
    'debt_payments', (select count(*) from debt_payments where debtor_id = any(v_debtors))
  );
end;
$$;

create or replace function purge_test_data(p_owner_pin text, p_before timestamptz, p_include_debtors boolean default false)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_shifts uuid[];
  v_orders uuid[];
  v_debtors uuid[] := '{}';
  v_result jsonb;
begin
  if p_owner_pin is null or not exists (select 1 from users where role = 'owner' and pin = p_owner_pin) then
    raise exception 'WRONG_PIN';
  end if;

  -- Natija o'chirishdan oldingi hisobga teng (ko'rsatilgan raqamlar bilan bir xil)
  v_result := purge_preview(p_before, p_include_debtors);

  select coalesce(array_agg(id), '{}') into v_shifts from shifts where not is_open and opened_at < p_before;
  select coalesce(array_agg(id), '{}') into v_orders from orders
   where shift_id = any(v_shifts) or (shift_id is null and created_at < p_before);
  if p_include_debtors then
    select coalesce(array_agg(d.id), '{}') into v_debtors from debtors d
     where not exists (select 1 from orders o where o.debtor_id = d.id and o.id <> all(v_orders));
  end if;

  -- Bog'liqlik tartibida: avval bolalar, keyin ota yozuvlar
  update debt_payments set order_id = null where order_id = any(v_orders);
  delete from debt_payments where debtor_id = any(v_debtors);
  delete from order_items where order_id = any(v_orders);
  delete from orders where id = any(v_orders);
  delete from debtors where id = any(v_debtors);
  delete from write_offs where shift_id = any(v_shifts) or (shift_id is null and created_at < p_before);
  delete from stock_ins where shift_id = any(v_shifts) or (shift_id is null and created_at < p_before);
  delete from shift_reports where shift_id = any(v_shifts);
  delete from shift_stock where shift_id = any(v_shifts);
  delete from osh_stock where shift_id = any(v_shifts);
  delete from shifts where id = any(v_shifts);

  return v_result;
end;
$$;
