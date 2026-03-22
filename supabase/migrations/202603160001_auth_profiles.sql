begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('user', 'admin');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('pending', 'active', 'suspended');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  nickname text not null,
  email text not null,
  phone text null,
  role public.app_role not null default 'user',
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_nickname_unique_idx on public.profiles (lower(nickname));
create unique index if not exists profiles_email_unique_idx on public.profiles (lower(email));
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (account_status);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  generated_nickname text := lower(regexp_replace(coalesce(raw_meta ->> 'nickname', split_part(coalesce(new.email, ''), '@', 1), 'user_' || left(new.id::text, 8)), '[^a-zA-Z0-9_]', '_', 'g'));
  generated_role public.app_role := case
    when raw_meta ->> 'role' = 'admin' then 'admin'
    else 'user'
  end;
  generated_status public.account_status := case
    when raw_meta ->> 'account_status' = 'pending' then 'pending'
    when raw_meta ->> 'account_status' = 'suspended' then 'suspended'
    else 'active'
  end;
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
    generated_role,
    generated_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles
for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin')
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'user') = 'admin');

commit;
