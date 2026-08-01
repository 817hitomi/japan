alter table public.quiz_questions
add column if not exists question_type text not null default '漢字讀法';

alter table public.quiz_questions
drop constraint if exists quiz_questions_question_type_check;

alter table public.quiz_questions
add constraint quiz_questions_question_type_check
check (question_type in ('漢字讀法', '漢字書寫', '前後關係', '近義替換'));

create index if not exists quiz_questions_level_category_type_id_idx
on public.quiz_questions (level, category, question_type, id desc);
