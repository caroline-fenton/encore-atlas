-- Phase 1: Initial schema for Encore Atlas
-- Run this in the Supabase SQL Editor

-- ============================================================
-- 1. USERS
-- ============================================================
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  is_anonymous boolean not null default true,
  display_name text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can read and update their own row
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- Allow the app to insert a row when a new session starts
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

-- ============================================================
-- 2. ARTISTS
-- ============================================================
create table public.artists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  tags        text[] default '{}',
  tag_source  text default 'pending',
  youtube_channel_id text,
  created_at  timestamptz not null default now()
);

alter table public.artists enable row level security;

-- Artists are publicly readable
create policy "artists_select_all" on public.artists
  for select using (true);

-- Only authenticated users can insert (prevents abuse)
create policy "artists_insert_authenticated" on public.artists
  for insert with check (auth.uid() is not null);

-- ============================================================
-- 3. ARTIST SEARCHES
-- ============================================================
create table public.artist_searches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  query_text        text not null,
  selected_artist_id uuid references public.artists(id) on delete set null,
  searched_at       timestamptz not null default now()
);

alter table public.artist_searches enable row level security;

-- Users can read their own searches
create policy "searches_select_own" on public.artist_searches
  for select using (auth.uid() = user_id);

-- Users can insert their own searches
create policy "searches_insert_own" on public.artist_searches
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- 4. WATCH HISTORY (schema only for Phase 1, used in Phase 2)
-- ============================================================
create table public.watch_history (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  artist_id             uuid not null references public.artists(id) on delete cascade,
  youtube_video_id      text not null,
  video_title           text not null,
  watched_at            timestamptz not null default now(),
  watch_duration_seconds integer
);

alter table public.watch_history enable row level security;

create policy "watch_select_own" on public.watch_history
  for select using (auth.uid() = user_id);

create policy "watch_insert_own" on public.watch_history
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_artist_searches_user_id on public.artist_searches(user_id);
create index idx_artist_searches_searched_at on public.artist_searches(searched_at desc);
create index idx_watch_history_user_id on public.watch_history(user_id);
create index idx_watch_history_artist_id on public.watch_history(artist_id);
