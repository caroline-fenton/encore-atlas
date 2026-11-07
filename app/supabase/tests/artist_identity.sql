begin;

-- Run after the artist_identity_lookup migration in a transaction and roll
-- back afterwards. Assertions deliberately fail the transaction on regressions.
do $$
declare
  fixture_id uuid;
  resolved_id uuid;
  before_count bigint;
begin
  if public.artist_identity_key('  Touché Amoré  ')
       <> public.artist_identity_key('TOUCHE AMORE')
     or public.artist_identity_key(U&'Touche\0301 Amore\0301')
       <> public.artist_identity_key('Touché Amoré')
     or public.artist_identity_key('touché amoreé')
       <> public.artist_identity_key('Touché Amoré') then
    raise exception 'Accent, Unicode, case, or reviewed typo normalization failed';
  end if;

  if public.artist_identity_key('radio head') <> public.artist_identity_key('Radiohead') then
    raise exception 'Space variants must share one identity';
  end if;

  if public.artist_identity_key('!!!') = public.artist_identity_key('???')
     or public.artist_identity_key('The Creem') = public.artist_identity_key('Creem')
     or public.artist_identity_key('Conan Mockasin') = public.artist_identity_key('Connan Mockasin') then
    raise exception 'Distinct names must not be fuzzily merged';
  end if;

  insert into public.artists (name) values ('Codex identity fixture café')
  returning id into fixture_id;

  select id into resolved_id from public.resolve_artist('CODEX IDENTITY FIXTURE CAFE');
  if resolved_id is distinct from fixture_id then
    raise exception 'Resolver missed an accent/case variant';
  end if;
  select id into resolved_id from public.resolve_artist('The Codex identity fixture cafe');
  if resolved_id is distinct from fixture_id then
    raise exception 'Leading-the fallback failed';
  end if;

  -- Exact identity wins when both leading-the variants are real rows.
  insert into public.artists (name) values ('The Codex identity fixture café')
  returning id into fixture_id;
  select id into resolved_id from public.resolve_artist('The Codex identity fixture cafe');
  if resolved_id is distinct from fixture_id then
    raise exception 'Leading-the fallback overrode an exact identity';
  end if;

  begin
    insert into public.artists (name) values ('CODEX IDENTITY FIXTURE CAFE');
    raise exception 'Unique index allowed a duplicate artist';
  exception when unique_violation then
    null;
  end;

  select count(*) into before_count from public.artists;
  if exists (select 1 from public.resolve_artist('no such codex identity fixture artist'))
     or exists (select 1 from public.resolve_artist('   '))
     or (select count(*) from public.artists) <> before_count then
    raise exception 'Lookup must not create artists or match blank/unknown names';
  end if;

  if has_table_privilege('anon', 'public.artist_identity_merge_backups', 'SELECT')
     or has_table_privilege('authenticated', 'public.artist_identity_merge_backups', 'SELECT') then
    raise exception 'Recovery snapshots are exposed to app users';
  end if;

  if exists (
    select 1 from public.artist_identity_merge_backups b,
      lateral jsonb_array_elements_text(b.snapshot->'search_ids') s(id)
    left join public.artist_searches h on h.id = s.id::uuid
    where h.selected_artist_id is distinct from b.merged_into
  ) or exists (
    select 1 from public.artist_identity_merge_backups b,
      lateral jsonb_array_elements_text(b.snapshot->'watch_ids') w(id)
    left join public.watch_history h on h.id = w.id::uuid
    where h.artist_id is distinct from b.merged_into
  ) then
    raise exception 'Merge lost a search or watch history association';
  end if;

  if exists (
    select 1 from public.artist_identity_merge_backups b,
      lateral jsonb_array_elements(b.snapshot->'videos') v
    where not exists (
      select 1 from public.artist_videos current_video
      where current_video.artist_id = b.merged_into
        and current_video.youtube_video_id = v->>'youtube_video_id'
    )
  ) then
    raise exception 'Merge lost a unique video';
  end if;
end;
$$;

rollback;
