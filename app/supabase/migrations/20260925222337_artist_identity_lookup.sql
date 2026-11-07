set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- One identity lookup for page builds, cached pages, and history links.
-- Keep display names intact. Do not fuzzy-match arbitrary artist names or
-- collapse a leading "the": both names may identify different real acts.
create or replace function public.artist_identity_key(p_name text)
returns text
language sql
immutable strict parallel safe
security invoker
set search_path = ''
as $$
  with normalized as (
    select regexp_replace(lower(normalize(trim(p_name), NFKD)),
                          '[^[:alnum:]]', '', 'g') as key
  )
  select case
    -- Reviewed correction for the duplicate reported in September 2026.
    when key = 'toucheamoree' then 'toucheamore'
    -- Punctuation-only artists such as !!! must retain their identities.
    when key = '' then 'raw:' || lower(trim(p_name))
    else key
  end
  from normalized;
$$;

-- Recovery snapshots are not exposed to public readers or app users.
create table public.artist_identity_merge_backups (
  artist_id uuid primary key,
  merged_into uuid not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.artist_identity_merge_backups enable row level security;
revoke all on public.artist_identity_merge_backups from public, anon, authenticated;
grant all on public.artist_identity_merge_backups to service_role;

-- Consolidate only the reviewed Touché Amoré duplicates. Keep the original
-- page's ID and metadata. Save both original and duplicate state so the
-- merge can be reversed without losing videos or history associations.
do $$
declare
  canonical_id uuid;
  duplicate_id uuid;
begin
  -- Prevent a concurrent search/build/admin write during this one-off merge.
  lock table public.artists, public.artist_videos, public.artist_searches,
             public.watch_history, public.admin_content_refreshes
    in share row exclusive mode;

  select id into canonical_id from public.artists
  where lower(name) = 'touché amoré';

  if canonical_id is null then
    return; -- Fresh databases have no production cleanup to perform.
  end if;

  if exists (
    select 1 from public.artists a
    where public.artist_identity_key(a.name) = 'toucheamore'
      and a.id <> canonical_id
      and (a.is_curated or exists (
        select 1 from public.admin_content_refreshes r where r.artist_id = a.id
      ))
  ) then
    raise exception 'Touché Amoré duplicate has curated content or refresh history; review before merging';
  end if;

  insert into public.artist_identity_merge_backups (artist_id, merged_into, snapshot)
  select a.id, canonical_id, jsonb_build_object(
    'artist', to_jsonb(a),
    'videos', coalesce((select jsonb_agg(to_jsonb(v)) from public.artist_videos v
                        where v.artist_id = a.id), '[]'::jsonb),
    'search_ids', coalesce((select jsonb_agg(s.id) from public.artist_searches s
                            where s.selected_artist_id = a.id), '[]'::jsonb),
    'watch_ids', coalesce((select jsonb_agg(w.id) from public.watch_history w
                           where w.artist_id = a.id), '[]'::jsonb)
  )
  from public.artists a
  where public.artist_identity_key(a.name) = 'toucheamore';

  for duplicate_id in
    select id from public.artists
    where public.artist_identity_key(name) = 'toucheamore' and id <> canonical_id
    order by created_at, id
  loop
    -- Do not silently replace an admin's manual selection with another copy.
    if exists (
      select 1 from public.artist_videos d
      join public.artist_videos c on c.artist_id = canonical_id
        and c.youtube_video_id = d.youtube_video_id
      where d.artist_id = duplicate_id and d.is_manually_added
    ) then
      raise exception 'Duplicate has a conflicting manual video; review before merging';
    end if;

    -- Move each unique video with its ID; append within its existing section.
    with moves as (
      select d.id, coalesce((
        select max(c.display_order) from public.artist_videos c
        where c.artist_id = canonical_id and c.video_type = d.video_type
      ), -1) + row_number() over (
        partition by d.video_type order by d.display_order, d.id
      ) as new_order
      from public.artist_videos d
      where d.artist_id = duplicate_id
        and not exists (
          select 1 from public.artist_videos c
          where c.artist_id = canonical_id and c.youtube_video_id = d.youtube_video_id
        )
    )
    update public.artist_videos v
    set artist_id = canonical_id, display_order = moves.new_order::integer
    from moves where v.id = moves.id;

    update public.artist_searches set selected_artist_id = canonical_id
    where selected_artist_id = duplicate_id;
    update public.watch_history set artist_id = canonical_id
    where artist_id = duplicate_id;
    -- Remaining videos are already present on the canonical page and backed up.
    delete from public.artists where id = duplicate_id;
  end loop;
end;
$$;

-- Enforces the same identity even for concurrent builds or older clients.
-- Any unrelated pre-existing collision aborts the migration for review.
create unique index artists_identity_key_unique
  on public.artists (public.artist_identity_key(name));

create or replace function public.resolve_artist(p_name text)
returns setof public.artists
language sql
stable
security invoker
set search_path = ''
as $$
  select a.* from public.artists a
  where trim(p_name) <> '' and public.artist_identity_key(a.name) in (
    public.artist_identity_key(p_name),
    public.artist_identity_key(case
      when lower(trim(p_name)) ~ '^the\s+' then regexp_replace(lower(trim(p_name)), '^the\s+', '')
      else 'the ' || trim(p_name)
    end)
  )
  -- Preserve the old leading-the fallback, but prefer an exact identity if
  -- both names exist (e.g. two genuinely different bands).
  order by (public.artist_identity_key(a.name) = public.artist_identity_key(p_name)) desc
  limit 1;
$$;

revoke all on function public.artist_identity_key(text) from public;
revoke all on function public.resolve_artist(text) from public;
grant execute on function public.artist_identity_key(text) to anon, authenticated, service_role;
grant execute on function public.resolve_artist(text) to anon, authenticated, service_role;
