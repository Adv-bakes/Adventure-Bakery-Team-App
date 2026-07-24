-- TRN-003 Allergens Part 1: Know the Risk — drop discontinued "burger" product wording.
-- CEO directive: no longer reference the (ceasing) allergen-free burger line; use the
-- generic "allergen-free product" / "producto libre de alérgenos" instead. Mirrors the
-- TRN-004 change (20260723000001). Quiz logic and correct answers are UNCHANGED — only
-- the product-specific wording in Q2 (question/option/rationale) and Q4 (question).
--
-- Idempotent: every UPDATE keys on the OLD text, so re-running after it's applied touches
-- 0 rows. Scoped to the Allergens Part 1 module family (EN + ES rows share the title stem)
-- via a title match, so it can't collide with other modules.

DO $$
DECLARE
  mod_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO mod_ids
  FROM public.sop_documents
  WHERE title ILIKE '%Allergens Part 1%';

  IF mod_ids IS NULL THEN
    RAISE NOTICE 'TRN-003: no module matched title ILIKE %%Allergens Part 1%% — nothing updated';
    RETURN;
  END IF;

  ------------------------------------------------------------------ EN Q2
  UPDATE public.quiz_questions
  SET question_text = 'What makes the allergen-free product we make different and high-risk?'
  WHERE sop_id = ANY(mod_ids)
    AND question_text = 'What makes the plant-based burger we make different and high-risk?';

  UPDATE public.quiz_questions
  SET rationale = 'The product is labeled free of all top 9 allergens yet is produced in the same building, on shared equipment and rotating staff, as wheat/egg/milk/tree-nut products — so any cross-contact makes the claim false.'
  WHERE sop_id = ANY(mod_ids)
    AND rationale = 'The burger is labeled free of all top 9 allergens yet is produced in the same building, on shared equipment and rotating staff, as wheat/egg/milk/tree-nut products — so any cross-contact makes the claim false.';

  ------------------------------------------------------------------ EN Q4
  UPDATE public.quiz_questions
  SET question_text = 'You''re not sure whether the line was fully cleaned before the free-from product run. What should you do?'
  WHERE sop_id = ANY(mod_ids)
    AND question_text = 'You''re not sure whether the line was fully cleaned before the free-from burger run. What should you do?';

  ------------------------------------------------------------------ ES Q2
  UPDATE public.quiz_questions
  SET question_text = '¿Qué hace que el producto libre de alérgenos que fabricamos sea diferente y de alto riesgo?'
  WHERE sop_id = ANY(mod_ids)
    AND question_text = '¿Qué hace que la hamburguesa vegetal que fabricamos sea diferente y de alto riesgo?';

  -- ES Q2 option[0] gender fix (hamburguesa fem -> producto masc): Etiquetada/hecha -> Etiquetado/hecho.
  -- Targeted substring replace on the jsonb array text; the phrase is unique within the row.
  UPDATE public.quiz_questions
  SET options = replace(options::text,
        'Etiquetada libre de los 9 alérgenos, pero hecha junto a ellos',
        'Etiquetado libre de los 9 alérgenos, pero hecho junto a ellos')::jsonb
  WHERE sop_id = ANY(mod_ids)
    AND options::text LIKE '%Etiquetada libre de los 9 alérgenos, pero hecha junto a ellos%';

  UPDATE public.quiz_questions
  SET rationale = 'El producto está etiquetado libre de los 9 alérgenos principales, pero se produce en el mismo edificio, con equipo compartido y personal rotativo, que los productos con trigo, huevo, leche y frutos secos, así que cualquier contacto cruzado vuelve falsa la declaración.'
  WHERE sop_id = ANY(mod_ids)
    AND rationale = 'La hamburguesa está etiquetada libre de los 9 alérgenos principales, pero se produce en el mismo edificio, con equipo compartido y personal rotativo, que los productos con trigo, huevo, leche y frutos secos, así que cualquier contacto cruzado vuelve falsa la declaración.';

  ------------------------------------------------------------------ ES Q4
  UPDATE public.quiz_questions
  SET question_text = 'No estás seguro de si la línea se limpió por completo antes de correr el producto libre. ¿Qué debes hacer?'
  WHERE sop_id = ANY(mod_ids)
    AND question_text = 'No estás seguro de si la línea se limpió por completo antes de correr la hamburguesa libre. ¿Qué debes hacer?';
END $$;
