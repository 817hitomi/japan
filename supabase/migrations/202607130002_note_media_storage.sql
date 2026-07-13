insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-media',
  'note-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public note media are readable" on storage.objects;
create policy "Public note media are readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'note-media');

drop policy if exists "Authenticated users can upload note media" on storage.objects;
create policy "Authenticated users can upload note media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'note-media');
