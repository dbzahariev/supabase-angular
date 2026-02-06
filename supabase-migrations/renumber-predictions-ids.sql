-- Renumber predictions IDs to be sequential
-- ВНИМАНИЕ: Изпълнявай само ако predictions няма foreign key референции от други таблици!

-- Стъпка 1: Временно изключи sequence-а и преномерирай ID-тата
WITH numbered_rows AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) as new_id
    FROM public.predictions
)
UPDATE public.predictions p
SET id = nr.new_id
FROM numbered_rows nr
WHERE p.id = nr.id;

-- Стъпка 2: Намери максималното ID и ресетни sequence-а
SELECT setval('predictions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.predictions), true);

-- Провери резултата
SELECT id, user_id, match_id FROM public.predictions ORDER BY id;
