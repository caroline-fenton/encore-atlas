-- Guarded admin page-delete: junk pages (wrong subjects, zero-signal names)
-- can be removed from the admin tool instead of raw SQL. Every deletion
-- leaves an audit row, and curated artists are refused outright.

create table public.admin_artist_deletions (
  id uuid primary key default gen_random_uuid(),
  -- No FK: the artist row is gone by the time this row commits.
  artist_id uuid not null,
  artist_name text not null,
  deleted_by uuid not null references auth.users(id) on delete restrict,
  video_count integer not null,
  watch_history_count integer not null,
  search_count integer not null,
  refresh_count integer not null,
  created_at timestamptz not null default now()
);

-- Service-role only, like admin_content_refreshes: RLS on, no policies.
alter table public.admin_artist_deletions enable row level security;

-- Atomic delete-with-audit. Counts are captured under the row lock so the
-- audit row records exactly what the cascade removed (artist_videos and
-- watch_history cascade; artist_searches.selected_artist_id sets null).
create or replace function public.admin_delete_artist(
  p_artist_id uuid,
  p_deleted_by uuid,
  p_confirm_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  artist_row public.artists%rowtype;
  v_video_count integer;
  v_watch_history_count integer;
  v_search_count integer;
  v_refresh_count integer;
begin
  if not exists (select 1 from public.admin_users where user_id = p_deleted_by) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select *
  into artist_row
  from public.artists
  where id = p_artist_id
  for update;

  if artist_row.id is null then
    raise exception 'Artist not found';
  end if;

  if artist_row.is_curated then
    raise exception 'Curated artists cannot be deleted';
  end if;

  if p_confirm_name is null or lower(trim(p_confirm_name)) <> lower(trim(artist_row.name)) then
    raise exception 'Artist name confirmation does not match' using errcode = '22023';
  end if;

  select count(*) into v_video_count
  from public.artist_videos where artist_id = p_artist_id;

  select count(*) into v_watch_history_count
  from public.watch_history where artist_id = p_artist_id;

  select count(*) into v_search_count
  from public.artist_searches where selected_artist_id = p_artist_id;

  select count(*) into v_refresh_count
  from public.admin_content_refreshes where artist_id = p_artist_id;

  insert into public.admin_artist_deletions (
    artist_id,
    artist_name,
    deleted_by,
    video_count,
    watch_history_count,
    search_count,
    refresh_count
  )
  values (
    p_artist_id,
    artist_row.name,
    p_deleted_by,
    v_video_count,
    v_watch_history_count,
    v_search_count,
    v_refresh_count
  );

  delete from public.artists where id = p_artist_id;

  return jsonb_build_object(
    'artist_id', p_artist_id,
    'artist_name', artist_row.name,
    'video_count', v_video_count,
    'watch_history_count', v_watch_history_count,
    'search_count', v_search_count,
    'refresh_count', v_refresh_count
  );
end;
$$;

revoke all on function public.admin_delete_artist(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_delete_artist(uuid, uuid, text) to service_role;
