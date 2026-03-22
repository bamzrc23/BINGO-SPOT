begin;

create or replace function public.run_game_round_automation(
  p_draw_interval_seconds integer default 5,
  p_prestart_animation_seconds integer default 5,
  p_round_cooldown_seconds integer default 20,
  p_base_prize numeric default 0.20,
  p_lucky_ball_probability numeric default 0.1200,
  p_extra_spins_p1 numeric default 0.7000,
  p_extra_spins_p2 numeric default 0.2200,
  p_extra_spins_p3 numeric default 0.0800,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_has_lock boolean := false;
  v_active_round public.game_rounds;
  v_scheduled_round public.game_rounds;
  v_latest_round public.game_rounds;
  v_new_scheduled_round public.game_rounds;
  v_activated_round public.game_rounds;
  v_round_end_at timestamptz;
  v_cooldown_until timestamptz;
  v_next_scheduled_at timestamptz;
  v_lines_paid integer := 0;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_draw_interval_seconds < 1 or p_draw_interval_seconds > 30 then
    raise exception 'INVALID_DRAW_INTERVAL_SECONDS';
  end if;

  if p_prestart_animation_seconds < 0 or p_prestart_animation_seconds > 60 then
    raise exception 'INVALID_PRESTART_ANIMATION_SECONDS';
  end if;

  if p_round_cooldown_seconds < 0 or p_round_cooldown_seconds > 300 then
    raise exception 'INVALID_ROUND_COOLDOWN_SECONDS';
  end if;

  if p_base_prize is null or p_base_prize <= 0 then
    raise exception 'BASE_PRIZE_MUST_BE_POSITIVE';
  end if;

  select pg_try_advisory_xact_lock(hashtext('game_round_automation_lock'))
    into v_has_lock;

  if not v_has_lock then
    return jsonb_build_object(
      'state', 'locked',
      'processed_at', v_now
    );
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  select *
    into v_active_round
  from public.game_rounds gr
  where gr.status = 'active'
  order by gr.activated_at desc nulls last, gr.created_at desc
  limit 1
  for update;

  if v_active_round.id is not null then
    v_round_end_at :=
      coalesce(v_active_round.activated_at, v_active_round.created_at) +
      make_interval(
        secs => (coalesce(v_active_round.total_draw_count, 0) * p_draw_interval_seconds)
          + p_prestart_animation_seconds
      );

    if v_now < v_round_end_at then
      return jsonb_build_object(
        'state', 'active',
        'active_round_id', v_active_round.id,
        'next_transition_at', v_round_end_at,
        'processed_at', v_now
      );
    end if;

    select *
      into v_active_round
    from public.finalize_game_round(
      v_active_round.id,
      jsonb_build_object(
        'automation', true,
        'source', 'run_game_round_automation'
      ) || coalesce(p_metadata, '{}'::jsonb)
    );

    select count(*)
      into v_lines_paid
    from public.settle_game_round_line_prizes(
      v_active_round.id,
      round(p_base_prize::numeric, 2),
      jsonb_build_object(
        'automation', true,
        'source', 'run_game_round_automation'
      ) || coalesce(p_metadata, '{}'::jsonb)
    );

    v_cooldown_until :=
      coalesce(v_active_round.finished_at, v_active_round.updated_at, v_now) +
      make_interval(secs => p_round_cooldown_seconds);

    select *
      into v_scheduled_round
    from public.game_rounds gr
    where gr.status = 'scheduled'
    order by gr.scheduled_at asc, gr.created_at asc
    limit 1
    for update;

    if v_scheduled_round.id is null then
      select *
        into v_new_scheduled_round
      from public.create_game_round(
        v_cooldown_until,
        jsonb_build_object(
          'automation', true,
          'source', 'run_game_round_automation',
          'created_after_round', v_active_round.id
        ) || coalesce(p_metadata, '{}'::jsonb)
      );
      v_scheduled_round := v_new_scheduled_round;
    elsif v_scheduled_round.scheduled_at < v_cooldown_until then
      update public.game_rounds
      set
        scheduled_at = v_cooldown_until,
        metadata = metadata || jsonb_build_object(
          'automation', true,
          'source', 'run_game_round_automation',
          'rescheduled_after_round', v_active_round.id
        ) || coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
      where id = v_scheduled_round.id
        and status = 'scheduled'
      returning * into v_scheduled_round;
    end if;

    return jsonb_build_object(
      'state', 'round_finished',
      'finished_round_id', v_active_round.id,
      'lines_paid', v_lines_paid,
      'scheduled_round_id', v_scheduled_round.id,
      'cooldown_until', v_cooldown_until,
      'processed_at', v_now
    );
  end if;

  select *
    into v_scheduled_round
  from public.game_rounds gr
  where gr.status = 'scheduled'
  order by gr.scheduled_at asc, gr.created_at asc
  limit 1
  for update;

  if v_scheduled_round.id is not null then
    if v_scheduled_round.scheduled_at > v_now then
      return jsonb_build_object(
        'state', 'scheduled',
        'scheduled_round_id', v_scheduled_round.id,
        'next_transition_at', v_scheduled_round.scheduled_at,
        'processed_at', v_now
      );
    end if;

    select *
      into v_activated_round
    from public.activate_game_round(
      v_scheduled_round.id,
      p_lucky_ball_probability,
      p_extra_spins_p1,
      p_extra_spins_p2,
      p_extra_spins_p3,
      jsonb_build_object(
        'automation', true,
        'source', 'run_game_round_automation'
      ) || coalesce(p_metadata, '{}'::jsonb)
    );

    return jsonb_build_object(
      'state', 'round_activated',
      'active_round_id', v_activated_round.id,
      'activated_at', v_activated_round.activated_at,
      'processed_at', v_now
    );
  end if;

  select *
    into v_latest_round
  from public.game_rounds gr
  order by gr.created_at desc
  limit 1
  for update;

  if v_latest_round.id is not null and v_latest_round.status = 'finished' then
    v_cooldown_until :=
      coalesce(v_latest_round.finished_at, v_latest_round.updated_at, v_latest_round.created_at) +
      make_interval(secs => p_round_cooldown_seconds);

    v_next_scheduled_at := case
      when v_now < v_cooldown_until then v_cooldown_until
      else v_now + make_interval(secs => p_round_cooldown_seconds)
    end;
  else
    v_next_scheduled_at := v_now + make_interval(secs => p_round_cooldown_seconds);
  end if;

  select *
    into v_new_scheduled_round
  from public.create_game_round(
    v_next_scheduled_at,
    jsonb_build_object(
      'automation', true,
      'source', 'run_game_round_automation',
      'bootstrap', true
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'state', 'round_scheduled',
    'scheduled_round_id', v_new_scheduled_round.id,
    'next_transition_at', v_new_scheduled_round.scheduled_at,
    'processed_at', v_now
  );
end;
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

grant execute on function public.run_game_round_automation(
  integer,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb
) to authenticated, service_role;

grant execute on function public.purchase_bingo_boards(integer, uuid, text, jsonb)
  to authenticated, service_role;

commit;
