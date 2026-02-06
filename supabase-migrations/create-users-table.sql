-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name_bg VARCHAR(100) NOT NULL UNIQUE,
    name_en VARCHAR(100)
);

-- Create index on name_bg for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_name_bg ON public.users(name_bg);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users (including anonymous)
CREATE POLICY "Allow public read access" ON public.users
    FOR SELECT
    USING (true);

-- Create policy to allow insert for all users (including anonymous)
CREATE POLICY "Allow public insert" ON public.users
    FOR INSERT
    WITH CHECK (true);

-- Create policy to allow update for all users (including anonymous)
CREATE POLICY "Allow public update" ON public.users
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Create policy to allow delete for all users (including anonymous)
CREATE POLICY "Allow public delete" ON public.users
    FOR DELETE
    USING (true);
