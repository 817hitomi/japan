create table if not exists public.site_ads (
  slot text primary key,
  label text not null,
  enabled boolean not null default false,
  channel text not null default 'affiliate' check (channel in ('affiliate', 'html')),
  link_url text not null default '',
  image_url text not null default '',
  alt_text text not null default '',
  html_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_site_ads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_site_ads_updated_at on public.site_ads;

create trigger set_site_ads_updated_at
before update on public.site_ads
for each row
execute function public.set_site_ads_updated_at();

alter table public.site_ads enable row level security;

grant select on public.site_ads to anon;
grant select, insert, update, delete on public.site_ads to authenticated;
grant all on public.site_ads to service_role;

drop policy if exists "Site ads are publicly readable" on public.site_ads;
create policy "Site ads are publicly readable"
on public.site_ads
for select
using (true);

drop policy if exists "Authenticated users can manage site ads" on public.site_ads;
create policy "Authenticated users can manage site ads"
on public.site_ads
for all
to authenticated
using (true)
with check (true);
