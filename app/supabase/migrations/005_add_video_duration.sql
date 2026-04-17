-- Add duration column to artist_videos for displaying duration badges
alter table public.artist_videos
  add column if not exists duration text;
