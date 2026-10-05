-- =========================================================
-- Licia — Fase 8: Life OS / Context Engine
-- Jalankan setelah schema_all.sql atau gabungkan ke schema_all.sql.
-- Semua perubahan idempoten.
-- =========================================================

-- Areas: ruang hidup yang stabil, mis. Career, Learning, Personal.
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default '◉',
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.areas enable row level security;
drop policy if exists "areas_all_own" on public.areas;
create policy "areas_all_own" on public.areas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_areas_user on public.areas(user_id, created_at asc);

-- Projects: jembatan antara goal dan tindakan harian.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid references public.areas(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  target_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.projects enable row level security;
drop policy if exists "projects_all_own" on public.projects;
create policy "projects_all_own" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_projects_user_status on public.projects(user_id, status, updated_at desc);

alter table public.goals add column if not exists area_id uuid references public.areas(id) on delete set null;
alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.tasks add column if not exists area_id uuid references public.areas(id) on delete set null;
alter table public.tasks add column if not exists estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0);
alter table public.schedule_blocks add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists idx_tasks_user_project on public.tasks(user_id, project_id, status);
create index if not exists idx_tasks_user_area on public.tasks(user_id, area_id, status);
create index if not exists idx_schedule_user_project on public.schedule_blocks(user_id, project_id);

-- Memory: hal yang sengaja dipilih pengguna untuk dikenali Licia.
create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'preferensi',
  memory_key text not null,
  memory_value text not null,
  source text default 'manual',
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.user_memories enable row level security;
drop policy if exists "memories_all_own" on public.user_memories;
create policy "memories_all_own" on public.user_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_memories_user_enabled on public.user_memories(user_id, enabled, updated_at desc);

-- Automation: aturan ringan milik pengguna. Mesin eksekusi client-side hanya
-- menjalankan aksi yang aman (mis. membuat notifikasi/local flag) tanpa API key.
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  action_type text not null,
  action_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.automations enable row level security;
drop policy if exists "automations_all_own" on public.automations;
create policy "automations_all_own" on public.automations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_automations_user_enabled on public.automations(user_id, enabled);

-- Vault: pengetahuan pribadi berupa teks, URL, potongan OCR, atau ringkasan.
create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  item_type text not null default 'note' check (item_type in ('note','link','snippet','document')),
  content text,
  source_url text,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.vault_items enable row level security;
drop policy if exists "vault_all_own" on public.vault_items;
create policy "vault_all_own" on public.vault_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_vault_user_updated on public.vault_items(user_id, updated_at desc);

-- Indeks pencarian sederhana untuk client-side universal search.
create index if not exists idx_goals_user_area on public.goals(user_id, area_id);
