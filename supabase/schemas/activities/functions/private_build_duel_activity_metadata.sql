create or replace function private.build_duel_activity_metadata(
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_duel public.duels%rowtype;
  v_prediction public.predictions%rowtype;
  v_challenger public.players%rowtype;
  v_opponent public.players%rowtype;
  v_winner public.players%rowtype;
  v_challenger_bet public.bets%rowtype;
  v_opponent_bet public.bets%rowtype;
  v_winner_player_id uuid := null;
begin
  select * into v_duel
  from public.duels
  where id = p_duel_id;

  if not found then
    return '{}'::jsonb;
  end if;

  select * into v_prediction
  from public.predictions
  where id = v_duel.prediction_id;

  select * into v_challenger
  from public.players
  where id = v_duel.challenger_player_id;

  if v_duel.matched_opponent_player_id is not null then
    select * into v_opponent
    from public.players
    where id = v_duel.matched_opponent_player_id;
  end if;

  if v_duel.status = 'resolved'
     and v_prediction.winning_option_id is not null
     and v_duel.matched_opponent_bet_id is not null then
    select * into v_challenger_bet
    from public.bets
    where id = v_duel.challenger_bet_id;

    select * into v_opponent_bet
    from public.bets
    where id = v_duel.matched_opponent_bet_id;

    if found and v_challenger_bet.option_id = v_prediction.winning_option_id then
      v_winner_player_id := v_duel.challenger_player_id;
    elsif v_opponent_bet.option_id = v_prediction.winning_option_id then
      v_winner_player_id := v_duel.matched_opponent_player_id;
    end if;
  end if;

  if v_winner_player_id is not null then
    select * into v_winner
    from public.players
    where id = v_winner_player_id;
  end if;

  return jsonb_build_object(
    'duelId', v_duel.id,
    'predictionId', v_duel.prediction_id,
    'predictionTitle', v_prediction.title,
    'status', v_duel.status,
    'challenger', jsonb_build_object(
      'id', v_challenger.id,
      'username', v_challenger.username
    ),
    'opponent', case
      when v_duel.matched_opponent_player_id is null then null
      else jsonb_build_object(
        'id', v_opponent.id,
        'username', v_opponent.username
      )
    end,
    'winner', case
      when v_winner_player_id is null then null
      else jsonb_build_object(
        'id', v_winner.id,
        'username', v_winner.username
      )
    end,
    'stakeAmount', v_duel.stake_amount,
    'payout', case
      when v_duel.status = 'resolved' and v_winner_player_id is not null then v_duel.stake_amount * 2
      else null
    end,
    'createdAt', v_duel.created_at,
    'matchedAt', v_duel.matched_at,
    'resolvedAt', v_duel.resolved_at
  );
end;
$$;
