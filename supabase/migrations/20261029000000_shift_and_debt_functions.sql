-- Smena ochish/yopish va qarz to'lovi: har biri bitta tranzaksiyada (yarim yozilib qolmaydi),
-- bitta vaqtda faqat bitta ochiq smena bo'lishi kafolatlanadi.
-- Eski kod bilan mos: faqat yangi funksiyalar va bitta indeks qo'shiladi.

-- ---------------------------------------------------------------------------
-- 1) Bir vaqtda faqat bitta ochiq smena
-- ---------------------------------------------------------------------------
-- Agar (sinov paytida) bir nechta ochiq smena qolib ketgan bo'lsa, eng yangisi ochiq qoladi,
-- qolganlari yopiladi (indeks yaratilishi uchun).
update shifts
   set is_open = false, closed_at = coalesce(closed_at, now())
 where is_open
   and id <> (select id from shifts where is_open order by opened_at desc limit 1);

create unique index if not exists one_open_shift on shifts ((true)) where is_open;

-- ---------------------------------------------------------------------------
-- 2) open_shift: smena + boshlang'ich qoldiq + tashlangan qoldiq + osh qozoni
--    p_items: [{"product_id": "...", "qty": 5, "qty_original": 8, "note": "..."}]
--    qty - o'tgan smenadan qabul qilingan miqdor, qty_original - o'tgan smena oxiridagi miqdor.
-- ---------------------------------------------------------------------------
create or replace function open_shift(p_worker_id uuid, p_items jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_shift shifts%rowtype;
  v_pool numeric := 0;
  v_prod record;
  v_qty numeric;
begin
  -- Ikki planshet bir vaqtda "Smena ochish" bossa, ikkinchisi birinchi ochgan smenani oladi
  perform pg_advisory_xact_lock(hashtext('open_shift'));
  select * into v_shift from shifts where is_open order by opened_at desc limit 1;
  if found then
    return jsonb_build_object('shift_id', v_shift.id, 'existing', true);
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    p_items := '[]'::jsonb;
  end if;

  insert into shifts (opened_by, is_open) values (p_worker_id, true) returning * into v_shift;

  -- Hamma mahsulot uchun boshlang'ich qoldiq (o'tgan smenadan qabul qilingani yoki 0)
  insert into shift_stock (shift_id, product_id, initial_qty)
  select v_shift.id, p.id, coalesce(round(sum(greatest((e ->> 'qty')::numeric, 0))), 0)
    from products p
    left join jsonb_array_elements(p_items) e on (e ->> 'product_id')::uuid = p.id
   group by p.id;

  -- Kamaytirilgan miqdor "Smena boshida chiqindi" bo'lib yoziladi (kassir izohi bilan)
  insert into write_offs (shift_id, product_id, qty, reason, worker_id)
  select v_shift.id, (e ->> 'product_id')::uuid,
         round((e ->> 'qty_original')::numeric - (e ->> 'qty')::numeric),
         'Smena boshida chiqindi' ||
           case when btrim(coalesce(e ->> 'note', '')) <> '' then ': ' || btrim(e ->> 'note') else '' end,
         p_worker_id
    from jsonb_array_elements(p_items) e
   where (e ->> 'qty_original')::numeric > (e ->> 'qty')::numeric
     and exists (select 1 from products p where p.id = (e ->> 'product_id')::uuid);

  -- Osh qozoni: eng katta porsiyali (butun) qoldiq bo'lsa shundan, bo'lmasa keyingisidan
  for v_prod in
    select p.id, p.hissa_per_unit from products p where p.unit_type = 'hissa' order by p.hissa_per_unit desc
  loop
    select coalesce(sum(greatest((e ->> 'qty')::numeric, 0)), 0) into v_qty
      from jsonb_array_elements(p_items) e where (e ->> 'product_id')::uuid = v_prod.id;
    if v_qty > 0 then
      v_pool := v_qty * coalesce(nullif(v_prod.hissa_per_unit, 0), 1);
      exit;
    end if;
  end loop;
  if v_pool > 0 then
    insert into osh_stock (shift_id, product_group, total_hissa) values (v_shift.id, 'osh', round(v_pool));
  end if;

  return jsonb_build_object('shift_id', v_shift.id, 'existing', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) close_shift: tizim qoldig'i serverda hisoblanadi, farq bo'lsa izoh majburiy,
