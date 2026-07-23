-- TRN-004 "Allergens Part 2: Protecting the Claim" — de-mandate color-coding in the quiz.
--
-- The training now states the requirement as SEGREGATION + validated cleaning, with
-- color-coding demoted to an optional sorting aid (deck TRN004-updated.pptx). The quiz's
-- Q2 still framed color-coded tools as the mechanism and asserted tools are "never shared
-- across zones," which contradicts the updated policy: a shared tool IS acceptable after a
-- clean/sanitize/verify. This rewrites Q2 in both the English and Spanish modules.
--
-- Scoped by question id AND sop_id so nothing else can be touched. correct_option_index
-- stays 0 in both. No schema change.

-- English module: Food Safety 4 — Allergens Part 2 (1702545f-2d19-49be-b534-ebd930ab7d6d)
UPDATE public.quiz_questions
SET question_text = 'How do we keep allergen and free-from tools from cross-contaminating each other?',
    options = '[
      "Dedicate tools to a zone, or clean, sanitize, and verify a shared tool before free-from use",
      "Keep them neat and organized for visiting auditors",
      "Rely on color-coding alone; a cleaned shared tool is never acceptable",
      "Only track which worker used each tool"
    ]'::jsonb,
    correct_option_index = 0,
    hint = 'Segregation or a validated clean — both are acceptable.',
    rationale = 'We keep allergen and free-from tools apart by dedicating them to a zone, or by cleaning, sanitizing, and verifying a shared tool before it touches a free-from product. Color-coding is one helpful way to sort dedicated tools, but it is not required — a properly cleaned and verified tool is just as safe.'
WHERE id = '54d7b88a-300d-4ed5-8234-51d49cc42737'
  AND sop_id = '1702545f-2d19-49be-b534-ebd930ab7d6d';

-- Spanish module: Food Safety 4 — Allergens Part 2 (ES) (dda981cd-356a-4c10-9c87-6577032d1f33)
UPDATE public.quiz_questions
SET question_text = '¿Cómo evitamos que los utensilios con y sin alérgenos se contaminen entre sí?',
    options = '[
      "Dedicar utensilios a una zona, o limpiar, sanitizar y verificar un utensilio compartido antes de usarlo en producto libre de alérgenos",
      "Verse ordenados y organizados para los auditores que visitan",
      "Confiar solo en la codificación por color; un utensilio compartido limpio nunca es aceptable",
      "Solo rastrear qué trabajador usó cada utensilio"
    ]'::jsonb,
    correct_option_index = 0,
    hint = 'Segregación o una limpieza validada — ambas son aceptables.',
    rationale = 'Mantenemos separados los utensilios con y sin alérgenos dedicándolos a una zona, o limpiando, sanitizando y verificando un utensilio compartido antes de usarlo en un producto libre de alérgenos. La codificación por color es una forma útil de ordenar los utensilios dedicados, pero no es obligatoria — un utensilio bien limpio y verificado es igual de seguro.'
WHERE id = 'd2fc0ef3-c135-4b53-8bbe-7862c37e5332'
  AND sop_id = 'dda981cd-356a-4c10-9c87-6577032d1f33';
