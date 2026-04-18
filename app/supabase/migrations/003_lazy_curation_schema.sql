-- Phase 2: Lazy Curation Pipeline schema changes
-- Adds new columns to artists table and creates artist_videos table

-- ============================================================
-- 1. EXTEND ARTISTS TABLE
-- ============================================================
alter table public.artists
  add column if not exists blurb text,
  add column if not exists decade text,
  add column if not exists related_artists text[],
  add column if not exists musicbrainz_id text,
  add column if not exists is_curated boolean not null default false,
  add column if not exists discovered_by uuid references public.users(id) on delete set null,
  add column if not exists last_refreshed_at timestamptz;

-- Allow authenticated users to update artists (for edge function writes)
create policy "artists_update_authenticated" on public.artists
  for update using (auth.uid() is not null);

-- ============================================================
-- 2. ARTIST VIDEOS
-- ============================================================
create table public.artist_videos (
  id               uuid primary key default gen_random_uuid(),
  artist_id        uuid not null references public.artists(id) on delete cascade,
  youtube_video_id text not null,
  title            text not null,
  description      text,
  thumbnail_url    text,
  published_at     timestamptz,
  view_count       integer,
  search_query     text not null,
  is_manually_added boolean not null default false,
  display_order    integer not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.artist_videos enable row level security;

-- Artist videos are publicly readable
create policy "artist_videos_select_all" on public.artist_videos
  for select using (true);

-- Only authenticated users can insert
create policy "artist_videos_insert_authenticated" on public.artist_videos
  for insert with check (auth.uid() is not null);

-- Only authenticated users can update (for refresh/admin)
create policy "artist_videos_update_authenticated" on public.artist_videos
  for update using (auth.uid() is not null);

-- Unique constraint to prevent duplicate videos per artist
alter table public.artist_videos
  add constraint artist_videos_artist_video_unique
  unique (artist_id, youtube_video_id);

-- ============================================================
-- 3. ADD was_cache_hit TO ARTIST SEARCHES
-- ============================================================
alter table public.artist_searches
  add column if not exists was_cache_hit boolean not null default false;

-- ============================================================
-- 4. INDEXES
-- ============================================================
create index idx_artist_videos_artist_id on public.artist_videos(artist_id);
create index idx_artist_videos_display_order on public.artist_videos(artist_id, display_order);
create index idx_artists_name_lower on public.artists(lower(name));
