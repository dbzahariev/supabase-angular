-- Create matches table
CREATE TABLE IF NOT EXISTS public.matches (
    id INTEGER PRIMARY KEY,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    utc_date TIMESTAMPTZ NOT NULL,
    group_name VARCHAR(50) NOT NULL,
    home_ft INTEGER NOT NULL,
    away_ft INTEGER NOT NULL,
    home_pt INTEGER NOT NULL,
    away_pt INTEGER NOT NULL,
    winner VARCHAR(20) NOT NULL CHECK (winner IN ('HOME_TEAM', 'AWAY_TEAM', 'DRAW')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on id for faster lookups
CREATE INDEX IF NOT EXISTS idx_matches_id ON public.matches(id);

-- Create index on group for filtering
CREATE INDEX IF NOT EXISTS idx_matches_group ON public.matches(group_name);

-- Create index on date for sorting
CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(utc_date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users (including anonymous)
CREATE POLICY "Allow public read access" ON public.matches
    FOR SELECT
    USING (true);

-- Create policy to allow insert for all users (including anonymous)
CREATE POLICY "Allow public insert" ON public.matches
    FOR INSERT
    WITH CHECK (true);

-- Create policy to allow update for all users (including anonymous)
CREATE POLICY "Allow public update" ON public.matches
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Create policy to allow delete for all users (including anonymous)
CREATE POLICY "Allow public delete" ON public.matches
    FOR DELETE
    USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.matches IS 'Stores match information for Euro tournaments';
COMMENT ON COLUMN public.matches.id IS 'Unique match identifier';
COMMENT ON COLUMN public.matches.home_team IS 'Home team name';
COMMENT ON COLUMN public.matches.away_team IS 'Away team name';
COMMENT ON COLUMN public.matches.utc_date IS 'Match date and time in UTC';
COMMENT ON COLUMN public.matches.group_name IS 'Group or stage name (e.g., GROUP_A, LAST_16, FINAL)';
COMMENT ON COLUMN public.matches.home_ft IS 'Home team full-time score';
COMMENT ON COLUMN public.matches.away_ft IS 'Away team full-time score';
COMMENT ON COLUMN public.matches.home_pt IS 'Home team penalty score (-1 if no penalties)';
COMMENT ON COLUMN public.matches.away_pt IS 'Away team penalty score (-1 if no penalties)';
COMMENT ON COLUMN public.matches.winner IS 'Match winner: HOME_TEAM, AWAY_TEAM, or DRAW';
