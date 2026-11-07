-- Serialize cross-category video decisions with the artist-row lock already
-- shared by public builds and admin publishes. Existing stored categories win;
-- manual selections are never overwritten or removed. No historical rows are
-- changed until an incomplete artist is built again.

create or replace function public.upsert_public_build_videos(
  p_artist_id uuid,
  p_videos jsonb,
  p_video_type text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_videos) is distinct from 'array'
    or (p_video_type is not null and p_video_type not in ('concert', 'interview', 'music_video')) then
    raise exception 'Invalid public video payload or category' using errcode = '22023';
  end if;

  -- Reject malformed/mixed scoped requests before they can delete stale rows.
  if exists (
    select 1 from jsonb_to_recordset(p_videos) as video(youtube_video_id text, video_type text)
    where video.youtube_video_id is null or trim(video.youtube_video_id) = ''
      or video.video_type is null
      or video.video_type not in ('concert', 'interview', 'music_video')
      or (p_video_type is not null and video.video_type <> p_video_type)
  ) or exists (
    select 1 from jsonb_to_recordset(p_videos) as video(youtube_video_id text)
    group by video.youtube_video_id having count(*) > 1
  ) then
    raise exception 'Invalid or duplicate public video candidate' using errcode = '22023';
  end if;

  perform 1
  from public.artists
  where id = p_artist_id
    and not is_curated
    and last_refreshed_at is null
  for update;

  if not found then
    raise exception 'Artist was curated while the public build was running';
  end if;

  -- Skip any candidate already persisted for this artist under a different
  -- video_type — that row wins (whichever build wrote it first), and this
  -- candidate is left out entirely rather than overwriting or duplicating
  -- it under p_video_type.
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
  where not exists (
      select 1
      from public.artist_videos existing
      where existing.artist_id = p_artist_id
        and existing.youtube_video_id = video.youtube_video_id
        and existing.video_type <> video.video_type
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
      channel_title = excluded.channel_title
  where not public.artist_videos.is_manually_added;

  if p_video_type is not null then
    -- "Surviving" candidates are the ones that actually got inserted above
    -- (excludes any candidate that lost the cross-type check because it's
    -- now classified elsewhere). Anything currently stored as p_video_type
    -- that isn't a surviving candidate is stale — whether because this
    -- build's search no longer found it, or because it just got reclassified
    -- to another type here — and gets cleared the same way either case.
    delete from public.artist_videos
    where artist_id = p_artist_id
      and video_type = p_video_type
      and not is_manually_added
      and youtube_video_id not in (
        select video.youtube_video_id
        from jsonb_to_recordset(p_videos) as video(youtube_video_id text)
        where not exists (
          select 1
          from public.artist_videos existing
          where existing.artist_id = p_artist_id
            and existing.youtube_video_id = video.youtube_video_id
            and existing.video_type <> p_video_type
        )
      );
  end if;
end;
$$;

-- CREATE OR REPLACE preserves permissions; state them explicitly for replay.
revoke all on function public.upsert_public_build_videos(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.upsert_public_build_videos(uuid, jsonb, text)
  to service_role;
