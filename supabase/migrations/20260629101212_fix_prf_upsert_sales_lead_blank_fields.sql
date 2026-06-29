-- Fix: prf_upsert_sales_lead trigger used COALESCE, which only backfills NULL
-- fields. An empty string ('') counted as "already filled", so a lead created
-- with blank contact_name/phone/company_name (e.g. from a partial intake)
-- never got backfilled by a later, more complete PRF submission.
-- Treat blank/whitespace-only strings as NULL on both insert and update.

CREATE OR REPLACE FUNCTION public.prf_upsert_sales_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lead_email text;
  new_company text;
  new_contact text;
  new_phone text;
BEGIN
  lead_email := nullif(trim(NEW.email), '');
  IF lead_email IS NULL THEN
    RETURN NEW;
  END IF;

  new_company := nullif(trim(NEW.company_name), '');
  new_contact := nullif(trim(NEW.founder_name), '');
  new_phone   := nullif(trim(NEW.phone), '');

  INSERT INTO public.sales_leads (email, company_name, contact_name, phone, profile_id)
  VALUES (lead_email, new_company, new_contact, new_phone, NEW.owner_user_id)
  ON CONFLICT ((lower(email)))
  DO UPDATE SET
    company_name = COALESCE(nullif(trim(public.sales_leads.company_name), ''), EXCLUDED.company_name),
    contact_name = COALESCE(nullif(trim(public.sales_leads.contact_name), ''), EXCLUDED.contact_name),
    phone        = COALESCE(nullif(trim(public.sales_leads.phone), ''), EXCLUDED.phone),
    profile_id   = COALESCE(public.sales_leads.profile_id, EXCLUDED.profile_id),
    -- if archived, restore to Lead In
    stage = CASE WHEN public.sales_leads.stage = 'Archived' THEN 'Lead In' ELSE public.sales_leads.stage END,
    stage_updated_at = CASE WHEN public.sales_leads.stage = 'Archived' THEN now() ELSE public.sales_leads.stage_updated_at END,
    archived_reason = CASE WHEN public.sales_leads.stage = 'Archived' THEN NULL ELSE public.sales_leads.archived_reason END,
    archived_at = CASE WHEN public.sales_leads.stage = 'Archived' THEN NULL ELSE public.sales_leads.archived_at END;

  RETURN NEW;
END;
$$;

-- One-time backfill: fill any existing sales_leads with blank/whitespace
-- company_name/contact_name/phone from the most recent prf_submissions row
-- (by email) that actually has a non-blank value for that field.
UPDATE public.sales_leads sl
SET
  company_name = COALESCE(nullif(trim(sl.company_name), ''), sub.company_name),
  contact_name = COALESCE(nullif(trim(sl.contact_name), ''), sub.contact_name),
  phone        = COALESCE(nullif(trim(sl.phone), ''), sub.phone)
FROM (
  SELECT
    lower(p.email) AS email_lower,
    (array_agg(p.company_name ORDER BY p.created_at DESC) FILTER (WHERE nullif(trim(p.company_name), '') IS NOT NULL))[1] AS company_name,
    (array_agg(p.founder_name ORDER BY p.created_at DESC) FILTER (WHERE nullif(trim(p.founder_name), '') IS NOT NULL))[1] AS contact_name,
    (array_agg(p.phone ORDER BY p.created_at DESC) FILTER (WHERE nullif(trim(p.phone), '') IS NOT NULL))[1] AS phone
  FROM public.prf_submissions p
  WHERE p.email IS NOT NULL AND length(trim(p.email)) > 0
  GROUP BY lower(p.email)
) sub
WHERE lower(sl.email) = sub.email_lower
  AND (
    nullif(trim(sl.company_name), '') IS NULL
    OR nullif(trim(sl.contact_name), '') IS NULL
    OR nullif(trim(sl.phone), '') IS NULL
  );
