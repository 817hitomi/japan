drop index if exists public.word_cards_japanese_unique_idx;

create unique index if not exists word_cards_japanese_kana_unique_idx
  on public.word_cards (japanese, kana);
