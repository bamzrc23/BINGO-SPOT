begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  generated_nickname text := lower(
    regexp_replace(
      coalesce(
        raw_meta ->> 'nickname',
        split_part(coalesce(new.email, ''), '@', 1),
        'user_' || left(new.id::text, 8)
      ),
      '[^a-zA-Z0-9_]',
      '_',
      'g'
    )
  );
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    nickname,
    email,
    phone,
    role,
    account_status
  )
  values (
    new.id,
    coalesce(nullif(raw_meta ->> 'first_name', ''), 'Jugador'),
    coalesce(nullif(raw_meta ->> 'last_name', ''), 'Bingo'),
    generated_nickname,
    coalesce(new.email, generated_nickname || '@invalid.local'),
    nullif(raw_meta ->> 'phone', ''),
    'user',
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(auth.role(), 'anon');
  v_actor_is_admin boolean := false;
begin
  if v_actor_role = 'service_role' then
    return new;
  end if;

  if v_actor_user_id is not null then
    select exists(
      select 1
      from public.profiles p
      where p.id = v_actor_user_id
        and p.role = 'admin'
        and p.account_status = 'active'
    ) into v_actor_is_admin;
  end if;

  if v_actor_is_admin then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'FORBIDDEN_PROFILE_ID_CHANGE';
  end if;

  if new.role is distinct from old.role then
    raise exception 'FORBIDDEN_ROLE_CHANGE';
  end if;

  if new.account_status is distinct from old.account_status then
    raise exception 'FORBIDDEN_ACCOUNT_STATUS_CHANGE';
  end if;

  if new.email is distinct from old.email then
    raise exception 'FORBIDDEN_EMAIL_CHANGE';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
before update on public.profiles
for each row
execute function public.protect_profile_privileged_fields();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  and role = 'user'
  and account_status = 'active'
);

revoke execute on function public.run_game_round_automation(
  integer,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb
) from authenticated;
revoke execute on function public.run_game_round_automation(
  integer,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb
) from anon;
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
) to service_role;

commit;
