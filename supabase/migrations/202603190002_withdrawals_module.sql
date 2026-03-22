begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'withdrawal_status') then
    create type public.withdrawal_status as enum ('pending', 'approved', 'paid', 'rejected');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bank_account_type') then
    create type public.bank_account_type as enum ('savings', 'checking');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'withdrawal_event_type') then
    create type public.withdrawal_event_type as enum (
      'created',
      'approved',
      'paid',
      'rejected'
    );
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wallets_locked_balance_lte_balance'
  ) then
    alter table public.wallets
    add constraint wallets_locked_balance_lte_balance
    check (locked_balance <= balance);
  end if;
end
$$;

create table if not exists public.withdrawal_fee_rules (
  id uuid primary key default gen_random_uuid(),
  bank_normalized text not null unique,
  fee numeric(12,2) not null check (fee >= 0),
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_withdrawal_fee_rules_updated_at on public.withdrawal_fee_rules;
create trigger set_withdrawal_fee_rules_updated_at
before update on public.withdrawal_fee_rules
for each row
execute function public.set_current_timestamp_updated_at();

insert into public.withdrawal_fee_rules (bank_normalized, fee, description)
values
  ('banco pichincha', 0, 'Sin costo adicional'),
  ('pichincha', 0, 'Sin costo adicional'),
  ('banco guayaquil', 0, 'Sin costo adicional'),
  ('guayaquil', 0, 'Sin costo adicional'),
  ('__default__', 0.45, 'Comision interbancaria estandar')
on conflict (bank_normalized) do nothing;

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text not null,
  bank_normalized text not null,
  account_type public.bank_account_type not null,
  account_number text not null,
  account_holder_name text not null,
  account_holder_id text not null,
  amount_requested numeric(12,2) not null check (amount_requested > 0),
  fee_applied numeric(12,2) not null check (fee_applied >= 0),
  amount_net numeric(12,2) not null check (amount_net >= 0),
  locked_amount numeric(12,2) not null check (locked_amount > 0),
  status public.withdrawal_status not null default 'pending',
  admin_observation text null,
  rejection_reason text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  paid_at timestamptz null,
  rejected_at timestamptz null,
  wallet_transaction_id uuid null references public.wallet_transactions(id) on delete set null,
  external_reference text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'withdrawals_amount_net_check'
      and c.conrelid = 'public.withdrawals'::regclass
  ) then
    alter table public.withdrawals
    add constraint withdrawals_amount_net_check
    check (amount_net = amount_requested - fee_applied);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'withdrawals_paid_requires_wallet_tx'
      and c.conrelid = 'public.withdrawals'::regclass
  ) then
    alter table public.withdrawals
    add constraint withdrawals_paid_requires_wallet_tx
    check ((status <> 'paid') or (wallet_transaction_id is not null));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'withdrawals_rejected_requires_reason'
      and c.conrelid = 'public.withdrawals'::regclass
  ) then
    alter table public.withdrawals
    add constraint withdrawals_rejected_requires_reason
    check (
      (status <> 'rejected' and rejection_reason is null) or
      (status = 'rejected' and coalesce(length(trim(rejection_reason)), 0) > 0)
    );
  end if;
end
$$;

