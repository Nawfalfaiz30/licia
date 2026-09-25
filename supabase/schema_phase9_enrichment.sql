-- Licia v12 — Enrichment: projects, memory, knowledge, health, reading, habits, people, subscriptions.
-- Jalankan setelah schema_phase8_life_os.sql.

alter table public.goals add column if not exists why text;
alter table public.goals add column if not exists next_step text;
alter table public.goals add column if not exists review_cycle text default 'weekly';

alter table public.brain_dump_notes add column if not exists title text;
alter table public.brain_dump_notes add column if not exists updated_at timestamptz default now();
alter table public.brain_dump_notes add column if not exists color text;

alter table public.reading_logs add column if not exists total_pages integer;
alter table public.reading_logs add column if not exists current_page integer default 0;
alter table public.reading_logs add column if not exists format text default 'digital';
alter table public.reading_logs add column if not exists started_at timestamptz;
alter table public.reading_logs add column if not exists finished_at timestamptz;
alter table public.reading_logs add column if not exists last_read_at timestamptz;
alter table public.reading_logs add column if not exists takeaways text;

alter table public.habits add column if not exists description text;
alter table public.habits add column if not exists preferred_time time;
alter table public.habits add column if not exists color text;
alter table public.habits add column if not exists active boolean not null default true;

alter table public.social_relations add column if not exists tags text[] default '{}';
alter table public.social_relations add column if not exists next_followup_date date;
alter table public.social_relations add column if not exists preferred_channel text;
alter table public.social_relations add column if not exists avatar_url text;
alter table public.social_interactions add column if not exists interaction_type text default 'lainnya';

alter table public.subscriptions add column if not exists reminder_days integer default 3;
alter table public.subscriptions add column if not exists service_url text;
alter table public.subscriptions add column if not exists notes text;

alter table public.skills add column if not exists target_date date;
alter table public.skills add column if not exists learning_mode text default 'practice';
alter table public.skills add column if not exists hours_spent numeric default 0;

alter table public.decisions add column if not exists tags text[] default '{}';
alter table public.decisions add column if not exists result_rating integer check (result_rating between 1 and 5);

create index if not exists idx_notes_user_updated on public.brain_dump_notes(user_id, updated_at desc);
create index if not exists idx_reading_user_updated on public.reading_logs(user_id, updated_at desc);
create index if not exists idx_habits_user_active on public.habits(user_id, active);
create index if not exists idx_relations_user_followup on public.social_relations(user_id, next_followup_date);
create index if not exists idx_subscriptions_user_due on public.subscriptions(user_id, active, next_billing_date);
create index if not exists idx_skills_user_target on public.skills(user_id, target_date);
create index if not exists idx_decisions_user_created on public.decisions(user_id, created_at desc);
