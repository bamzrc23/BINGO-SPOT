begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'game_round_status') then
    create type public.game_round_status as enum ('scheduled', 'active', 'finished');
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

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  status public.game_round_status not null default 'scheduled',
  scheduled_at timestamptz not null default now(),
  activated_at timestamptz null,
  finished_at timestamptz null,
  base_draw_count integer not null default 9 check (base_draw_count = 9),
  extra_draw_count integer not null default 0 check (extra_draw_count between 0 and 3),
  total_draw_count integer not null default 9 check (total_draw_count = base_draw_count + extra_draw_count),
  lucky_ball_probability numeric(5,4) not null default 0.1200 check (lucky_ball_probability >= 0 and lucky_ball_probability <= 1),
  lucky_ball_triggered boolean not null default false,
  lucky_ball_trigger_order integer null check (lucky_ball_trigger_order is null or lucky_ball_trigger_order between 1 and 9),
  lucky_ball_extra_spins integer not null default 0 check (lucky_ball_extra_spins between 0 and 3),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_rounds_lucky_ball_consistency check (
    (lucky_ball_triggered = false and lucky_ball_extra_spins = 0 and lucky_ball_trigger_order is null) or
    (lucky_ball_triggered = true and lucky_ball_extra_spins between 1 and 3 and lucky_ball_trigger_order between 1 and 9)
  )
);

drop trigger if exists set_game_rounds_updated_at on public.game_rounds;
create trigger set_game_rounds_updated_at
before update on public.game_rounds
for each row
execute function public.set_current_timestamp_updated_at();

create unique index if not exists game_rounds_single_active_uidx
  on public.game_rounds ((status))
  where status = 'active';

create table if not exists public.game_round_multipliers (
  id uuid primary key default gen_random_uuid(),
  game_round_id uuid not null references public.game_rounds(id) on delete cascade,
  number_value smallint not null check (number_value between 1 and 30),
  multiplier smallint not null check (multiplier in (2, 3, 5)),
  created_at timestamptz not null default now(),
  unique (game_round_id, number_value)
);

create table if not exists public.game_round_draws (
  id uuid primary key default gen_random_uuid(),
  game_round_id uuid not null references public.game_rounds(id) on delete cascade,
  draw_order integer not null check (draw_order > 0),
  number_value smallint not null check (number_value between 1 and 30),
  is_extra_spin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_round_id, draw_order),
  unique (game_round_id, number_value)
);

create table if not exists public.game_round_lucky_ball_events (
  id uuid primary key default gen_random_uuid(),
  game_round_id uuid not null unique references public.game_rounds(id) on delete cascade,
  trigger_order integer not null check (trigger_order between 1 and 9),
  extra_spins integer not null check (extra_spins between 1 and 3),
  random_value numeric(8,6) not null check (random_value >= 0 and random_value <= 1),
  created_at timestamptz not null default now()
);

create index if not exists game_rounds_status_created_at_idx
  on public.game_rounds (status, created_at desc);
create index if not exists game_round_draws_round_order_idx
  on public.game_round_draws (game_round_id, draw_order);
create index if not exists game_round_multipliers_round_idx
  on public.game_round_multipliers (game_round_id, multiplier desc);

alter table public.game_rounds enable row level security;
alter table public.game_round_multipliers enable row level security;
alter table public.game_round_draws enable row level security;
alter table public.game_round_lucky_ball_events enable row level security;

drop policy if exists "game_rounds_select_authenticated" on public.game_rounds;
create policy "game_rounds_select_authenticated"
on public.game_rounds
for select
to authenticated
using (true);

drop policy if exists "game_round_multipliers_select_authenticated" on public.game_round_multipliers;
create policy "game_round_multipliers_select_authenticated"
on public.game_round_multipliers
for select
to authenticated
using (true);

drop policy if exists "game_round_draws_select_authenticated" on public.game_round_draws;
create policy "game_round_draws_select_authenticated"
on public.game_round_draws
for select
to authenticated
using (true);

