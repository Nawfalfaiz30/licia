-- LICIA V35.1 - Finance / Wallet overhaul

-- Rich account metadata. Existing rows remain compatible.
alter table if exists public.accounts
  add column if not exists account_type text not null default 'bank';
alter table if exists public.accounts
  add column if not exists is_default boolean not null default false;

alter table if exists public.accounts
  drop constraint if exists accounts_account_type_check;
alter table if exists public.accounts
  add constraint accounts_account_type_check check (account_type in ('bank','cash','ewallet','other'));

create unique index if not exists accounts_one_default_per_user_idx
  on public.accounts (user_id)
  where is_default = true;

-- Internal transfers do not pollute income/expense analytics.
create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint account_transfers_different_accounts check (from_account_id <> to_account_id)
);

alter table public.account_transfers enable row level security;
drop policy if exists account_transfers_all_own on public.account_transfers;
create policy account_transfers_all_own on public.account_transfers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists account_transfers_user_occurred_idx
  on public.account_transfers(user_id, occurred_at desc);
create index if not exists account_transfers_from_idx
  on public.account_transfers(user_id, from_account_id, occurred_at desc);
create index if not exists account_transfers_to_idx
  on public.account_transfers(user_id, to_account_id, occurred_at desc);

-- Sync + versioning for transfers.
drop trigger if exists trg_account_transfers_version on public.account_transfers;
create trigger trg_account_transfers_version
before update on public.account_transfers
for each row execute function public.licia_bump_version();

drop trigger if exists trg_account_transfers_sync_event on public.account_transfers;
create trigger trg_account_transfers_sync_event
after insert or update or delete on public.account_transfers
for each row execute function public.licia_write_sync_event();

-- Expose transfer entity through the universal mutation layer.
-- (The API allowlist maps this to account_transfers.)

notify pgrst, 'reload schema';
