-- Първо изтрий старата таблица
DROP TABLE IF EXISTS public.predictions CASCADE;

-- Create predictions table
CREATE TABLE IF NOT EXISTS public.predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    utc_date TIMESTAMP WITH TIME ZONE NOT NULL,
    match_group VARCHAR(50),
    home_ft INTEGER NOT NULL,
    away_ft INTEGER NOT NULL,
    home_pt INTEGER NOT NULL,
    away_pt INTEGER NOT NULL,
    winner VARCHAR(20) NOT NULL,
    UNIQUE(user_id, match_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON public.predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_utc_date ON public.predictions(utc_date);
CREATE INDEX IF NOT EXISTS idx_predictions_match_group ON public.predictions(match_group);

-- Enable Row Level Security (RLS)
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users (including anonymous)
CREATE POLICY "Allow public read access" ON public.predictions
    FOR SELECT
    USING (true);

-- Create policy to allow insert for all users (including anonymous)
CREATE POLICY "Allow public insert" ON public.predictions
    FOR INSERT
    WITH CHECK (true);

-- Create policy to allow update for all users (including anonymous)
CREATE POLICY "Allow public update" ON public.predictions
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Create policy to allow delete for all users (including anonymous)
CREATE POLICY "Allow public delete" ON public.predictions
    FOR DELETE
    USING (true);


INSERT INTO public.predictions 
(user_id, match_id, utc_date, match_group, home_ft, away_ft, home_pt, away_pt, winner)
VALUES 
(1, 202401, '2024-06-14 18:00:00+00', 'ROUND_1', 2, 1, 1, 0, 'HOME_TEAM');