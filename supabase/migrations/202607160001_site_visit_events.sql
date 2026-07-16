create table if not exists public.site_visit_events (
  id bigserial primary key,
  visitor_id text not null,
  page_path text not null,
  page_title text,
  referrer text,
  user_agent text,
  visited_at timestamptz not null default now()
);

create index if not exists site_visit_events_visited_at_idx
  on public.site_visit_events (visited_at desc);

create index if not exists site_visit_events_page_path_idx
  on public.site_visit_events (page_path);

create index if not exists site_visit_events_visitor_id_idx
  on public.site_visit_events (visitor_id);
