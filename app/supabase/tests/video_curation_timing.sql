-- Local diagnostic only: compare identical 75-row writes with/without the guard.
-- Everything rolls back, including trigger changes. No external API latency measured.
begin;
create temporary table curation_timings(enabled boolean, milliseconds double precision);
do $$
declare a uuid; started timestamptz; enabled boolean; iteration integer;
begin
  insert into public.artists(name) values('Timing fixture') returning id into a;
  foreach enabled in array array[false,true] loop
    if enabled then alter table public.artist_videos enable trigger enforce_video_curation;
    else alter table public.artist_videos disable trigger enforce_video_curation; end if;
    for iteration in 1..25 loop
      started:=clock_timestamp();
      insert into public.artist_videos(artist_id,youtube_video_id,title,search_query,display_order,video_type)
        select a,lpad(n::text,11,'0'),'Timing fixture','fixture',n,'concert' from generate_series(1,75) n;
      insert into curation_timings values(enabled,extract(epoch from clock_timestamp()-started)*1000);
      delete from public.artist_videos where artist_id=a;
    end loop;
  end loop;
end $$;
select '75 video inserts; guard=' || enabled || '; median_ms=' ||
  round(percentile_cont(0.5) within group(order by milliseconds)::numeric,3)
  from curation_timings group by enabled order by enabled;
rollback;
