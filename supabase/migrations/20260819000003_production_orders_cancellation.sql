-- Record how an order was cancelled.
--
-- There was no way to cancel or delete an order in the app at all -- orders only ever moved
-- forward through the six stages. The schema half-anticipated it: OrderBoard, ClientOrders and
-- SalesClientFolder all query `.neq(status, 'Archived')`, so an archived order already disappears
-- from every list, but nothing ever set that status. The exit was framed and never cut.
--
-- Cancelling is a soft archive, so the columns below are what stop it from being a silent
-- deletion: an order that was placed and then cancelled is a business fact, and "it vanished" is
-- not a record of it. Naming mirrors sales_leads (archived_at / archived_reason), which is the
-- existing convention for the same idea.

alter table public.production_orders
  add column if not exists archived_at     timestamptz,
  add column if not exists archived_by     uuid references auth.users(id),
  add column if not exists archived_reason text;

comment on column public.production_orders.archived_at is
  'When the order was cancelled. Set together with status = ''Archived''.';
comment on column public.production_orders.archived_reason is
  'Why it was cancelled. Required by the UI -- a cancellation with no reason is a poor record.';

-- Partial index: the only queries that care are "show me cancelled orders", and every list view
-- excludes them, so there is no point indexing the ~all-null majority.
create index if not exists production_orders_archived_at_idx
  on public.production_orders (archived_at)
  where archived_at is not null;

do $$
declare
  n integer;
begin
  select count(*) into n from public.production_orders where status = 'Archived';
  raise notice 'production_orders_cancellation: % order(s) currently archived', n;
end
$$;
