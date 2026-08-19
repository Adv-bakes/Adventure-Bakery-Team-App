-- Repair order numbers that were built from the wrong client's name.
--
-- OrderDetail generates `<initials>-<MMDDYY>` from whatever it resolved as the client name, once,
-- and stores it. While the client was resolved through the shared profile (see
-- 20260819000001_production_orders_lead_id.sql) that name could be the wrong company, so the wrong
-- initials were baked into a permanent identifier: order 7a027d49 is Morini Brands' but carries
-- GFB-073126, Guilt Free Bites' initials. The identity fix does not correct it, because the
-- generator only fires when order_number is null.
--
-- Only the INITIALS are rewritten; the existing -MMDDYY suffix is preserved verbatim. That is
-- deliberate -- the date half is already correct, and recomputing it here would reintroduce a
-- discrepancy, since the app derives it from created_at in the BROWSER's timezone and this runs
-- in the database's.
--
-- An order number is a customer-facing identifier, so rows where it may already have left the
-- building are excluded: anything with a QuickBooks estimate sent or accepted, or a confirmed
-- deposit, keeps the number it has. Fixing a stale label is not worth breaking reconciliation
-- against a document someone already holds.

with candidates as (
  select o.id,
         o.order_number,
         coalesce(nullif(trim(l.company_name), ''), nullif(trim(l.email), '')) as source_name
  from   public.production_orders o
  join   public.sales_leads l on l.id = o.lead_id
  where  o.order_number ~ '^[A-Za-z]+-[0-9]{6}$'
    and  o.qb_estimate_sent_at is null
    and  o.qb_estimate_accepted_at is null
    and  o.deposit_confirmed_at is null
),
computed as (
  select c.id,
         c.order_number,
         -- Mirrors the app: first letter of each of the first three words, uppercased.
         coalesce((
           select string_agg(upper(left(u.word, 1)), '' order by u.ord)
           from   unnest(regexp_split_to_array(trim(c.source_name), '\s+'))
                    with ordinality as u(word, ord)
           where  u.word <> '' and u.ord <= 3
         ), 'AB') as initials
  from   candidates c
  where  c.source_name is not null
)
update public.production_orders o
set    order_number = cm.initials || substring(cm.order_number from position('-' in cm.order_number))
from   computed cm
where  o.id = cm.id
  and  split_part(cm.order_number, '-', 1) <> cm.initials;

do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select o.id, o.order_number, l.company_name
    from   public.production_orders o
    join   public.sales_leads l on l.id = o.lead_id
    where  o.order_number is not null
    order  by o.created_at
  loop
    n := n + 1;
    raise notice 'order_number_client_initials: % -> % (%)', r.id, r.order_number, r.company_name;
  end loop;
  raise notice 'order_number_client_initials: % order(s) carry a number', n;

  for r in
    select o.id, o.order_number
    from   public.production_orders o
    where  o.order_number ~ '^[A-Za-z]+-[0-9]{6}$'
      and  (o.qb_estimate_sent_at is not null
            or o.qb_estimate_accepted_at is not null
            or o.deposit_confirmed_at is not null)
  loop
    raise notice 'order_number_client_initials: SKIPPED % (%) -- already sent/accepted/paid, left as is',
      r.id, r.order_number;
  end loop;
end
$$;
