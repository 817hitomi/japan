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
    'video/quicktime',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/x-m4a'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
