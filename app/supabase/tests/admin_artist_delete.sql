begin;
do $$
declare
  actor uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  target uuid;
  other uuid;
  result jsonb;
begin
  insert into auth.users(id) values(actor),(outsider);
  insert into public.users(id) values(actor);
  insert into public.admin_users(user_id) values(actor);
  insert into public.artists(name) values('Deletion fixture') returning id into target;
  insert into public.artists(name) values('Untouched fixture') returning id into other;
  insert into public.artist_videos(artist_id,youtube_video_id,title,search_query,display_order) values(target,'fixture','Fixture','fixture',0);
  insert into public.watch_history(user_id,artist_id,youtube_video_id,video_title) values(actor,target,'fixture','Fixture');
  insert into public.artist_searches(user_id,query_text,selected_artist_id) values(actor,'fixture',target);
  insert into public.admin_content_refreshes(artist_id,requested_by,scopes,before_snapshot,proposed_snapshot)
    values(target,actor,array['videos'],'{}','{}');
  begin
    perform public.admin_delete_artist(target,outsider,'Deletion fixture');
    raise exception 'non-admin unexpectedly deleted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_delete_artist(target,actor,'Wrong name');
    raise exception 'wrong name unexpectedly deleted';
  exception when invalid_parameter_value then null; end;
  update public.artists set is_curated=true where id=target;
  begin
    perform public.admin_delete_artist(target,actor,'Deletion fixture');
    raise exception 'curated unexpectedly deleted';
  exception when raise_exception then
    if sqlerrm <> 'Curated artists cannot be deleted' then raise; end if;
  end;
  assert not exists(select 1 from public.admin_artist_deletions where artist_id=target);
  update public.artists set is_curated=false where id=target;
  result := public.admin_delete_artist(target,actor,'  DELETION FIXTURE  ');
  assert result->>'video_count' = '1';
  assert result->>'watch_history_count' = '1';
  assert result->>'search_count' = '1';
  assert result->>'refresh_count' = '1';
  assert not exists(select 1 from public.artists where id=target);
  assert exists(select 1 from public.artists where id=other);
  assert not exists(select 1 from public.artist_videos where artist_id=target);
  assert not exists(select 1 from public.watch_history where artist_id=target);
  assert not exists(select 1 from public.admin_content_refreshes where artist_id=target);
  assert exists(select 1 from public.artist_searches where user_id=actor and selected_artist_id is null);
  assert exists(select 1 from public.admin_artist_deletions where artist_id=target and deleted_by=actor and refresh_count=1);
  begin
    perform public.admin_delete_artist(target,actor,'Deletion fixture');
    raise exception 'missing artist unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'Artist not found' then raise; end if;
  end;
  assert not has_function_privilege('anon','public.admin_delete_artist(uuid,uuid,text)','execute');
  assert not has_function_privilege('authenticated','public.admin_delete_artist(uuid,uuid,text)','execute');
  assert has_function_privilege('service_role','public.admin_delete_artist(uuid,uuid,text)','execute');
  assert (select relrowsecurity from pg_class where oid='public.admin_artist_deletions'::regclass);
end;
$$;
rollback;
