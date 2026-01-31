-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id SERIAL PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL UNIQUE,
    name_bg VARCHAR(100) NOT NULL
);

-- Create index on name_en for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_name_en ON public.teams(name_en);

-- Enable Row Level Security (RLS)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users (including anonymous)
CREATE POLICY "Allow public read access" ON public.teams
    FOR SELECT
    USING (true);

-- Create policy to allow insert for all users (including anonymous)
CREATE POLICY "Allow public insert" ON public.teams
    FOR INSERT
    WITH CHECK (true);

-- Create policy to allow update for all users (including anonymous)
CREATE POLICY "Allow public update" ON public.teams
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Create policy to allow delete for all users (including anonymous)
CREATE POLICY "Allow public delete" ON public.teams
    FOR DELETE
    USING (true);
