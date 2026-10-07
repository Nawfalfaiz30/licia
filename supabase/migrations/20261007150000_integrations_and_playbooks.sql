create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  account_email text,
  status text not null default 'pending' check (status in ('pending','active','error','revoked')),
  scopes text[] not null default '{}',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  cursor text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);
alter table public.integration_connections enable row level security;
drop policy if exists "integration_connections_own" on public.integration_connections;
create policy "integration_connections_own" on public.integration_connections for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create index if not exists integration_connections_provider_idx on public.integration_connections(user_id, provider);

create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  state_hash text not null unique,
  code_verifier text,
  redirect_path text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.integration_oauth_states enable row level security;
drop policy if exists "integration_oauth_states_own" on public.integration_oauth_states;
create policy "integration_oauth_states_own" on public.integration_oauth_states for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.inbound_capture_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('telegram','whatsapp','email','generic')),
  token_hash text not null unique,
  label text not null default '',
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.inbound_capture_tokens enable row level security;
drop policy if exists "inbound_capture_tokens_own" on public.inbound_capture_tokens;
create policy "inbound_capture_tokens_own" on public.inbound_capture_tokens for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  modules text[] not null default '{}',
  habits jsonb not null default '[]'::jsonb,
  budget_categories jsonb not null default '[]'::jsonb,
  sample_tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.playbooks enable row level security;
drop policy if exists "playbooks_read_all" on public.playbooks;
create policy "playbooks_read_all" on public.playbooks for select using (true);

insert into public.playbooks(slug,name,description,modules,habits,budget_categories,sample_tasks)
values
 ('student','Mahasiswa','Fokus kuliah, tugas, fokus, dan review mingguan.',
  '{tasks,calendar,focus,notes,habits,goals}',
  '[{"name":"Belajar 60 menit","target_per_week":5}]'::jsonb,
  '["Makan","Transportasi","Kuliah"]'::jsonb,
  '["Review materi","Kerjakan tugas prioritas","Rencanakan pekan depan"]'::jsonb),
 ('freelancer','Freelancer','Menjaga proyek, invoice, fokus, dan arus kas.',
  '{tasks,projects,calendar,finance,focus}',
  '[{"name":"Review pipeline","target_per_week":2}]'::jsonb,
  '["Operasional","Tools","Pajak","Pribadi"]'::jsonb,
  '["Cek deadline client","Kirim invoice","Blok waktu deep work"]'::jsonb),
 ('employee','Karyawan','Rutinitas kerja, rapat, fokus, dan keseimbangan hidup.',
  '{tasks,calendar,focus,habits,finance}',
  '[{"name":"Shutdown ritual","target_per_week":5}]'::jsonb,
  '["Makan","Transportasi","Langganan"]'::jsonb,
  '["Siapkan top 3","Review agenda","Tutup pekerjaan terbuka"]'::jsonb),
 ('small-business','Usaha Kecil','Kas, pengeluaran usaha, pelanggan, dan operasi.',
  '{tasks,projects,calendar,finance,goals,automations}',
  '[{"name":"Rekonsiliasi kas","target_per_week":1}]'::jsonb,
  '["Bahan","Operasional","Marketing","Gaji"]'::jsonb,
  '["Cek saldo","Catat transaksi","Review piutang"]'::jsonb)
on conflict (slug) do nothing;

create table if not exists public.capture_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inbox_item_id uuid,
  source text not null,
  object_path text,
  mime_type text,
  size_bytes bigint,
  extracted_text text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending','processing','completed','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.capture_attachments enable row level security;
drop policy if exists "capture_attachments_own" on public.capture_attachments;
create policy "capture_attachments_own" on public.capture_attachments for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create index if not exists capture_attachments_user_idx on public.capture_attachments(user_id, created_at desc);
