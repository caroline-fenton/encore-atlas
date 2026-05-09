-- Phase 4: Recommendations
-- Adds bio_metadata column to artists and creates the get_recommendations function

-- ============================================================
-- 1. EXTEND ARTISTS TABLE
-- ============================================================
alter table public.artists
  add column if not exists bio_metadata jsonb;

-- GIN index for JSONB queries (origin_city, influences, etc.)
create index if not exists idx_artists_bio_metadata_gin
  on public.artists using gin(bio_metadata);

-- GIN index on tags for fast array intersection queries
create index if not exists idx_artists_tags_gin
  on public.artists using gin(tags);

-- ============================================================
-- 2. RECOMMENDATION FUNCTION
-- ============================================================
-- Two-layer scoring:
--   Layer 1: Tag similarity — count of shared genre tags × 10 per watched artist
--   Layer 2: Bio-derived scene adjacency — geography, era, and influence signals
--
-- The CROSS JOIN of candidates × watched_artists produces one row per pair.
-- SUM aggregates scores across all watched artists per candidate, so a
-- candidate that matches multiple watched artists scores proportionally higher.
--
-- Returns only fully-built artist pages (last_refreshed_at IS NOT NULL).
-- Returns nothing if the user has no watch history (empty CROSS JOIN).
--
-- Security: uses auth.uid() directly rather than accepting a caller-supplied
-- UUID. SECURITY INVOKER means the existing watch_history RLS policies
-- (SELECT WHERE user_id = auth.uid()) apply normally — callers can only
-- ever see recommendations derived from their own watch history.

create or replace function public.get_recommendations(
  p_limit int default 10
)
returns table (
  id          uuid,
  name        text,
  tags        text[],
  blurb       text,
  total_score int
)
language sql
stable
-- SECURITY INVOKER (default): run as the calling user so RLS on
-- watch_history enforces data isolation automatically.
as $$
  with watched_artist_ids as (
    select distinct artist_id
    from   watch_history
    where  user_id = auth.uid()   -- bound to the caller; not caller-supplied
  ),
  watched_artists as (
    select a.id, a.name, a.tags, a.bio_metadata
    from   artists a
    where  a.id in (select artist_id from watched_artist_ids)
  ),
  candidates as (
    select a.id, a.name, a.tags, a.bio_metadata, a.blurb
    from   artists a
    where  a.id           not in (select artist_id from watched_artist_ids)
      and  a.last_refreshed_at is not null   -- only fully-built pages
  ),
  -- Score every candidate against every watched artist, then filter to
  -- only those with genuine similarity (total_score > 0). Without this
  -- filter, zero-score artists (completely unrelated genres) fill the
  -- LIMIT when the DB doesn't have enough truly similar artists yet.
  scored as (
    select
      c.id,
      c.name,
      c.tags,
      c.blurb,
      (
        -- Layer 1: tag similarity
        coalesce(sum(
          coalesce(
            array_length(
              array(select unnest(c.tags) intersect select unnest(wa.tags)),
              1
            ),
            0
          ) * 10
        ), 0)

        +

        -- Layer 2: bio-derived scene adjacency
        coalesce(sum(
          -- Geography
          case
            when c.bio_metadata->>'origin_city' is not null
             and c.bio_metadata->>'origin_city' = wa.bio_metadata->>'origin_city'
            then 25
            when c.bio_metadata->>'origin_region' is not null
             and c.bio_metadata->>'origin_region' = wa.bio_metadata->>'origin_region'
            then 15
            else 0
          end
          +
          -- Era (formation year proximity)
          case
            when coalesce(c.bio_metadata->>'formation_year', '')  != ''
             and coalesce(wa.bio_metadata->>'formation_year', '') != ''
             and abs(
                   cast(c.bio_metadata->>'formation_year'  as int)
                 - cast(wa.bio_metadata->>'formation_year' as int)
                 ) < 3
            then 20
            when coalesce(c.bio_metadata->>'formation_year', '')  != ''
             and coalesce(wa.bio_metadata->>'formation_year', '') != ''
             and abs(
                   cast(c.bio_metadata->>'formation_year'  as int)
                 - cast(wa.bio_metadata->>'formation_year' as int)
                 ) < 8
            then 10
            else 0
          end
          +
          -- Influence relationships (candidate was influenced by watched artist)
          case
            when c.bio_metadata->'influences' is not null
             and c.bio_metadata->'influences' ?| array[wa.name]
            then 30
            else 0
          end
        ), 0)
      )::int as total_score

    from      candidates     c
    cross join watched_artists wa
    group by  c.id, c.name, c.tags, c.blurb
  )
  select id, name, tags, blurb, total_score
  from   scored
  where  total_score > 0
  order by total_score desc
  limit    p_limit;
$$;

grant execute on function public.get_recommendations(int) to authenticated;
grant execute on function public.get_recommendations(int) to anon;
