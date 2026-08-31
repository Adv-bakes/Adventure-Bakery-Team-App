-- Reflow the sections 20260831000012 appended to FSQM-002.
--
-- That migration wrote its new text hard-wrapped at about 100 characters, because the SQL heredoc
-- was formatted for a person reading the migration file. Stored text is not source code: those line
-- breaks are real characters in the policy, so both the app's read-only view and the printed PDF
-- show forced breaks mid-sentence while the original English paragraphs - which are single long
-- lines - reflow correctly. The document read as though two people had typed it.
--
-- Fixed by replacing everything from the "Communication and Display" heading onward. The original
-- English above that marker is kept by construction rather than retyped, using left() on the
-- existing value, so the approved wording still cannot be altered by a transcription slip.
--
-- A blanket newline-join would have been wrong: the signature blocks depend on adjacent lines
-- staying adjacent. "Gabriela Juncos-Mercer, Owner" and "Adventure Bakery, LLC" are two lines on
-- purpose, and a regex that joins any two non-blank lines would have run them together.
--
-- Paragraphs are now single lines and wrap wherever the renderer decides. Line breaks that survive
-- are the ones that mean something: the signature lines, and the address under each name.

begin;

update public.sop_documents
   set content = jsonb_set(content, '{statement}', to_jsonb(
         left(content->>'statement',
              position('Communication and Display' in content->>'statement') - 1)
         || $add$Communication and Display

This policy is displayed in prominent positions at the site, where employees, contractors and visitors can read it. It is communicated to every employee during induction and revisited at annual refresher training. It is issued in English and Spanish, the languages understood by site personnel, and both versions are posted together.

Authorised by

Signed: __________________________________    Date: ______________

Gabriela Juncos-Mercer, Owner
Adventure Bakery, LLC

- - -

Política de Inocuidad y Calidad Alimentaria

Adventure Bakery, LLC se compromete a elaborar productos horneados seguros y de alta calidad que cumplan o superen los requisitos de nuestros clientes, de la reglamentación aplicable y del Código SQF. Mantenemos un Sistema de Gestión de Inocuidad y Calidad Alimentaria integral, basado en las Buenas Prácticas de Manufactura, la mejora continua y una cultura íntegra de cuidado y responsabilidad.

Lo logramos mediante un enfoque disciplinado, alineado con el Código Safe Quality Food (SQF) y con toda la reglamentación aplicable. Nuestra promesa es sencilla:

«Decimos lo que hacemos. Hacemos lo que decimos. Y lo hacemos bien.»

Para sostener este compromiso, brindamos a nuestro equipo la capacitación continua y las herramientas necesarias para mantener una sólida cultura de inocuidad alimentaria. Nos hacemos responsables mediante procedimientos documentados, auditorías internas y mejora continua. Nos comunicamos abiertamente en todos los niveles de la panadería para que los problemas se prevengan y no se ignoren. Esperamos que cada integrante del equipo, desde producción hasta la dirección, proteja la integridad de nuestros productos y la confianza de nuestros clientes.

La inocuidad alimentaria no es un departamento aquí. Es nuestra forma de hacer negocios.

Comunicación y Exhibición

Esta política se exhibe en lugares visibles del sitio, donde el personal, los contratistas y los visitantes puedan leerla. Se comunica a cada empleado durante la inducción y se repasa en la capacitación anual de actualización. Se emite en inglés y español, los idiomas que comprende el personal del sitio, y ambas versiones se exhiben juntas.

Autorizado por

Firma: __________________________________    Fecha: ______________

Gabriela Juncos-Mercer, Propietaria
Adventure Bakery, LLC$add$))
 where sop_number = 'FSQM-002'
   and type = 'policy'
   and position('Communication and Display' in content->>'statement') > 0;

do $$
declare
  bad text;
  st text;
  longest int;
begin
  select content->>'statement' into st from public.sop_documents where sop_number = 'FSQM-002';

  -- The longest line in the ORIGINAL English is 471 characters, so a low maximum would be wrong.
  -- What matters is that no paragraph is chopped at ~100: measure the appended half only.
  select max(length(l)) into longest from unnest(string_to_array(
           substr(st, position('Comunicación y Exhibición' in st)), chr(10))) as l
   where length(trim(l)) > 0;

  select string_agg(x, '; ') into bad from (
    select 'the original English was lost' as x
     where st not like '%Say what we do. Do what we say.%'
    union all
    select 'the English display section is missing' where st not like '%prominent positions%'
    union all
    select 'the Spanish policy is missing' where st not like '%Política de Inocuidad%'
    union all
    select 'the signature blocks are missing'
     where st not like '%Signed:%' or st not like '%Firma:%'
    union all
    -- the two-line sign-off must survive as two lines
    select 'the English sign-off was joined into one line'
     where st not like '%Gabriela Juncos-Mercer, Owner' || chr(10) || 'Adventure Bakery, LLC%'
    union all
    select 'the Spanish sign-off was joined into one line'
     where st not like '%Gabriela Juncos-Mercer, Propietaria' || chr(10) || 'Adventure Bakery, LLC%'
    union all
    -- and the reflow actually happened: a still-wrapped paragraph shows up as a ~100 char ceiling
    select 'the appended text is still hard-wrapped (longest line ' || longest::text || ' chars)'
     where longest < 150
    union all
    select 'the text was duplicated' where (length(st) - length(replace(st, 'Communication and Display', ''))) / 25 <> 1
  ) t;

  if bad is not null then
    raise exception 'the FSQM-002 reflow did not apply cleanly: %', bad;
  end if;

  raise notice 'FSQM-002 statement reflowed; longest Spanish line now % chars', longest;
end $$;

commit;
