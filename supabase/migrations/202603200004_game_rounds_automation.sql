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

commit;
