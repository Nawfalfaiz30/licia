-- Licia v0.57 — migrasi aditif dan idempoten (aman dijalankan ulang).
-- Jalankan SETELAH schema_all_v30.sql dan migrasi v31–v38. Jalankan di Supabase SQL Editor / CLI.
--
-- Isi:
--   1. Tugas: tag, aturan berulang, tanggal selesai
--   2. Multi-percakapan chat (ai_chat_conversations) + ringkasan bergulir
--   3. Jurnal harian + mood
--   4. Penelusuran AI: kolom tambahan ai_usage_events (model diminta, fallback, latensi, jumlah tool)
--   5. Memori semantik (pgvector) — opsional, aktif bila LICIA_SEMANTIC_SEARCH=true
--   6. Indeks untuk query umum (F4)
--
-- Semua tabel baru: RLS aktif + kebijakan pemilik (diperiksa oleh `npm run audit:rls`).

-- 1. TUGAS -----------------------------------------------------------------
alter table public.tasks add column if not exists tags text[] not null default '{}';
alter table public.tasks add column if not exists recurrence jsonb;
alter table public.tasks add column if not exists recurrence_origin_id uuid references public.tasks(id) on delete set null;
alter table public.tasks add column if not exists completed_at timestamptz;

-- Aturan berulang harus berupa objek JSON (validasi bentuk ketat dilakukan di aplikasi).
alter table public.tasks drop constraint if exists tasks_recurrence_is_object;
alter table public.tasks add constraint tasks_recurrence_is_object
  check (recurrence is null or jsonb_typeof(recurrence) = 'object');

-- 2. MULTI-PERCAKAPAN ------------------------------------------------------
-- ai_chat_messages.conversation_id (text) sudah ada; id percakapan baru berupa uuid dalam bentuk teks.
-- Percakapan lama ('default') dibuat barisnya secara lazy oleh API saat daftar dimuat.
create table if not exists public.ai_chat_conversations (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  pinned boolean not null default false,
  -- Ringkasan bergulir untuk giliran lama yang sudah keluar dari jendela konteks (B11).
  summary text not null default '',
  summary_message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
alter table public.ai_chat_conversations enable row level security;
drop policy if exists "ai_chat_conversations_own" on public.ai_chat_conversations;
create policy "ai_chat_conversations_own" on public.ai_chat_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists ai_chat_conversations_user_idx
  on public.ai_chat_conversations(user_id, pinned desc, last_message_at desc);

-- 3. JURNAL HARIAN ---------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  mood smallint check (mood is null or mood between 1 and 5),
  content text not null default '',
  reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
alter table public.journal_entries enable row level security;
drop policy if exists "journal_entries_own" on public.journal_entries;
create policy "journal_entries_own" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists journal_entries_user_date_idx
  on public.journal_entries(user_id, entry_date desc);

-- 4. PENELUSURAN AI (B7 / B12) ----------------------------------------------
alter table public.ai_usage_events add column if not exists requested_model text;
alter table public.ai_usage_events add column if not exists fallback_used boolean not null default false;
alter table public.ai_usage_events add column if not exists latency_ms integer;
alter table public.ai_usage_events add column if not exists tool_count integer not null default 0;
alter table public.ai_usage_events add column if not exists turn_id text;
create index if not exists idx_ai_usage_events_user_endpoint
  on public.ai_usage_events(user_id, endpoint, created_at desc);

-- 5. MEMORI SEMANTIK (B5) ----------------------------------------------------
-- Konten Vault TIDAK PERNAH di-embed (terenkripsi di sisi klien).
create extension if not exists vector;

create table if not exists public.licia_embeddings (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('note','memory','decision','task','inbox')),
  entity_id uuid not null,
  content_hash text not null,
  embedding vector(1536) not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);
alter table public.licia_embeddings enable row level security;
drop policy if exists "licia_embeddings_own" on public.licia_embeddings;
create policy "licia_embeddings_own" on public.licia_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists licia_embeddings_hnsw_idx
  on public.licia_embeddings using hnsw (embedding vector_cosine_ops);

create or replace function public.match_licia_embeddings(
  query_embedding vector(1536),
  match_count integer default 8,
  entity_types text[] default null
)
returns table (entity_type text, entity_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select e.entity_type, e.entity_id, 1 - (e.embedding <=> query_embedding) as similarity
  from public.licia_embeddings e
  where e.user_id = auth.uid()
    and (entity_types is null or e.entity_type = any(entity_types))
  order by e.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

-- 6. INDEKS (F4) -------------------------------------------------------------
create index if not exists idx_tasks_user_due on public.tasks(user_id, due_at);
create index if not exists idx_tasks_user_status_due on public.tasks(user_id, status, due_at);
create index if not exists idx_tasks_tags_gin on public.tasks using gin (tags);
create index if not exists idx_expenses_user_occurred on public.expenses(user_id, occurred_at desc);
create index if not exists idx_incomes_user_occurred on public.incomes(user_id, occurred_at desc);
create index if not exists idx_schedule_blocks_user_date on public.schedule_blocks(user_id, block_date, start_time);
create index if not exists idx_inbox_user_status_created on public.smart_inbox_items(user_id, status, created_at desc);
create index if not exists idx_notes_user_created on public.brain_dump_notes(user_id, created_at desc);
create index if not exists idx_reminders_user_due on public.reminders(user_id, status, remind_at);
create index if not exists idx_pomodoro_user_started on public.pomodoro_sessions(user_id, started_at desc);
