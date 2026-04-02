begin;

create or replace function public.safe_jsonb_to_numeric(
  p_value jsonb,
  p_default numeric default null
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_text text;
begin
  if p_value is null then
    return p_default;
  end if;

  if jsonb_typeof(p_value) not in ('number', 'string') then
    return p_default;
  end if;

  v_text := trim(both '"' from p_value::text);
  if v_text is null or v_text = '' then
    return p_default;
  end if;

  begin
    return v_text::numeric;
  exception
    when others then
      return p_default;
  end;
end;
$$;

create or replace function public.get_game_setting_numeric(
  p_key text,
  p_default numeric
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value jsonb;
begin
  if p_key is null or trim(p_key) = '' then
    return p_default;
  end if;

  select gs.value
    into v_value
  from public.game_settings gs
  where gs.key = trim(p_key)
  limit 1;

  return public.safe_jsonb_to_numeric(v_value, p_default);
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'board_purchases_unit_price_check'
      and conrelid = 'public.board_purchases'::regclass
  ) then
    alter table public.board_purchases
      drop constraint board_purchases_unit_price_check;
  end if;
end;
$$;

alter table public.board_purchases
  add constraint board_purchases_unit_price_check
  check (unit_price > 0);

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
  v_stake_tier text := coalesce(nullif(lower(trim(coalesce(p_metadata ->> 'stake_tier', 'basic'))), ''), 'basic');
  v_stake_base_prize_multiplier numeric(10,4);
  v_stake_cashback_rate numeric(10,4);
  v_purchase_metadata jsonb := '{}'::jsonb;
  v_price_basic numeric(10,2);
  v_price_plus numeric(10,2);
  v_price_pro numeric(10,2);
  v_price_max numeric(10,2);
  v_multiplier_basic numeric(10,4);
  v_multiplier_plus numeric(10,4);
  v_multiplier_pro numeric(10,4);
  v_multiplier_max numeric(10,4);
  v_cashback_basic numeric(10,4);
  v_cashback_plus numeric(10,4);
  v_cashback_pro numeric(10,4);
  v_cashback_max numeric(10,4);
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if v_quantity not in (1, 5, 25, 100) then
    raise exception 'INVALID_BOARD_QUANTITY';
  end if;

  v_price_basic := round(public.get_game_setting_numeric('bingo.stake.basic.unit_price', 0.10), 2);
  v_price_plus := round(public.get_game_setting_numeric('bingo.stake.plus.unit_price', 0.20), 2);
  v_price_pro := round(public.get_game_setting_numeric('bingo.stake.pro.unit_price', 0.40), 2);
  v_price_max := round(public.get_game_setting_numeric('bingo.stake.max.unit_price', 1.00), 2);

  v_multiplier_basic := public.get_game_setting_numeric('bingo.stake.basic.base_prize_multiplier', 1.0);
  v_multiplier_plus := public.get_game_setting_numeric('bingo.stake.plus.base_prize_multiplier', 2.2);
  v_multiplier_pro := public.get_game_setting_numeric('bingo.stake.pro.base_prize_multiplier', 4.8);
  v_multiplier_max := public.get_game_setting_numeric('bingo.stake.max.base_prize_multiplier', 12.0);

  v_cashback_basic := public.get_game_setting_numeric('bingo.stake.basic.cashback_rate', 0.08);
  v_cashback_plus := public.get_game_setting_numeric('bingo.stake.plus.cashback_rate', 0.09);
  v_cashback_pro := public.get_game_setting_numeric('bingo.stake.pro.cashback_rate', 0.10);
  v_cashback_max := public.get_game_setting_numeric('bingo.stake.max.cashback_rate', 0.12);

  case v_stake_tier
    when 'basic' then
      v_unit_price := v_price_basic;
      v_stake_base_prize_multiplier := v_multiplier_basic;
      v_stake_cashback_rate := v_cashback_basic;
    when 'plus' then
      v_unit_price := v_price_plus;
      v_stake_base_prize_multiplier := v_multiplier_plus;
      v_stake_cashback_rate := v_cashback_plus;
    when 'pro' then
      v_unit_price := v_price_pro;
      v_stake_base_prize_multiplier := v_multiplier_pro;
      v_stake_cashback_rate := v_cashback_pro;
    when 'max' then
      v_unit_price := v_price_max;
      v_stake_base_prize_multiplier := v_multiplier_max;
      v_stake_cashback_rate := v_cashback_max;
    else
      raise exception 'INVALID_STAKE_TIER';
  end case;

  if v_unit_price <= 0
    or v_stake_base_prize_multiplier <= 0
    or v_stake_cashback_rate < 0
    or v_stake_cashback_rate > 1 then
    raise exception 'INVALID_STAKE_CONFIGURATION';
  end if;

  v_purchase_metadata :=
    coalesce(p_metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'stake_tier', v_stake_tier,
      'stake_unit_price', v_unit_price,
      'stake_base_prize_multiplier', v_stake_base_prize_multiplier,
      'stake_cashback_rate', v_stake_cashback_rate
    );

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
    (
      jsonb_build_object(
        'purchase_id', v_purchase_id,
        'quantity', v_quantity,
        'game_id', v_effective_game_id
      ) || v_purchase_metadata
    ),
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
    v_purchase_metadata
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

create or replace function public.settle_game_round_line_prizes(
  p_game_round_id uuid,
  p_base_prize numeric default 0.20,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  line_win_id uuid,
  user_id uuid,
  board_id uuid,
  line_type public.bingo_line_type,
  line_numbers smallint[],
  applied_multiplier smallint,
  base_prize numeric,
  prize_amount numeric,
  wallet_transaction_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
  v_round public.game_rounds;
  v_candidate record;
  v_line public.game_round_line_wins;
  v_wallet_tx record;
  v_lines_paid integer := 0;
  v_total_paid numeric(12,2) := 0;
  v_operation_ref text;
  v_line_base_prize numeric(12,2);
  v_cashback_candidate record;
  v_cashback_tx record;
  v_cashback_amount numeric(12,2);
  v_cashback_count integer := 0;
  v_cashback_total numeric(12,2) := 0;
  v_multiplier_basic numeric(10,4);
  v_multiplier_plus numeric(10,4);
  v_multiplier_pro numeric(10,4);
  v_multiplier_max numeric(10,4);
  v_cashback_basic numeric(10,4);
  v_cashback_plus numeric(10,4);
  v_cashback_pro numeric(10,4);
  v_cashback_max numeric(10,4);
begin
  if p_game_round_id is null then
    raise exception 'GAME_ROUND_ID_REQUIRED';
  end if;

  if p_base_prize is null or p_base_prize <= 0 then
    raise exception 'BASE_PRIZE_MUST_BE_POSITIVE';
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

  if v_round.status not in ('active', 'finished') then
    raise exception 'INVALID_GAME_ROUND_STATUS_FOR_PRIZES';
  end if;

  if not exists (select 1 from public.game_round_draws d where d.game_round_id = p_game_round_id) then
    raise exception 'ROUND_DRAWS_NOT_FOUND';
  end if;

  v_multiplier_basic := public.get_game_setting_numeric('bingo.stake.basic.base_prize_multiplier', 1.0);
  v_multiplier_plus := public.get_game_setting_numeric('bingo.stake.plus.base_prize_multiplier', 2.2);
  v_multiplier_pro := public.get_game_setting_numeric('bingo.stake.pro.base_prize_multiplier', 4.8);
  v_multiplier_max := public.get_game_setting_numeric('bingo.stake.max.base_prize_multiplier', 12.0);

  v_cashback_basic := public.get_game_setting_numeric('bingo.stake.basic.cashback_rate', 0.08);
  v_cashback_plus := public.get_game_setting_numeric('bingo.stake.plus.cashback_rate', 0.09);
  v_cashback_pro := public.get_game_setting_numeric('bingo.stake.pro.cashback_rate', 0.10);
  v_cashback_max := public.get_game_setting_numeric('bingo.stake.max.cashback_rate', 0.12);

  for v_candidate in
    with drawn as (
      select array_agg(d.number_value order by d.draw_order) as numbers
      from public.game_round_draws d
      where d.game_round_id = p_game_round_id
    ),
    row_lines as (
      select
        b.id as board_id,
        b.purchase_id,
        b.user_id,
        case c.row_index
          when 0 then 'row_1'::public.bingo_line_type
          when 1 then 'row_2'::public.bingo_line_type
          else 'row_3'::public.bingo_line_type
        end as line_type,
        array_agg(c.number_value order by c.col_index)::smallint[] as line_numbers
      from public.bingo_boards b
      join public.bingo_board_cells c on c.board_id = b.id
      cross join drawn d
      where b.game_id = p_game_round_id
      group by b.id, b.purchase_id, b.user_id, c.row_index, d.numbers
      having bool_and(c.number_value = any(d.numbers))
    ),
    col_lines as (
      select
        b.id as board_id,
        b.purchase_id,
        b.user_id,
        case c.col_index
          when 0 then 'col_1'::public.bingo_line_type
          when 1 then 'col_2'::public.bingo_line_type
          else 'col_3'::public.bingo_line_type
        end as line_type,
        array_agg(c.number_value order by c.row_index)::smallint[] as line_numbers
      from public.bingo_boards b
      join public.bingo_board_cells c on c.board_id = b.id
      cross join drawn d
      where b.game_id = p_game_round_id
      group by b.id, b.purchase_id, b.user_id, c.col_index, d.numbers
      having bool_and(c.number_value = any(d.numbers))
    ),
    candidates as (
      select * from row_lines
      union all
      select * from col_lines
    ),
    enriched as (
      select
        c.board_id,
        c.purchase_id,
        c.user_id,
        c.line_type,
        c.line_numbers,
        coalesce(sum(m.multiplier), 1)::smallint as applied_multiplier,
        coalesce(nullif(lower(bp.metadata ->> 'stake_tier'), ''), 'basic') as stake_tier,
        coalesce(
          public.safe_jsonb_to_numeric(bp.metadata -> 'stake_base_prize_multiplier', null),
          case coalesce(nullif(lower(bp.metadata ->> 'stake_tier'), ''), 'basic')
            when 'plus' then v_multiplier_plus
            when 'pro' then v_multiplier_pro
            when 'max' then v_multiplier_max
            else v_multiplier_basic
          end,
          1
        )::numeric as stake_base_prize_multiplier
      from candidates c
      join public.board_purchases bp on bp.id = c.purchase_id
      left join public.game_round_multipliers m
        on m.game_round_id = p_game_round_id
       and m.number_value = any(c.line_numbers)
      group by c.board_id, c.purchase_id, c.user_id, c.line_type, c.line_numbers, bp.metadata
    )
    select *
    from enriched e
    where not exists (
      select 1
      from public.game_round_line_wins lw
      where lw.game_round_id = p_game_round_id
        and lw.board_id = e.board_id
        and lw.line_type = e.line_type
    )
  loop
    v_operation_ref := format(
      'prize_line:%s:%s:%s',
      p_game_round_id,
      v_candidate.board_id,
      v_candidate.line_type
    );

    v_line_base_prize := round((p_base_prize * v_candidate.stake_base_prize_multiplier)::numeric, 2);

    begin
      insert into public.game_round_line_wins (
        game_round_id,
        board_id,
        purchase_id,
        user_id,
        line_type,
        line_numbers,
        applied_multiplier,
        base_prize,
        prize_amount,
        operation_ref
      )
      values (
        p_game_round_id,
        v_candidate.board_id,
        v_candidate.purchase_id,
        v_candidate.user_id,
        v_candidate.line_type,
        v_candidate.line_numbers,
        v_candidate.applied_multiplier,
        v_line_base_prize,
        round((v_line_base_prize * v_candidate.applied_multiplier)::numeric, 2),
        v_operation_ref
      )
      returning * into v_line;
    exception
      when unique_violation then
        continue;
    end;

    select * into v_wallet_tx
    from public.apply_wallet_transaction(
      v_line.user_id,
      'prize',
      'credit',
      v_line.prize_amount,
      v_line.operation_ref,
      'game_line_prize',
      jsonb_build_object(
        'game_round_id', p_game_round_id,
        'line_win_id', v_line.id,
        'board_id', v_line.board_id,
        'line_type', v_line.line_type,
        'line_numbers', v_line.line_numbers,
        'multiplier', v_line.applied_multiplier,
        'stake_tier', v_candidate.stake_tier,
        'stake_base_prize_multiplier', v_candidate.stake_base_prize_multiplier
      ) || coalesce(p_metadata, '{}'::jsonb),
      v_actor_user_id
    )
    limit 1;

    update public.game_round_line_wins
    set
      wallet_transaction_id = v_wallet_tx.transaction_id,
      paid_at = now()
    where id = v_line.id
    returning * into v_line;

    v_lines_paid := v_lines_paid + 1;
    v_total_paid := round(v_total_paid + v_line.prize_amount, 2);

    return query
    select
      v_line.id,
      v_line.user_id,
      v_line.board_id,
      v_line.line_type,
      v_line.line_numbers,
      v_line.applied_multiplier,
      v_line.base_prize,
      v_line.prize_amount,
      v_line.wallet_transaction_id;
  end loop;

  for v_cashback_candidate in
    select
      bp.id as purchase_id,
      bp.user_id,
      bp.quantity,
      bp.total_amount,
      coalesce(nullif(lower(bp.metadata ->> 'stake_tier'), ''), 'basic') as stake_tier,
      greatest(
        0,
        least(
          coalesce(
            public.safe_jsonb_to_numeric(bp.metadata -> 'stake_cashback_rate', null),
            case coalesce(nullif(lower(bp.metadata ->> 'stake_tier'), ''), 'basic')
              when 'plus' then v_cashback_plus
              when 'pro' then v_cashback_pro
              when 'max' then v_cashback_max
              else v_cashback_basic
            end,
            0
          ),
          1
        )
      )::numeric as cashback_rate
    from public.board_purchases bp
    where bp.game_id = p_game_round_id
      and bp.status = 'completed'
      and bp.quantity >= 25
      and not exists (
        select 1
        from public.game_round_line_wins lw
        where lw.game_round_id = p_game_round_id
          and lw.purchase_id = bp.id
      )
  loop
    v_cashback_amount := round((v_cashback_candidate.total_amount * v_cashback_candidate.cashback_rate)::numeric, 2);
    if v_cashback_amount <= 0 then
      continue;
    end if;

    v_operation_ref := format(
      'prize_cashback:%s:%s',
      p_game_round_id,
      v_cashback_candidate.purchase_id
    );

    select * into v_cashback_tx
    from public.apply_wallet_transaction(
      v_cashback_candidate.user_id,
      'prize',
      'credit',
      v_cashback_amount,
      v_operation_ref,
      'game_cashback',
      jsonb_build_object(
        'game_round_id', p_game_round_id,
        'purchase_id', v_cashback_candidate.purchase_id,
        'quantity', v_cashback_candidate.quantity,
        'stake_tier', v_cashback_candidate.stake_tier,
        'cashback_rate', v_cashback_candidate.cashback_rate,
        'reason', 'no_line_wins_large_purchase'
      ) || coalesce(p_metadata, '{}'::jsonb),
      v_actor_user_id
    )
    limit 1;

    if not coalesce(v_cashback_tx.was_already_processed, false) then
      v_cashback_count := v_cashback_count + 1;
      v_cashback_total := round(v_cashback_total + v_cashback_amount, 2);
      v_total_paid := round(v_total_paid + v_cashback_amount, 2);
    end if;
  end loop;

  insert into public.game_round_prize_runs (
    game_round_id,
    executed_by,
    base_prize,
    lines_paid,
    total_paid,
    metadata
  )
  values (
    p_game_round_id,
    v_actor_user_id,
    round(p_base_prize::numeric, 2),
    v_lines_paid,
    v_total_paid,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'cashback_count', v_cashback_count,
      'cashback_total', v_cashback_total
    )
  );
end;
$$;

grant execute on function public.safe_jsonb_to_numeric(jsonb, numeric)
  to authenticated, service_role;

grant execute on function public.get_game_setting_numeric(text, numeric)
  to authenticated, service_role;

grant execute on function public.purchase_bingo_boards(integer, uuid, text, jsonb)
  to authenticated, service_role;

grant execute on function public.settle_game_round_line_prizes(uuid, numeric, jsonb)
  to authenticated, service_role;

commit;
