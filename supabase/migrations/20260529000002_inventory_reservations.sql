create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.production_orders(id) on delete cascade,
  ingredient_name text not null,
  reserved_lbs numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.inventory_reservations enable row level security;

create policy "Staff/admin all inventory_reservations" on public.inventory_reservations
  for all to authenticated
  using (is_staff_or_admin(auth.uid()))
  with check (is_staff_or_admin(auth.uid()));
