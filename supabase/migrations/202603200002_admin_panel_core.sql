begin;

create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null check (char_length(trim(action)) > 0),
  entity_type text not null check (char_length(trim(entity_type)) > 0),
  entity_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table if not exists public.game_settings (
  key text primary key,
  value jsonb not null,
  description text null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_game_settings_updated_at on public.game_settings;
create trigger set_game_settings_updated_at
before update on public.game_settings
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.audit_logs enable row level security;
alter table public.game_settings enable row level security;

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
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

drop policy if exists "game_settings_select_authenticated" on public.game_settings;
create policy "game_settings_select_authenticated"
on public.game_settings
for select
to authenticated
using (true);

drop policy if exists "game_settings_admin_manage" on public.game_settings;
create policy "game_settings_admin_manage"
on public.game_settings
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

create or replace function public.is_admin_actor(p_actor_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_role text := coalesce(auth.role(), 'anon');
begin
  if v_actor_role = 'service_role' then
    return true;
  end if;

  if p_actor_user_id is not null and exists (
    select 1
    from public.profiles p
    where p.id = p_actor_user_id
      and p.role = 'admin'
  ) then
    return true;
  end if;

  return coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin';
end;
$$;

create or replace function public.record_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_payload jsonb default '{}'::jsonb,
  p_actor_user_id uuid default auth.uid()
)
returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.audit_logs;
begin
  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  )
  values (
    p_actor_user_id,
    nullif(trim(coalesce(p_action, '')), ''),
    nullif(trim(coalesce(p_entity_type, '')), ''),
    nullif(trim(coalesce(p_entity_id, '')), ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_set_user_account_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  if p_status is null then
    raise exception 'ACCOUNT_STATUS_REQUIRED';
  end if;

  if not public.is_admin_actor(v_actor_user_id) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  update public.profiles
  set account_status = p_status
  where id = p_user_id
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  perform public.record_audit_log(
    'admin.user_status_changed',
    'profile',
    p_user_id::text,
    jsonb_build_object(
      'new_status', p_status,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    ),
    v_actor_user_id
  );

  return v_profile;
end;
$$;

create or replace function public.admin_list_users_with_wallets(
  p_search text default null,
  p_role public.app_role default null,
  p_status public.account_status default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  nickname text,
  email text,
  phone text,
  role public.app_role,
  account_status public.account_status,
  created_at timestamptz,
  wallet_balance numeric,
  wallet_locked_balance numeric,
  wallet_updated_at timestamptz,
  wallet_tx_count bigint,
  last_wallet_tx_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_admin_actor(v_actor_user_id) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.email,
    p.phone,
    p.role,
    p.account_status,
    p.created_at,
    coalesce(w.balance, 0)::numeric as wallet_balance,
    coalesce(w.locked_balance, 0)::numeric as wallet_locked_balance,
    w.updated_at as wallet_updated_at,
    coalesce(tx_agg.tx_count, 0)::bigint as wallet_tx_count,
    tx_agg.last_tx_at as last_wallet_tx_at
  from public.profiles p
  left join public.wallets w on w.user_id = p.id
  left join lateral (
    select
      count(*)::bigint as tx_count,
      max(t.created_at) as last_tx_at
    from public.wallet_transactions t
    where t.user_id = p.id
  ) tx_agg on true
  where
    (p_role is null or p.role = p_role)
    and (p_status is null or p.account_status = p_status)
    and (
      v_search is null
      or p.first_name ilike '%' || v_search || '%'
      or p.last_name ilike '%' || v_search || '%'
      or p.nickname ilike '%' || v_search || '%'
      or p.email ilike '%' || v_search || '%'
      or coalesce(p.phone, '') ilike '%' || v_search || '%'
    )
  order by p.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.admin_list_wallet_transactions(
  p_user_id uuid,
  p_limit integer default 40
)
returns table (
  id uuid,
  wallet_id uuid,
  user_id uuid,
  movement_type public.wallet_movement_type,
  direction public.wallet_direction,
  amount numeric,
  balance_before numeric,
  balance_after numeric,
  operation_ref text,
  operation_source text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 200);
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  if not public.is_admin_actor(v_actor_user_id) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  return query
  select
    t.id,
    t.wallet_id,
    t.user_id,
    t.movement_type,
    t.direction,
    t.amount::numeric,
    t.balance_before::numeric,
    t.balance_after::numeric,
    t.operation_ref,
    t.operation_source,
    t.metadata,
    t.created_by,
    t.created_at
  from public.wallet_transactions t
  where t.user_id = p_user_id
  order by t.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.admin_get_dashboard_metrics()
returns table (
  users_total bigint,
  users_active bigint,
  users_suspended bigint,
  topups_pending bigint,
  withdrawals_pending bigint,
  active_round_id uuid,
  boards_sold_total bigint,
  prizes_paid_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
begin
  if not public.is_admin_actor(v_actor_user_id) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  return query
  select
    (select count(*) from public.profiles) as users_total,
    (select count(*) from public.profiles where account_status = 'active') as users_active,
    (select count(*) from public.profiles where account_status = 'suspended') as users_suspended,
    (select count(*) from public.topups where status = 'pending') as topups_pending,
    (select count(*) from public.withdrawals where status = 'pending') as withdrawals_pending,
    (
      select gr.id
      from public.game_rounds gr
      where gr.status = 'active'
      order by gr.activated_at desc nulls last, gr.created_at desc
      limit 1
    ) as active_round_id,
    (
      select coalesce(sum(bp.quantity), 0)::bigint
      from public.board_purchases bp
      where bp.status = 'completed'
    ) as boards_sold_total,
    (
      select coalesce(sum(lw.prize_amount), 0)::numeric
      from public.game_round_line_wins lw
      where lw.wallet_transaction_id is not null
    ) as prizes_paid_total;
end;
$$;

create or replace function public.admin_upsert_game_setting(
  p_key text,
  p_value jsonb,
  p_description text default null
)
returns public.game_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_key text := nullif(trim(coalesce(p_key, '')), '');
  v_row public.game_settings;
begin
  if v_key is null then
    raise exception 'SETTING_KEY_REQUIRED';
  end if;

  if p_value is null then
    raise exception 'SETTING_VALUE_REQUIRED';
  end if;

  if not public.is_admin_actor(v_actor_user_id) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  insert into public.game_settings (
    key,
    value,
    description,
    updated_by
  )
  values (
    v_key,
    p_value,
    nullif(trim(coalesce(p_description, '')), ''),
    v_actor_user_id
  )
  on conflict (key)
  do update
  set
    value = excluded.value,
    description = excluded.description,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into v_row;

  perform public.record_audit_log(
    'admin.game_setting_updated',
    'game_setting',
    v_key,
    jsonb_build_object(
      'value', p_value,
      'description', nullif(trim(coalesce(p_description, '')), '')
    ),
    v_actor_user_id
  );

  return v_row;
end;
$$;

create or replace function public.admin_list_audit_logs(
  p_action text default null,
  p_entity_type text default null,
  p_limit integer default 120,
  p_offset integer default 0
)
returns table (
  id uuid,
  actor_user_id uuid,
  actor_nickname text,
  action text,
  entity_type text,
  entity_id text,
  payload jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 300);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_action text := nullif(trim(coalesce(p_action, '')), '');
  v_entity_type text := nullif(trim(coalesce(p_entity_type, '')), '');
begin
  if not public.is_admin_actor(v_actor_user_id) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  return query
  select
    a.id,
    a.actor_user_id,
    p.nickname as actor_nickname,
    a.action,
    a.entity_type,
    a.entity_id,
    a.payload,
    a.created_at
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_user_id
  where
    (v_action is null or a.action ilike '%' || v_action || '%')
    and (v_entity_type is null or a.entity_type ilike '%' || v_entity_type || '%')
  order by a.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.audit_topup_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_audit_log(
    'topup.' || new.event_type::text,
    'topup',
    new.topup_id::text,
    jsonb_build_object(
      'event_type', new.event_type,
      'previous_status', new.previous_status,
      'current_status', new.current_status,
      'notes', new.notes,
      'payload', new.payload
    ),
    new.actor_user_id
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.topup_events') is not null then
    execute 'drop trigger if exists audit_topup_events_insert on public.topup_events';
    execute '
      create trigger audit_topup_events_insert
      after insert on public.topup_events
      for each row
      execute function public.audit_topup_event_insert()
    ';
  end if;
end
$$;

create or replace function public.audit_withdrawal_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_audit_log(
    'withdrawal.' || new.event_type::text,
    'withdrawal',
    new.withdrawal_id::text,
    jsonb_build_object(
      'event_type', new.event_type,
      'previous_status', new.previous_status,
      'current_status', new.current_status,
      'notes', new.notes,
      'payload', new.payload
    ),
    new.actor_user_id
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.withdrawal_events') is not null then
    execute 'drop trigger if exists audit_withdrawal_events_insert on public.withdrawal_events';
    execute '
      create trigger audit_withdrawal_events_insert
      after insert on public.withdrawal_events
      for each row
      execute function public.audit_withdrawal_event_insert()
    ';
  end if;
end
$$;

create or replace function public.audit_game_prize_run_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_audit_log(
    'game.prize_run',
    'game_round',
    new.game_round_id::text,
    jsonb_build_object(
      'base_prize', new.base_prize,
      'lines_paid', new.lines_paid,
      'total_paid', new.total_paid,
      'metadata', new.metadata
    ),
    new.executed_by
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.game_round_prize_runs') is not null then
    execute 'drop trigger if exists audit_game_prize_runs_insert on public.game_round_prize_runs';
    execute '
      create trigger audit_game_prize_runs_insert
      after insert on public.game_round_prize_runs
      for each row
      execute function public.audit_game_prize_run_insert()
    ';
  end if;
end
$$;

grant execute on function public.is_admin_actor(uuid) to authenticated, service_role;
grant execute on function public.record_audit_log(text, text, text, jsonb, uuid)
  to authenticated, service_role;
grant execute on function public.admin_set_user_account_status(uuid, public.account_status, text)
  to authenticated, service_role;
grant execute on function public.admin_list_users_with_wallets(
  text,
  public.app_role,
  public.account_status,
  integer,
  integer
)
  to authenticated, service_role;
grant execute on function public.admin_list_wallet_transactions(uuid, integer)
  to authenticated, service_role;
grant execute on function public.admin_get_dashboard_metrics()
  to authenticated, service_role;
grant execute on function public.admin_upsert_game_setting(text, jsonb, text)
  to authenticated, service_role;
grant execute on function public.admin_list_audit_logs(text, text, integer, integer)
  to authenticated, service_role;

commit;
