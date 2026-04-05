-- Phase 2 fix: Remove overly permissive RLS policies
--
-- The edge function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS,
-- so client-facing insert/update policies on artists and artist_videos
-- are unnecessary and allow any anonymous user to tamper with catalog data.

-- Drop the broad update policy on artists
drop policy if exists "artists_update_authenticated" on public.artists;

-- Drop the broad insert/update policies on artist_videos
-- (only the edge function writes to this table, via service role key)
drop policy if exists "artist_videos_insert_authenticated" on public.artist_videos;
drop policy if exists "artist_videos_update_authenticated" on public.artist_videos;
