-- REP-905 Visitor Log - a report over the FRM-905 visitor sign-in entries (owner, 2026-10-02).
--
-- FRM-014's food defense review asks whether visitors and contractors signed in and out. Until now that
-- meant opening FRM-905 entries one at a time. REP-905 lists them: one line per visit, with who they came
-- to see, time in and out, whether they signed out, and whether entry was refused. A derived report
-- (src/lib/formReport.ts): type 'report', no entries of its own, same pattern as REP-007 over FRM-007.
--
-- sourceStatus is "submitted": the kiosk writes each visit already submitted (visitor_sign_in), so there
-- are no drafts to miss - the opposite of REP-007, where open CAPAs are drafts.
-- Every column and parameter names a field FRM-905 v5 has, and the Entry map keys are its entry_route
-- options exactly (em dash included); the generator asserts both, and the guard below re-checks the fields.
--
-- Draft, like the D-22 documents it serves. It also points the two D-22 drafts at the report:
--   FRM-014  the review line now names REP-905 (a fixed row label; answers are kept by position)
--   FSQM-025 the visitor-record line and the records list name REP-905
-- Both guarded on their md5 as pushed in 20261002000004 (attachments excluded).

begin;

do $guard$
declare h text; missing text;
begin
  if exists (select 1 from public.sop_documents where sop_number = 'REP-905') then
    raise exception 'REP-905 already exists.';
  end if;
  select string_agg(n, ', ') into missing
    from unnest(array['ack_date', 'ack_response_id', 'areas', 'company', 'entry_notes', 'entry_route', 'escort_name', 'health_notes', 'host', 'no_symptoms', 'purpose', 'time_in', 'time_out', 'visit_date', 'visitor_name', 'wounds_covered']) n
   where not exists (select 1 from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                              jsonb_array_elements(s->'fields') f
                      where d.sop_number = 'FRM-905' and d.status = 'active' and f->>'id' = n);
  if missing is not null then raise exception 'FRM-905 no longer has: %', missing; end if;
  select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = 'FRM-014' and status = 'draft';
  if h is distinct from '74f2a0b15366f2a50672faf5758882e7' then raise exception 'FRM-014 is not the draft that was reviewed (md5 %).', h; end if;
  select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = 'FSQM-025' and status = 'draft';
  if h is distinct from '7536570dbc540cd2b62844d6e759f536' then raise exception 'FSQM-025 is not the draft that was reviewed (md5 %).', h; end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values ('REP-905', 'Visitor Log', 'report', 'Module 11', 'draft', 'New', '2.7.1.2, 11.3.4.1', true,
        jsonb_build_object('report_schema', $rep${
 "version": 1,
 "sourceSopNumber": "FRM-905",
 "sourceStatus": "submitted",
 "defaultDateField": "visit_date",
 "columns": [
  {
   "id": "date",
   "header": "Date",
   "source": {
    "kind": "field",
    "field": "visit_date"
   }
  },
  {
   "id": "visitor",
   "header": "Visitor",
   "source": {
    "kind": "field",
    "field": "visitor_name"
   }
  },
  {
   "id": "company",
   "header": "Company",
   "source": {
    "kind": "field",
    "field": "company"
   }
  },
  {
   "id": "purpose",
   "header": "Purpose",
   "source": {
    "kind": "field",
    "field": "purpose"
   }
  },
  {
   "id": "host",
   "header": "Here to see",
   "source": {
    "kind": "field",
    "field": "host"
   }
  },
  {
   "id": "time_in",
   "header": "In",
   "source": {
    "kind": "field",
    "field": "time_in"
   }
  },
  {
   "id": "time_out",
   "header": "Out",
   "source": {
    "kind": "field",
    "field": "time_out"
   }
  },
  {
   "id": "signed_out",
   "header": "Signed out",
   "source": {
    "kind": "cases",
    "default": "No",
    "cases": [
     {
      "field": "time_out",
      "op": "notEmpty",
      "then": "Yes"
     }
    ]
   }
  },
  {
   "id": "entry",
   "header": "Entry",
   "source": {
    "kind": "map",
    "field": "entry_route",
    "fallback": "",
    "map": {
     "Briefed — FRM-906 completed and signed": "Briefed",
     "Escorted at all times by an authorized employee": "Escorted",
     "Both": "Briefed and escorted",
     "Entry refused": "REFUSED"
    }
   }
  },
  {
   "id": "ack_date",
   "header": "GMP rules signed",
   "source": {
    "kind": "field",
    "field": "ack_date"
   }
  }
 ],
 "params": [
  {
   "id": "visited_between",
   "label": "Visited between",
   "type": "date-range",
   "field": "visit_date"
  },
  {
   "id": "visitor",
   "label": "Visitor",
   "type": "text",
   "field": "visitor_name",
   "op": "contains"
  },
  {
   "id": "purpose",
   "label": "Purpose",
   "type": "select",
   "column": "purpose"
  },
  {
   "id": "signed_out",
   "label": "Signed out",
   "type": "select",
   "column": "signed_out"
  },
  {
   "id": "entry",
   "label": "Entry",
   "type": "select",
   "column": "entry"
  }
 ],
 "legend": [
  "Every visitor and contractor signed in on the entrance screen (FRM-905), one line per visit. The record of who entered the site, for FSQM-025 (SQF 2.7.1.2 vii) and FSQM-012 Part 6.",
  "Signed out: No means the visitor never signed out on the screen. Entry: REFUSED means the visitor declared a symptom and was not let in; the visit is still recorded.",
  "GMP rules signed: the date of the FRM-906 acknowledgement the visit relied on. It is valid for twelve months."
 ]
}$rep$::jsonb, 'attachments', '[]'::jsonb));

