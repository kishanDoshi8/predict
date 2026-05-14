-- ============================================================
-- Migration: 019_leaderboard_and_history_rpcs
-- Description:
--   Adds two RPCs for the room leaderboard feature:
--     1. get_room_leaderboard  — ranked member stats for a room
--     2. get_room_prediction_history — resolved predictions feed
--   Both validate room membership via auth.uid().
-- ============================================================

-- ============================================================
-- Index: speed up per-room bet aggregation
-- ============================================================
create index if not exists idx_bets_prediction_player
  on public.bets (prediction_id, player_id);

create index if not exists idx_predictions_room_resolved
  on public.predictions (room_id, status, resolved_at desc)
  where status in ('revealed', 'cancelled', 'no_result');

-- ============================================================
-- RPC: get_room_leaderboard
-- Returns ranked room members with per-room and global stats.
-- Validates that the caller is a member of the requested room.
-- ============================================================
create or replace function public.get_room_leaderboard(p_room_id uuid)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result    json;
begin
  -- Resolve caller from JWT
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  -- Enforce room membership
  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  -- Build ranked leaderboard
  select json_agg(lb order by lb.rank)
  into v_result
  from (
    select
      rm.player_id,
      p.username,
      rm.total_won_in_room,
      rm.joined_at,
      rm.is_organizer,
      p.current_streak,
      p.longest_streak,
      -- Bet aggregates scoped to this room
      coalesce(s.total_bets,         0)  as total_bets,
      coalesce(s.total_revealed_bets,0)  as total_revealed_bets,
      coalesce(s.winning_bets,       0)  as winning_bets,
      coalesce(s.total_wagered,      0)  as total_wagered,
      coalesce(s.total_payout,       0)  as total_payout,
      -- Net gain/loss in this room
      coalesce(s.total_payout, 0) - coalesce(s.total_wagered, 0) as net_points,
      -- Win percentage over revealed predictions only
      case
        when coalesce(s.total_revealed_bets, 0) > 0
          then round(
            (coalesce(s.winning_bets, 0)::numeric
              / s.total_revealed_bets) * 100,
            1
          )
        else 0
      end as win_percentage,
      -- Rank: primary = most points won, secondary = win rate, tertiary = earliest join
      rank() over (
        order by
          rm.total_won_in_room desc,
          case
            when coalesce(s.total_revealed_bets, 0) > 0
              then (coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets)
            else 0
          end desc,
          rm.joined_at asc
      ) as rank
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join (
      select
        b.player_id,
        count(*)                                                                  as total_bets,
        count(*) filter (where pred.status = 'revealed')                          as total_revealed_bets,
        count(*) filter (
          where pred.status = 'revealed'
            and b.option_id = pred.winning_option_id
        )                                                                          as winning_bets,
        sum(b.amount)                                                              as total_wagered,
        sum(coalesce(b.payout, 0))                                                 as total_payout
      from public.bets b
      join public.predictions pred on pred.id = b.prediction_id
      where pred.room_id = p_room_id
        and pred.status in ('revealed', 'cancelled', 'no_result')
      group by b.player_id
    ) s on s.player_id = rm.player_id
    where rm.room_id = p_room_id
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;

grant execute on function public.get_room_leaderboard(uuid) to authenticated;


-- ============================================================
-- RPC: get_room_prediction_history
-- Returns resolved predictions for a room (newest first).
-- Includes options, pool, creator, winner stats.
-- Validates that the caller is a member of the requested room.
-- ============================================================
create or replace function public.get_room_prediction_history(
  p_room_id uuid,
  p_limit   int default 20,
  p_offset  int default 0
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result    json;
begin
  -- Resolve caller from JWT
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  -- Enforce room membership
  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  -- Clamp pagination params
  p_limit  := greatest(1, least(p_limit,  100));
  p_offset := greatest(0, p_offset);

  select json_agg(h)
  into v_result
  from (
    select
      pred.id             as prediction_id,
      pred.title,
      pred.status,
      pred.resolved_at,
      pred.created_at,
      pred.winning_option_id,
      creator.username    as creator_username,
      winning_opt.label   as winning_option_label,
      -- Total pool for this prediction
      (
        select coalesce(sum(po.total_bet), 0)
        from public.prediction_options po
        where po.prediction_id = pred.id
      )                   as total_pool,
      -- Bet counts
      coalesce(bs.total_bets,   0) as total_bets,
      coalesce(bs.winner_count, 0) as winner_count,
      -- Options snapshot (for visualization)
      (
        select json_agg(
          json_build_object(
            'id',            po2.id,
            'label',         po2.label,
            'total_bet',     po2.total_bet,
            'display_order', po2.display_order
          ) order by po2.display_order
        )
        from public.prediction_options po2
        where po2.prediction_id = pred.id
      )                   as options
    from public.predictions pred
    join public.players creator on creator.id = pred.created_by
    left join public.prediction_options winning_opt
      on winning_opt.id = pred.winning_option_id
    left join (
      select
        b.prediction_id,
        count(*)                                                       as total_bets,
        count(*) filter (
          where pred2.status = 'revealed'
            and b.option_id = pred2.winning_option_id
        )                                                              as winner_count
      from public.bets b
      join public.predictions pred2 on pred2.id = b.prediction_id
      where pred2.room_id = p_room_id
        and pred2.status in ('revealed', 'cancelled', 'no_result')
      group by b.prediction_id
    ) bs on bs.prediction_id = pred.id
    where pred.room_id = p_room_id
      and pred.status in ('revealed', 'cancelled', 'no_result')
    order by pred.resolved_at desc nulls last, pred.created_at desc
    limit p_limit
    offset p_offset
  ) h;

  return coalesce(v_result, '[]'::json);
end;
$$;

grant execute on function public.get_room_prediction_history(uuid, int, int) to authenticated;
