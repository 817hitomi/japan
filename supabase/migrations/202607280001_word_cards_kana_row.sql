alter table public.word_cards
  add column if not exists kana_row text not null default '';

alter table public.word_cards
  drop constraint if exists word_cards_kana_row_check;

alter table public.word_cards
  add constraint word_cards_kana_row_check
  check (kana_row in ('', 'a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa'));

create index if not exists word_cards_category_kana_row_id_idx
  on public.word_cards (category, kana_row, id desc);

create or replace view public.public_word_facets
with (security_invoker = true)
as
select
  category,
  kana_row,
  count(*)::bigint as word_count
from public.word_cards
where category <> '首頁白版'
group by category, kana_row;

revoke all on public.public_word_facets from public;
grant select on public.public_word_facets to anon, authenticated, service_role;
