-- prf_submissions.lead_id existed but was never actually populated by the
-- trigger that resolves/creates the matching sales_leads row — every PRF
-- (whether from the public Lead Prequalifier app or a staff "Add Deal" entry)
-- was only ever linked to its client by matching email strings as a runtime
-- fallback (see SalesClientFolder.tsx), not a real foreign key.
--
-- This fires the same trigger either way, so fixing it here covers both:
-- the public intake and manual staff entry both upsert sales_leads, then
-- stamp the resolved id back onto the PRF row.

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
  resolved_lead_id uuid;
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
    archived_at = CASE WHEN public.sales_leads.stage = 'Archived' THEN NULL ELSE public.sales_leads.archived_at END
  RETURNING id INTO resolved_lead_id;

  UPDATE public.prf_submissions SET lead_id = resolved_lead_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- One-time backfill: link every existing PRF to its lead by email match,
-- so older projects/PRFs get the real fk too, not just new ones going forward.
UPDATE public.prf_submissions p
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE p.lead_id IS NULL
  AND p.email IS NOT NULL
  AND lower(p.email) = lower(sl.email);
