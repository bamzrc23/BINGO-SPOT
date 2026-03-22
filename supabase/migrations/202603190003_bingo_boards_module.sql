begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'board_purchase_status') then
    create type public.board_purchase_status as enum ('pending', 'completed', 'failed');
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

create table if not exists public.board_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid null,
  quantity integer not null check (quantity in (1, 5, 25, 100)),
  unit_price numeric(10,2) not null default 0.10 check (unit_price = 0.10),
  total_amount numeric(12,2) not null check (total_amount = (quantity::numeric * unit_price)),
  status public.board_purchase_status not null default 'completed',
  wallet_transaction_id uuid not null references public.wallet_transactions(id) on delete restrict,
  operation_ref text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operation_ref)
);

drop trigger if exists set_board_purchases_updated_at on public.board_purchases;
create trigger set_board_purchases_updated_at
before update on public.board_purchases
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.bingo_boards (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.board_purchases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid null,
  board_index integer not null check (board_index > 0),
  board_fingerprint text not null,
  grid jsonb not null,
  created_at timestamptz not null default now(),
  unique (purchase_id, board_index),
  unique (purchase_id, board_fingerprint),
  unique (user_id, board_fingerprint)
);

create table if not exists public.bingo_board_cells (
  board_id uuid not null references public.bingo_boards(id) on delete cascade,
  row_index smallint not null check (row_index between 0 and 2),
  col_index smallint not null check (col_index between 0 and 2),
  number_value smallint not null check (number_value between 1 and 30),
  primary key (board_id, row_index, col_index),
  unique (board_id, number_value),
  constraint bingo_board_cells_col_range_check check (
    (col_index = 0 and number_value between 1 and 10) or
    (col_index = 1 and number_value between 11 and 20) or
    (col_index = 2 and number_value between 21 and 30)
  )
);

create index if not exists board_purchases_user_created_at_idx
  on public.board_purchases (user_id, created_at desc);
create index if not exists board_purchases_user_game_created_at_idx
  on public.board_purchases (user_id, game_id, created_at desc);
create index if not exists bingo_boards_purchase_idx
  on public.bingo_boards (purchase_id, board_index);
create index if not exists bingo_boards_user_game_idx
  on public.bingo_boards (user_id, game_id, created_at desc);
create index if not exists bingo_board_cells_board_idx
  on public.bingo_board_cells (board_id);

alter table public.board_purchases enable row level security;
alter table public.bingo_boards enable row level security;
alter table public.bingo_board_cells enable row level security;

drop policy if exists "board_purchases_select_own" on public.board_purchases;
create policy "board_purchases_select_own"
on public.board_purchases
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "board_purchases_select_admin" on public.board_purchases;
create policy "board_purchases_select_admin"
on public.board_purchases
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

drop policy if exists "bingo_boards_select_own" on public.bingo_boards;
create policy "bingo_boards_select_own"
on public.bingo_boards
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "bingo_boards_select_admin" on public.bingo_boards;
create policy "bingo_boards_select_admin"
on public.bingo_boards
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

drop policy if exists "bingo_board_cells_select_own" on public.bingo_board_cells;
create policy "bingo_board_cells_select_own"
on public.bingo_board_cells
for select
to authenticated
using (
  exists (
    select 1
    from public.bingo_boards b
    where b.id = board_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "bingo_board_cells_select_admin" on public.bingo_board_cells;
create policy "bingo_board_cells_select_admin"
on public.bingo_board_cells
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

create or replace function public.validate_bingo_grid_structure(p_grid jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_seen integer[] := '{}';
  v_row_index integer;
  v_col_index integer;
  v_cell jsonb;
  v_value integer;
begin
  if p_grid is null or jsonb_typeof(p_grid) <> 'array' or jsonb_array_length(p_grid) <> 3 then
    return false;
  end if;

  for v_row_index in 0..2 loop
    if jsonb_typeof(p_grid -> v_row_index) <> 'array' or jsonb_array_length(p_grid -> v_row_index) <> 3 then
      return false;
    end if;

    for v_col_index in 0..2 loop
      v_cell := p_grid -> v_row_index -> v_col_index;
      if jsonb_typeof(v_cell) <> 'number' then
        return false;
      end if;

      begin
        v_value := (v_cell #>> '{}')::integer;
      exception when others then
        return false;
      end;

      if v_col_index = 0 and (v_value < 1 or v_value > 10) then
        return false;
      end if;

      if v_col_index = 1 and (v_value < 11 or v_value > 20) then
        return false;
      end if;

      if v_col_index = 2 and (v_value < 21 or v_value > 30) then
        return false;
      end if;

      if v_value = any(v_seen) then
        return false;
      end if;

      v_seen := array_append(v_seen, v_value);
    end loop;
  end loop;

  return array_length(v_seen, 1) = 9;
end;
$$;

create or replace function public.bingo_grid_to_fingerprint(p_grid jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_row_index integer;
  v_col_index integer;
  v_parts text[] := '{}';
begin
  if not public.validate_bingo_grid_structure(p_grid) then
    raise exception 'INVALID_BINGO_GRID';
  end if;

  for v_row_index in 0..2 loop
    for v_col_index in 0..2 loop
      v_parts := array_append(v_parts, p_grid -> v_row_index ->> v_col_index);
    end loop;
  end loop;

  return array_to_string(v_parts, '-');
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bingo_boards_grid_structure_check'
  ) then
    alter table public.bingo_boards
      add constraint bingo_boards_grid_structure_check
      check (public.validate_bingo_grid_structure(grid));
  end if;
end
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
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if v_quantity not in (1, 5, 25, 100) then
    raise exception 'INVALID_BOARD_QUANTITY';
  end if;

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
      'game_id', p_game_id
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
    p_game_id,
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
          p_game_id,
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

grant execute on function public.purchase_bingo_boards(integer, uuid, text, jsonb)
  to authenticated, service_role;

commit;
