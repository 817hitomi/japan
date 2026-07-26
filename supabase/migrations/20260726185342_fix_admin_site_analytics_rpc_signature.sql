-- PostgREST resolves RPCs by schema, function name, and the complete set of
-- named arguments. Remove known legacy signatures before recreating the exact
-- four-argument contract used by /api/admin/site-analytics.
drop function if exists public.get_admin_site_analytics(timestamptz, timestamptz);
drop function if exists public.get_admin_site_analytics(timestamptz, timestamptz, integer);
drop function if exists public.get_admin_site_analytics(timestamptz, timestamptz, integer, integer);
drop function if exists public.get_admin_site_analytics(integer, timestamptz, integer, timestamptz);

create function public.get_admin_site_analytics(
  p_page_limit integer,
  p_since timestamptz,
  p_source_limit integer,
  p_until timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with valid_events as materialized (
    select
      visitor_id,
      page_path,
      nullif(btrim(page_title), '') as page_title,
      referrer,
      visited_at,
      date_trunc('hour', timezone('Asia/Taipei', visited_at)) as taipei_hour,
      case
        when referrer is null or btrim(referrer) = '' then '直接／未知'
        when lower(referrer) ~ '^https?://(www\.)?(japan-note\.com|localhost)([:/]|$)' then '站內連結'
        when lower(referrer) ~ '^https?://(www\.)?google\.' then 'Google 搜尋'
        when lower(referrer) ~ '^https?://(www\.)?yahoo\.' then 'Yahoo 搜尋'
        when lower(referrer) ~ '^https?://(www\.)?bing\.' then 'Bing 搜尋'
        when lower(referrer) ~ '^https?://([^/]*\.)?(facebook\.|fb\.)' then 'Facebook'
        when lower(referrer) ~ '^https?://([^/]*\.)?instagram\.' then 'Instagram'
        when lower(referrer) ~ '^https?://([^/]*\.)?line\.' then 'LINE'
        when lower(referrer) ~ '^https?://([^/]*\.)?(youtube\.|youtu\.be)' then 'YouTube'
        else coalesce(
          nullif(
            lower(regexp_replace(referrer, '^https?://(?:www\.)?([^/:?#]+).*$', '\1', 'i')),
            ''
          ),
          '直接／未知'
        )
      end as source_label
    from public.site_visit_events
    where visited_at >= p_since
      and visited_at < p_until
      and visitor_id is not null
      and page_path is not null
  ),
  hours as (
    select generate_series(
      date_trunc('hour', timezone('Asia/Taipei', p_until)) - interval '23 hours',
      date_trunc('hour', timezone('Asia/Taipei', p_until)),
      interval '1 hour'
    ) as taipei_hour
  ),
  hourly_stats as (
    select
      hours.taipei_hour,
      count(distinct valid_events.visitor_id) as visitors,
      count(valid_events.visitor_id) as views
    from hours
    left join valid_events using (taipei_hour)
    group by hours.taipei_hour
    order by hours.taipei_hour
  ),
  latest_page_titles as (
    select distinct on (page_path)
      page_path,
      page_title as title
    from valid_events
    where page_title is not null
    order by page_path, visited_at desc
  ),
  page_stats as (
    select
      valid_events.page_path as path,
      coalesce(latest_page_titles.title, valid_events.page_path) as title,
      count(distinct valid_events.visitor_id) as visitors,
      count(*) as views,
      max(valid_events.visited_at) as last_seen_at
    from valid_events
    left join latest_page_titles using (page_path)
    group by valid_events.page_path, coalesce(latest_page_titles.title, valid_events.page_path)
    order by views desc, path
    limit greatest(0, least(p_page_limit, 100))
  ),
  source_stats as (
    select
      source_label as source,
      count(distinct visitor_id) as visitors,
      count(*) as views
    from valid_events
    group by source_label
    order by views desc, source
    limit greatest(0, least(p_source_limit, 100))
  ),
  event_summary as (
    select
      count(distinct visitor_id) as tracked_visitors,
      count(*) as total_views
    from valid_events
  )
  select jsonb_build_object(
    'totalVisitors', coalesce((select count(*) from public.site_visitors), 0),
    'trackedVisitors', coalesce(event_summary.tracked_visitors, 0),
    'totalViews', coalesce(event_summary.total_views, 0),
    'processedRows', coalesce(event_summary.total_views, 0),
    'hourly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', to_char(taipei_hour, 'MM/DD HH24:00'),
        'visitors', visitors,
        'views', views
      ) order by taipei_hour)
      from hourly_stats
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', path,
        'title', title,
        'visitors', visitors,
        'views', views,
        'lastSeenAt', last_seen_at
      ) order by views desc, path)
      from page_stats
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', source,
        'visitors', visitors,
        'views', views
      ) order by views desc, source)
      from source_stats
    ), '[]'::jsonb)
  )
  from event_summary;
$$;

revoke all on function public.get_admin_site_analytics(integer, timestamptz, integer, timestamptz)
  from public, anon, authenticated;
grant select on table public.site_visitors to service_role;
grant select on table public.site_visit_events to service_role;
grant execute on function public.get_admin_site_analytics(integer, timestamptz, integer, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
