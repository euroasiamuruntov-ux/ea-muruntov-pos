-- Kassir uchun "tez-tez sotiladigan" taomlar: Rahbar Menyuda yulduzcha bilan belgilaydi,
-- kassir panelida tepada alohida qatorda ko'rinadi.
-- Eski kod bilan mos (yangi ustun default qiymatli).
alter table products add column if not exists is_favorite boolean not null default false;
