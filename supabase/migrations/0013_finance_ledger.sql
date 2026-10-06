-- Canonical migration 0013 — Finance ledger hardening
-- Adds a server-authoritative current_balance and transaction-safe balance
-- maintenance for expenses, income, and internal transfers.

alter table public.accounts
  add column if not exists current_balance numeric not null default 0;

create index if not exists accounts_user_balance_idx
  on public.accounts(user_id, current_balance);

create or replace function public.licia_recalculate_account_balance(_account_id uuid)
returns numeric
security definer
set search_path = public
language plpgsql
as $$
declare
  total numeric := 0;
begin
  select coalesce(a.starting_balance, 0)
    + coalesce((select sum(e.amount) from public.incomes e where e.account_id = a.id and e.user_id = a.user_id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.account_id = a.id and e.user_id = a.user_id), 0)
    + coalesce((select sum(t.amount) from public.account_transfers t where t.to_account_id = a.id and t.user_id = a.user_id), 0)
    - coalesce((select sum(t.amount) from public.account_transfers t where t.from_account_id = a.id and t.user_id = a.user_id), 0)
    into total
  from public.accounts a
  where a.id = _account_id;

  if not found then
    return null;
  end if;

  perform set_config('licia.finance_internal', 'on', true);
  update public.accounts
     set current_balance = total
   where id = _account_id;
  return total;
end;
$$;

revoke all on function public.licia_recalculate_account_balance(uuid) from public, anon, authenticated;

-- Existing accounts get an exact one-time balance backfill.
update public.accounts a
set current_balance =
    coalesce(a.starting_balance, 0)
    + coalesce((select sum(i.amount) from public.incomes i where i.account_id = a.id and i.user_id = a.user_id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.account_id = a.id and e.user_id = a.user_id), 0)
    + coalesce((select sum(t.amount) from public.account_transfers t where t.to_account_id = a.id and t.user_id = a.user_id), 0)
    - coalesce((select sum(t.amount) from public.account_transfers t where t.from_account_id = a.id and t.user_id = a.user_id), 0);

create or replace function public.licia_accounts_balance_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.current_balance := coalesce(new.starting_balance, 0);
    return new;
  end if;

  if current_setting('licia.finance_internal', true) = 'on' then
    return new;
  end if;

  if new.starting_balance is distinct from old.starting_balance then
    new.current_balance := coalesce(old.current_balance, 0)
      + coalesce(new.starting_balance, 0)
      - coalesce(old.starting_balance, 0);
  else
    new.current_balance := old.current_balance;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_accounts_balance_guard on public.accounts;
create trigger trg_accounts_balance_guard
before insert or update on public.accounts
for each row execute function public.licia_accounts_balance_guard();

create or replace function public.licia_apply_expense_balance()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  perform set_config('licia.finance_internal', 'on', true);
  if tg_op = 'INSERT' then
    if new.account_id is not null then
      update public.accounts set current_balance = current_balance - new.amount
       where id = new.account_id and user_id = new.user_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.account_id is not null then
      update public.accounts set current_balance = current_balance + old.amount
       where id = old.account_id and user_id = old.user_id;
    end if;
    return old;
  end if;

  if old.account_id is not null and old.account_id is not distinct from new.account_id then
    update public.accounts set current_balance = current_balance + old.amount - new.amount
     where id = new.account_id and user_id = new.user_id;
  else
    if old.account_id is not null then
      update public.accounts set current_balance = current_balance + old.amount
       where id = old.account_id and user_id = old.user_id;
    end if;
    if new.account_id is not null then
      update public.accounts set current_balance = current_balance - new.amount
       where id = new.account_id and user_id = new.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_expenses_balance on public.expenses;
create trigger trg_expenses_balance
after insert or update or delete on public.expenses
for each row execute function public.licia_apply_expense_balance();

create or replace function public.licia_apply_income_balance()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  perform set_config('licia.finance_internal', 'on', true);
  if tg_op = 'INSERT' then
    if new.account_id is not null then
      update public.accounts set current_balance = current_balance + new.amount
       where id = new.account_id and user_id = new.user_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.account_id is not null then
      update public.accounts set current_balance = current_balance - old.amount
       where id = old.account_id and user_id = old.user_id;
    end if;
    return old;
  end if;

  if old.account_id is not null and old.account_id is not distinct from new.account_id then
    update public.accounts set current_balance = current_balance - old.amount + new.amount
     where id = new.account_id and user_id = new.user_id;
  else
    if old.account_id is not null then
      update public.accounts set current_balance = current_balance - old.amount
       where id = old.account_id and user_id = old.user_id;
    end if;
    if new.account_id is not null then
      update public.accounts set current_balance = current_balance + new.amount
       where id = new.account_id and user_id = new.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_incomes_balance on public.incomes;
