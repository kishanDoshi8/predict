create or replace function public.update_room_stats_after_resolution(
  p_room_id uuid,
  p_prediction_id uuid,
  p_winning_option_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_biggest_bet record;
  v_biggest_win record;
  v_most_profit record;
begin
  select
    b.amount,
    pred.id as prediction_id,
    b.player_id as user_id,
    p.username
  into v_biggest_bet
  from public.bets b
  join public.predictions pred on pred.id = b.prediction_id
  join public.players p on p.id = b.player_id
  where pred.room_id = p_room_id
    and pred.status in ('revealed', 'cancelled', 'no_result')
  order by b.amount desc, b.placed_at asc, b.id asc
  limit 1;

  if found then
    perform private.upsert_room_stat(
      p_room_id,
      'biggest_bet',
      jsonb_build_object(
        'amount', v_biggest_bet.amount,
        'prediction_id', v_biggest_bet.prediction_id,
        'user_id', v_biggest_bet.user_id,
        'username', v_biggest_bet.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'biggest_bet';
  end if;

  select
    greatest(coalesce(b.payout, 0) - b.amount, 0) as amount,
    pred.id as prediction_id,
    b.player_id as user_id,
    p.username
  into v_biggest_win
  from public.bets b
  join public.predictions pred on pred.id = b.prediction_id
  join public.players p on p.id = b.player_id
  where pred.room_id = p_room_id
    and pred.status = 'revealed'
  order by amount desc, pred.resolved_at asc nulls last, b.id asc
  limit 1;

  if found and v_biggest_win.amount > 0 then
    perform private.upsert_room_stat(
      p_room_id,
      'biggest_win',
      jsonb_build_object(
        'amount', v_biggest_win.amount,
        'prediction_id', v_biggest_win.prediction_id,
        'user_id', v_biggest_win.user_id,
        'username', v_biggest_win.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'biggest_win';
  end if;

  select
    b.player_id as user_id,
    p.username,
    sum(greatest(coalesce(b.payout, 0) - b.amount, 0))::bigint as amount
  into v_most_profit
  from public.bets b
  join public.predictions pred on pred.id = b.prediction_id
  join public.players p on p.id = b.player_id
  where pred.room_id = p_room_id
    and pred.status = 'revealed'
  group by b.player_id, p.username
  order by amount desc, p.username asc
  limit 1;

  if found and v_most_profit.amount > 0 then
    perform private.upsert_room_stat(
      p_room_id,
      'most_profit',
      jsonb_build_object(
        'amount', v_most_profit.amount,
        'user_id', v_most_profit.user_id,
        'username', v_most_profit.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'most_profit';
  end if;
end;
$$;
