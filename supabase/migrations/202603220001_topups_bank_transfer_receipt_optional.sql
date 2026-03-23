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
    nullif(trim(p_receipt_path), ''),
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