create trigger trg_incomes_balance
after insert or update or delete on public.incomes
for each row execute function public.licia_apply_income_balance();

create or replace function public.licia_apply_transfer_balance()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  first_id uuid;
  second_id uuid;
begin
  perform set_config('licia.finance_internal', 'on', true);

  if tg_op = 'DELETE' then
    first_id := least(old.from_account_id, old.to_account_id);
    second_id := greatest(old.from_account_id, old.to_account_id);
    perform id from public.accounts where id in (first_id, second_id) and user_id = old.user_id order by id for update;
    update public.accounts set current_balance = current_balance + old.amount where id = old.from_account_id and user_id = old.user_id;
    update public.accounts set current_balance = current_balance - old.amount where id = old.to_account_id and user_id = old.user_id;
    return old;
  elsif tg_op = 'INSERT' then
    first_id := least(new.from_account_id, new.to_account_id);
    second_id := greatest(new.from_account_id, new.to_account_id);
    perform id from public.accounts where id in (first_id, second_id) and user_id = new.user_id order by id for update;
    update public.accounts set current_balance = current_balance - new.amount where id = new.from_account_id and user_id = new.user_id;
    update public.accounts set current_balance = current_balance + new.amount where id = new.to_account_id and user_id = new.user_id;
    return new;
  end if;

  first_id := least(old.from_account_id, old.to_account_id, new.from_account_id, new.to_account_id);
  second_id := greatest(old.from_account_id, old.to_account_id, new.from_account_id, new.to_account_id);
  perform id from public.accounts where id in (first_id, second_id) and user_id = new.user_id order by id for update;
  update public.accounts set current_balance = current_balance + old.amount where id = old.from_account_id and user_id = old.user_id;
  update public.accounts set current_balance = current_balance - old.amount where id = old.to_account_id and user_id = old.user_id;
  update public.accounts set current_balance = current_balance - new.amount where id = new.from_account_id and user_id = new.user_id;
  update public.accounts set current_balance = current_balance + new.amount where id = new.to_account_id and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_account_transfers_balance on public.account_transfers;
create trigger trg_account_transfers_balance
after insert or update or delete on public.account_transfers
for each row execute function public.licia_apply_transfer_balance();

revoke all on function public.licia_accounts_balance_guard() from public, anon, authenticated;
revoke all on function public.licia_apply_expense_balance() from public, anon, authenticated;
revoke all on function public.licia_apply_income_balance() from public, anon, authenticated;
revoke all on function public.licia_apply_transfer_balance() from public, anon, authenticated;

-- Current-balance based transfer RPC. Both accounts are locked in UUID order
-- before the insufficient-funds check, so concurrent transfers serialize safely.
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
  first_id uuid;
  second_id uuid;
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

  first_id := least(p_from_account_id, p_to_account_id);
  second_id := greatest(p_from_account_id, p_to_account_id);
  perform id from public.accounts where id in (first_id, second_id) and user_id = uid order by id for update;

  if not exists (select 1 from public.accounts where id = p_from_account_id and user_id = uid) then
    raise exception using errcode = 'P0001', message = 'Dompet sumber tidak ditemukan.';
  end if;
  if not exists (select 1 from public.accounts where id = p_to_account_id and user_id = uid) then
    raise exception using errcode = 'P0001', message = 'Dompet tujuan tidak ditemukan.';
  end if;

  select name, coalesce(current_balance, 0) into from_name, from_balance
    from public.accounts where id = p_from_account_id and user_id = uid;
  select name, coalesce(current_balance, 0) into to_name, to_balance
    from public.accounts where id = p_to_account_id and user_id = uid;

  if from_balance < p_amount then
    raise exception using errcode = 'P0001', message = 'Saldo dompet sumber tidak cukup.';
  end if;

  insert into public.account_transfers(user_id, from_account_id, to_account_id, amount, note, occurred_at)
  values(uid, p_from_account_id, p_to_account_id, p_amount, nullif(left(coalesce(p_note, ''), 2000), ''), coalesce(p_occurred_at, now()))
  returning * into transfer_row;

  select current_balance into from_balance from public.accounts where id=p_from_account_id and user_id=uid;
  select current_balance into to_balance from public.accounts where id=p_to_account_id and user_id=uid;

  return jsonb_build_object(
    'transfer', to_jsonb(transfer_row),
    'from_account', jsonb_build_object('id', p_from_account_id, 'name', from_name, 'current_balance', from_balance),
    'to_account', jsonb_build_object('id', p_to_account_id, 'name', to_name, 'current_balance', to_balance)
  );
end;
$$;

revoke all on function public.licia_transfer_money(uuid, uuid, numeric, text, timestamptz) from public, anon;
grant execute on function public.licia_transfer_money(uuid, uuid, numeric, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
