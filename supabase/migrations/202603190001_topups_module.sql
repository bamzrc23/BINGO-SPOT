begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'topup_status') then
    create type public.topup_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'topup_provider') then
    create type public.topup_provider as enum ('payphone', 'bank_transfer');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'topup_event_type') then
    create type public.topup_event_type as enum (
      'created',
      'provider_update',
      'approved',
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

create table if not exists public.topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider public.topup_provider not null,
  status public.topup_status not null default 'pending',
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD' check (upper(currency) = 'USD'),
  provider_reference text null,
  client_reference text null,
  receipt_path text null,
  rejection_reason text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  wallet_transaction_id uuid null references public.wallet_transactions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topups_approved_requires_wallet_tx
    check ((status <> 'approved') or (wallet_transaction_id is not null)),
  constraint topups_rejected_requires_reason
    check (
      (status <> 'rejected' and rejection_reason is null) or
      (status = 'rejected' and coalesce(length(trim(rejection_reason)), 0) > 0)
    )
);

drop trigger if exists set_topups_updated_at on public.topups;
create trigger set_topups_updated_at
before update on public.topups
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.topup_events (
  id uuid primary key default gen_random_uuid(),
  topup_id uuid not null references public.topups(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type public.topup_event_type not null,
  previous_status public.topup_status null,
  current_status public.topup_status not null,
  notes text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists topups_user_created_at_idx
  on public.topups (user_id, created_at desc);
create index if not exists topups_status_provider_created_at_idx
  on public.topups (status, provider, created_at desc);
create index if not exists topups_created_at_idx
  on public.topups (created_at desc);
create unique index if not exists topups_provider_reference_uidx
  on public.topups (provider, provider_reference)
  where provider_reference is not null;
create unique index if not exists topups_wallet_transaction_uidx
  on public.topups (wallet_transaction_id)
  where wallet_transaction_id is not null;

create index if not exists topup_events_topup_created_at_idx
  on public.topup_events (topup_id, created_at desc);

alter table public.topups enable row level security;
alter table public.topup_events enable row level security;

drop policy if exists "topups_select_own" on public.topups;
create policy "topups_select_own"
on public.topups
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "topups_select_admin" on public.topups;
create policy "topups_select_admin"
on public.topups
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

drop policy if exists "topup_events_select_own" on public.topup_events;
create policy "topup_events_select_own"
on public.topup_events
for select
to authenticated
using (
  exists (
    select 1
    from public.topups t
    where t.id = topup_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "topup_events_select_admin" on public.topup_events;
create policy "topup_events_select_admin"
on public.topup_events
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'topup-receipts',
  'topup-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "topup_receipts_insert_own" on storage.objects;
create policy "topup_receipts_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'topup-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "topup_receipts_select_own" on storage.objects;
create policy "topup_receipts_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'topup-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "topup_receipts_select_admin" on storage.objects;
create policy "topup_receipts_select_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'topup-receipts'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "topup_receipts_delete_own" on storage.objects;
create policy "topup_receipts_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'topup-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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
  v_actor_is_admin boolean := false;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
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
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
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

  if v_actor_role <> 'service_role' then
    if v_actor_user_id is null then
      raise exception 'UNAUTHORIZED';
    end if;

    if p_user_id <> v_actor_user_id and not v_actor_is_admin then
      raise exception 'FORBIDDEN_WALLET_TARGET';
    end if;

    if p_movement_type in ('topup', 'prize') and not v_actor_is_admin then
      raise exception 'CREDIT_MOVEMENT_NOT_ALLOWED';
    end if;

    if p_movement_type = 'admin_adjustment' and not v_actor_is_admin then
      raise exception 'ADMIN_ROLE_REQUIRED';
    end if;
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
    coalesce(p_created_by, v_actor_user_id)
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

create or replace function public.create_topup_payphone_intent(
  p_amount numeric,
  p_client_reference text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.topups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_topup public.topups;
begin
  if v_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE';
  end if;

  insert into public.topups (
    user_id,
    provider,
    status,
    amount,
    currency,
    client_reference,
    metadata
  )
  values (
    v_actor_user_id,
    'payphone',
    'pending',
    round(p_amount::numeric, 2),
    'USD',
    nullif(trim(p_client_reference), ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into v_topup;

  insert into public.topup_events (
    topup_id,
    actor_user_id,
    event_type,
    previous_status,
    current_status,
    notes,
    payload
  )
  values (
    v_topup.id,
    v_actor_user_id,
    'created',
    null,
    v_topup.status,
    'Intento de recarga PayPhone creado.',
    jsonb_build_object('provider', 'payphone')
  );

  return v_topup;
end;
$$;

create or replace function public.create_topup_bank_transfer(
  p_amount numeric,
  p_client_reference text default null,
  p_receipt_path text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.topups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_topup public.topups;
begin
  if v_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE';
  end if;

  if p_receipt_path is null or trim(p_receipt_path) = '' then
    raise exception 'RECEIPT_REQUIRED';
  end if;

  insert into public.topups (
    user_id,
    provider,
    status,
    amount,
    currency,
    client_reference,
    receipt_path,
    metadata
  )
  values (
    v_actor_user_id,
    'bank_transfer',
    'pending',
    round(p_amount::numeric, 2),
    'USD',
    nullif(trim(p_client_reference), ''),
    trim(p_receipt_path),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into v_topup;

  insert into public.topup_events (
    topup_id,
    actor_user_id,
    event_type,
    previous_status,
    current_status,
    notes,
    payload
  )
  values (
    v_topup.id,
    v_actor_user_id,
    'created',
    null,
    v_topup.status,
    'Solicitud de recarga por transferencia registrada.',
    jsonb_build_object('provider', 'bank_transfer')
  );

  return v_topup;
end;
$$;

create or replace function public.review_topup_bank_transfer(
  p_topup_id uuid,
  p_decision public.topup_status,
  p_rejection_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.topups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
  v_topup public.topups;
  v_wallet_tx record;
begin
  if p_topup_id is null then
    raise exception 'TOPUP_ID_REQUIRED';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_TOPUP_DECISION';
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

  select * into v_topup
  from public.topups
  where id = p_topup_id
  for update;

  if v_topup.id is null then
    raise exception 'TOPUP_NOT_FOUND';
  end if;

  if v_topup.provider <> 'bank_transfer' then
    raise exception 'INVALID_TOPUP_PROVIDER';
  end if;

  if v_topup.status <> 'pending' then
    return v_topup;
  end if;

  if p_decision = 'rejected' then
    if p_rejection_reason is null or trim(p_rejection_reason) = '' then
      raise exception 'REJECTION_REASON_REQUIRED';
    end if;

    update public.topups
    set
      status = 'rejected',
      rejection_reason = trim(p_rejection_reason),
      reviewed_by = v_actor_user_id,
      reviewed_at = now(),
      metadata = metadata || coalesce(p_payload, '{}'::jsonb),
      updated_at = now()
    where id = v_topup.id
    returning * into v_topup;

    insert into public.topup_events (
      topup_id,
      actor_user_id,
      event_type,
      previous_status,
      current_status,
      notes,
      payload
    )
    values (
      v_topup.id,
      v_actor_user_id,
      'rejected',
      'pending',
      'rejected',
      trim(p_rejection_reason),
      coalesce(p_payload, '{}'::jsonb)
    );

    return v_topup;
  end if;

  select * into v_wallet_tx
  from public.apply_wallet_transaction(
    v_topup.user_id,
    'topup',
    'credit',
    v_topup.amount,
    'topup:' || v_topup.id::text,
    'topup_bank_transfer',
    jsonb_build_object(
      'topup_id', v_topup.id,
      'provider', v_topup.provider,
      'source', 'admin_review'
    ) || coalesce(p_payload, '{}'::jsonb),
    v_actor_user_id
  )
  limit 1;

  update public.topups
  set
    status = 'approved',
    rejection_reason = null,
    reviewed_by = v_actor_user_id,
    reviewed_at = now(),
    wallet_transaction_id = v_wallet_tx.transaction_id,
    metadata = metadata || coalesce(p_payload, '{}'::jsonb),
    updated_at = now()
  where id = v_topup.id
  returning * into v_topup;

  insert into public.topup_events (
    topup_id,
    actor_user_id,
    event_type,
    previous_status,
    current_status,
    notes,
    payload
  )
  values (
    v_topup.id,
    v_actor_user_id,
    'approved',
    'pending',
    'approved',
    'Recarga aprobada manualmente por administracion.',
    jsonb_build_object(
      'wallet_transaction_id', v_wallet_tx.transaction_id,
      'was_already_processed', coalesce(v_wallet_tx.was_already_processed, false)
    ) || coalesce(p_payload, '{}'::jsonb)
  );

  return v_topup;
end;
$$;

create or replace function public.apply_topup_payphone_result(
  p_topup_id uuid,
  p_provider_reference text default null,
  p_approved boolean default false,
  p_rejection_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.topups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
  v_topup public.topups;
  v_wallet_tx record;
  v_provider_reference text := nullif(trim(p_provider_reference), '');
begin
  if p_topup_id is null then
    raise exception 'TOPUP_ID_REQUIRED';
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

  select * into v_topup
  from public.topups
  where id = p_topup_id
  for update;

  if v_topup.id is null then
    raise exception 'TOPUP_NOT_FOUND';
  end if;

  if v_topup.provider <> 'payphone' then
    raise exception 'INVALID_TOPUP_PROVIDER';
  end if;

  if v_topup.status <> 'pending' then
    return v_topup;
  end if;

  if not p_approved then
    update public.topups
    set
      status = 'rejected',
      rejection_reason = coalesce(nullif(trim(p_rejection_reason), ''), 'Pago rechazado por proveedor.'),
      provider_reference = coalesce(v_provider_reference, provider_reference),
      reviewed_by = v_actor_user_id,
      reviewed_at = now(),
      metadata = metadata || coalesce(p_payload, '{}'::jsonb),
      updated_at = now()
    where id = v_topup.id
    returning * into v_topup;

    insert into public.topup_events (
      topup_id,
      actor_user_id,
      event_type,
      previous_status,
      current_status,
      notes,
      payload
    )
    values (
      v_topup.id,
      v_actor_user_id,
      'rejected',
      'pending',
      'rejected',
      v_topup.rejection_reason,
      jsonb_build_object(
        'provider_reference', v_provider_reference
      ) || coalesce(p_payload, '{}'::jsonb)
    );

    return v_topup;
  end if;

  select * into v_wallet_tx
  from public.apply_wallet_transaction(
    v_topup.user_id,
    'topup',
    'credit',
    v_topup.amount,
    'topup:' || v_topup.id::text,
    'topup_payphone',
    jsonb_build_object(
      'topup_id', v_topup.id,
      'provider', v_topup.provider,
      'provider_reference', v_provider_reference
    ) || coalesce(p_payload, '{}'::jsonb),
    v_actor_user_id
  )
  limit 1;

  update public.topups
  set
    status = 'approved',
    rejection_reason = null,
    provider_reference = coalesce(v_provider_reference, provider_reference),
    reviewed_by = v_actor_user_id,
    reviewed_at = now(),
    wallet_transaction_id = v_wallet_tx.transaction_id,
    metadata = metadata || coalesce(p_payload, '{}'::jsonb),
    updated_at = now()
  where id = v_topup.id
  returning * into v_topup;

  insert into public.topup_events (
    topup_id,
    actor_user_id,
    event_type,
    previous_status,
    current_status,
    notes,
    payload
  )
  values (
    v_topup.id,
    v_actor_user_id,
    'approved',
    'pending',
    'approved',
    'Recarga PayPhone aprobada.',
    jsonb_build_object(
      'wallet_transaction_id', v_wallet_tx.transaction_id,
      'provider_reference', v_provider_reference,
      'was_already_processed', coalesce(v_wallet_tx.was_already_processed, false)
    ) || coalesce(p_payload, '{}'::jsonb)
  );

  return v_topup;
end;
$$;

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

grant execute on function public.create_topup_payphone_intent(numeric, text, jsonb)
  to authenticated, service_role;
grant execute on function public.create_topup_bank_transfer(numeric, text, text, jsonb)
  to authenticated, service_role;
grant execute on function public.review_topup_bank_transfer(
  uuid,
  public.topup_status,
  text,
  jsonb
) to authenticated, service_role;
grant execute on function public.apply_topup_payphone_result(
  uuid,
  text,
  boolean,
  text,
  jsonb
) to authenticated, service_role;

commit;
