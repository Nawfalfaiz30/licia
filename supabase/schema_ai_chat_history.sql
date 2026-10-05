-- Licia server-backed chat history
-- Run this once in Supabase SQL Editor / Supabase CLI.
create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text not null default 'default',
  turn_id text,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_chat_messages enable row level security;

drop policy if exists "ai_chat_messages_own" on public.ai_chat_messages;
create policy "ai_chat_messages_own"
  on public.ai_chat_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists ai_chat_messages_user_created_idx
  on public.ai_chat_messages(user_id, conversation_id, created_at desc);

create index if not exists ai_chat_messages_turn_idx
  on public.ai_chat_messages(user_id, conversation_id, turn_id, created_at);

create unique index if not exists ai_chat_messages_turn_unique_idx
  on public.ai_chat_messages(user_id, conversation_id, turn_id, role)
  where turn_id is not null;

comment on table public.ai_chat_messages is
  'Server-side conversation history for Licia. Client localStorage remains a UI cache, not the source of truth.';