--    hisobot qatorlari va smena yopilishi birga yoziladi.
--    p_rows: [{"product_id": "...", "actual_qty": 4, "note": "..."}]  (faqat kassir o'zgartirganlari)
-- ---------------------------------------------------------------------------
create or replace function close_shift_rows(p_shift_id uuid, p_rows jsonb)
returns table (product_id uuid, system_qty numeric, actual_qty numeric, note text)
language sql
stable
set search_path = public
as $$
  select b.product_id,
         b.balance,
         coalesce(o.actual::numeric, b.balance),
         coalesce(btrim(o.note), '')
    from shift_balances(p_shift_id) b
    left join (
      select (e ->> 'product_id')::uuid as product_id, e ->> 'actual_qty' as actual, e ->> 'note' as note
        from jsonb_array_elements(p_rows) e
    ) o on o.product_id = b.product_id;
$$;

create or replace function close_shift(p_shift_id uuid, p_worker_id uuid, p_rows jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_missing text;
  v_rows jsonb;
begin
  perform 1 from shifts where id = p_shift_id and is_open for update;
  if not found then
    raise exception 'SHIFT_CLOSED';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    p_rows := '[]'::jsonb;
  end if;

  select string_agg(p.name, ', ') into v_missing
    from close_shift_rows(p_shift_id, p_rows) r
    join products p on p.id = r.product_id
   where r.actual_qty <> r.system_qty and r.note = '';
  if v_missing is not null then
    raise exception 'NOTE_REQUIRED' using detail = v_missing;
  end if;

  insert into shift_reports (shift_id, product_id, system_qty, actual_qty, diff, note)
  select p_shift_id, r.product_id, r.system_qty, r.actual_qty, r.actual_qty - r.system_qty, r.note
    from close_shift_rows(p_shift_id, p_rows) r;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', r.product_id, 'system_qty', r.system_qty, 'actual_qty', r.actual_qty,
           'diff', r.actual_qty - r.system_qty, 'note', r.note)), '[]'::jsonb)
    into v_rows from close_shift_rows(p_shift_id, p_rows) r;

  update shifts set is_open = false, closed_at = now(), closed_by = p_worker_id where id = p_shift_id;

  return jsonb_build_object('rows', v_rows);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) pay_debt: qarz to'lovi (qarz kamayadi + to'lov tarixi), ortiqcha to'lov rad etiladi
-- ---------------------------------------------------------------------------
create or replace function pay_debt(p_debtor_id uuid, p_amount numeric, p_pay_type text default 'naqd')
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_debt numeric;
  v_new numeric;
begin
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'BAD_QTY';
  end if;
  if p_pay_type is null or p_pay_type not in ('naqd', 'click', 'karta') then
    raise exception 'BAD_PAY_TYPE';
  end if;

  select coalesce(total_debt, 0) into v_debt from debtors where id = p_debtor_id for update;
  if not found then
    raise exception 'DEBTOR_NOT_FOUND';
  end if;
  if p_amount > v_debt then
    raise exception 'OVERPAY' using detail = v_debt::text;
  end if;

  v_new := v_debt - p_amount;
  update debtors set total_debt = v_new, updated_at = now() where id = p_debtor_id;
  insert into debt_payments (debtor_id, amount, pay_type, note)
  values (p_debtor_id, p_amount, p_pay_type, 'To''lov: ' || p_amount || ' so''m (' || p_pay_type || ')');

  return jsonb_build_object('total_debt', v_new);
end;
$$;
