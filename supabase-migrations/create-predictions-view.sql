-- Create a view that joins predictions with users and matches to get user names and team names
CREATE OR REPLACE VIEW public.predictions_with_users AS
SELECT 
    p.id,
    p.user_id,
    p.match_id,
    p.utc_date,
    p.match_group,
    p.home_ft,
    p.away_ft,
    p.home_pt,
    p.away_pt,
    p.winner,
    u.name_bg,
    u.name_en,
    ht.name_en AS home_team_en,
    ht.name_bg AS home_team_bg,
    at.name_en AS away_team_en,
    at.name_bg AS away_team_bg
FROM 
    public.predictions p
    INNER JOIN public.users u ON p.user_id = u.id
    INNER JOIN public.matches m ON p.match_id = m.id
    INNER JOIN public.teams ht ON m.home_team_id = ht.id
    INNER JOIN public.teams at ON m.away_team_id = at.id;

-- Enable RLS on the view
ALTER VIEW public.predictions_with_users SET (security_invoker = true);

-- Grant select permissions to authenticated and anonymous users
GRANT SELECT ON public.predictions_with_users TO anon;
GRANT SELECT ON public.predictions_with_users TO authenticated;
