-- Minimal admin-only artist content refresh workflow.

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create table public.admin_content_refreshes (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  scopes text[] not null
    check (
      cardinality(scopes) > 0
      and scopes <@ array['metadata', 'same_vibe', 'videos']::text[]
    ),
  status text not null default 'preview'
    check (status in ('preview', 'published', 'failed', 'conflict')),
  before_snapshot jsonb not null,
  proposed_snapshot jsonb not null,
  published_snapshot jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.admin_content_refreshes enable row level security;

create index idx_admin_content_refreshes_artist_created
  on public.admin_content_refreshes(artist_id, created_at desc);

create or replace function public.current_artist_content_snapshot(p_artist_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'artist', to_jsonb(a),
    'videos', coalesce(
      (
        select jsonb_agg(to_jsonb(v) order by v.id)
        from public.artist_videos v
        where v.artist_id = a.id
      ),
      '[]'::jsonb
    )
  )
  from public.artists a
  where a.id = p_artist_id;
$$;

revoke all on function public.current_artist_content_snapshot(uuid) from public;
grant execute on function public.current_artist_content_snapshot(uuid) to service_role;

create or replace function public.publish_admin_content_refresh(p_refresh_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  refresh_row public.admin_content_refreshes%rowtype;
  current_snapshot jsonb;
  proposed_artist jsonb;
  proposed_videos jsonb;
  manual_video_replacements jsonb;
  published jsonb;
begin
  select *
  into refresh_row
  from public.admin_content_refreshes
  where id = p_refresh_id
  for update;

  if refresh_row.id is null then
    raise exception 'Refresh preview not found';
  end if;

  if refresh_row.status <> 'preview' then
    raise exception 'Refresh preview is no longer publishable';
  end if;

  perform 1
  from public.artists
  where id = refresh_row.artist_id
  for update;

  perform 1
  from public.artist_videos
  where artist_id = refresh_row.artist_id
  for update;

  current_snapshot := public.current_artist_content_snapshot(refresh_row.artist_id);

  if current_snapshot is distinct from refresh_row.before_snapshot then
    raise exception 'Artist content changed after this preview was generated';
  end if;

  proposed_artist := refresh_row.proposed_snapshot->'artist';
  proposed_videos := coalesce(refresh_row.proposed_snapshot->'videos', '[]'::jsonb);
  manual_video_replacements := coalesce(
    refresh_row.proposed_snapshot->'manual_video_replacements',
    '[]'::jsonb
  );

  if (
    refresh_row.scopes && array['metadata', 'same_vibe']::text[]
    and coalesce((current_snapshot->'artist'->>'is_curated')::boolean, false)
  ) then
    raise exception 'Curated artist metadata and same-vibe artists are protected';
  end if;

  if 'metadata' = any(refresh_row.scopes) then
    update public.artists
    set tags = coalesce(
          array(select jsonb_array_elements_text(proposed_artist->'tags')),
          '{}'::text[]
        ),
        tag_source = coalesce(proposed_artist->>'tag_source', tag_source),
        blurb = proposed_artist->>'blurb',
        decade = proposed_artist->>'decade',
        bio_metadata = nullif(proposed_artist->'bio_metadata', 'null'::jsonb),
        wikipedia_extract = proposed_artist->>'wikipedia_extract',
        wikipedia_thumbnail_url = proposed_artist->>'wikipedia_thumbnail_url',
        wikipedia_url = proposed_artist->>'wikipedia_url',
        artist_context = jsonb_set(
          coalesce(proposed_artist->'artist_context', '{}'::jsonb),
          '{relatedArtists}',
          coalesce(artist_context->'relatedArtists', '[]'::jsonb),
          true
        )
    where id = refresh_row.artist_id;
  end if;

  if 'same_vibe' = any(refresh_row.scopes) then
    update public.artists
    set related_artists = coalesce(
          array(select jsonb_array_elements_text(proposed_artist->'related_artists')),
          '{}'::text[]
        ),
        artist_context = jsonb_set(
          coalesce(artist_context, '{}'::jsonb),
          '{relatedArtists}',
          coalesce(proposed_artist->'artist_context'->'relatedArtists', '[]'::jsonb),
          true
        )
    where id = refresh_row.artist_id;
  end if;

  if 'videos' = any(refresh_row.scopes) then
    if jsonb_array_length(proposed_videos) = 0 then
      raise exception 'A video refresh cannot publish an empty video list';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(manual_video_replacements) replacement
      where not exists (
        select 1
        from public.artist_videos existing
        where existing.artist_id = refresh_row.artist_id
          and coalesce(existing.video_type, 'concert') = 'concert'
          and existing.is_manually_added
          and existing.youtube_video_id = replacement
      )
    ) then
      raise exception 'A manual replacement does not identify a protected video';
    end if;

    if exists (
      select 1
      from public.artist_videos existing
      where existing.artist_id = refresh_row.artist_id
        and coalesce(existing.video_type, 'concert') = 'concert'
        and existing.is_manually_added
        and (manual_video_replacements ? existing.youtube_video_id)
        and (
          exists (
            select 1
            from jsonb_array_elements(proposed_videos) proposed
            where proposed->>'youtube_video_id' = existing.youtube_video_id
          )
          or not exists (
            select 1
            from jsonb_array_elements(proposed_videos) proposed
            where coalesce((proposed->>'is_manually_added')::boolean, false)
              and (proposed->>'display_order')::integer = existing.display_order
          )
        )
    ) then
      raise exception 'A protected manual replacement must remove the old video and keep a manual successor in its position';
    end if;

    if exists (
      select 1
      from public.artist_videos existing
      where existing.artist_id = refresh_row.artist_id
        and coalesce(existing.video_type, 'concert') = 'concert'
        and existing.is_manually_added
        and not (manual_video_replacements ? existing.youtube_video_id)
        and not exists (
          select 1
          from jsonb_array_elements(proposed_videos) proposed
          where proposed->>'youtube_video_id' = existing.youtube_video_id
        )
    ) then
      raise exception 'A manually added video is missing from the proposed list';
    end if;

    delete from public.artist_videos existing
    where existing.artist_id = refresh_row.artist_id
      and coalesce(existing.video_type, 'concert') = 'concert'
      and (
        not existing.is_manually_added
        or (manual_video_replacements ? existing.youtube_video_id)
      )
      and not exists (
        select 1
        from jsonb_array_elements(proposed_videos) proposed
        where proposed->>'youtube_video_id' = existing.youtube_video_id
      );

    insert into public.artist_videos (
      artist_id,
      youtube_video_id,
      title,
      description,
      thumbnail_url,
      published_at,
      view_count,
      duration,
      search_query,
      is_manually_added,
      display_order,
      video_type,
      channel_title
    )
    select
      refresh_row.artist_id,
      proposed.youtube_video_id,
      proposed.title,
      proposed.description,
      proposed.thumbnail_url,
      proposed.published_at,
      proposed.view_count,
      proposed.duration,
      proposed.search_query,
      proposed.is_manually_added,
      proposed.display_order,
      'concert',
      proposed.channel_title
    from jsonb_to_recordset(proposed_videos) as proposed(
      youtube_video_id text,
      title text,
      description text,
      thumbnail_url text,
      published_at timestamptz,
      view_count bigint,
      duration text,
      search_query text,
      is_manually_added boolean,
      display_order integer,
      channel_title text
    )
    on conflict (artist_id, youtube_video_id, video_type) do update
    set title = excluded.title,
        description = excluded.description,
        thumbnail_url = excluded.thumbnail_url,
        published_at = excluded.published_at,
        view_count = excluded.view_count,
        duration = excluded.duration,
        search_query = excluded.search_query,
        is_manually_added = public.artist_videos.is_manually_added
          or excluded.is_manually_added,
        display_order = excluded.display_order,
        channel_title = excluded.channel_title;
  end if;

  update public.artists
  set last_refreshed_at = now()
  where id = refresh_row.artist_id;

  published := public.current_artist_content_snapshot(refresh_row.artist_id);

  update public.admin_content_refreshes
  set status = 'published',
      published_snapshot = published,
      published_at = now(),
      error_message = null
  where id = p_refresh_id;

  return published;
end;
$$;

revoke all on function public.publish_admin_content_refresh(uuid) from public;
grant execute on function public.publish_admin_content_refresh(uuid) to service_role;
