-- Public lazy builds must stop writing videos if an administrator curates the
-- artist while the build is in flight. Admin video refreshes use a separate
-- transactional function and remain allowed for curated artists.

create or replace function public.upsert_public_build_videos(
  p_artist_id uuid,
  p_videos jsonb
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
end;
$$;

revoke all on function public.upsert_public_build_videos(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_public_build_videos(uuid, jsonb)
  to service_role;
