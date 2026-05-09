-- Store Wikipedia content in DB and add Claude-generated bio column

alter table public.artists
  add column if not exists wikipedia_extract text,
  add column if not exists wikipedia_thumbnail_url text,
  add column if not exists wikipedia_url text,
  add column if not exists bio text;
