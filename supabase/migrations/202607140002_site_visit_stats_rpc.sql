create or replace function public.record_site_visit(p_visitor_id text)
returns table(visitor_count bigint, visit_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_visitor_id), '') is null then
    return query select 0::bigint, 0::bigint;
    return;
  end if;

  insert into public.site_visitors (visitor_id, first_seen_at, last_seen_at, visit_count)
  values (trim(p_visitor_id), now(), now(), 1)
  on conflict (visitor_id) do update
    set last_seen_at = excluded.last_seen_at,
        visit_count = public.site_visitors.visit_count + 1;

  return query
    select
      count(*)::bigint as visitor_count,
      coalesce(sum(public.site_visitors.visit_count), 0)::bigint as visit_count
    from public.site_visitors;
end;
$$;
