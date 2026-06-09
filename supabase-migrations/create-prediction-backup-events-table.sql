-- Create table for prediction change backups (audit log)
CREATE TABLE IF NOT EXISTS public.prediction_backup_events (
    id BIGSERIAL PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    match_id INTEGER NOT NULL,
    prediction_id INTEGER NULL,
    column_index INTEGER NOT NULL,
    input_value TEXT NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT NULL,
    source TEXT NOT NULL DEFAULT 'all-predictions',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_backup_events_event_id
ON public.prediction_backup_events(event_id);

CREATE INDEX IF NOT EXISTS idx_prediction_backup_events_user_id
ON public.prediction_backup_events(user_id);

CREATE INDEX IF NOT EXISTS idx_prediction_backup_events_match_id
ON public.prediction_backup_events(match_id);

CREATE INDEX IF NOT EXISTS idx_prediction_backup_events_event_timestamp
ON public.prediction_backup_events(event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_backup_events_action
ON public.prediction_backup_events(action);

-- Enable RLS
ALTER TABLE public.prediction_backup_events ENABLE ROW LEVEL SECURITY;

-- Public read policy (aligning with existing project policies)
DROP POLICY IF EXISTS "Allow public read access" ON public.prediction_backup_events;
CREATE POLICY "Allow public read access" ON public.prediction_backup_events
    FOR SELECT
    USING (true);

-- Public insert policy (required for client-side audit writes)
DROP POLICY IF EXISTS "Allow public insert" ON public.prediction_backup_events;
CREATE POLICY "Allow public insert" ON public.prediction_backup_events
    FOR INSERT
    WITH CHECK (true);
