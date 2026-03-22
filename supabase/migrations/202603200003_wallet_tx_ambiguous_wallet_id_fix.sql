begin;

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
