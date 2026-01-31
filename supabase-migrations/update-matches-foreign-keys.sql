-- Migration: Промяна на matches таблица за използване на foreign keys към teams
-- Стъпка 1: Добавяне на новите колони с foreign keys

-- Добавяне на home_team_id колона
ALTER TABLE public.matches 
ADD COLUMN home_team_id INTEGER;

-- Добавяне на away_team_id колона
ALTER TABLE public.matches 
ADD COLUMN away_team_id INTEGER;

-- Стъпка 2: Попълване на новите колони с данни от teams таблицата
-- (Това трябва да се направи преди да се изтрият старите колони)
-- Използва се UPDATE с JOIN за да се намерят съответните ID-та

UPDATE public.matches m
SET home_team_id = t.id
FROM public.teams t
WHERE m.home_team = t.name_en;

UPDATE public.matches m
SET away_team_id = t.id
FROM public.teams t
WHERE m.away_team = t.name_en;

-- Стъпка 3: Проверка дали всички записи имат попълнени ID-та
-- (Ако има NULL стойности, има проблем с данните)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.matches WHERE home_team_id IS NULL OR away_team_id IS NULL) THEN
        RAISE EXCEPTION 'Има мачове без съответстващи отбори в teams таблицата!';
    END IF;
END $$;

-- Стъпка 4: Добавяне на NOT NULL constraint
ALTER TABLE public.matches 
ALTER COLUMN home_team_id SET NOT NULL;

ALTER TABLE public.matches 
ALTER COLUMN away_team_id SET NOT NULL;

-- Стъпка 5: Добавяне на foreign key constraints
ALTER TABLE public.matches
ADD CONSTRAINT fk_matches_home_team 
FOREIGN KEY (home_team_id) 
REFERENCES public.teams(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE public.matches
ADD CONSTRAINT fk_matches_away_team 
FOREIGN KEY (away_team_id) 
REFERENCES public.teams(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Стъпка 6: Създаване на индекси за по-бързи заявки
CREATE INDEX IF NOT EXISTS idx_matches_home_team_id ON public.matches(home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team_id ON public.matches(away_team_id);

-- Стъпка 7: Изтриване на старите text колони
ALTER TABLE public.matches 
DROP COLUMN home_team;

ALTER TABLE public.matches 
DROP COLUMN away_team;

-- Стъпка 8 (опционално): Изтриване на старите индекси ако има такива
-- DROP INDEX IF EXISTS idx_matches_home_team;
-- DROP INDEX IF EXISTS idx_matches_away_team;
