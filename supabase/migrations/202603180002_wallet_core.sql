begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'wallet_movement_type') then
    create type public.wallet_movement_type as enum (
      'topup',
      'prize',
      'board_purchase',
      'withdrawal',
      'admin_adjustment'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'wallet_direction') then
    create type public.wallet_direction as enum ('credit', 'debit');
  end if;
end
$$;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  locked_balance numeric(12,2) not null default 0 check (locked_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
before update on public.wallets
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_type public.wallet_movement_type not null,
  direction public.wallet_direction not null,
  amount numeric(12,2) not null check (amount > 0),
  balance_before numeric(12,2) not null check (balance_before >= 0),
  balance_after numeric(12,2) not null check (balance_after >= 0),
  operation_ref text null,
  operation_source text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wallets_user_id_idx on public.wallets (user_id);
create index if not exists wallet_transactions_user_created_at_idx
  on public.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_transactions_wallet_created_at_idx
  on public.wallet_transactions (wallet_id, created_at desc);
create index if not exists wallet_transactions_movement_type_idx
  on public.wallet_transactions (movement_type);
create unique index if not exists wallet_transactions_wallet_operation_ref_uidx
  on public.wallet_transactions (wallet_id, operation_ref)
  where operation_ref is not null;

create or replace function public.ensure_wallet_for_user(p_user_id uuid)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets;
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean :=
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin';
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  if v_actor_role <> 'service_role' then
    if v_actor_user_id is null then
      raise exception 'UNAUTHORIZED';
    end if;

    if p_user_id <> v_actor_user_id and not v_actor_is_admin then
      raise exception 'FORBIDDEN_WALLET_TARGET';
    end if;
  end if;

  insert into public.wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.wallets
  where user_id = p_user_id
  limit 1;

  if v_wallet.id is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  return v_wallet;
end;
$$;

create or replace function public.apply_wallet_transaction(
  p_user_id uuid,
  p_movement_type public.wallet_movement_type,
  p_direction public.wallet_direction,
  p_amount numeric,
  p_operation_ref text default null,
  p_operation_source text default 'system',
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns table (
  transaction_id uuid,
  wallet_id uuid,
  user_id uuid,
  movement_type public.wallet_movement_type,
  direction public.wallet_direction,
  amount numeric,
  balance_before numeric,
  balance_after numeric,
  operation_ref text,
  created_at timestamptz,
  was_already_processed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets;
  v_existing public.wallet_transactions;
  v_transaction public.wallet_transactions;
  v_before_balance numeric(12,2);
  v_after_balance numeric(12,2);
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean :=
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin';
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE';
  end if;

  if p_movement_type in ('topup', 'prize') and p_direction <> 'credit' then
    raise exception 'INVALID_DIRECTION_FOR_CREDIT_MOVEMENT';
  end if;

  if p_movement_type in ('board_purchase', 'withdrawal') and p_direction <> 'debit' then
    raise exception 'INVALID_DIRECTION_FOR_DEBIT_MOVEMENT';
  end if;

  if p_movement_type = 'admin_adjustment' and v_actor_role <> 'service_role' and not v_actor_is_admin then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  select * into v_wallet
  from public.ensure_wallet_for_user(p_user_id);

  select * into v_wallet
  from public.wallets
  where id = v_wallet.id
  for update;

  if p_operation_ref is not null then
    select * into v_existing
    from public.wallet_transactions wt
    where wt.wallet_id = v_wallet.id
      and wt.operation_ref = p_operation_ref
    limit 1;

    if v_existing.id is not null then
      return query
      select
        v_existing.id,
        v_existing.wallet_id,
        v_existing.user_id,
        v_existing.movement_type,
        v_existing.direction,
        v_existing.amount,
        v_existing.balance_before,
        v_existing.balance_after,
        v_existing.operation_ref,
        v_existing.created_at,
        true;
      return;
    end if;
  end if;

  v_before_balance := v_wallet.balance;
  v_after_balance := case
    when p_direction = 'credit' then v_before_balance + p_amount
    else v_before_balance - p_amount
  end;

  if v_after_balance < 0 then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.wallets
  set balance = v_after_balance,
      updated_at = now()
  where id = v_wallet.id;

  insert into public.wallet_transactions (
    wallet_id,
    user_id,
    movement_type,
    direction,
    amount,
    balance_before,
    balance_after,
    operation_ref,
    operation_source,
    metadata,
    created_by
  )
  values (
    v_wallet.id,
    p_user_id,
    p_movement_type,
    p_direction,
    p_amount,
    v_before_balance,
    v_after_balance,
    nullif(trim(p_operation_ref), ''),
    coalesce(nullif(trim(p_operation_source), ''), 'system'),
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  returning * into v_transaction;

  return query
  select
    v_transaction.id,
    v_transaction.wallet_id,
    v_transaction.user_id,
    v_transaction.movement_type,
    v_transaction.direction,
    v_transaction.amount,
    v_transaction.balance_before,
    v_transaction.balance_after,
    v_transaction.operation_ref,
    v_transaction.created_at,
    false;
end;
$$;

create or replace function public.handle_profile_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_profile_created_wallet on public.profiles;
create trigger on_profile_created_wallet
after insert on public.profiles
for each row
execute function public.handle_profile_wallet();

insert into public.wallets (user_id)
select p.id
from public.profiles p
left join public.wallets w on w.user_id = p.id
where w.id is null
on conflict (user_id) do nothing;

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
on public.wallets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "wallets_select_admin" on public.wallets;
create policy "wallets_select_admin"
on public.wallets
for select
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin');

drop policy if exists "wallet_transactions_select_own" on public.wallet_transactions;
create policy "wallet_transactions_select_own"
on public.wallet_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "wallet_transactions_select_admin" on public.wallet_transactions;
create policy "wallet_transactions_select_admin"
on public.wallet_transactions
for select
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin');

grant execute on function public.ensure_wallet_for_user(uuid) to authenticated, service_role;
grant execute on function public.apply_wallet_transaction(
  uuid,
  public.wallet_movement_type,
  public.wallet_direction,
  numeric,
  text,
  text,
  jsonb,
  uuid
) to authenticated, service_role;

commit;
