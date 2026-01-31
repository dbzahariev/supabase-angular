-- Rollback Migration: Връщане на matches таблица към VARCHAR колони
-- Това е rollback скрипт, ако трябва да се върнем назад

-- Стъпка 1: Добавяне на старите VARCHAR колони обратно
ALTER TABLE public.matches 
ADD COLUMN home_team VARCHAR(100);

ALTER TABLE public.matches 
ADD COLUMN away_team VARCHAR(100);

-- Стъпка 2: Попълване на VARCHAR колоните от teams таблицата
UPDATE public.matches m
SET home_team = t.name_en
FROM public.teams t
WHERE m.home_team_id = t.id;

UPDATE public.matches m
SET away_team = t.name_en
FROM public.teams t
WHERE m.away_team_id = t.id;

-- Стъпка 3: Добавяне на NOT NULL constraint
ALTER TABLE public.matches 
ALTER COLUMN home_team SET NOT NULL;

ALTER TABLE public.matches 
ALTER COLUMN away_team SET NOT NULL;

-- Стъпка 4: Изтриване на foreign key constraints
ALTER TABLE public.matches
DROP CONSTRAINT IF EXISTS fk_matches_home_team;

ALTER TABLE public.matches
DROP CONSTRAINT IF EXISTS fk_matches_away_team;

-- Стъпка 5: Изтриване на индексите
DROP INDEX IF EXISTS idx_matches_home_team_id;
DROP INDEX IF EXISTS idx_matches_away_team_id;

-- Стъпка 6: Изтриване на ID колоните
ALTER TABLE public.matches 
DROP COLUMN home_team_id;

ALTER TABLE public.matches 
DROP COLUMN away_team_id;
