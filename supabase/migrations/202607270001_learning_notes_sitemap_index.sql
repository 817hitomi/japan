create index if not exists learning_notes_published_sitemap_idx
  on public.learning_notes (updated_at desc, id)
  include (slug)
  where status = '已發布';
