alter table public.site_visitors
  add column if not exists last_path text not null default '/';

create or replace function public.record_site_visit(p_visitor_id text, p_path text default '/')
returns table(visitor_count bigint, visit_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text := left(coalesce(nullif(trim(p_path), ''), '/'), 512);
begin
  if nullif(trim(p_visitor_id), '') is null then
    return query select 0::bigint, 0::bigint;
    return;
  end if;

  insert into public.site_visitors (visitor_id, first_seen_at, last_seen_at, visit_count, last_path)
  values (trim(p_visitor_id), now(), now(), 1, v_path)
  on conflict (visitor_id) do update
    set last_seen_at = excluded.last_seen_at,
        last_path = excluded.last_path,
        visit_count = public.site_visitors.visit_count + 1;

  return query
    select
      count(*)::bigint as visitor_count,
      coalesce(sum(public.site_visitors.visit_count), 0)::bigint as visit_count
    from public.site_visitors;
end;
$$;
