-- Deliberately separate reviewed video decisions from whole-artist refreshes.
-- No production content is changed by this migration.
-- Public projection only: no reviewer identity, reasons, or audit snapshots.
-- Read alongside the artist to keep reviewed-empty results authoritative.
alter table public.artists add column video_curation_policy jsonb not null
  default '{"reviewed_empty_types": [], "decisions": []}'::jsonb;

create table public.video_curation_reviews (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  policy_version text not null check (policy_version = '2026-11-07.v1'),
  action text not null check (action in ('keep', 'remove')),
  target_type text,
  reason text not null check (length(trim(reason)) between 1 and 2000),
  before_videos jsonb not null,
  before_decision jsonb,
  source_videos jsonb not null,
  after_videos jsonb,
  status text not null default 'preview' check (status in ('preview','approved','applied','conflict','dismissed')),
  requested_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  applied_at timestamptz,
  error_message text,
  check ((action = 'remove' and target_type is null) or
    (action = 'keep' and target_type is not null and target_type in ('concert','interview','music_video')))
);
create index video_curation_reviews_queue on public.video_curation_reviews(requested_by, created_at desc);
create index video_curation_reviews_artist on public.video_curation_reviews(artist_id);

create table public.video_curation_decisions (
  artist_id uuid not null references public.artists(id) on delete cascade,
  youtube_video_id text not null,
  action text not null check (action in ('keep','remove')),
  target_type text,
  policy_version text not null,
  review_id uuid not null references public.video_curation_reviews(id),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null,
  primary key (artist_id, youtube_video_id),
  check ((action = 'remove' and target_type is null) or
    (action = 'keep' and target_type is not null and target_type in ('concert','interview','music_video')))
);
create index video_curation_decisions_review on public.video_curation_decisions(review_id);

alter table public.video_curation_reviews enable row level security;
alter table public.video_curation_decisions enable row level security;
revoke all on public.video_curation_reviews, public.video_curation_decisions from public, anon, authenticated;
grant all on public.video_curation_reviews, public.video_curation_decisions to service_role;

-- Invoker functions are service-role-only. The Edge function verifies the JWT;
-- these functions additionally verify the supplied actor's current admin grant.
create function public.preview_video_curation(p_actor uuid, p_artist uuid, p_video text,
  p_action text, p_target text, p_reason text, p_policy text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare b jsonb; d jsonb; source jsonb; r public.video_curation_reviews;
begin
  if not exists(select 1 from public.admin_users where user_id=p_actor) then
    raise exception 'Admin access required';
  end if;
  perform 1 from public.artists where id=p_artist for update;
  if not found then raise exception 'Artist not found'; end if;
  select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb) into b
    from public.artist_videos v where artist_id=p_artist and youtube_video_id=p_video;
  select to_jsonb(x) into d from public.video_curation_decisions x
    where artist_id=p_artist and youtube_video_id=p_video;
  -- Permit reviewing an exclusion again using its last known stored video.
  if b='[]'::jsonb and d is null then raise exception 'Stored video not found'; end if;
  source := b;
  if b='[]'::jsonb then
    select source_videos into source from public.video_curation_reviews where id=(d->>'review_id')::uuid;
  end if;
  insert into public.video_curation_reviews(artist_id,youtube_video_id,policy_version,action,
    target_type,reason,before_videos,before_decision,source_videos,requested_by)
    values(p_artist,p_video,p_policy,p_action,p_target,p_reason,b,d,source,p_actor) returning * into r;
  return to_jsonb(r);
end $$;

