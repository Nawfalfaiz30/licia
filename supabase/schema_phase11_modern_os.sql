-- Licia v12.1 — Modern Core / AI / UX
-- Jalankan setelah schema_all.sql.
-- Tidak menghapus data Relations lama; modulnya hanya dipensiunkan dari produk/UI/AI.

alter table public.users
  add column if not exists preferences jsonb not null default '{}'::jsonb;

create index if not exists idx_users_preferences on public.users using gin (preferences);
create index if not exists idx_smart_inbox_open_created on public.smart_inbox_items(user_id, status, created_at desc);
create index if not exists idx_daily_plans_user_week_updated on public.daily_plans(user_id, week_start desc, updated_at desc);

comment on column public.users.preferences is 'Licia UI/UX preferences: language, startPage, weekStart, focus defaults, sound, reduced motion, density, delete confirmation.';
