-- ============================================================
-- Migration: duel_view_models
-- Description: Frontend-oriented duel view model RPCs.
-- ============================================================

create or replace function private.get_duel_view_model(
  p_duel_id uuid,
  p_current_player_id uuid default private.get_player_id_from_auth()
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_result jsonb;
begin
  with duel_base as (
    select
      d.id,
      d.status,
      d.prediction_id,
      d.challenger_player_id,
      d.matched_opponent_player_id,
      d.stake_amount,
      d.fee_amount,
      d.created_at,
      d.matched_at,
      d.resolved_at,
      p.winning_option_id,
      cb.option_id as challenger_option_id,
      ob.option_id as opponent_option_id,
      cp.username as challenger_username,
      op.username as opponent_username
    from public.duels d
    join public.predictions p on p.id = d.prediction_id
    join public.bets cb on cb.id = d.challenger_bet_id
    left join public.bets ob on ob.id = d.matched_opponent_bet_id
    join public.players cp on cp.id = d.challenger_player_id
    left join public.players op on op.id = d.matched_opponent_player_id
    where d.id = p_duel_id
  ),
  queue_data as (
    select
      count(*)::int as queue_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', pl.id,
            'username', pl.username
          )
          order by pl.username asc
        ),
        '[]'::jsonb
      ) as queued_players,
      coalesce(bool_or(dq.player_id = p_current_player_id), false) as current_player_queued
    from public.duel_queue dq
    join public.players pl on pl.id = dq.player_id
    where dq.duel_id = p_duel_id
  ),
  winner_data as (
    select
      case
        when db.status = 'resolved'
          and db.winning_option_id is not null
          and db.matched_opponent_player_id is not null
        then
          case
            when db.challenger_option_id = db.winning_option_id then db.challenger_player_id
            when db.opponent_option_id = db.winning_option_id then db.matched_opponent_player_id
            else null
          end
        else null
      end as winner_player_id
    from duel_base db
  ),
  rivalry_data as (
    select
      count(*)::int as total_duels,
      count(*) filter (where winner_id = p_current_player_id)::int as wins,
      count(*) filter (where winner_id = opponent_context.v_opponent_id)::int as losses,
      coalesce(
        sum(
          case
            when winner_id = p_current_player_id then stake_amount
            when winner_id = opponent_context.v_opponent_id then -stake_amount
            else 0
          end
        ),
        0
      )::int as net_points
    from (
      select
        rd.stake_amount,
        case
          when rcb.option_id = rp.winning_option_id then rd.challenger_player_id
          when rob.option_id = rp.winning_option_id then rd.matched_opponent_player_id
          else null
        end as winner_id
      from public.duels rd
      join public.predictions rp on rp.id = rd.prediction_id
      join public.bets rcb on rcb.id = rd.challenger_bet_id
      left join public.bets rob on rob.id = rd.matched_opponent_bet_id
      cross join lateral (
        select
          case
            when db.challenger_player_id = p_current_player_id then db.matched_opponent_player_id
            when db.matched_opponent_player_id = p_current_player_id then db.challenger_player_id
            else null
          end as v_opponent_id
        from duel_base db
      ) pair
      where rd.status = 'resolved'
        and rp.winning_option_id is not null
        and pair.v_opponent_id is not null
        and (
          (rd.challenger_player_id = p_current_player_id and rd.matched_opponent_player_id = pair.v_opponent_id)
          or
          (rd.challenger_player_id = pair.v_opponent_id and rd.matched_opponent_player_id = p_current_player_id)
        )
    ) rivalry_source
    cross join lateral (
      select
        case
          when db.challenger_player_id = p_current_player_id then db.matched_opponent_player_id
          when db.matched_opponent_player_id = p_current_player_id then db.challenger_player_id
          else null
        end as v_opponent_id
      from duel_base db
    ) opponent_context
  )
  select jsonb_build_object(
    'id', db.id,
    'status', db.status,
    'challenger', jsonb_build_object(
      'id', db.challenger_player_id,
      'username', db.challenger_username
    ),
    'opponent', case
      when db.matched_opponent_player_id is null then null
      else jsonb_build_object(
        'id', db.matched_opponent_player_id,
        'username', db.opponent_username
      )
    end,
    'stakeAmount', db.stake_amount,
    'feeAmount', db.fee_amount,
    'totalPot', (db.stake_amount * 2),
    'queueCount', q.queue_count,
    'queuedPlayers', q.queued_players,
    'currentPlayerState',
      case
        when p_current_player_id is null then 'none'
        when db.status = 'resolved'
          and w.winner_player_id is not null
          and (p_current_player_id = db.challenger_player_id or p_current_player_id = db.matched_opponent_player_id)
        then case
          when w.winner_player_id = p_current_player_id then 'winner'
          else 'loser'
        end
        when db.status = 'matched'
          and (p_current_player_id = db.challenger_player_id or p_current_player_id = db.matched_opponent_player_id)
        then 'matched'
        when q.current_player_queued then 'queued'
        when p_current_player_id = db.challenger_player_id then 'creator'
        else 'none'
      end,
    'currentPlayerQueued', q.current_player_queued,
    'totalReserved',
      case
        when db.status in ('created', 'queued') then db.stake_amount * (q.queue_count + 1)
        when db.status = 'matched' then db.stake_amount * 2
        else 0
      end,
    'rivalry',
      case
        when p_current_player_id is null then null
        when db.matched_opponent_player_id is null then null
        when p_current_player_id not in (db.challenger_player_id, db.matched_opponent_player_id) then null
        else (
          select jsonb_build_object(
            'totalDuels', rd.total_duels,
            'wins', rd.wins,
            'losses', rd.losses,
            'netPoints', rd.net_points
          )
          from rivalry_data rd
        )
      end,
    'winner',
      case
        when w.winner_player_id is null then null
        else (
          select jsonb_build_object('id', p.id, 'username', p.username)
          from public.players p
          where p.id = w.winner_player_id
        )
      end,
    'payout',
      case
        when db.status = 'resolved' and w.winner_player_id is not null then db.stake_amount * 2
        else null
      end,
    'createdAt', db.created_at,
    'matchedAt', db.matched_at,
    'resolvedAt', db.resolved_at
  )
  into v_result
  from duel_base db
  cross join queue_data q
  cross join winner_data w;

  return v_result;