create function public.approve_video_curation(p_actor uuid, p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Admin access required'; end if;
  if coalesce(cardinality(p_ids),0) not between 1 and 100 then raise exception 'Select 1 to 100 reviews'; end if;
  perform 1 from public.video_curation_reviews where id=any(p_ids) order by id for update;
  if (select count(*) from public.video_curation_reviews where id=any(p_ids)
    and requested_by=p_actor and status in ('preview','approved')) <> cardinality(p_ids) then
    raise exception 'Reviews are missing, not owned, duplicated, or no longer pending';
  end if;
  update public.video_curation_reviews set status='approved',approved_by=p_actor,approved_at=now()
    where id=any(p_ids) and status='preview';
end $$;

create function public.apply_video_curation(p_actor uuid, p_ids uuid[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.video_curation_reviews; b jsonb; d jsonb; source jsonb;
  artist uuid; previous_override text; conflict boolean := false;
begin
  if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Admin access required'; end if;
  if coalesce(cardinality(p_ids),0) not between 1 and 100 then raise exception 'Select 1 to 100 reviews'; end if;
  select min(artist_id::text)::uuid into artist from public.video_curation_reviews where id=any(p_ids);
  if artist is null or (select count(*) from public.video_curation_reviews where id=any(p_ids)
    and artist_id=artist and requested_by=p_actor and approved_by=p_actor and status in ('approved','applied')) <> cardinality(p_ids) then
    raise exception 'Select approved reviews for one artist owned by this admin';
  end if;
  -- Same lock order as the public builder: artist first, then video rows.
  perform 1 from public.artists where id=artist for update;
  perform 1 from public.video_curation_reviews where id=any(p_ids) order by id for update;
  if exists(select 1 from public.video_curation_reviews where id=any(p_ids) and status not in ('approved','applied')) then
    raise exception 'Review state changed';
  end if;
  if exists(select 1 from public.video_curation_reviews where id=any(p_ids)
    group by youtube_video_id having count(*)>1) then raise exception 'Duplicate review target'; end if;
  -- Check every target before changing any content; unrelated duplicates are allowed.
  for r in select * from public.video_curation_reviews where id=any(p_ids) and status='approved' loop
    select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb) into b
      from public.artist_videos v where artist_id=artist and youtube_video_id=r.youtube_video_id;
    select to_jsonb(x) into d from public.video_curation_decisions x
      where artist_id=artist and youtube_video_id=r.youtube_video_id;
    if b is distinct from r.before_videos or d is distinct from r.before_decision then conflict := true; end if;
  end loop;
  if conflict then
    update public.video_curation_reviews set status='conflict',error_message='Video or approval changed; create a fresh preview.'
      where id=any(p_ids) and status='approved';
    return jsonb_build_object('status','conflict');
  end if;
  if not exists(select 1 from public.video_curation_reviews where id=any(p_ids) and status='approved') then
    return jsonb_build_object('status','applied');
  end if;
  previous_override := current_setting('app.video_curation_apply',true);
  perform set_config('app.video_curation_apply','true',true);
  for r in select * from public.video_curation_reviews where id=any(p_ids) and status='approved' order by id loop
    if r.action='keep' then
      select value into source from jsonb_array_elements(r.source_videos)
        order by (value->>'video_type'=r.target_type) desc,
          (value->>'is_manually_added')::boolean desc, value->>'id' limit 1;
      if source is null then
        select value into source from public.video_curation_reviews old,
          lateral jsonb_array_elements(old.before_videos)
          where old.id=(r.before_decision->>'review_id')::uuid
          order by (value->>'video_type'=r.target_type) desc,value->>'id' limit 1;
      end if;
      if source is null then raise exception 'No stored video to restore'; end if;
      -- Keep the surviving row ID, data and position when possible.
      delete from public.artist_videos where artist_id=artist and youtube_video_id=r.youtube_video_id
        and id<>(source->>'id')::uuid;
      update public.artist_videos set video_type=r.target_type,is_manually_added=true
        where id=(source->>'id')::uuid and artist_id=artist;
      if not found then
        source := source || jsonb_build_object('video_type',r.target_type,'is_manually_added',true);
        insert into public.artist_videos select * from jsonb_populate_record(null::public.artist_videos,source);
      end if;
    else
      delete from public.artist_videos where artist_id=artist and youtube_video_id=r.youtube_video_id;
    end if;
    insert into public.video_curation_decisions values(artist,r.youtube_video_id,r.action,r.target_type,
      r.policy_version,r.id,p_actor,r.approved_at)
      on conflict(artist_id,youtube_video_id) do update set action=excluded.action,target_type=excluded.target_type,
        policy_version=excluded.policy_version,review_id=excluded.review_id,
        approved_by=excluded.approved_by,approved_at=excluded.approved_at;
    select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb) into b
      from public.artist_videos v where artist_id=artist and youtube_video_id=r.youtube_video_id;
    update public.video_curation_reviews set status='applied',after_videos=b,applied_at=now() where id=r.id;
  end loop;
  perform set_config('app.video_curation_apply',coalesce(previous_override,''),true);
  -- Also marks a deliberately empty artist complete, blocking public rebuild/refill.
  update public.artists set last_refreshed_at=now(), video_curation_policy=jsonb_build_object(
    'reviewed_empty_types', (
      select coalesce(jsonb_agg(category order by category),'[]'::jsonb) from (
        select distinct category from public.video_curation_reviews review,
          lateral (
            select value->>'video_type' as category from jsonb_array_elements(review.source_videos)
            union select review.target_type
          ) touched
        where review.artist_id=artist and review.status='applied'
          and category in ('concert','interview','music_video')
          and not exists(select 1 from public.artist_videos v where v.artist_id=artist and v.video_type=category)
      ) empty_categories
    ),
    'decisions', (
      select coalesce(jsonb_agg(jsonb_build_object('youtube_video_id',youtube_video_id,
        'action',action,'target_type',target_type) order by youtube_video_id),'[]'::jsonb)
      from public.video_curation_decisions where artist_id=artist
    )
  ) where id=artist;
  return jsonb_build_object('status','applied');
end $$;

create function public.guard_video_curation() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare d public.video_curation_decisions; artist uuid; video text;
begin
  if current_setting('app.video_curation_apply',true)='true' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='DELETE' then artist:=old.artist_id; video:=old.youtube_video_id;
  else artist:=new.artist_id; video:=new.youtube_video_id; end if;
  -- Serialize direct writes with review application as well as builder RPCs.
  perform 1 from public.artists where id=artist for update;
  if not found then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='UPDATE' and (old.artist_id,old.youtube_video_id) is distinct from (new.artist_id,new.youtube_video_id)
    and exists(select 1 from public.video_curation_decisions where artist_id=old.artist_id and youtube_video_id=old.youtube_video_id) then
    raise exception 'Use Video Review to change an approved pick';
  end if;
  select * into d from public.video_curation_decisions where artist_id=artist and youtube_video_id=video;
  if not found then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='INSERT' then
    -- Suppress rediscovery and alternate-category duplicates across every writer.
    if d.action='remove' or new.video_type<>d.target_type then return null; end if;
    new.is_manually_added := true;
    return new;
  end if;
  if tg_op='DELETE' or d.action='remove' or new.video_type<>d.target_type or not new.is_manually_added then
    raise exception 'Use Video Review to change an approved pick';
  end if;
  return new;
end $$;
create trigger enforce_video_curation before insert or update or delete on public.artist_videos
  for each row execute function public.guard_video_curation();

revoke all on function public.preview_video_curation(uuid,uuid,text,text,text,text,text),
  public.approve_video_curation(uuid,uuid[]),public.apply_video_curation(uuid,uuid[]),
  public.guard_video_curation() from public,anon,authenticated;
grant execute on function public.preview_video_curation(uuid,uuid,text,text,text,text,text),
  public.approve_video_curation(uuid,uuid[]),public.apply_video_curation(uuid,uuid[]),
  public.guard_video_curation() to service_role;

create index video_curation_reviews_approver on public.video_curation_reviews(approved_by);
create index video_curation_decisions_approver on public.video_curation_decisions(approved_by);
