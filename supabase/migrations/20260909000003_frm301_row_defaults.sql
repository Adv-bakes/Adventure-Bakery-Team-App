-- FRM-301 Receiving Log: default Time of Arrival to now, and Receiver Initials to the
-- signed-in user, on every newly added row.
--
-- WHY THE ROW AND NOT THE ENTRY. Both defaults are computed when the ROW is added, not when
-- the entry was created. For a receiving log that difference is the entire point: a receiver
-- opens the log once in the morning and adds a row per delivery through the day, so a time
-- stamped at entry-creation would label every delivery with the time of the first one. The
-- app applies these in newGridRow(), which runs both for the rows a new entry starts with and
-- for each Add Row.
--
-- NEITHER IS AN ANSWER, BOTH ARE STARTING POINTS. A default only ever seeds an EMPTY new row;
-- nothing rewrites a row that already exists, and every cell stays editable. That matters most
-- for the initials: they are an attestation, and a receiver recording a delivery that someone
-- else actually took has to be able to correct them. The entry's real attribution is
-- created_by on the response row, which no default touches.
--
-- INITIALS COME FROM THE PROFILE NAME, and initialsFromName() returns "" rather than a guess
-- when there is no usable full name (an email is not a name). An empty cell the receiver fills
-- in is correct; "RN" derived from "rnmercer@gmail.com" would be a wrong attestation.
--
-- NOTE ON THE COLUMN ID. The initials column is `receiver_initals` - missing an "i". That is a
-- typo in the original schema, and it stays: field and column ids are locked after first save
-- because saved answers key on them, so renaming it would orphan every value already recorded
-- against it. It is referenced verbatim here.

begin;

do $$
declare
  r record;
begin
  select status,
         (content #>> '{form_schema,sections,0,fields,0,id}')             as grid_id,
         jsonb_array_length(content #> '{form_schema,sections,0,fields,0,columns}') as cols,
         (content #>> '{form_schema,sections,0,fields,0,columns,0,id}')   as c0,
         (content #>> '{form_schema,sections,0,fields,0,columns,0,type}') as c0_type,
         (content #>> '{form_schema,sections,0,fields,0,columns,11,id}')  as c11,
         (content #>> '{form_schema,sections,0,fields,0,columns,11,type}') as c11_type,
         (content #> '{form_schema,sections,0,fields,0,columns,0}'  ? 'defaultTo') as c0_set,
         (content #> '{form_schema,sections,0,fields,0,columns,11}' ? 'defaultTo') as c11_set
    into r
    from public.sop_documents where sop_number = 'FRM-301';

  if r.status is distinct from 'active' or r.grid_id is distinct from 'receiving_log' then
    raise exception 'FRM-301 is %/% , expected active/receiving_log.', r.status, r.grid_id;
  end if;
  if r.cols <> 13 then
    raise exception 'Receiving Log has % columns, expected 13.', r.cols;
  end if;
  -- Index-addressed writes are safe only while the indices still mean what they meant.
  -- The type check matters as much as the id: "now" on a text column would write a raw
  -- timestamp into a free-text cell.
  if r.c0 is distinct from 'time_of_arrival' or r.c0_type is distinct from 'time' then
    raise exception 'Column 0 is %/% , expected time_of_arrival/time.', r.c0, r.c0_type;
  end if;
  if r.c11 is distinct from 'receiver_initals' or r.c11_type is distinct from 'text' then
    raise exception 'Column 11 is %/% , expected receiver_initals/text.', r.c11, r.c11_type;
  end if;
  if r.c0_set or r.c11_set then
    raise exception 'A defaultTo is already set (arrival=%, initials=%).', r.c0_set, r.c11_set;
  end if;
end $$;

create temporary table frm301_defaults_before on commit drop as
select md5(content::text) as h
  from public.sop_documents where sop_number = 'FRM-301';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(content,
                     '{form_schema,sections,0,fields,0,columns,0,defaultTo}',
                     to_jsonb('now'::text), true),
                   '{form_schema,sections,0,fields,0,columns,11,defaultTo}',
                   to_jsonb('currentUserInitials'::text), true)
 where sop_number = 'FRM-301' and status = 'active';

do $$
declare
  r record;
  drift int;
begin
  select (content #>> '{form_schema,sections,0,fields,0,columns,0,defaultTo}')  as arrival,
         (content #>> '{form_schema,sections,0,fields,0,columns,11,defaultTo}') as initials,
         (content #>> '{form_schema,sections,0,fields,0,scanLabel}')            as scan_still_on,
         jsonb_array_length(content #> '{form_schema,sections,0,fields,0,columns}') as cols
    into r
    from public.sop_documents where sop_number = 'FRM-301';

  if r.arrival is distinct from 'now' then
    raise exception 'Time of Arrival default is % , expected now.', r.arrival;
  end if;
  if r.initials is distinct from 'currentUserInitials' then
    raise exception 'Receiver Initials default is % , expected currentUserInitials.', r.initials;
  end if;
  -- 20260909000002 ran before this one; prove it is still in force.
  if r.scan_still_on is distinct from 'true' then
    raise exception 'The label scan is no longer enabled (found %).', r.scan_still_on;
  end if;
  if r.cols <> 13 then
    raise exception 'Column count changed to %.', r.cols;
  end if;

  select count(*) into drift
    from public.sop_documents d, frm301_defaults_before b
   where d.sop_number = 'FRM-301'
     and md5((d.content
              #- '{form_schema,sections,0,fields,0,columns,0,defaultTo}'
              #- '{form_schema,sections,0,fields,0,columns,11,defaultTo}')::text) is distinct from b.h;
  if drift <> 0 then
    raise exception 'FRM-301 changed outside the two defaultTo keys. Rolled back.';
  end if;
end $$;

commit;
