create index if not exists learning_notes_status_slug_idx
  on public.learning_notes (status, slug)
  where slug <> '';

create index if not exists learning_notes_status_category_date_idx
  on public.learning_notes (status, category, published_date desc, id desc);
