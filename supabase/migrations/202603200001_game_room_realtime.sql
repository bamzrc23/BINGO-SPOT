begin;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'game_rounds',
    'game_round_line_wins',
    'wallets',
    'wallet_transactions',
    'board_purchases',
    'bingo_boards'
  ];
begin
  foreach v_table in array v_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

commit;
