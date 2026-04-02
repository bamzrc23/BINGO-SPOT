begin;

create or replace function public.run_game_round_automation_safe(
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
begin
  if v_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  return public.run_game_round_automation(
    6,
    7,
    30,
    0.20,
    0.15,
    0.78,
    0.17,
    0.05,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('wrapper', 'run_game_round_automation_safe')
  );
end;
$$;

grant execute on function public.run_game_round_automation_safe(jsonb)
  to authenticated, service_role;

commit;
