-- LICIA V39 — Stabilization / Hardening
-- Apply after V35.1 finance wallet + V38 AI feedback.
-- Wallet transfers are serialized by locking both account rows in a
-- deterministic order before checking and recording the transfer.

create or replace function public.licia_transfer_money(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_note text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  from_name text;
  to_name text;
  from_balance numeric;
  to_balance numeric;
  transfer_row public.account_transfers%rowtype;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'Jumlah transfer harus lebih besar dari 0.';
  end if;
  if p_from_account_id is null or p_to_account_id is null or p_from_account_id = p_to_account_id then
    raise exception using errcode = '22023', message = 'Dompet sumber dan tujuan harus berbeda.';
  end if;

  if not exists (
    select 1 from public.accounts
    where id = p_from_account_id and user_id = uid
  ) then
    raise exception using errcode = 'P0001', message = 'Dompet sumber tidak ditemukan.';
  end if;
  if not exists (
    select 1 from public.accounts
    where id = p_to_account_id and user_id = uid
  ) then
    raise exception using errcode = 'P0001', message = 'Dompet tujuan tidak ditemukan.';
  end if;

  -- Always lock both accounts in the same order to avoid deadlocks when two
  -- concurrent transfers move money in opposite directions.
  perform id
    from public.accounts
   where user_id = uid
     and id in (p_from_account_id, p_to_account_id)
   order by id
   for update;

  select name, coalesce(starting_balance, 0)
    into from_name, from_balance
    from public.accounts
   where id = p_from_account_id
     and user_id = uid;

  select name, coalesce(starting_balance, 0)
    into to_name, to_balance
    from public.accounts
   where id = p_to_account_id
     and user_id = uid;

  from_balance := from_balance
    + coalesce((select sum(amount) from public.incomes where user_id = uid and account_id = p_from_account_id), 0)
    - coalesce((select sum(amount) from public.expenses where user_id = uid and account_id = p_from_account_id), 0)
    + coalesce((select sum(amount) from public.account_transfers where user_id = uid and to_account_id = p_from_account_id), 0)
    - coalesce((select sum(amount) from public.account_transfers where user_id = uid and from_account_id = p_from_account_id), 0);

  to_balance := to_balance
    + coalesce((select sum(amount) from public.incomes where user_id = uid and account_id = p_to_account_id), 0)
    - coalesce((select sum(amount) from public.expenses where user_id = uid and account_id = p_to_account_id), 0)
    + coalesce((select sum(amount) from public.account_transfers where user_id = uid and to_account_id = p_to_account_id), 0)
    - coalesce((select sum(amount) from public.account_transfers where user_id = uid and from_account_id = p_to_account_id), 0);

  if from_balance < p_amount then
    raise exception using errcode = 'P0001', message = 'Saldo dompet sumber tidak cukup.';
  end if;

  insert into public.account_transfers (user_id, from_account_id, to_account_id, amount, note, occurred_at)
  values (
    uid,
    p_from_account_id,
    p_to_account_id,
    p_amount,
    nullif(left(coalesce(p_note, ''), 2000), ''),
    coalesce(p_occurred_at, now())
  )
  returning * into transfer_row;

  return jsonb_build_object(
    'transfer', to_jsonb(transfer_row),
    'from_account', jsonb_build_object('id', p_from_account_id, 'name', from_name, 'current_balance', from_balance - p_amount),
    'to_account', jsonb_build_object('id', p_to_account_id, 'name', to_name, 'current_balance', to_balance + p_amount)
  );
end;
$$;

revoke all on function public.licia_transfer_money(uuid, uuid, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function public.licia_transfer_money(uuid, uuid, numeric, text, timestamptz) to authenticated;

create index if not exists idx_ai_usage_events_user_created_id
  on public.ai_usage_events(user_id, created_at asc, id asc);

notify pgrst, 'reload schema';
