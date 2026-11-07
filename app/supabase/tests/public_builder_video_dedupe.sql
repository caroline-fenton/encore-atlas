-- Run only in a disposable database after all migrations. Rolls fixtures back.
begin;
create function pg_temp.candidate(video_id text, category text, label text default 'generated')
returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('youtube_video_id', video_id,
    'title', label, 'search_query', 'fixture', 'display_order', 0, 'video_type', category));
$$;
create function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception '%', message; end if;
end $$;

do $$
declare
  artist uuid;
  other_artist uuid;
  before_rows jsonb;
begin
  insert into public.artists(name) values ('dedupe fixture') returning id into artist;
  insert into public.artists(name) values ('dedupe other fixture') returning id into other_artist;

  -- An existing category wins, including when the concert write arrives later.
  perform public.upsert_public_build_videos(artist, pg_temp.candidate('shared', 'interview'), 'interview');
  perform public.upsert_public_build_videos(artist, pg_temp.candidate('shared', 'concert'), 'concert');
  perform public.upsert_public_build_videos(artist, pg_temp.candidate('shared', 'music_video'), 'music_video');
  perform pg_temp.assert_true((select count(*) = 1 and min(video_type) = 'interview'
    from public.artist_videos where artist_id = artist), 'Existing category did not win');

  -- Legacy calls without a category must not bypass cross-category exclusion.
  perform public.upsert_public_build_videos(artist, pg_temp.candidate('shared', 'concert'));
  perform pg_temp.assert_true((select count(*) = 1 from public.artist_videos where artist_id = artist),
    'Legacy call bypassed dedupe');

  -- Same-category metadata is refreshed, but manual title/order is immutable.
  perform public.upsert_public_build_videos(artist, pg_temp.candidate('shared', 'interview', 'updated'), 'interview');
  perform pg_temp.assert_true((select title = 'updated' from public.artist_videos where artist_id = artist),
    'Automatic metadata was not refreshed');
  update public.artist_videos set is_manually_added = true, title = 'manual title', display_order = 7
    where artist_id = artist;
  perform public.upsert_public_build_videos(artist, pg_temp.candidate('shared', 'interview', 'overwrite'), 'interview');
  perform pg_temp.assert_true((select title = 'manual title' and display_order = 7 and is_manually_added
    from public.artist_videos where artist_id = artist), 'Manual selection was overwritten');

  -- Retry cleanup removes the stale automatic copy while preserving the manual one.
  insert into public.artist_videos(artist_id, youtube_video_id, title, search_query, video_type)
    values (artist, 'shared', 'old duplicate', 'fixture', 'concert');
  perform public.upsert_public_build_videos(artist, pg_temp.candidate('shared', 'concert'), 'concert');
  perform pg_temp.assert_true((select count(*) = 1 from public.artist_videos where artist_id = artist),
    'Stale cross-category copy survived');

  perform public.upsert_public_build_videos(artist, pg_temp.candidate('stale', 'interview'), 'interview');
  perform public.upsert_public_build_videos(other_artist, pg_temp.candidate('other', 'interview'), 'interview');
  perform public.upsert_public_build_videos(artist, '[]', 'interview');
  perform pg_temp.assert_true((select count(*) = 1 and bool_and(is_manually_added)
    from public.artist_videos where artist_id = artist), 'Empty refresh deleted manual content or kept stale rows');
  perform pg_temp.assert_true((select count(*) = 1 from public.artist_videos where artist_id = other_artist),
    'Cleanup touched another artist');

  -- Preserve intentional manual selections even if two categories contain one ID.
  insert into public.artist_videos(artist_id, youtube_video_id, title, search_query, video_type, is_manually_added)
    values (artist, 'shared', 'second manual', 'fixture', 'concert', true);
  perform public.upsert_public_build_videos(artist, '[]', 'concert');
  perform pg_temp.assert_true((select count(*) = 2 from public.artist_videos where artist_id = artist),
    'Conflicting manual selections were silently resolved');

  -- Bad payloads must fail without removing any rows.
  select jsonb_agg(to_jsonb(v) order by id) into before_rows from public.artist_videos v where artist_id = artist;
  begin
    perform public.upsert_public_build_videos(artist, pg_temp.candidate('bad', 'concert'), 'interview');
    raise exception 'Mismatched category accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.upsert_public_build_videos(artist, pg_temp.candidate(null, 'interview'), 'interview');
    raise exception 'Null video ID accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.upsert_public_build_videos(artist,
      pg_temp.candidate('duplicate', 'interview') || pg_temp.candidate('duplicate', 'interview'), 'interview');
    raise exception 'Duplicate payload accepted';
  exception when invalid_parameter_value then null;
  end;
  perform pg_temp.assert_true(before_rows = (select jsonb_agg(to_jsonb(v) order by id)
    from public.artist_videos v where artist_id = artist), 'Invalid request changed stored rows');

  -- Both admin curation and a completed/video-only publish stop all writes.
  update public.artists set is_curated = true where id = artist;
  begin
    perform public.upsert_public_build_videos(artist, '[]', 'concert');
    raise exception 'Curated write accepted';
  exception when raise_exception then
    if sqlerrm <> 'Artist was curated while the public build was running' then raise; end if;
  end;
  update public.artists set is_curated = false, last_refreshed_at = now() where id = artist;
  begin
    perform public.upsert_public_build_videos(artist, '[]', 'concert');
    raise exception 'Completed write accepted';
  exception when raise_exception then
    if sqlerrm <> 'Artist was curated while the public build was running' then raise; end if;
  end;

  perform pg_temp.assert_true(not has_function_privilege('anon',
    'public.upsert_public_build_videos(uuid,jsonb,text)', 'EXECUTE'), 'Anon can write videos');
  perform pg_temp.assert_true(not has_function_privilege('authenticated',
    'public.upsert_public_build_videos(uuid,jsonb,text)', 'EXECUTE'), 'Authenticated client can write videos');
  perform pg_temp.assert_true(has_function_privilege('service_role',
    'public.upsert_public_build_videos(uuid,jsonb,text)', 'EXECUTE'), 'Service role cannot write videos');
end $$;
rollback;
