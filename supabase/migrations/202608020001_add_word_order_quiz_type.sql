alter table public.quiz_questions
drop constraint if exists quiz_questions_question_type_check;

alter table public.quiz_questions
add constraint quiz_questions_question_type_check
check (question_type in ('漢字讀法', '漢字書寫', '前後關係', '近義替換', '語序排列'));

alter table public.quiz_questions
drop constraint if exists quiz_questions_word_order_options_check;

alter table public.quiz_questions
add constraint quiz_questions_word_order_options_check
check (question_type <> '語序排列' or jsonb_array_length(options) >= 2);

notify pgrst, 'reload schema';
