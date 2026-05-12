ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS artist_context jsonb;
