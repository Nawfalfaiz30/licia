-- Canonical migration 0014 — Sync mutation leases
-- Gives each processing mutation an explicit claim token and lease deadline.
-- A worker can only finish a mutation while it owns the current claim.

alter table public.life_os_sync_mutations
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists lease_expires_at timestamptz;

create index if not exists life_os_sync_mutations_lease_idx
  on public.life_os_sync_mutations(status, lease_expires_at);

create index if not exists life_os_sync_mutations_user_lease_idx
  on public.life_os_sync_mutations(user_id, status, lease_expires_at);