end;
$$;

create or replace function public.get_prediction_duels_view(
  p_prediction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_result jsonb;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  select coalesce(
    jsonb_agg(
      private.get_duel_view_model(d.id, v_auth_player_id)
      order by d.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.duels d
  where d.prediction_id = p_prediction_id;

  return v_result;
end;
$$;

create or replace function public.get_prediction_duel_summary(
  p_prediction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_result jsonb;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  with queue_by_duel as (
    select dq.duel_id, count(*)::int as queue_count
    from public.duel_queue dq
    group by dq.duel_id
  ),
  duel_rows as (
    select
      d.id,
      d.status,
      d.stake_amount,
      d.challenger_player_id,
      d.matched_opponent_player_id,
      coalesce(q.queue_count, 0) as queue_count
    from public.duels d
    left join queue_by_duel q on q.duel_id = d.id
    where d.prediction_id = p_prediction_id and d.status in ('created', 'queued', 'matched', 'resolved')
  ),
  participants as (
    select challenger_player_id as player_id from duel_rows
    union
    select matched_opponent_player_id from duel_rows where matched_opponent_player_id is not null
    union
    select dq.player_id
    from public.duel_queue dq
    join public.duels d on d.id = dq.duel_id
    where d.prediction_id = p_prediction_id
  ),
  current_player_active_created as (
    select d.id
    from public.duels d
    where d.prediction_id = p_prediction_id
      and d.challenger_player_id = v_auth_player_id
      and d.status in ('created', 'queued', 'matched')
    order by d.created_at desc
    limit 1
  ),
  current_player_queue as (
    select count(*)::int as queued_count
    from public.duel_queue dq
    join public.duels d on d.id = dq.duel_id
    where d.prediction_id = p_prediction_id
      and dq.player_id = v_auth_player_id
      and d.status in ('created', 'queued', 'matched')
  ),
  current_player_active_participation as (
    select exists (
      select 1
      from public.duels d
      where d.prediction_id = p_prediction_id
        and d.status in ('created', 'queued', 'matched')
        and (
          d.challenger_player_id = v_auth_player_id
          or d.matched_opponent_player_id = v_auth_player_id
          or exists (
            select 1
            from public.duel_queue dq
            where dq.duel_id = d.id
              and dq.player_id = v_auth_player_id
          )
        )
    ) as has_active_participation
  ),
  current_player_qualifying_bet as (
    select exists (
      select 1
      from public.bets b
      where b.prediction_id = p_prediction_id
        and b.player_id = v_auth_player_id
        and b.amount >= 100
    ) as has_qualifying_bet
  ),
  prediction_phase as (
    select p.status
    from public.predictions p
    where p.id = p_prediction_id
  )
  select jsonb_build_object(
    'totalDuels', count(*)::int,
    'activeDuels', count(*) filter (where dr.status in ('created', 'queued'))::int,
    'matchedDuels', count(*) filter (where dr.status = 'matched')::int,
    'resolvedDuels', count(*) filter (where dr.status in ('resolved'))::int,
    'totalStake', coalesce(sum(dr.stake_amount), 0)::int,
    'totalEscrow', coalesce(sum(
      case
        when dr.status in ('created', 'queued') then dr.stake_amount * (dr.queue_count + 1)
        when dr.status = 'matched' then dr.stake_amount * 2
        else 0
      end
    ), 0)::int,
    'largestStake', max(dr.stake_amount),
    'medianStake', percentile_cont(0.5) within group (order by dr.stake_amount),
    'uniqueParticipants', (select count(*)::int from participants),
    'queueEntries', (
      select count(*)::int
      from public.duel_queue dq
      join public.duels d on d.id = dq.duel_id
      where d.prediction_id = p_prediction_id
    ),
    'currentPlayerHasCreatedDuel', exists(select 1 from current_player_active_created),
    'currentPlayerCreatedDuelId', (select id from current_player_active_created),
    'currentPlayerQueuedCount', (select queued_count from current_player_queue),
    'currentPlayerCanCreate',
      (
        v_auth_player_id is not null
        and (select status from prediction_phase) = 'draft'
        and (select has_qualifying_bet from current_player_qualifying_bet)
        and not (select has_active_participation from current_player_active_participation)
      )
  )
  into v_result
  from duel_rows dr;

  return coalesce(
    v_result,
    jsonb_build_object(
      'totalDuels', 0,
      'activeDuels', 0,
      'matchedDuels', 0,
      'resolvedDuels', 0,
      'totalStake', 0,
      'totalEscrow', 0,
      'largestStake', null,
      'medianStake', null,
      'uniqueParticipants', 0,
      'queueEntries', 0,
      'currentPlayerHasCreatedDuel', false,
      'currentPlayerCreatedDuelId', null,
      'currentPlayerQueuedCount', 0,
      'currentPlayerCanCreate', false
    )
  );
end;
$$;

create or replace function public.create_duel_view(
  p_prediction_id uuid,
  p_challenger_player_id uuid,
  p_bet_id uuid,
  p_stake_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_duel public.duels%rowtype;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  select * into v_duel
  from public.create_duel(
    p_prediction_id,
    p_challenger_player_id,
    p_bet_id,
    p_stake_amount
  );

  return private.get_duel_view_model(v_duel.id, v_auth_player_id);
end;
$$;

create or replace function public.join_duel_queue_view(
  p_duel_id uuid,
  p_player_id uuid,
  p_bet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_duel public.duels%rowtype;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  select * into v_duel
  from public.join_duel_queue(
    p_duel_id,
    p_player_id,
    p_bet_id
  );

  return private.get_duel_view_model(v_duel.id, v_auth_player_id);
end;
$$;

create or replace function public.cancel_duel_view(
  p_duel_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_duel public.duels%rowtype;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  select * into v_duel
  from public.cancel_duel(
    p_duel_id,
    p_player_id
  );

  return private.get_duel_view_model(v_duel.id, v_auth_player_id);
end;
$$;

grant execute on function public.get_prediction_duels_view(uuid) to authenticated;
grant execute on function public.get_prediction_duel_summary(uuid) to authenticated;
grant execute on function public.create_duel_view(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.join_duel_queue_view(uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_duel_view(uuid, uuid) to authenticated;

revoke all on function private.get_duel_view_model(uuid, uuid) from public;
revoke all on function private.get_duel_view_model(uuid, uuid) from authenticated;
