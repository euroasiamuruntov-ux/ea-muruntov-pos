-- Qoldiq va buyurtma mantig'i bazaning o'zida (bitta tranzaksiyada) bajariladi.
-- Sabab: brauzerdagi eski ma'lumot asosida hisoblash ikki planshetda xato beradi,
-- buyurtma yarim yozilib qolishi mumkin edi.

-- ---------------------------------------------------------------------------
-- shift_balances: smena bo'yicha har bir mahsulot qoldig'i (yagona haqiqat manbai)
-- ---------------------------------------------------------------------------
create or replace function shift_balances(p_shift_id uuid)
returns table (
  product_id uuid,
  initial_qty numeric,
  kirim_qty numeric,
  auto_qty numeric,
  sold_qty numeric,
  writeoff_qty numeric,
  balance numeric
)
language sql
stable
set search_path = public
as $$
  with pool as (
    select coalesce(sum(total_hissa), 0) as hissa
    from osh_stock
    where shift_id = p_shift_id and product_group = 'osh'
  )
  select
    p.id,
    coalesce(ss.initial_qty, 0),
    coalesce(si.total, 0),
    coalesce(si.auto, 0),
    coalesce(oi.total, 0),
    coalesce(wo.total, 0),
    case
      when p.unit_type = 'hissa'
        then floor((select hissa from pool) / nullif(p.hissa_per_unit, 0))
      else coalesce(ss.initial_qty, 0) + coalesce(si.total, 0)
           - coalesce(oi.total, 0) - coalesce(wo.total, 0)
    end
  from products p
  left join (
    select s.product_id, sum(s.initial_qty) as initial_qty
    from shift_stock s where s.shift_id = p_shift_id group by s.product_id
  ) ss on ss.product_id = p.id
  left join (
    select i.product_id,
           sum(i.qty) as total,
           sum(i.qty) filter (where i.source = 'auto_extra') as auto
    from stock_ins i where i.shift_id = p_shift_id group by i.product_id
  ) si on si.product_id = p.id
  left join (
    select it.product_id, sum(it.qty) as total
    from order_items it
    join orders o on o.id = it.order_id
    where o.shift_id = p_shift_id
    group by it.product_id
  ) oi on oi.product_id = p.id
  left join (
    select w.product_id, sum(w.qty) as total
    from write_offs w where w.shift_id = p_shift_id group by w.product_id
  ) wo on wo.product_id = p.id;
$$;

