CREATE TABLE IF NOT EXISTS app_progress (
  user_id text PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 255),
  progress jsonb NOT NULL CHECK (jsonb_typeof(progress) = 'object'),
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
