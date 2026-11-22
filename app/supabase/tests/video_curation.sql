begin;
do $$
declare actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); artist uuid; other_artist uuid;
  first_id uuid; second_id uuid; saved_time timestamptz; result jsonb;
begin
  insert into auth.users(id) values(actor),(outsider);
  insert into public.users(id) values(actor);
  insert into public.admin_users(user_id) values(actor);
  insert into public.artists(name) values('Curation fixture') returning id into artist;
  insert into public.artists(name) values('Other fixture') returning id into other_artist;
  insert into public.artist_videos(artist_id,youtube_video_id,title,search_query,display_order,video_type,is_manually_added)
    values(artist,'ImQ1i1fBEA0','Tiny Desk','fixture',0,'concert',true),
      (artist,'ImQ1i1fBEA0','Tiny Desk','fixture',0,'interview',false),
      (artist,'KAek2u6POk4','Audio album','fixture',1,'concert',true),
      (other_artist,'KAek2u6POk4','Other artist','fixture',0,'concert',false);
  begin
    perform public.preview_video_curation(outsider,artist,'ImQ1i1fBEA0','keep','concert','test','2026-11-07.v1');
    raise exception 'Authorization failed';
  exception when raise_exception then if sqlerrm <> 'Admin access required' then raise; end if; end;
  first_id := (public.preview_video_curation(actor,artist,'ImQ1i1fBEA0','keep','concert','Live session','2026-11-07.v1')->>'id')::uuid;
  second_id := (public.preview_video_curation(actor,artist,'KAek2u6POk4','remove',null,'Audio only','2026-11-07.v1')->>'id')::uuid;
  begin
    perform public.apply_video_curation(actor,array[first_id]);
    raise exception 'Applied without approval';
  exception when raise_exception then if sqlerrm <> 'Select approved reviews for one artist owned by this admin' then raise; end if; end;
  perform public.approve_video_curation(actor,array[first_id,second_id]);
  result:=public.apply_video_curation(actor,array[first_id,second_id]);
  assert result->>'status'='applied';
  assert (select count(*)=1 from public.artist_videos where artist_id=artist);
  assert (select video_type='concert' and is_manually_added from public.artist_videos where artist_id=artist);
  assert exists(select 1 from public.artist_videos where artist_id=other_artist);
  select last_refreshed_at into saved_time from public.artists where id=artist;
  perform public.apply_video_curation(actor,array[first_id,second_id]);
  assert (select last_refreshed_at=saved_time from public.artists where id=artist);
  insert into public.artist_videos(artist_id,youtube_video_id,title,search_query,display_order,video_type)
    values(artist,'KAek2u6POk4','Rediscovered','fixture',2,'music_video'),
      (artist,'ImQ1i1fBEA0','Wrong section','fixture',2,'interview');
  assert (select count(*)=1 from public.artist_videos where artist_id=artist);
  begin
    delete from public.artist_videos where artist_id=artist;
    raise exception 'Deleted protected pick';
  exception when raise_exception then if sqlerrm <> 'Use Video Review to change an approved pick' then raise; end if; end;
  -- Repeated exclusion must not lose the stored source used for restoration.
  second_id := (public.preview_video_curation(actor,artist,'KAek2u6POk4','remove',null,'Still excluded','2026-11-07.v1')->>'id')::uuid;
  perform public.approve_video_curation(actor,array[second_id]);
  perform public.apply_video_curation(actor,array[second_id]);
  second_id := (public.preview_video_curation(actor,artist,'KAek2u6POk4','keep','music_video','Human override','2026-11-07.v1')->>'id')::uuid;
  perform public.approve_video_curation(actor,array[second_id]);
  perform public.apply_video_curation(actor,array[second_id]);
  assert exists(select 1 from public.artist_videos where artist_id=artist and youtube_video_id='KAek2u6POk4' and video_type='music_video');
  -- Any stale target prevents the entire artist batch changing.
  first_id := (public.preview_video_curation(actor,artist,'ImQ1i1fBEA0','remove',null,'Review again','2026-11-07.v1')->>'id')::uuid;
  second_id := (public.preview_video_curation(actor,artist,'KAek2u6POk4','remove',null,'Review again','2026-11-07.v1')->>'id')::uuid;
  perform public.approve_video_curation(actor,array[first_id,second_id]);
  update public.artist_videos set title='Changed since preview' where artist_id=artist and youtube_video_id='ImQ1i1fBEA0';
  result:=public.apply_video_curation(actor,array[first_id,second_id]);
  assert result->>'status'='conflict';
  assert (select count(*)=2 from public.artist_videos where artist_id=artist);
  assert not has_function_privilege('authenticated','public.apply_video_curation(uuid,uuid[])','execute');
  assert not has_table_privilege('anon','public.video_curation_decisions','select');
  assert not has_table_privilege('authenticated','public.video_curation_reviews','insert');
  -- Artist deletion still cascades normally (no deletion is performed in production).
  delete from public.artists where id=artist;
  assert not exists(select 1 from public.video_curation_decisions where artist_id=artist);
end $$;
rollback;
