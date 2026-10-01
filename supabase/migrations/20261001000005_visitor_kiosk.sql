-- Visitor kiosk: sign visitors in on an entrance tablet with no member of staff logged in.
--
-- The sign-in screen (20261001000002) ran inside a staff session, so a host had to hand over
-- their own logged-in tablet. The entrance tablet instead signs in ONCE as a dedicated account
-- holding a new role, 'kiosk', and is left that way.
--
-- THE KIOSK ROLE GETS NO TABLE ACCESS AT ALL. It is outside is_staff_or_admin() and outside
-- is_compliance_viewer(), so every RLS policy in the system refuses it: no documents, no entries,
-- no profiles, no training. A tablet left at the door is one a stranger can pick up, so what it
-- can reach is exactly the four functions below and nothing else - each does one thing, checks the
-- caller, and returns only what the screen shows.
--
--   visitor_desk_context()  the two forms' schemas, the names of the team (to answer "who are you
--                           here to see?"), and who is on site now.
--   visitor_lookup(query)   the acknowledgements that could belong to whoever typed the query.
--                           Refuses fewer than four digits or two letters, so the list of people
--                           who have visited cannot be paged through.
--   visitor_sign_in(...)    writes the FRM-906 acknowledgement (when one is needed) and the
--                           FRM-905 visit in ONE transaction, already submitted.
--   sign_out_visitor(...)   unchanged in what it does; now also callable by the kiosk.
--
-- Staff use the same functions from the portal page, so there is one path, not two.
--
-- visitor_sign_in DOES NOT TRUST THE TABLET for the things that make the record worth having: the
-- form number and revision are pinned from the live documents, the caller's revisions must match
-- them, unknown answer keys are rejected, the signature must be a PNG of sane size, and a visit
-- that claims to rely on an earlier acknowledgement is checked against that acknowledgement
-- (submitted, current revision, less than twelve months old).
--
-- user_roles.role is TEXT with a CHECK (20260714000005), so the new role is a constraint change,
-- not an enum change. A kiosk account is created like any other: invite it from the HR directory
-- with the role Kiosk and open the invitation link on the tablet.

begin;

-- ------------------------------------------------------------------ the role
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role = any (array[
    'owner'::text, 'admin'::text, 'staff'::text, 'auditor'::text, 'user'::text, 'kiosk'::text,
    -- legacy values kept for back-compat with any historical rows
    'manager'::text, 'customer'::text
  ]));

