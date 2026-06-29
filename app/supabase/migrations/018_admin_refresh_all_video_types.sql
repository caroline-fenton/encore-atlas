-- Admin video refreshes now manage every video category shown on artist pages:
-- live/concert videos, interviews, and music videos.

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
  manual_video_removals jsonb;
  manual_video_replacements jsonb;
  manual_metadata_edit boolean;
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
  manual_video_removals := coalesce(
    refresh_row.proposed_snapshot->'manual_video_removals',
    '[]'::jsonb
  );
  manual_video_replacements := coalesce(
    refresh_row.proposed_snapshot->'manual_video_replacements',
    '[]'::jsonb
  );
  manual_metadata_edit := coalesce(
    (refresh_row.proposed_snapshot->>'manual_metadata_edit')::boolean,
    false
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

  if manual_metadata_edit and refresh_row.scopes && array['metadata', 'same_vibe']::text[] then
    update public.artists
    set is_curated = true
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
          and coalesce(existing.video_type, 'concert') in ('concert', 'interview', 'music_video')
          and existing.is_manually_added
          and coalesce(existing.video_type, 'concert') || ':' || existing.youtube_video_id = replacement
      )
    ) then
      raise exception 'A manual replacement does not identify a protected video';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(manual_video_removals) removal
      where not exists (
        select 1
        from public.artist_videos existing
        where existing.artist_id = refresh_row.artist_id
          and coalesce(existing.video_type, 'concert') in ('concert', 'interview', 'music_video')
          and existing.is_manually_added
          and coalesce(existing.video_type, 'concert') || ':' || existing.youtube_video_id = removal
      )
    ) then
      raise exception 'A manual removal does not identify a protected video';
    end if;

    if exists (
      select 1
      from public.artist_videos existing
      where existing.artist_id = refresh_row.artist_id
        and coalesce(existing.video_type, 'concert') in ('concert', 'interview', 'music_video')
        and existing.is_manually_added
        and (manual_video_replacements ? (coalesce(existing.video_type, 'concert') || ':' || existing.youtube_video_id))
        and (
          exists (
            select 1
            from jsonb_array_elements(proposed_videos) proposed
            where proposed->>'youtube_video_id' = existing.youtube_video_id
              and coalesce(proposed->>'video_type', 'concert') = coalesce(existing.video_type, 'concert')
          )
          or not exists (
            select 1
            from jsonb_array_elements(proposed_videos) proposed
            where coalesce((proposed->>'is_manually_added')::boolean, false)
              and coalesce(proposed->>'video_type', 'concert') = coalesce(existing.video_type, 'concert')
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
        and coalesce(existing.video_type, 'concert') in ('concert', 'interview', 'music_video')
        and existing.is_manually_added
        and not (manual_video_replacements ? (coalesce(existing.video_type, 'concert') || ':' || existing.youtube_video_id))
        and not (manual_video_removals ? (coalesce(existing.video_type, 'concert') || ':' || existing.youtube_video_id))
        and not exists (
          select 1
          from jsonb_array_elements(proposed_videos) proposed
          where proposed->>'youtube_video_id' = existing.youtube_video_id
            and coalesce(proposed->>'video_type', 'concert') = coalesce(existing.video_type, 'concert')
        )
    ) then
      raise exception 'A manually added video is missing from the proposed list';
    end if;

    delete from public.artist_videos existing
    where existing.artist_id = refresh_row.artist_id
      and coalesce(existing.video_type, 'concert') in ('concert', 'interview', 'music_video')
      and (
        not existing.is_manually_added
        or (manual_video_replacements ? (coalesce(existing.video_type, 'concert') || ':' || existing.youtube_video_id))
        or (manual_video_removals ? (coalesce(existing.video_type, 'concert') || ':' || existing.youtube_video_id))
      )
      and not exists (
        select 1
        from jsonb_array_elements(proposed_videos) proposed
        where proposed->>'youtube_video_id' = existing.youtube_video_id
          and coalesce(proposed->>'video_type', 'concert') = coalesce(existing.video_type, 'concert')
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
      coalesce(proposed.video_type, 'concert'),
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
      video_type text,
      channel_title text
    )
    where coalesce(proposed.video_type, 'concert') in ('concert', 'interview', 'music_video')
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

    update public.artists
    set video_types_synced = array(
      select distinct unnest(video_types_synced || array['interview', 'music_video']::text[])
    )
    where id = refresh_row.artist_id;
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

revoke all on function public.publish_admin_content_refresh(uuid)
  from public, anon, authenticated;
grant execute on function public.publish_admin_content_refresh(uuid) to service_role;