drop trigger if exists set_withdrawals_updated_at on public.withdrawals;
create trigger set_withdrawals_updated_at
before update on public.withdrawals
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.withdrawal_events (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.withdrawals(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type public.withdrawal_event_type not null,
  previous_status public.withdrawal_status null,
  current_status public.withdrawal_status not null,
  notes text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists withdrawals_user_created_at_idx
  on public.withdrawals (user_id, created_at desc);
create index if not exists withdrawals_status_created_at_idx
  on public.withdrawals (status, created_at desc);
create index if not exists withdrawals_user_status_created_at_idx
  on public.withdrawals (user_id, status, created_at desc);
create unique index if not exists withdrawals_wallet_tx_uidx
  on public.withdrawals (wallet_transaction_id)
  where wallet_transaction_id is not null;
create index if not exists withdrawal_events_withdrawal_created_at_idx
  on public.withdrawal_events (withdrawal_id, created_at desc);

alter table public.withdrawal_fee_rules enable row level security;
alter table public.withdrawals enable row level security;
alter table public.withdrawal_events enable row level security;

drop policy if exists "withdrawal_fee_rules_select_authenticated" on public.withdrawal_fee_rules;
create policy "withdrawal_fee_rules_select_authenticated"
on public.withdrawal_fee_rules
for select
to authenticated
using (true);

drop policy if exists "withdrawal_fee_rules_admin_manage" on public.withdrawal_fee_rules;
create policy "withdrawal_fee_rules_admin_manage"
on public.withdrawal_fee_rules
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "withdrawals_select_own" on public.withdrawals;
create policy "withdrawals_select_own"
on public.withdrawals
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "withdrawals_select_admin" on public.withdrawals;
create policy "withdrawals_select_admin"
on public.withdrawals
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "withdrawal_events_select_own" on public.withdrawal_events;
create policy "withdrawal_events_select_own"
on public.withdrawal_events
for select
to authenticated
using (
  exists (
    select 1
    from public.withdrawals w
    where w.id = withdrawal_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "withdrawal_events_select_admin" on public.withdrawal_events;
create policy "withdrawal_events_select_admin"
on public.withdrawal_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create or replace function public.normalize_bank_name(p_bank_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(p_bank_name, ''))), '\s+', ' ', 'g');
$$;

create or replace function public.resolve_withdrawal_fee(p_bank_name text)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_bank_normalized text := public.normalize_bank_name(p_bank_name);
  v_fee numeric(12,2);
begin
  if v_bank_normalized = '' then
    raise exception 'BANK_NAME_REQUIRED';
  end if;

  select r.fee
    into v_fee
  from public.withdrawal_fee_rules r
  where r.bank_normalized = v_bank_normalized
  limit 1;

  if v_fee is null then
    select r.fee
      into v_fee
    from public.withdrawal_fee_rules r
    where r.bank_normalized = '__default__'
    limit 1;
  end if;

  return coalesce(v_fee, 0);
end;
$$;

create or replace function public.get_withdrawal_fee_quote(
  p_bank_name text,
  p_amount_requested numeric
)
returns table (
  bank_normalized text,
  fee_applied numeric,
  amount_net numeric
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_bank_normalized text := public.normalize_bank_name(p_bank_name);
  v_fee numeric(12,2);
  v_net numeric(12,2);
begin
  if v_bank_normalized = '' then
    raise exception 'BANK_NAME_REQUIRED';
  end if;

  if p_amount_requested is null or p_amount_requested <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE';
  end if;

  v_fee := public.resolve_withdrawal_fee(v_bank_normalized);
  v_net := round(p_amount_requested::numeric - v_fee, 2);

  if v_net <= 0 then
    raise exception 'AMOUNT_LESS_OR_EQUAL_FEE';
  end if;

  return query
  select
    v_bank_normalized,
    round(v_fee::numeric, 2),
    v_net;
end;
$$;

create or replace function public.create_withdrawal_request(
  p_bank_name text,
  p_account_type public.bank_account_type,
  p_account_number text,
  p_account_holder_name text,
  p_account_holder_id text,
  p_amount_requested numeric,
  p_metadata jsonb default '{}'::jsonb
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets;
  v_withdrawal public.withdrawals;
  v_available_balance numeric(12,2);
  v_quote record;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_account_number is null or trim(p_account_number) = '' then
    raise exception 'ACCOUNT_NUMBER_REQUIRED';
  end if;

  if p_account_holder_name is null or trim(p_account_holder_name) = '' then
    raise exception 'ACCOUNT_HOLDER_REQUIRED';
  end if;

  if p_account_holder_id is null or trim(p_account_holder_id) = '' then
    raise exception 'ACCOUNT_HOLDER_ID_REQUIRED';
  end if;

  select * into v_quote
  from public.get_withdrawal_fee_quote(p_bank_name, p_amount_requested)
  limit 1;

  select * into v_wallet
  from public.ensure_wallet_for_user(v_user_id);

  select * into v_wallet
  from public.wallets
  where id = v_wallet.id
  for update;

  v_available_balance := round(v_wallet.balance - v_wallet.locked_balance, 2);

  if v_available_balance < p_amount_requested then
    raise exception 'INSUFFICIENT_AVAILABLE_BALANCE';
  end if;

  update public.wallets
  set
    locked_balance = locked_balance + round(p_amount_requested::numeric, 2),
    updated_at = now()
  where id = v_wallet.id;

  insert into public.withdrawals (
    user_id,
    bank_name,
    bank_normalized,
    account_type,
    account_number,
    account_holder_name,
    account_holder_id,
    amount_requested,
    fee_applied,
    amount_net,
    locked_amount,
    status,
    metadata
  )
  values (
    v_user_id,
    trim(p_bank_name),
    v_quote.bank_normalized,
    p_account_type,
    trim(p_account_number),
    trim(p_account_holder_name),
    trim(p_account_holder_id),
    round(p_amount_requested::numeric, 2),
    v_quote.fee_applied,
    v_quote.amount_net,
    round(p_amount_requested::numeric, 2),
    'pending',
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_withdrawal;

  insert into public.withdrawal_events (
    withdrawal_id,
    actor_user_id,
    event_type,
    previous_status,
    current_status,
    notes,
    payload
  )
  values (
    v_withdrawal.id,
    v_user_id,
    'created',
    null,
    'pending',
    'Solicitud de retiro creada.',
    jsonb_build_object(
      'amount_requested', v_withdrawal.amount_requested,
      'fee_applied', v_withdrawal.fee_applied,
      'amount_net', v_withdrawal.amount_net
    )
  );

  return v_withdrawal;
end;
$$;

create or replace function public.review_withdrawal_request(
  p_withdrawal_id uuid,
  p_decision public.withdrawal_status,
  p_observation text default null,
  p_rejection_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
  v_withdrawal public.withdrawals;
  v_wallet public.wallets;
begin
  if p_withdrawal_id is null then
    raise exception 'WITHDRAWAL_ID_REQUIRED';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_WITHDRAWAL_DECISION';
  end if;

  if v_actor_user_id is not null then
    select exists(
      select 1
      from public.profiles p
      where p.id = v_actor_user_id
        and p.role = 'admin'
    ) into v_actor_is_admin;
  end if;

  if not v_actor_is_admin then
    v_actor_is_admin :=
      coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin';
  end if;

  if v_actor_role <> 'service_role' and not v_actor_is_admin then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  select * into v_withdrawal
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if v_withdrawal.id is null then
    raise exception 'WITHDRAWAL_NOT_FOUND';
  end if;

  if v_withdrawal.status <> 'pending' then
    return v_withdrawal;
  end if;

  if p_decision = 'rejected' then
    if p_rejection_reason is null or trim(p_rejection_reason) = '' then
      raise exception 'REJECTION_REASON_REQUIRED';
    end if;

    select * into v_wallet
    from public.wallets
    where user_id = v_withdrawal.user_id
    for update;

    if v_wallet.id is null then
      raise exception 'WALLET_NOT_FOUND';
    end if;

    if v_wallet.locked_balance < v_withdrawal.locked_amount then
      raise exception 'LOCKED_BALANCE_MISMATCH';
    end if;

    update public.wallets
    set
      locked_balance = locked_balance - v_withdrawal.locked_amount,
      updated_at = now()
    where id = v_wallet.id;

    update public.withdrawals
    set
      status = 'rejected',
      admin_observation = nullif(trim(p_observation), ''),
      rejection_reason = trim(p_rejection_reason),
      reviewed_by = v_actor_user_id,
      rejected_at = now(),
      metadata = metadata || coalesce(p_payload, '{}'::jsonb),
      updated_at = now()
    where id = v_withdrawal.id
    returning * into v_withdrawal;

    insert into public.withdrawal_events (
      withdrawal_id,
      actor_user_id,
      event_type,
      previous_status,
      current_status,
      notes,
      payload
    )
    values (
      v_withdrawal.id,
      v_actor_user_id,
      'rejected',
      'pending',
      'rejected',
      v_withdrawal.rejection_reason,
      coalesce(p_payload, '{}'::jsonb)
    );

    return v_withdrawal;
  end if;

  update public.withdrawals
  set
    status = 'approved',
    admin_observation = nullif(trim(p_observation), ''),
    rejection_reason = null,
    reviewed_by = v_actor_user_id,
    approved_at = now(),
    metadata = metadata || coalesce(p_payload, '{}'::jsonb),
    updated_at = now()
  where id = v_withdrawal.id
  returning * into v_withdrawal;

  insert into public.withdrawal_events (
    withdrawal_id,
    actor_user_id,
    event_type,
    previous_status,
    current_status,
    notes,
    payload
  )
  values (
    v_withdrawal.id,
    v_actor_user_id,
    'approved',
    'pending',
    'approved',
    coalesce(nullif(trim(p_observation), ''), 'Retiro aprobado.'),
    coalesce(p_payload, '{}'::jsonb)
  );

  return v_withdrawal;
end;
$$;

create or replace function public.mark_withdrawal_paid(
  p_withdrawal_id uuid,
  p_observation text default null,
  p_external_reference text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
  v_withdrawal public.withdrawals;
  v_wallet public.wallets;
  v_existing_tx public.wallet_transactions;
  v_before_balance numeric(12,2);
  v_after_balance numeric(12,2);
  v_operation_ref text;
begin
  if p_withdrawal_id is null then
    raise exception 'WITHDRAWAL_ID_REQUIRED';
  end if;

  if v_actor_user_id is not null then
    select exists(
      select 1
      from public.profiles p
      where p.id = v_actor_user_id
        and p.role = 'admin'
    ) into v_actor_is_admin;
  end if;

  if not v_actor_is_admin then
    v_actor_is_admin :=
      coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin';
  end if;

  if v_actor_role <> 'service_role' and not v_actor_is_admin then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  select * into v_withdrawal
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if v_withdrawal.id is null then
    raise exception 'WITHDRAWAL_NOT_FOUND';
  end if;

  if v_withdrawal.status = 'paid' then
    return v_withdrawal;
  end if;

  if v_withdrawal.status <> 'approved' then
    raise exception 'WITHDRAWAL_NOT_APPROVED';
  end if;

  select * into v_wallet
  from public.wallets
  where user_id = v_withdrawal.user_id
  for update;

  if v_wallet.id is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if v_wallet.locked_balance < v_withdrawal.locked_amount then
    raise exception 'LOCKED_BALANCE_MISMATCH';
  end if;

  if v_wallet.balance < v_withdrawal.locked_amount then
    raise exception 'INSUFFICIENT_BALANCE_FOR_PAYOUT';
  end if;

  v_operation_ref := 'withdrawal:' || v_withdrawal.id::text;

  select * into v_existing_tx
  from public.wallet_transactions
  where wallet_id = v_wallet.id
    and operation_ref = v_operation_ref
  limit 1;

  if v_existing_tx.id is null then
    v_before_balance := v_wallet.balance;
    v_after_balance := round(v_before_balance - v_withdrawal.locked_amount, 2);

    update public.wallets
    set
      balance = v_after_balance,
      locked_balance = locked_balance - v_withdrawal.locked_amount,
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
      v_withdrawal.user_id,
      'withdrawal',
      'debit',
      v_withdrawal.locked_amount,
      v_before_balance,
      v_after_balance,
      v_operation_ref,
      'withdrawal_payout',
      jsonb_build_object(
        'withdrawal_id', v_withdrawal.id,
        'fee_applied', v_withdrawal.fee_applied,
        'amount_net', v_withdrawal.amount_net,
        'bank_name', v_withdrawal.bank_name
      ) || coalesce(p_payload, '{}'::jsonb),
      v_actor_user_id
    )
    returning * into v_existing_tx;
  end if;

  update public.withdrawals
  set
    status = 'paid',
    admin_observation = nullif(trim(p_observation), ''),
    paid_at = now(),
    wallet_transaction_id = v_existing_tx.id,
    external_reference = nullif(trim(p_external_reference), ''),
    metadata = metadata || coalesce(p_payload, '{}'::jsonb),
    updated_at = now()
  where id = v_withdrawal.id
  returning * into v_withdrawal;

  insert into public.withdrawal_events (
    withdrawal_id,
    actor_user_id,
    event_type,
    previous_status,
    current_status,
    notes,
    payload
  )
  values (
    v_withdrawal.id,
    v_actor_user_id,
    'paid',
    'approved',
    'paid',
    coalesce(nullif(trim(p_observation), ''), 'Retiro marcado como pagado.'),
    jsonb_build_object(
      'wallet_transaction_id', v_existing_tx.id,
      'external_reference', nullif(trim(p_external_reference), '')
    ) || coalesce(p_payload, '{}'::jsonb)
  );

  return v_withdrawal;
end;
$$;

grant execute on function public.resolve_withdrawal_fee(text) to authenticated, service_role;
grant execute on function public.get_withdrawal_fee_quote(text, numeric)
  to authenticated, service_role;
grant execute on function public.create_withdrawal_request(
  text,
  public.bank_account_type,
  text,
  text,
  text,
  numeric,
  jsonb
) to authenticated, service_role;
grant execute on function public.review_withdrawal_request(
  uuid,
  public.withdrawal_status,
  text,
  text,
  jsonb
) to authenticated, service_role;
grant execute on function public.mark_withdrawal_paid(
  uuid,
  text,
  text,
  jsonb
) to authenticated, service_role;

commit;
