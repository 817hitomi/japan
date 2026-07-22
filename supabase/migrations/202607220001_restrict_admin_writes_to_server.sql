-- ADMIN_EMAIL is evaluated only by the application server. Authenticated users
-- retain public read access, while every admin mutation goes through protected
-- route handlers that use the service_role client.

revoke insert, update, delete on public.learning_notes from authenticated;
revoke insert, update, delete on public.site_ads from authenticated;
revoke insert, update, delete on public.word_cards from authenticated;
revoke insert, update, delete on public.site_quotes from authenticated;
revoke insert, update, delete on public.quiz_categories from authenticated;
revoke insert, update, delete on public.quiz_questions from authenticated;

revoke usage on sequence public.learning_notes_id_seq from authenticated;
revoke usage on sequence public.word_cards_id_seq from authenticated;
revoke usage on sequence public.site_quotes_id_seq from authenticated;
revoke usage on sequence public.quiz_questions_id_seq from authenticated;

drop policy if exists "Authenticated users can manage learning notes" on public.learning_notes;
drop policy if exists "Authenticated users can manage site ads" on public.site_ads;
drop policy if exists "Authenticated users can manage word cards" on public.word_cards;
drop policy if exists "Authenticated users can manage site quotes" on public.site_quotes;
drop policy if exists "Authenticated users can manage quiz categories" on public.quiz_categories;
drop policy if exists "Authenticated users can manage quiz questions" on public.quiz_questions;
drop policy if exists "Authenticated users can upload note media" on storage.objects;
drop policy if exists "Admins can manage affiliates" on public.affiliates;