-- FRM-014: the review line names the report
update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(
                             case when f->>'id' = 'defense_checks'
                                  then jsonb_set(f, '{rows,labels}', (
                                         select jsonb_agg(case when l = to_jsonb($t$Visitors and contractors signed in and out on FRM-905 - recent entries looked at$t$::text) then to_jsonb($t$Visitors and contractors signed in and out - the Visitor Log (REP-905) looked at$t$::text) else l end order by lo)
                                           from jsonb_array_elements(f->'rows'->'labels') with ordinality z(l, lo)))
                                  else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-014' and d.status = 'draft';

-- FSQM-025: the visitor-record line and the records list name the report
update public.sop_documents d
   set content = jsonb_set(
         jsonb_set(d.content, '{procedure}', (
           select jsonb_agg(case when l = to_jsonb($t$• Visitors and contractors: each signs in and out on the entrance screen (FRM-905), which keeps the name, company, the person visited and the times (SQF 2.7.1.2 vii).$t$::text) then to_jsonb($t$• Visitors and contractors: each signs in and out on the entrance screen (FRM-905), which keeps the name, company, the person visited and the times. The Visitor Log (REP-905) lists every visit (SQF 2.7.1.2 vii).$t$::text) else l end order by lo)
             from jsonb_array_elements(d.content->'procedure') with ordinality z(l, lo))),
         '{records}', to_jsonb(replace(d.content->>'records', $t$• FRM-905 visitor and contractor sign-in records
$t$, $t$• FRM-905 visitor and contractor sign-in records, listed in REP-905
$t$)))
 where d.sop_number = 'FSQM-025' and d.status = 'draft';

do $verify$
declare r record;
begin
  select status, type, content->'report_schema'->>'sourceSopNumber' as src, content->'report_schema'->>'sourceStatus' as st,
         jsonb_array_length(content->'report_schema'->'columns') as cols, jsonb_array_length(content->'report_schema'->'params') as params
    into r from public.sop_documents where sop_number = 'REP-905';
  if r.status <> 'draft' or r.type <> 'report' or r.src <> 'FRM-905' or r.st <> 'submitted' or r.cols <> 10 or r.params <> 5 then
    raise exception 'REP-905 is not as written: %', r;
  end if;
  if (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
             jsonb_array_elements(s->'fields') f, jsonb_array_elements_text(f->'rows'->'labels') l
       where d.sop_number = 'FRM-014' and f->>'id' = 'defense_checks' and l like '%REP-905%') <> 1
     or (select sum(jsonb_array_length(f->'rows'->'labels')) from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
             jsonb_array_elements(s->'fields') f where d.sop_number = 'FRM-014' and f->>'type' = 'grid') <> 21 then
    raise exception 'FRM-014 review line was not rewritten, or a line was lost.';
  end if;
  if (select count(*) from public.sop_documents d, jsonb_array_elements_text(d.content->'procedure') l
       where d.sop_number = 'FSQM-025' and l like '%REP-905%') <> 1
     or (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number = 'FSQM-025') <> 46
     or (select content->>'records' from public.sop_documents where sop_number = 'FSQM-025') not like '%REP-905%' then
    raise exception 'FSQM-025 was not pointed at REP-905.';
  end if;
end $verify$;

commit;
