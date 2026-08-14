-- A prior incomplete public build attempt can leave a cross-type duplicate
-- behind that a later attempt's dedup pass now excludes from what it
-- writes. That cleanup must happen inside the same curation-locked
-- transaction as the write itself — a separate post-RPC delete runs after
-- the lock from migration 016 has already been released, so it could erase
-- rows an admin curates or publishes in the window between the two calls.
--
-- p_video_type is optional and defaults to null (no cleanup), so the
-- concert write — which never needs this — is unaffected. Manually added
-- rows are never touched by the public builder.

drop function if exists public.upsert_public_build_videos(uuid, jsonb);

create function public.upsert_public_build_videos(
  p_artist_id uuid,
  p_videos jsonb,
  p_video_type text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.artists
  where id = p_artist_id
    and not is_curated
  for update;

  if not found then
    raise exception 'Artist was curated while the public build was running';
  end if;

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
    display_order,
    video_type,
    channel_title
  )
  select
    p_artist_id,
    video.youtube_video_id,
    video.title,
    video.description,
    video.thumbnail_url,
    video.published_at,
    video.view_count,
    video.duration,
    video.search_query,
    video.display_order,
    video.video_type,
    video.channel_title
  from jsonb_to_recordset(p_videos) as video(
    youtube_video_id text,
    title text,
    description text,
    thumbnail_url text,
    published_at timestamptz,
    view_count bigint,
    duration text,
    search_query text,
    display_order integer,
    video_type text,
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
      display_order = excluded.display_order,
      channel_title = excluded.channel_title;

  if p_video_type is not null then
    delete from public.artist_videos
    where artist_id = p_artist_id
      and video_type = p_video_type
      and not is_manually_added
      and youtube_video_id not in (
        select video.youtube_video_id
        from jsonb_to_recordset(p_videos) as video(youtube_video_id text)
      );
  end if;
end;
$$;

revoke all on function public.upsert_public_build_videos(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.upsert_public_build_videos(uuid, jsonb, text)
  to service_role;