-- ---------------------------------------------------------------------------
-- create_order: buyurtma + qarz + qoldiq + osh hissasi + avto-kirim, hammasi birga
--
-- Xatolar (kassir sahifasi shu kodlar bo'yicha o'zbekcha xabar chiqaradi):
--   SHIFT_CLOSED, EMPTY_ORDER, BAD_PAY_TYPE, BAD_QTY, PRODUCT_NOT_FOUND,
--   PRODUCT_UNAVAILABLE, STOCK_SHORT, DEBTOR_REQUIRED, DEBTOR_NOT_FOUND,
--   ADJUST_TOO_LARGE
-- ---------------------------------------------------------------------------
create or replace function create_order(
  p_shift_id uuid,
  p_worker_id uuid,
  p_pay_type text,
  p_items jsonb,
  p_debtor_id uuid default null,
  p_debtor_name text default null,
  p_debtor_phone text default null,
  p_actual_paid numeric default null,
  p_payment_note text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_item record;
  v_existing record;
  v_prod products%rowtype;
  v_total numeric := 0;
  v_order_id uuid;
  v_debtor_id uuid := p_debtor_id;
  v_debtor_name text := nullif(btrim(coalesce(p_debtor_name, '')), '');
  v_actual numeric;
  v_pool numeric := 0;
  v_has_hissa boolean := false;
  v_balance numeric;
  v_short numeric;
  v_need numeric;
  v_extra jsonb := '[]'::jsonb;
begin
  if p_pay_type is null or p_pay_type not in ('naqd', 'click', 'karta', 'qarz', 'ichki') then
    raise exception 'BAD_PAY_TYPE';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;

  -- Smenani qulflaymiz: bir smenadagi buyurtmalar ketma-ket bajariladi,
  -- shuning uchun ikki planshet bir vaqtda qoldiqni "ikki marta" ishlata olmaydi.
  perform 1 from shifts where id = p_shift_id and is_open for update;
  if not found then
    raise exception 'SHIFT_CLOSED';
  end if;

  -- Shu kalit bilan buyurtma allaqachon yozilgan bo'lsa, yangisini yaratmaymiz
  if p_request_id is not null then
    select id, total into v_existing from orders where request_id = p_request_id;
    if found then
      return jsonb_build_object('order_id', v_existing.id, 'total', v_existing.total,
                                'extra', '[]'::jsonb, 'duplicate', true);
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where coalesce((e ->> 'qty')::numeric, 0) <= 0
       or (e ->> 'qty')::numeric <> trunc((e ->> 'qty')::numeric)
  ) then
    raise exception 'BAD_QTY';
  end if;

  -- Bir xil mahsulot ikki marta kelsa qo'shib yuboramiz; narx doim bazadan olinadi
  select coalesce(sum(p.price * l.qty), 0) into v_total
  from (
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::numeric) as qty
    from jsonb_array_elements(p_items) e
    group by 1
  ) l
  join products p on p.id = l.product_id;

  select coalesce(total_hissa, 0) into v_pool
  from osh_stock where shift_id = p_shift_id and product_group = 'osh' limit 1;
  v_pool := coalesce(v_pool, 0);

  -- Qarz
  if p_pay_type = 'qarz' then
    if v_debtor_id is not null then
      update debtors
         set total_debt = coalesce(total_debt, 0) + v_total, updated_at = now()
       where id = v_debtor_id
      returning name into v_debtor_name;
      if not found then
        raise exception 'DEBTOR_NOT_FOUND';
      end if;
    elsif v_debtor_name is not null then
      insert into debtors (name, phone, total_debt)
      values (v_debtor_name, coalesce(btrim(p_debtor_phone), ''), v_total)
      returning id into v_debtor_id;
    else
      raise exception 'DEBTOR_REQUIRED';
    end if;
  else
    v_debtor_id := null;
    v_debtor_name := null;
  end if;

  -- Moslashuvchan to'lov (±1000 so'm)
  v_actual := case when p_pay_type = 'ichki' then 0 else coalesce(p_actual_paid, v_total) end;
  if p_pay_type <> 'ichki' and abs(v_actual - v_total) > 1000 then
    raise exception 'ADJUST_TOO_LARGE';
  end if;

  insert into orders (shift_id, worker_id, total, pay_type, debtor_name, debtor_id,
                      debt_paid, actual_paid, payment_note, request_id)
  values (p_shift_id, p_worker_id,
          case when p_pay_type = 'ichki' then 0 else v_total end,
          p_pay_type, v_debtor_name, v_debtor_id,
          p_pay_type <> 'qarz', v_actual, p_payment_note, p_request_id)
  returning id into v_order_id;

  -- Qatorlar: qoldiqni tekshirish, avto-kirim, order_items
  for v_item in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::numeric) as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    select * into v_prod from products where id = v_item.product_id;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
    if not v_prod.is_available then
      raise exception 'PRODUCT_UNAVAILABLE' using detail = v_prod.name;
    end if;

    v_short := 0;

    if v_prod.unit_type = 'hissa' then
      -- Osh: butun va yarim bitta umumiy hissa qoldig'idan ayriladi
      v_has_hissa := true;
      v_need := v_prod.hissa_per_unit * v_item.qty;
      v_short := greatest(0, v_need - v_pool);

      if v_prod.stock_mode = 'strict' and v_short > 0 then
        raise exception 'STOCK_SHORT' using detail = v_prod.name;
      end if;

      if v_prod.stock_mode = 'soft' and v_short > 0 then
        -- Kirim kg bilan yoziladi (qo'lda kirim ham shunday), hissa -> kg
        insert into stock_ins (shift_id, product_id, qty, worker_id, source, note)
        values (p_shift_id, v_prod.id,
                v_short / coalesce(nullif(v_prod.kg_to_hissa, 0), 21),
                p_worker_id, 'auto_extra',
                'Sotuv paytida tizimda yetmadi: ' || v_short || ' hissa');
        v_extra := v_extra || jsonb_build_object(
          'product_id', v_prod.id, 'name', v_prod.name,
          'qty', ceil(v_short / nullif(v_prod.hissa_per_unit, 0)));
      end if;

      v_pool := greatest(0, v_pool - v_need);
    else
      select coalesce((select sum(s.initial_qty) from shift_stock s
                        where s.shift_id = p_shift_id and s.product_id = v_prod.id), 0)
           + coalesce((select sum(i.qty) from stock_ins i
                        where i.shift_id = p_shift_id and i.product_id = v_prod.id), 0)
           - coalesce((select sum(it.qty) from order_items it
                         join orders o on o.id = it.order_id
                        where o.shift_id = p_shift_id and it.product_id = v_prod.id), 0)
           - coalesce((select sum(w.qty) from write_offs w
                        where w.shift_id = p_shift_id and w.product_id = v_prod.id), 0)
        into v_balance;

      v_short := greatest(0, v_item.qty - greatest(v_balance, 0));

      if v_prod.stock_mode = 'strict' and v_short > 0 then
        raise exception 'STOCK_SHORT' using detail = v_prod.name;
      end if;

      if v_prod.stock_mode = 'soft' and v_short > 0 then
        insert into stock_ins (shift_id, product_id, qty, worker_id, source, note)
        values (p_shift_id, v_prod.id, v_short, p_worker_id, 'auto_extra',
                'Sotuv paytida tizimda yetmadi');
        v_extra := v_extra || jsonb_build_object(
          'product_id', v_prod.id, 'name', v_prod.name, 'qty', v_short);
      end if;
    end if;

    insert into order_items (order_id, product_id, qty, price)
    values (v_order_id, v_prod.id, v_item.qty, v_prod.price);
  end loop;

  if v_has_hissa then
    update osh_stock set total_hissa = v_pool, updated_at = now()
     where shift_id = p_shift_id and product_group = 'osh';
  end if;

  return jsonb_build_object('order_id', v_order_id, 'total', v_total, 'extra', v_extra);
end;
$$;

-- ---------------------------------------------------------------------------
-- add_stock_in: kirim (osh bo'lsa hissa qoldig'iga ham qo'shiladi)
-- ---------------------------------------------------------------------------
create or replace function add_stock_in(
  p_shift_id uuid,
  p_worker_id uuid,
  p_product_id uuid,
  p_qty numeric,
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_prod products%rowtype;
  v_id uuid;
  v_hissa numeric := 0;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'BAD_QTY';
  end if;

  perform 1 from shifts where id = p_shift_id and is_open for update;
  if not found then
    raise exception 'SHIFT_CLOSED';
  end if;

  select * into v_prod from products where id = p_product_id;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_prod.unit_type <> 'hissa' and p_qty <> trunc(p_qty) then
    raise exception 'BAD_QTY';
  end if;

  insert into stock_ins (shift_id, product_id, qty, worker_id, source, note)
  values (p_shift_id, p_product_id, p_qty, p_worker_id, 'manual', p_note)
  returning id into v_id;

  if v_prod.unit_type = 'hissa' then
    v_hissa := round(p_qty * coalesce(nullif(v_prod.kg_to_hissa, 0), 21));
    update osh_stock set total_hissa = coalesce(total_hissa, 0) + v_hissa, updated_at = now()
     where shift_id = p_shift_id and product_group = 'osh';
    if not found then
      insert into osh_stock (shift_id, product_group, total_hissa)
      values (p_shift_id, 'osh', v_hissa);
    end if;
  end if;

  -- "Yo'q" qilingan mahsulotga kirim kelsa, avtomatik "Bor" bo'ladi
  if not v_prod.is_available then
    update products set is_available = true where id = p_product_id;
  end if;

  return jsonb_build_object('id', v_id, 'made_available', not v_prod.is_available, 'hissa', v_hissa);
end;
$$;

-- ---------------------------------------------------------------------------
-- add_write_off: chiqim (osh bo'lsa hissa qoldig'idan ham ayriladi)
-- ---------------------------------------------------------------------------
create or replace function add_write_off(
  p_shift_id uuid,
  p_worker_id uuid,
  p_product_id uuid,
  p_qty numeric,
  p_reason text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_prod products%rowtype;
  v_id uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'BAD_QTY';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED';
  end if;

  perform 1 from shifts where id = p_shift_id and is_open for update;
  if not found then
    raise exception 'SHIFT_CLOSED';
  end if;

  select * into v_prod from products where id = p_product_id;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if p_qty <> trunc(p_qty) then
    raise exception 'BAD_QTY';
  end if;

  insert into write_offs (shift_id, product_id, qty, reason, worker_id)
  values (p_shift_id, p_product_id, p_qty, btrim(p_reason), p_worker_id)
  returning id into v_id;

  if v_prod.unit_type = 'hissa' then
    update osh_stock
       set total_hissa = greatest(0, coalesce(total_hissa, 0) - p_qty * coalesce(nullif(v_prod.hissa_per_unit, 0), 3)),
           updated_at = now()
     where shift_id = p_shift_id and product_group = 'osh';
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;