create or replace function public.is_visitor_desk(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_staff_or_admin(_user_id) or public.has_role(_user_id, 'kiosk');
$$;

-- ------------------------------------------------------------------ invitations
-- Identical to 20260827000007 except that 'kiosk' is an invitable role. It needs no department:
-- a kiosk is not a person and is assigned no training.
create or replace function public.create_team_invitation(_email text, _role text, _department text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_token text;
  v_dept  text := NULLIF(trim(_department), '');
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins or owners can invite team members';
  END IF;
  IF _role NOT IN ('owner', 'admin', 'staff', 'auditor', 'user', 'kiosk') THEN
    RAISE EXCEPTION 'Invalid role: %', _role;
  END IF;
  IF _role IN ('owner', 'admin') AND NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only an owner can invite an owner or admin';
  END IF;

  -- Roles that receive training must say which department, or their job-specific modules are
  -- never assigned and the gap is invisible.
  IF _role IN ('owner', 'admin', 'staff') AND v_dept IS NULL THEN
    RAISE EXCEPTION 'A department is required when inviting a % — training is assigned by '
                    'department, so without one this person receives only the all-staff modules '
                    'and appears fully trained.', _role;
  END IF;

  -- A department the app does not offer matches no module, failing exactly as silently as none.
  IF v_dept IS NOT NULL
     AND v_dept NOT IN ('Production', 'Sourcing', 'Quality Control', 'Admin', 'R&D', 'Sales') THEN
    RAISE EXCEPTION 'Unknown department: %. Valid departments are Production, Sourcing, '
                    'Quality Control, Admin, R&D, Sales.', v_dept;
  END IF;

  INSERT INTO public.client_invitations (email, invited_by, invite_kind, role, department)
  VALUES (lower(trim(_email)), auth.uid(), 'team', _role, v_dept)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$function$;

-- ------------------------------------------------------------------ helpers
-- Case, accents and punctuation folded, so "José  Pérez" is found by "jose perez". Mirrors
-- normalizeName() in src/lib/visitors.ts, which does the exact matching on what this returns.
create or replace function public.visitor_fold(_s text)
returns text
language sql immutable
as $$
  select btrim(regexp_replace(
           translate(lower(coalesce(_s, '')),
                     'áàâäãåéèêëíìîïóòôöõúùûüñç',
                     'aaaaaaeeeeiiiiooooouuuunc'),
           '[^a-z0-9]+', ' ', 'g'));
$$;

-- ------------------------------------------------------------------ context
create or replace function public.visitor_desk_context()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_forms   jsonb;
  v_staff   jsonb;
  v_on_site jsonb;
begin
  if not public.is_visitor_desk(auth.uid()) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  select jsonb_object_agg(d.sop_number, jsonb_build_object(
           'id', d.id, 'sop_number', d.sop_number, 'revision', d.revision,
           'form_schema', d.content->'form_schema'))
    into v_forms
    from public.sop_documents d
   where d.sop_number in ('FRM-905', 'FRM-906') and d.status = 'active' and d.type = 'form';

  -- Names only: this is what a visitor taps to say who they are here to see.
  select coalesce(jsonb_agg(n order by n), '[]'::jsonb)
    into v_staff
    from (select distinct btrim(p.full_name) as n
            from public.profiles p
           where nullif(btrim(coalesce(p.full_name, '')), '') is not null
             and exists (select 1 from public.user_roles ur
                          where ur.user_id = p.id and ur.role in ('owner', 'admin', 'staff'))) s;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'name', coalesce(r.data->>'visitor_name', ''),
           'company', coalesce(r.data->>'company', ''),
           'host', coalesce(r.data->>'host', ''),
           'visit_date', coalesce(r.data->>'visit_date', ''),
           'time_in', coalesce(r.data->>'time_in', '')) order by r.created_at desc), '[]'::jsonb)
    into v_on_site
    from public.sop_document_responses r
   where r.form_number = 'FRM-905'
     and r.status = 'submitted'
     and nullif(btrim(coalesce(r.data->>'time_out', '')), '') is null
     and coalesce(r.data->>'visit_date', '') >= to_char(current_date - 31, 'YYYY-MM-DD');

  return jsonb_build_object('forms', coalesce(v_forms, '{}'::jsonb), 'staff', v_staff, 'on_site', v_on_site);
end $$;

