-- Track which secondary video categories (interview, music_video) have been
-- searched and persisted, so a completed-but-empty category can be
-- distinguished from one that was never attempted (legacy artists or
-- artists with too few concert videos to bother searching).
alter table public.artists
  add column if not exists video_types_synced text[] not null default '{}';

-- Persist the uploader/channel name for display on video cards.
alter table public.artist_videos
  add column if not exists channel_title text;
