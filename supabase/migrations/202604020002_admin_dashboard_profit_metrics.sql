begin;

drop function if exists public.admin_get_dashboard_metrics();

create or replace function public.admin_get_dashboard_metrics()
returns table (
  users_total bigint,
  users_active bigint,
  users_suspended bigint,
  topups_pending bigint,
  withdrawals_pending bigint,
  active_round_id uuid,
  boards_sold_total bigint,
  boards_revenue_total numeric,
  prizes_paid_total numeric,
  net_gaming_result_total numeric,
  board_sales_breakdown jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_boards_revenue_total numeric := 0;
  v_prizes_paid_total numeric := 0;
begin
  if not public.is_admin_actor(v_actor_user_id) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  select coalesce(sum(bp.total_amount), 0)::numeric
    into v_boards_revenue_total
  from public.board_purchases bp
  where bp.status = 'completed';

  select coalesce(sum(lw.prize_amount), 0)::numeric
    into v_prizes_paid_total
  from public.game_round_line_wins lw
  where lw.wallet_transaction_id is not null;

  return query
  select
    (select count(*) from public.profiles) as users_total,
    (select count(*) from public.profiles where account_status = 'active') as users_active,
    (select count(*) from public.profiles where account_status = 'suspended') as users_suspended,
    (select count(*) from public.topups where status = 'pending') as topups_pending,
    (select count(*) from public.withdrawals where status = 'pending') as withdrawals_pending,
    (
      select gr.id
      from public.game_rounds gr
      where gr.status = 'active'
      order by gr.activated_at desc nulls last, gr.created_at desc
      limit 1
    ) as active_round_id,
    (
      select coalesce(sum(bp.quantity), 0)::bigint
      from public.board_purchases bp
      where bp.status = 'completed'
    ) as boards_sold_total,
    round(v_boards_revenue_total::numeric, 2) as boards_revenue_total,
    round(v_prizes_paid_total::numeric, 2) as prizes_paid_total,
    round((v_boards_revenue_total - v_prizes_paid_total)::numeric, 2) as net_gaming_result_total,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'stake_tier', sb.stake_tier,
            'unit_price', sb.unit_price,
            'purchases_count', sb.purchases_count,
            'boards_sold', sb.boards_sold,
            'sales_total', sb.sales_total
          )
          order by sb.unit_price asc, sb.stake_tier asc
        ),
        '[]'::jsonb
      )
      from (
        select
          coalesce(nullif(lower(trim(coalesce(bp.metadata ->> 'stake_tier', ''))), ''), 'unknown') as stake_tier,
          round(bp.unit_price::numeric, 2) as unit_price,
          count(*)::bigint as purchases_count,
          coalesce(sum(bp.quantity), 0)::bigint as boards_sold,
          round(coalesce(sum(bp.total_amount), 0)::numeric, 2) as sales_total
        from public.board_purchases bp
        where bp.status = 'completed'
        group by 1, 2
      ) sb
    ) as board_sales_breakdown;
end;
$$;

grant execute on function public.admin_get_dashboard_metrics()
  to authenticated, service_role;

commit;
