begin;

-- Permite multiplicadores compuestos por linea (ej: x2*x2 = x4).
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'game_round_line_wins'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%applied_multiplier%'
  loop
    execute format(
      'alter table public.game_round_line_wins drop constraint if exists %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

alter table public.game_round_line_wins
  add constraint game_round_line_wins_applied_multiplier_check
  check (applied_multiplier >= 1 and applied_multiplier <= 125);

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
        (
          power(2::numeric, count(*) filter (where m.multiplier = 2)) *
          power(3::numeric, count(*) filter (where m.multiplier = 3)) *
          power(5::numeric, count(*) filter (where m.multiplier = 5))
        )::smallint as applied_multiplier
      from candidates c
      left join public.game_round_multipliers m
        on m.game_round_id = p_game_round_id
       and m.number_value = any(c.line_numbers)
      group by c.board_id, c.purchase_id, c.user_id, c.line_type, c.line_numbers
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
        round(p_base_prize::numeric, 2),
        round((p_base_prize * v_candidate.applied_multiplier)::numeric, 2),
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
        'multiplier', v_line.applied_multiplier
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
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.settle_game_round_line_prizes(uuid, numeric, jsonb)
  to authenticated, service_role;

commit;
