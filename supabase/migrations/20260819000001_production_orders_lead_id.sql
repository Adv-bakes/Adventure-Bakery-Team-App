-- Give a production order the identity it was created with.
--
-- The New Order dialogs ask the operator to pick a SALES LEAD, build the product list from that
-- lead's PRFs, and then store `client_id = lead.profile_id` -- discarding the lead. That is only
-- lossless while profile -> lead is one-to-one, and it is not: two leads (Morini Brands and
-- Guilt Free Bites LLC) share profile 0ec912f6, which is in fact an Adventure Bakery staff
-- account standing in as the customer. The consequences were all silent:
--   * Order Board picked whichever lead the name map happened to write last (Guilt Free Bites),
--     so Morini's Bahama Burger order was filed under the wrong company
--   * OrderDetail's .maybeSingle() lookup errored with PGRST116 on the two matching rows, the
--     error was discarded, and the raw client_id UUID was shown as the client name -- which then
--     seeded the generated order_number
--   * both client folders listed each other's orders, because both query orders by profile id
--
-- lead_id stays nullable: legacy rows whose items cannot be resolved to exactly one lead keep a
-- null and continue to fall back to the profile lookup, rather than being guessed at.

alter table public.production_orders
  add column if not exists lead_id uuid references public.sales_leads(id);

create index if not exists production_orders_lead_id_idx
  on public.production_orders (lead_id);

comment on column public.production_orders.lead_id is
  'The sales_leads row this order was placed for. Authoritative owner of the order; client_id is the client''s auth profile and is NOT unique per lead.';

-- Backfill from the order's own line items. items[].product_id is a prf_submissions id, and a
-- PRF names exactly one lead, so this recovers the lead the operator actually picked. Orders
-- whose items disagree are left null and reported below rather than guessed.
with items_expanded as (
  select o.id as order_id,
         it->>'product_id' as product_id
  from public.production_orders o
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
  ) as it
  where o.lead_id is null
),
resolved as (
  select e.order_id,
         count(distinct p.lead_id) as lead_count,
         min(p.lead_id::text)::uuid as lead_id
  from items_expanded e
  join public.prf_submissions p
    on p.id = e.product_id::uuid
  where e.product_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and p.lead_id is not null
  group by e.order_id
)
update public.production_orders o
set    lead_id = r.lead_id
from   resolved r
where  o.id = r.order_id
  and  r.lead_count = 1;

do $$
declare
  total     integer;
  filled    integer;
  unfilled  integer;
  stragglers text;
begin
  select count(*) into total    from public.production_orders;
  select count(*) into filled   from public.production_orders where lead_id is not null;
  select count(*) into unfilled from public.production_orders where lead_id is null;

  select string_agg(id::text, ', ') into stragglers
  from public.production_orders where lead_id is null;

  raise notice 'production_orders_lead_id: % of % order(s) resolved to a lead; % left null',
    filled, total, unfilled;
  if unfilled > 0 then
    raise notice 'production_orders_lead_id: unresolved order ids (they keep the profile fallback): %',
      coalesce(stragglers, '(none)');
  end if;
end
$$;