-- ------------------------------------------------------------------ lookup
create or replace function public.visitor_lookup(_query text)
returns table (id uuid, form_revision text, ack_date text, name text, company text, phone text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_q      text := btrim(coalesce(_query, ''));
  v_digits text := regexp_replace(v_q, '\D', '', 'g');
  v_folded text := public.visitor_fold(v_q);
  v_phone  boolean := length(v_digits) >= 4 and v_q !~* '[a-z]';
  v_word   text := split_part(v_folded, ' ', 1);
begin
  if not public.is_visitor_desk(auth.uid()) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  -- Too little typed: nobody. The visitor list is never shown to somebody who has not said who
  -- they are.
  if not v_phone and length(v_folded) < 2 then
    return;
  end if;

  return query
    select r.id, r.form_revision,
           coalesce(r.data->>'ack_date', ''), coalesce(r.data->>'visitor_name', ''),
           coalesce(r.data->>'company', ''), coalesce(r.data->>'phone', '')
      from public.sop_document_responses r
     where r.form_number = 'FRM-906'
       and r.status = 'submitted'
       and case
             when v_phone then
               length(regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g')) >= 4
               and right(regexp_replace(r.data->>'phone', '\D', '', 'g'), 4) = right(v_digits, 4)
             else
               (' ' || public.visitor_fold(coalesce(r.data->>'visitor_name', '') || ' ' || coalesce(r.data->>'company', '')))
                 like '% ' || v_word || '%'
           end
     order by r.submitted_at desc
     limit 50;
end $$;

-- ------------------------------------------------------------------ sign in
create or replace function public.visitor_sign_in(
  _visit        jsonb,
  _ack          jsonb,
  _revision_905 text,
  _revision_906 text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  d905       record;
  d906       record;
  v_refused  boolean;
  v_ack_id   uuid;
  v_ack_date text;
  v_visit_id uuid;
  v_prior    record;
  v_bad      text;
  v_png      constant text := '^data:image/png;base64,[A-Za-z0-9+/=]+$';
begin
  if not public.is_visitor_desk(v_uid) then
    raise exception 'Not permitted to sign a visitor in.' using errcode = '42501';
  end if;

  select d.id, d.revision, d.content->'form_schema' as schema into d905
    from public.sop_documents d where d.sop_number = 'FRM-905' and d.status = 'active' and d.type = 'form';
  select d.id, d.revision, d.content->'form_schema' as schema into d906
    from public.sop_documents d where d.sop_number = 'FRM-906' and d.status = 'active' and d.type = 'form';
  if d905.id is null or d906.id is null then
    raise exception 'The visitor forms are not available.';
  end if;
  -- A tablet left open over a revision would otherwise pin today's entry to a form it never showed.
  if d905.revision is distinct from _revision_905 or d906.revision is distinct from _revision_906 then
    raise exception 'The visitor forms have been revised. Please start this sign-in again.';
  end if;

  if _visit is null or jsonb_typeof(_visit) <> 'object' then
    raise exception 'The sign-in is incomplete.';
  end if;

  -- Only answers the form actually has.
  select string_agg(k, ', ') into v_bad
    from jsonb_object_keys(_visit) k
   where k not in (select f->>'id' from jsonb_array_elements(d905.schema->'sections') s,
                                         jsonb_array_elements(s->'fields') f);
  if v_bad is not null then
    raise exception 'Unknown answers for FRM-905: %', v_bad;
  end if;

  if nullif(btrim(coalesce(_visit->>'visitor_name', '')), '') is null
     or nullif(btrim(coalesce(_visit->>'purpose', '')), '') is null
     or nullif(btrim(coalesce(_visit->>'host', '')), '') is null
     or coalesce(_visit->>'visit_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(_visit->>'time_in', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
     or coalesce(_visit->>'no_symptoms', '') not in ('pass', 'fail') then
    raise exception 'The sign-in is incomplete.';
  end if;
  if coalesce(_visit#>>'{visitor_signature,image}', '') !~ v_png
     or length(_visit#>>'{visitor_signature,image}') > 300000
     or nullif(btrim(coalesce(_visit#>>'{visitor_signature,name}', '')), '') is null then
    raise exception 'The visitor has not signed.';
  end if;

  v_refused := _visit->>'no_symptoms' = 'fail';

  if _ack is not null and jsonb_typeof(_ack) = 'object' and not v_refused then
    select string_agg(k, ', ') into v_bad
      from jsonb_object_keys(_ack) k
     where k not in (select f->>'id' from jsonb_array_elements(d906.schema->'sections') s,
                                           jsonb_array_elements(s->'fields') f);
    if v_bad is not null then
      raise exception 'Unknown answers for FRM-906: %', v_bad;
    end if;
    if nullif(btrim(coalesce(_ack->>'visitor_name', '')), '') is null
       or coalesce(_ack->>'ack_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or coalesce(_ack#>>'{visitor_signature,image}', '') !~ v_png
       or length(_ack#>>'{visitor_signature,image}') > 300000 then
      raise exception 'The acknowledgement is incomplete.';
    end if;

    insert into public.sop_document_responses
      (document_id, form_number, form_revision, data, status, created_by, submitted_by, submitted_at)
    values
      (d906.id, 'FRM-906', d906.revision,
       jsonb_set(_ack, '{visitor_signature,witnessed_by}', to_jsonb(v_uid::text)),
       'submitted', v_uid, v_uid, now())
    returning id into v_ack_id;
    v_ack_date := _ack->>'ack_date';

  elsif not v_refused then
    -- Relying on an acknowledgement already on file: it has to be one, and it has to still count.
    begin
      v_ack_id := nullif(btrim(coalesce(_visit->>'ack_response_id', '')), '')::uuid;
    exception when others then
      v_ack_id := null;
    end;
    select r.form_revision, r.data->>'ack_date' as ack_date into v_prior
      from public.sop_document_responses r
     where r.id = v_ack_id and r.form_number = 'FRM-906' and r.status = 'submitted';
    if v_prior.ack_date is null then
      raise exception 'No signed acknowledgement is on file for this visitor. Please start again and read the rules.';
    end if;
    if v_prior.form_revision is distinct from d906.revision
       or (v_prior.ack_date::date + interval '12 months')::date <= (_visit->>'visit_date')::date then
      raise exception 'That acknowledgement is no longer valid. Please start again and read the rules.';
    end if;
    v_ack_date := v_prior.ack_date;
  end if;

  -- The acknowledgement relied on is the server's answer, never the tablet's.
  _visit := _visit || jsonb_build_object(
              'ack_response_id', coalesce(v_ack_id::text, ''),
              'ack_date', coalesce(v_ack_date, ''));
  _visit := jsonb_set(_visit, '{visitor_signature,witnessed_by}', to_jsonb(v_uid::text));

  insert into public.sop_document_responses
    (document_id, form_number, form_revision, data, status, created_by, submitted_by, submitted_at)
  values
    (d905.id, 'FRM-905', d905.revision, _visit, 'submitted', v_uid, v_uid, now())
  returning id into v_visit_id;

  return jsonb_build_object('visit_id', v_visit_id, 'ack_id', v_ack_id);
end $$;

-- ------------------------------------------------------------------ sign out
-- Same function as 20261001000003; the only change is who may call it.
create or replace function public.sign_out_visitor(
  _response_id uuid,
  _time_out    text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number  text;
  v_status  text;
  v_current text;
begin
  if not public.is_visitor_desk(auth.uid()) then
    raise exception 'Not permitted to sign a visitor out.' using errcode = '42501';
  end if;
  if _time_out is null or _time_out !~ '^([01]\d|2[0-3]):[0-5]\d$' then
    raise exception 'Time out must be HH:MM.';
  end if;

  select r.form_number, r.status, nullif(btrim(coalesce(r.data->>'time_out', '')), '')
    into v_number, v_status, v_current
    from public.sop_document_responses r
   where r.id = _response_id
     for update;

  if v_number is null then
    raise exception 'That visitor entry no longer exists.';
  end if;
  if v_number <> 'FRM-905' then
    raise exception 'Only a Visitor Sign-In Log (FRM-905) entry can be signed out.';
  end if;
  if v_status <> 'submitted' then
    raise exception 'That entry is still a draft; record the time out on the entry itself.';
  end if;
  if v_current is not null then
    raise exception 'That visitor was already signed out at %.', v_current;
  end if;

  update public.sop_document_responses
     set data       = data || jsonb_build_object('time_out', _time_out),
         updated_by = auth.uid()
   where id = _response_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.is_visitor_desk(uuid)                         from public;
revoke all on function public.visitor_desk_context()                        from public, anon;
revoke all on function public.visitor_lookup(text)                          from public, anon;
revoke all on function public.visitor_sign_in(jsonb, jsonb, text, text)     from public, anon;
revoke all on function public.sign_out_visitor(uuid, text)                  from public;
grant execute on function public.is_visitor_desk(uuid)                      to authenticated;
grant execute on function public.visitor_desk_context()                     to authenticated;
grant execute on function public.visitor_lookup(text)                       to authenticated;
grant execute on function public.visitor_sign_in(jsonb, jsonb, text, text)  to authenticated;
grant execute on function public.sign_out_visitor(uuid, text)               to authenticated;

do $$
declare
  src text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_team_invitation';
  -- every guard of the previous version must have survived the rewrite
  if src not like '%A department is required when inviting%'
     or src not like '%Unknown department%'
     or src not like '%Only admins or owners can invite team members%'
     or src not like '%Only an owner can invite an owner or admin%'
     or src not like '%SECURITY DEFINER%' then
    raise exception 'create_team_invitation lost a guard in the rewrite.';
  end if;
  if src not like '%''kiosk''%' then
    raise exception 'create_team_invitation does not accept the kiosk role.';
  end if;
  -- the kiosk must stay outside the two helpers every table policy is written against
  if (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'is_staff_or_admin') like '%kiosk%'
     or (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'is_compliance_viewer') like '%kiosk%' then
    raise exception 'The kiosk role must not be a staff or compliance-viewer role.';
  end if;
  if public.visitor_fold('José  Pérez-O''Neil') <> 'jose perez o neil' then
    raise exception 'visitor_fold is wrong: %', public.visitor_fold('José  Pérez-O''Neil');
  end if;
end $$;

commit;
