alter table public.shelf_life
  add column if not exists shelf_life_unit text default 'days';
