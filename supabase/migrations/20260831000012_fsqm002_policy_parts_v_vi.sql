-- INT-11: add the signature, display and language provisions to the food safety policy.
--
-- SQF 2.1.1.1 has six parts. FSQM-002 covers i to iv well - commitment, method, culture, and the
-- promise the site actually repeats to itself - and is silent on v and vi:
--
--   v.  the policy is signed by senior site management
--   vi. it is displayed in prominent positions and communicated to staff in the languages they
--       understand
--
-- The consultant's own evidence for this row claims compliance with "i-iv", and the row was scored
-- Compliant anyway. That scoring error is INT-12, raised separately with the consultant; this
-- migration fixes the document rather than arguing about the score.
--
-- DONE NOW, BEFORE INT-7. FSQM-002 is still draft, and INT-7 approves and issues the eight draft
-- FSQM documents. Adding this after that would mean issuing the site's food safety policy
-- incomplete and revising it immediately.
--
-- BILINGUAL IN ONE DOCUMENT, not two. The training modules use paired EN/ES rows because they are
-- assigned per employee in the language that employee is trained in. A policy is not assigned, it is
-- POSTED - and part vi asks for it to be displayed AND understood. One sheet carrying both languages
-- satisfies both at once and cannot be posted half-complete, which two documents can.
--
-- THE EXISTING ENGLISH TEXT IS APPENDED TO, NEVER RETYPED. The statement is concatenated in SQL
-- rather than restated as a literal, so the wording that was already approved cannot be altered by
-- a transcription slip - and the assertion below proves the original survived by checking for a
-- phrase from it.
--
-- ⚠️ TWO THINGS THE OWNER SHOULD SETTLE BEFORE THIS IS ISSUED:
--   1. The display wording says "in prominent positions at the site". Naming the ACTUAL posting
--      locations is stronger evidence at an audit, and only the site can say what they are.
--   2. The Spanish text should be read by a fluent speaker before it goes on a wall. It is a
--      faithful translation, but a policy in a language the signer cannot check is worth one
--      person's confirmation.
--
-- Status stays draft. This completes the document; issuing it is INT-7's job.

begin;

update public.sop_documents
   set content = jsonb_set(content, '{statement}',
         to_jsonb((content->>'statement') || E'\n\n' || $add$Communication and Display

This policy is displayed in prominent positions at the site, where employees, contractors and
visitors can read it. It is communicated to every employee during induction and revisited at annual
refresher training. It is issued in English and Spanish, the languages understood by site personnel,
and both versions are posted together.

Authorised by

Signed: __________________________________    Date: ______________

Gabriela Juncos-Mercer, Owner
Adventure Bakery, LLC

- - -

Política de Inocuidad y Calidad Alimentaria

Adventure Bakery, LLC se compromete a elaborar productos horneados seguros y de alta calidad que
cumplan o superen los requisitos de nuestros clientes, de la reglamentación aplicable y del Código
SQF. Mantenemos un Sistema de Gestión de Inocuidad y Calidad Alimentaria integral, basado en las
Buenas Prácticas de Manufactura, la mejora continua y una cultura íntegra de cuidado y
responsabilidad.

Lo logramos mediante un enfoque disciplinado, alineado con el Código Safe Quality Food (SQF) y con
toda la reglamentación aplicable. Nuestra promesa es sencilla:

«Decimos lo que hacemos. Hacemos lo que decimos. Y lo hacemos bien.»

Para sostener este compromiso, brindamos a nuestro equipo la capacitación continua y las herramientas
necesarias para mantener una sólida cultura de inocuidad alimentaria. Nos hacemos responsables
mediante procedimientos documentados, auditorías internas y mejora continua. Nos comunicamos
abiertamente en todos los niveles de la panadería para que los problemas se prevengan y no se
ignoren. Esperamos que cada integrante del equipo, desde producción hasta la dirección, proteja la
integridad de nuestros productos y la confianza de nuestros clientes.

La inocuidad alimentaria no es un departamento aquí. Es nuestra forma de hacer negocios.

Comunicación y Exhibición

Esta política se exhibe en lugares visibles del sitio, donde el personal, los contratistas y los
visitantes puedan leerla. Se comunica a cada empleado durante la inducción y se repasa en la
capacitación anual de actualización. Se emite en inglés y español, los idiomas que comprende el
personal del sitio, y ambas versiones se exhiben juntas.

Autorizado por

Firma: __________________________________    Fecha: ______________

Gabriela Juncos-Mercer, Propietaria
Adventure Bakery, LLC$add$)),
       revision = 'v2',
       effective_date = date '2026-08-31',
       sqf_reference = '2.1.1.1'
 where sop_number = 'FSQM-002'
   and type = 'policy'
   -- target-state guard: re-running finds the section already present and does nothing
   and (content->>'statement') not like '%Communication and Display%';

do $$
declare
  bad text;
  r record;
begin
  select * into r from public.sop_documents where sop_number = 'FSQM-002';

  select string_agg(x, '; ') into bad from (
    select 'FSQM-002 is missing' as x where r.id is null
    union all
    select 'part vi display provision is absent'
     where coalesce(r.content->>'statement','') not like '%prominent positions%'
    union all
    select 'part vi language provision is absent'
     where coalesce(r.content->>'statement','') not like '%English and Spanish%'
    union all
    select 'part v signature block is absent'
     where coalesce(r.content->>'statement','') not like '%Signed:%'
    union all
    select 'the Spanish version is absent'
     where coalesce(r.content->>'statement','') not like '%Política de Inocuidad%'
    union all
    -- the approved English wording must have survived being appended to
    select 'the original policy text was altered or lost'
     where coalesce(r.content->>'statement','') not like '%Say what we do. Do what we say.%'
    union all
    select 'revision is ' || coalesce(r.revision,'null') || ', expected v2'
     where r.revision is distinct from 'v2'
    union all
    -- issuing it is INT-7's decision, not this migration's
    select 'FSQM-002 was activated - issuing it belongs to INT-7'
     where r.status <> 'draft'
  ) t;

  if bad is not null then
    raise exception 'the FSQM-002 policy revision did not apply cleanly: %', bad;
  end if;

  raise notice 'FSQM-002 v2: parts v and vi added, bilingual, still draft for INT-7 to issue';
end $$;

commit;
