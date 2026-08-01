alter table public.songs
  add column if not exists tags text not null default '',
  add column if not exists cover_url text not null default '';
