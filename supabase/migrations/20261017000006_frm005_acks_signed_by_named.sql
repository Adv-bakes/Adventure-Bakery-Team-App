-- FRM-005: each SQF Practitioner signs their own acknowledgement, from their own log-in.
--
-- Owner, 2026-10-17: the two acknowledgement lines could be ticked by whoever had the entry open
-- ("Sign as Richard Mercer" on Diana's acknowledgement). They now carry `signedBy` - the mechanism
-- FRM-952's employee acknowledgment uses: the line is never ticked on the filler's screen; the
-- filler (or an admin) sends a request to the person, suggested from the name above it, and that
-- person signs from their own log-in (sign_response_field writes that one answer, nothing else).
--
-- Both lines become required, so the designation cannot be submitted until both people have
-- accepted it - what each line's statement says they do.
--
-- "Designated by Senior Site Management" is unchanged (a verifier line, admin/owner).
-- The wording a person reads does not change, so the revision stays "New". Safe to run twice.

do $$
declare
  f jsonb;
  p_sb constant jsonb := '{"nameField": "primary_name", "note": "Please read FRM-005 and sign your acknowledgement as primary SQF Practitioner."}';
  s_sb constant jsonb := '{"nameField": "substitute_name", "note": "Please read FRM-005 and sign your acknowledgement as substitute SQF Practitioner."}';
begin
  select content->'form_schema'->'sections'->4->'fields' into f
    from public.sop_documents where sop_number = 'FRM-005' and status = 'active';
  if f is null or f->0->>'id' <> 'primary_ack' or f->0->>'type' <> 'signature'
     or f->1->>'id' <> 'substitute_ack' or f->1->>'type' <> 'signature' then
    raise exception 'FRM-005 acknowledgement lines are not where this migration expects them.';
  end if;
  if f->0->'signedBy' = p_sb and f->1->'signedBy' = s_sb
     and (f->0->>'required')::boolean and (f->1->>'required')::boolean then
    raise notice 'FRM-005: already set, left alone';
    return;
  end if;
  if f->0 ? 'signedBy' or f->1 ? 'signedBy' then raise exception 'FRM-005 already has a different signedBy.'; end if;
  if exists (select 1 from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id
              where d.sop_number = 'FRM-005' and r.status = 'submitted') then
    raise exception 'FRM-005 has a submitted entry; review the acknowledgement change against it first.';
  end if;

  update public.sop_documents
     set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                     '{form_schema,sections,4,fields,0,signedBy}', p_sb),
                     '{form_schema,sections,4,fields,1,signedBy}', s_sb),
                     '{form_schema,sections,4,fields,0,required}', 'true'),
                     '{form_schema,sections,4,fields,1,required}', 'true')
   where sop_number = 'FRM-005' and status = 'active';

  if public.requested_signature_field((select id from public.sop_documents where sop_number = 'FRM-005' and status = 'active'), 'primary_ack') is null then
    raise exception 'the server does not see primary_ack as a line a named person signs.';
  end if;
end $$;
