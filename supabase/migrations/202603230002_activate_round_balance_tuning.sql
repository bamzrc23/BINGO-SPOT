begin;

create or replace function public.activate_game_round(
  p_game_round_id uuid,
  p_lucky_ball_probability numeric default 0.0800,
  p_extra_spins_p1 numeric default 0.7800,
  p_extra_spins_p2 numeric default 0.1700,
  p_extra_spins_p3 numeric default 0.0500,
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
  v_multiplier_boost_probability numeric := 0.4500;
  v_multiplier_boost_min_hits integer := 1;
  v_multiplier_boost_max_hits integer := 2;
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

grant execute on function public.activate_game_round(
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb
) to authenticated, service_role;

commit;
