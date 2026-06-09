-- Add video_type to artist_videos to distinguish concerts, interviews, and music videos
alter table public.artist_videos
  add column if not exists video_type text not null default 'concert'
    check (video_type in ('concert', 'interview', 'music_video'));

create index if not exists artist_videos_type_idx
  on public.artist_videos (artist_id, video_type);
