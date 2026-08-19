-- Stop recording an Adventure Bakery staff member as the customer.
--
-- Profile 0ec912f6 is Gabriela Juncos-Mercer (Gabriela@AdventureBakes.com), an admin+owner staff
-- account. It was stamped into the client-identity columns of two leads -- Morini Brands and
-- Guilt Free Bites LLC -- so the database asserted one staff member was both companies.
--
-- AddClientFlow/AddDealDialog already stopped doing this and says why in a comment: "this is a
-- staff member manually logging a deal, not a real client portal account. Stamping the staff
-- member's own id would make sales_leads.profile_id collide with every other deal that staffer
-- manually adds." These two rows predate that fix, and the collision it predicted is exactly what
-- happened -- see 20260819000001, where an order for Morini rendered as Guilt Free Bites.
--
-- NULL is the correct value, not a substitute id: neither company has a portal account (no
-- profiles row exists for cmorinisr@morinibrands.com or hi@gfbmarket.com), and null is precisely
-- what the current code writes for a staff-entered deal.
--
-- This RESTORES access rather than removing it. The prf_submissions client policies are
-- `auth.uid() = owner_user_id`, and claim_prfs_for_new_user() claims a PRF for a new auth user
-- with a matching email -- but only `WHERE owner_user_id IS NULL`. While a staff id sits there,
-- the real customer can never claim their own PRF. Nothing is lost meanwhile: no client account
-- exists to lose access, and staff/admin policies are unaffected.
--
-- Every statement is guarded on the exact profile id, so re-running is a no-op and a row that has
-- since been pointed at a genuine client account is never touched.

-- Order identity now lives in production_orders.lead_id (20260819000001), so client_id no longer
-- carries meaning for these rows.
update public.production_orders
set    client_id = null
where  client_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';

update public.client_documents
set    user_id = null
where  user_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';

update public.batch_sheets
set    client_user_id = null
where  client_user_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';

update public.prf_submissions
set    owner_user_id = null
where  owner_user_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';

update public.sales_leads
set    profile_id = null
where  profile_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';

do $$
declare
  -- text, not uuid, and every column is cast to text below. These columns are not all the same
  -- type -- one of them is text -- so a typed uuid variable fails with
  -- "operator does not exist: text = uuid". The UPDATEs above are unaffected: a bare string
  -- literal is coerced to whatever the column happens to be.
  staff constant text := '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';
  remaining integer := 0;
  n integer;
  other integer;
begin
  select count(*) into n from public.production_orders where client_id::text = staff;
  remaining := remaining + n; raise notice 'unlink_staff_profile: production_orders.client_id still set: %', n;

  select count(*) into n from public.client_documents where user_id::text = staff;
  remaining := remaining + n; raise notice 'unlink_staff_profile: client_documents.user_id still set: %', n;

  select count(*) into n from public.batch_sheets where client_user_id::text = staff;
  remaining := remaining + n; raise notice 'unlink_staff_profile: batch_sheets.client_user_id still set: %', n;

  select count(*) into n from public.prf_submissions where owner_user_id::text = staff;
  remaining := remaining + n; raise notice 'unlink_staff_profile: prf_submissions.owner_user_id still set: %', n;

  select count(*) into n from public.sales_leads where profile_id::text = staff;
  remaining := remaining + n; raise notice 'unlink_staff_profile: sales_leads.profile_id still set: %', n;

  if remaining = 0 then
    raise notice 'unlink_staff_profile: clean -- no client-identity column references the staff profile';
  else
    raise warning 'unlink_staff_profile: % reference(s) remain', remaining;
  end if;

  -- Any OTHER lead still pointing at an account that holds a staff role is the same bug with a
  -- different id. Reported, never changed automatically: only a person can say whether an address
  -- belongs to the customer or to us.
  select count(*) into other
  from   public.sales_leads l
  join   public.user_roles ur on ur.user_id::text = l.profile_id::text
  where  ur.role::text in ('admin', 'owner', 'staff');

  if other > 0 then
    raise warning 'unlink_staff_profile: % lead(s) still point at a profile holding a staff role -- review sales_leads.profile_id', other;
  end if;
end
$$;
