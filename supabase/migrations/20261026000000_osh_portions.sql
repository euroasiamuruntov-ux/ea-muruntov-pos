-- Osh kirimini porsiya bilan kiritish (necha butun, necha yarim).
-- Ichkarida hisob hissa bilan yuritiladi (qozon = osh_stock.total_hissa), foydalanuvchi esa kg yoki
-- porsiyani ko'radi. Kg bilan kirim eskicha `add_stock_in` orqali qoladi.
--
-- Eski kod bilan mos: faqat yangi funksiya qo'shiladi.

create or replace function add_osh_portions(
  p_shift_id uuid,
  p_worker_id uuid,
  p_items jsonb,            -- [{"product_id": "...", "qty": 5}, ...]  qty = porsiya soni (butun son)
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_item record;
  v_prod products%rowtype;
  v_hissa numeric;
  v_total numeric := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'BAD_QTY';
  end if;

  perform 1 from shifts where id = p_shift_id and is_open for update;
  if not found then
    raise exception 'SHIFT_CLOSED';
  end if;

  for v_item in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::numeric) as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_item.qty is null or v_item.qty <= 0 or v_item.qty <> trunc(v_item.qty) then
      raise exception 'BAD_QTY';
    end if;

    select * into v_prod from products where id = v_item.product_id;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
    if v_prod.unit_type <> 'hissa' then
      raise exception 'NOT_OSH' using detail = v_prod.name;
    end if;

    v_hissa := v_item.qty * coalesce(nullif(v_prod.hissa_per_unit, 0), 1);

    -- Kirim qatori kg ko'rinishida yoziladi (boshqa kirimlar bilan bir xil), aniq hissa saqlanadi
    insert into stock_ins (shift_id, product_id, qty, worker_id, source, note)
    values (p_shift_id, v_prod.id,
            v_hissa / coalesce(nullif(v_prod.kg_to_hissa, 0), 21),
            p_worker_id, 'manual', p_note);

    v_total := v_total + v_hissa;

    if not v_prod.is_available then
      update products set is_available = true where id = v_prod.id;
    end if;
  end loop;

  update osh_stock set total_hissa = coalesce(total_hissa, 0) + v_total, updated_at = now()
   where shift_id = p_shift_id and product_group = 'osh';
  if not found then
    insert into osh_stock (shift_id, product_group, total_hissa)
    values (p_shift_id, 'osh', v_total);
  end if;

  return jsonb_build_object('hissa', v_total);
end;
$$;