drop policy if exists "game_round_lucky_ball_select_authenticated" on public.game_round_lucky_ball_events;
create policy "game_round_lucky_ball_select_authenticated"
on public.game_round_lucky_ball_events
for select
to authenticated
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'board_purchases_game_id_fkey'
      and conrelid = 'public.board_purchases'::regclass
  ) then
    alter table public.board_purchases
      add constraint board_purchases_game_id_fkey
      foreign key (game_id) references public.game_rounds(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bingo_boards_game_id_fkey'
      and conrelid = 'public.bingo_boards'::regclass
  ) then
    alter table public.bingo_boards
      add constraint bingo_boards_game_id_fkey
      foreign key (game_id) references public.game_rounds(id) on delete set null;
  end if;
end
$$;

create or replace function public.create_game_round(
  p_scheduled_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns public.game_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
  v_round public.game_rounds;
begin
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

  insert into public.game_rounds (
    status,
    scheduled_at,
    metadata,
    created_by
  )
  values (
    'scheduled',
    coalesce(p_scheduled_at, now()),
    coalesce(p_metadata, '{}'::jsonb),
    v_actor_user_id
  )
  returning * into v_round;

  return v_round;
end;
$$;

create or replace function public.activate_game_round(
  p_game_round_id uuid,
  p_lucky_ball_probability numeric default 0.1200,
  p_extra_spins_p1 numeric default 0.7000,
  p_extra_spins_p2 numeric default 0.2200,
  p_extra_spins_p3 numeric default 0.0800,
  p_metadata jsonb default '{}'::jsonb
)
returns public.game_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
  v_round public.game_rounds;
  v_multipliers integer[] := array[2, 2, 2, 3, 5];
  v_multiplier_numbers integer[];
  v_draw_numbers integer[];
  v_is_lucky_triggered boolean := false;
  v_lucky_extra_spins integer := 0;
  v_lucky_trigger_order integer := null;
  v_random_lucky numeric;
  v_random_extra numeric;
  v_total_draws integer;
  v_multiplier_boost_probability numeric := 0.8000;
  v_multiplier_boost_min_hits integer := 2;
  v_multiplier_boost_max_hits integer := 4;
  v_boost_enabled boolean := false;
  v_boost_hits integer := 0;
  v_boosted_multiplier_numbers integer[] := '{}'::integer[];
  v_boosted_non_multiplier_numbers integer[] := '{}'::integer[];
  v_i integer;
begin
  if p_game_round_id is null then
    raise exception 'GAME_ROUND_ID_REQUIRED';
  end if;

  if p_lucky_ball_probability < 0 or p_lucky_ball_probability > 1 then
    raise exception 'INVALID_LUCKY_BALL_PROBABILITY';
  end if;

  if p_extra_spins_p1 <= 0 or p_extra_spins_p2 <= 0 or p_extra_spins_p3 <= 0 then
    raise exception 'INVALID_EXTRA_SPIN_PROBABILITIES';
  end if;

  if p_extra_spins_p3 >= p_extra_spins_p2 or p_extra_spins_p3 >= p_extra_spins_p1 then
    raise exception 'EXTRA_SPIN_3_MUST_BE_LOWEST';
  end if;

  if v_multiplier_boost_probability < 0 or v_multiplier_boost_probability > 1 then
    raise exception 'INVALID_MULTIPLIER_BOOST_PROBABILITY';
  end if;

  if v_multiplier_boost_min_hits < 0 or v_multiplier_boost_max_hits < 0 then
    raise exception 'INVALID_MULTIPLIER_BOOST_HITS';
  end if;

  if v_multiplier_boost_max_hits < v_multiplier_boost_min_hits then
    raise exception 'INVALID_MULTIPLIER_BOOST_RANGE';
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

  if exists (select 1 from public.game_rounds gr where gr.status = 'active' and gr.id <> p_game_round_id) then
    raise exception 'ANOTHER_ACTIVE_GAME_EXISTS';
  end if;

  select * into v_round
  from public.game_rounds
  where id = p_game_round_id
  for update;

  if v_round.id is null then
    raise exception 'GAME_ROUND_NOT_FOUND';
  end if;

  if v_round.status = 'finished' then
    return v_round;
  end if;

  if v_round.status = 'active' then
    return v_round;
  end if;

  delete from public.game_round_draws where game_round_id = p_game_round_id;
  delete from public.game_round_multipliers where game_round_id = p_game_round_id;
  delete from public.game_round_lucky_ball_events where game_round_id = p_game_round_id;

  select array_agg(n order by random())
    into v_multiplier_numbers
  from (
    select n
    from generate_series(1, 30) n
    order by random()
    limit 5
  ) q;

  for v_i in 1..5 loop
    insert into public.game_round_multipliers (
      game_round_id,
      number_value,
      multiplier
    )
    values (
      p_game_round_id,
      v_multiplier_numbers[v_i],
      v_multipliers[v_i]
    );
  end loop;

  v_random_lucky := random();

  if v_random_lucky < p_lucky_ball_probability then
    v_is_lucky_triggered := true;
    v_lucky_trigger_order := floor(random() * 9 + 1)::integer;
    v_random_extra := random();

    if v_random_extra < p_extra_spins_p1 then
      v_lucky_extra_spins := 1;
    elsif v_random_extra < (p_extra_spins_p1 + p_extra_spins_p2) then
      v_lucky_extra_spins := 2;
    else
      v_lucky_extra_spins := 3;
    end if;

    insert into public.game_round_lucky_ball_events (
      game_round_id,
      trigger_order,
      extra_spins,
      random_value
    )
    values (
      p_game_round_id,
      v_lucky_trigger_order,
      v_lucky_extra_spins,
      v_random_lucky
    );
  end if;

  v_total_draws := 9 + v_lucky_extra_spins;
  v_boost_enabled := random() < v_multiplier_boost_probability;

  if v_boost_enabled then
    v_boost_hits :=
      floor(
        random() * (v_multiplier_boost_max_hits - v_multiplier_boost_min_hits + 1)
        + v_multiplier_boost_min_hits
      )::integer;
    v_boost_hits := least(greatest(v_boost_hits, 0), 5, v_total_draws);
  end if;

  if v_boost_hits > 0 then
    select coalesce(array_agg(n order by random()), '{}'::integer[])
      into v_boosted_multiplier_numbers
    from (
      select n
      from unnest(v_multiplier_numbers) n
      order by random()
      limit v_boost_hits
    ) q;

    select coalesce(array_agg(n order by random()), '{}'::integer[])
      into v_boosted_non_multiplier_numbers
    from (
      select n
      from generate_series(1, 30) n
      where n <> all(v_boosted_multiplier_numbers)
      order by random()
      limit (v_total_draws - v_boost_hits)
    ) q;

    select array_agg(n order by random())
      into v_draw_numbers
    from (
      select unnest(v_boosted_multiplier_numbers) as n
      union all
      select unnest(v_boosted_non_multiplier_numbers) as n
    ) q;
  else
    select array_agg(n order by random())
      into v_draw_numbers
    from (
      select n
      from generate_series(1, 30) n
      order by random()
      limit v_total_draws
    ) q;
  end if;

  for v_i in 1..v_total_draws loop
    insert into public.game_round_draws (
      game_round_id,
      draw_order,
      number_value,
      is_extra_spin
    )
    values (
      p_game_round_id,
      v_i,
      v_draw_numbers[v_i],
      v_i > 9
    );
  end loop;

  update public.game_rounds
  set
    status = 'active',
    activated_at = now(),
    base_draw_count = 9,
    extra_draw_count = v_lucky_extra_spins,
    total_draw_count = v_total_draws,
    lucky_ball_probability = p_lucky_ball_probability,
    lucky_ball_triggered = v_is_lucky_triggered,
    lucky_ball_trigger_order = v_lucky_trigger_order,
    lucky_ball_extra_spins = v_lucky_extra_spins,
    metadata = metadata || jsonb_build_object(
      'multiplier_boost_probability', v_multiplier_boost_probability,
      'multiplier_boost_hits', v_boost_hits,
      'multiplier_boost_enabled', v_boost_enabled
    ) || coalesce(p_metadata, '{}'::jsonb),
    updated_at = now()
  where id = p_game_round_id
  returning * into v_round;

  return v_round;
end;
$$;

create or replace function public.finalize_game_round(
  p_game_round_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns public.game_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
  v_round public.game_rounds;
begin
  if p_game_round_id is null then
    raise exception 'GAME_ROUND_ID_REQUIRED';
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

  select * into v_round
  from public.game_rounds
  where id = p_game_round_id
  for update;

  if v_round.id is null then
    raise exception 'GAME_ROUND_NOT_FOUND';
  end if;

  if v_round.status = 'finished' then
    return v_round;
  end if;

  update public.game_rounds
  set
    status = 'finished',
    finished_at = now(),
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
    updated_at = now()
  where id = p_game_round_id
  returning * into v_round;

  return v_round;
end;
$$;

create or replace function public.get_active_game_round_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select gr.id
  from public.game_rounds gr
  where gr.status = 'active'
  order by gr.activated_at desc nulls last, gr.created_at desc
  limit 1;
$$;

create or replace function public.purchase_bingo_boards(
  p_quantity integer,
  p_game_id uuid default null,
  p_request_ref text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  purchase_id uuid,
  board_id uuid,
  board_index integer,
  board_fingerprint text,
  grid jsonb,
  wallet_transaction_id uuid,
  quantity integer,
  unit_price numeric,
  total_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_quantity integer := p_quantity;
  v_purchase_id uuid := gen_random_uuid();
  v_unit_price numeric(10,2) := 0.10;
  v_total numeric(12,2);
  v_operation_ref text;
  v_wallet_tx record;
  v_board_id uuid;
  v_board_index integer;
  v_col1 integer[];
  v_col2 integer[];
  v_col3 integer[];
  v_grid jsonb;
  v_fingerprint text;
  v_attempt integer;
  v_active_round_id uuid;
  v_scheduled_round public.game_rounds;
  v_effective_game_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if v_quantity not in (1, 5, 25, 100) then
    raise exception 'INVALID_BOARD_QUANTITY';
  end if;

  v_active_round_id := public.get_active_game_round_id();
  if v_active_round_id is not null then
    raise exception 'BOARD_PURCHASE_BLOCKED_ROUND_ACTIVE';
  end if;

  select * into v_scheduled_round
  from public.game_rounds gr
  where gr.status = 'scheduled'
  order by gr.scheduled_at asc, gr.created_at asc
  limit 1
  for update;

  if v_scheduled_round.id is null then
    raise exception 'NO_SCHEDULED_GAME_ROUND_AVAILABLE';
  end if;

  if v_scheduled_round.scheduled_at <= v_now then
    raise exception 'BOARD_PURCHASE_WINDOW_CLOSED';
  end if;

  if p_game_id is not null and p_game_id <> v_scheduled_round.id then
    raise exception 'MANUAL_GAME_SELECTION_NOT_ALLOWED';
  end if;

  v_effective_game_id := v_scheduled_round.id;

  v_total := round((v_quantity::numeric * v_unit_price), 2);
  v_operation_ref := coalesce(
    nullif(trim(p_request_ref), ''),
    'board_purchase:' || v_purchase_id::text
  );

  if exists (
    select 1
    from public.board_purchases bp
    where bp.user_id = v_user_id
      and bp.operation_ref = v_operation_ref
  ) then
    return query
    select
      bp.id,
      bb.id,
      bb.board_index,
      bb.board_fingerprint,
      bb.grid,
      bp.wallet_transaction_id,
      bp.quantity,
      bp.unit_price,
      bp.total_amount
    from public.board_purchases bp
    join public.bingo_boards bb on bb.purchase_id = bp.id
    where bp.user_id = v_user_id
      and bp.operation_ref = v_operation_ref
    order by bb.board_index;
    return;
  end if;

  select * into v_wallet_tx
  from public.apply_wallet_transaction(
    v_user_id,
    'board_purchase',
    'debit',
    v_total,
    v_operation_ref,
    'board_purchase',
    jsonb_build_object(
      'purchase_id', v_purchase_id,
      'quantity', v_quantity,
      'game_id', v_effective_game_id
    ) || coalesce(p_metadata, '{}'::jsonb),
    v_user_id
  )
  limit 1;

  insert into public.board_purchases (
    id,
    user_id,
    game_id,
    quantity,
    unit_price,
    total_amount,
    status,
    wallet_transaction_id,
    operation_ref,
    metadata
  )
  values (
    v_purchase_id,
    v_user_id,
    v_effective_game_id,
    v_quantity,
    v_unit_price,
    v_total,
    'completed',
    v_wallet_tx.transaction_id,
    v_operation_ref,
    coalesce(p_metadata, '{}'::jsonb)
  );

  for v_board_index in 1..v_quantity loop
    v_attempt := 0;

    loop
      v_attempt := v_attempt + 1;

      if v_attempt > 1200 then
        raise exception 'BOARD_GENERATION_EXHAUSTED';
      end if;

      select array_agg(v order by random())
      into v_col1
      from (
        select v
        from generate_series(1, 10) v
        order by random()
        limit 3
      ) s;

      select array_agg(v order by random())
      into v_col2
      from (
        select v
        from generate_series(11, 20) v
        order by random()
        limit 3
      ) s;

      select array_agg(v order by random())
      into v_col3
      from (
        select v
        from generate_series(21, 30) v
        order by random()
        limit 3
      ) s;

      v_grid := jsonb_build_array(
        jsonb_build_array(v_col1[1], v_col2[1], v_col3[1]),
        jsonb_build_array(v_col1[2], v_col2[2], v_col3[2]),
        jsonb_build_array(v_col1[3], v_col2[3], v_col3[3])
      );

      v_fingerprint := public.bingo_grid_to_fingerprint(v_grid);

      begin
        insert into public.bingo_boards (
          purchase_id,
          user_id,
          game_id,
          board_index,
          board_fingerprint,
          grid
        )
        values (
          v_purchase_id,
          v_user_id,
          v_effective_game_id,
          v_board_index,
          v_fingerprint,
          v_grid
        )
        returning id into v_board_id;

        insert into public.bingo_board_cells (
          board_id,
          row_index,
          col_index,
          number_value
        )
        values
          (v_board_id, 0, 0, v_col1[1]),
          (v_board_id, 0, 1, v_col2[1]),
          (v_board_id, 0, 2, v_col3[1]),
          (v_board_id, 1, 0, v_col1[2]),
          (v_board_id, 1, 1, v_col2[2]),
          (v_board_id, 1, 2, v_col3[2]),
          (v_board_id, 2, 0, v_col1[3]),
          (v_board_id, 2, 1, v_col2[3]),
          (v_board_id, 2, 2, v_col3[3]);

        return query
        select
          v_purchase_id,
          v_board_id,
          v_board_index,
          v_fingerprint,
          v_grid,
          v_wallet_tx.transaction_id,
          v_quantity,
          v_unit_price,
          v_total;

        exit;
      exception
        when unique_violation then
          continue;
      end;
    end loop;
  end loop;
end;
$$;

grant execute on function public.create_game_round(timestamptz, jsonb)
  to authenticated, service_role;
grant execute on function public.activate_game_round(
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb
) to authenticated, service_role;
grant execute on function public.finalize_game_round(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.get_active_game_round_id()
  to authenticated, service_role;
grant execute on function public.purchase_bingo_boards(integer, uuid, text, jsonb)
  to authenticated, service_role;

commit;
