-- Widen view_count to bigint — official music videos can exceed the
-- int4 max (2,147,483,647), e.g. videos with 2B+ views.
alter table public.artist_videos
  alter column view_count type bigint;
