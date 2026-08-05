alter table public.quiz_questions
drop constraint if exists quiz_questions_question_type_check;

alter table public.quiz_questions
add constraint quiz_questions_question_type_check
check (question_type in ('漢字讀法', '漢字書寫', '前後關係', '近義替換', '文法選擇', '語序排列'));

notify pgrst, 'reload schema';
