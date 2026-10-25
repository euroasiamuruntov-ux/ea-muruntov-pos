-- Davr bo'yicha taomlar sotuvi (Rahbar Tarix tabida "eng ko'p sotilganlar").
-- Bazaning o'zida hisoblanadi, shuning uchun ro'yxat qancha katta bo'lsa ham to'liq va tez.
-- Faqat yangi funksiya qo'shiladi (eski kod bilan mos).
create or replace function period_sales(p_from timestamptz, p_to timestamptz)
returns table (
  product_id uuid,
  name text,
  qty bigint,           -- sotilgan (ichkisiz)
  internal_qty bigint,  -- xodimlar ichki iste'moli
  revenue numeric       -- narx bo'yicha tushum (ichkisiz)
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.name,
    coalesce(sum(oi.qty) filter (where o.pay_type <> 'ichki'), 0)::bigint,
    coalesce(sum(oi.qty) filter (where o.pay_type = 'ichki'), 0)::bigint,
    coalesce(sum(oi.qty * oi.price) filter (where o.pay_type <> 'ichki'), 0)
  from order_items oi
  join orders o on o.id = oi.order_id
  join shifts s on s.id = o.shift_id
  join products p on p.id = oi.product_id
  where s.opened_at >= p_from and s.opened_at <= p_to
  group by p.id, p.name
  order by 3 desc, 2;
$$;
