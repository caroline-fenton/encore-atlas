-- Add video_type to artist_videos to distinguish concerts, interviews, and music videos
alter table public.artist_videos
  add column if not exists video_type text not null default 'concert'
    check (video_type in ('concert', 'interview', 'music_video'));

create index if not exists artist_videos_type_idx
  on public.artist_videos (artist_id, video_type);

-- A video can legitimately appear under multiple categories (e.g. a video
-- that's both a live performance and surfaces in an interview search).
-- Widen the uniqueness constraint to (artist_id, youtube_video_id, video_type)
-- so the same video can have separate rows per category instead of one
-- category's upsert overwriting another's.
alter table public.artist_videos
  drop constraint if exists artist_videos_artist_video_unique;

alter table public.artist_videos
  add constraint artist_videos_artist_video_type_unique
  unique (artist_id, youtube_video_id, video_type);
