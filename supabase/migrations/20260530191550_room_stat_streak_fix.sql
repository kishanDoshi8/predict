create or replace function public.get_room_weekly_leaderboard(p_room_id uuid)
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
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1
    from public.room_members
    where room_id = p_room_id
      and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  select json_agg(lb order by lb.rank)
  into v_result
  from (
    select
      rm.player_id,
      p.username,
      coalesce(s.weekly_total_won, 0) as total_won_in_room,
      rm.joined_at,
      rm.is_organizer,
      rm.current_streak,
      rm.highest_streak,
      coalesce(s.total_bets, 0) as total_bets,
      coalesce(s.total_revealed_bets, 0) as total_revealed_bets,
      coalesce(s.winning_bets, 0) as winning_bets,
      coalesce(s.total_wagered, 0) as total_wagered,
      coalesce(s.total_payout, 0) as total_payout,
      coalesce(s.total_payout, 0) - coalesce(s.total_wagered, 0) as net_points,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          round((coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets) * 100, 1)
        else 0
      end as win_percentage,
      rank() over (
        order by
          coalesce(s.weekly_total_won, 0) desc,
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
        count(*) as total_bets,
        count(*) as total_revealed_bets,
        count(*) filter (
          where b.option_id = pred.winning_option_id
        ) as winning_bets,
        sum(b.amount) as total_wagered,
        sum(coalesce(b.payout, 0)) as total_payout,
        sum(greatest(coalesce(b.payout, 0) - b.amount, 0)) as weekly_total_won
      from public.bets b
      join public.predictions pred on pred.id = b.prediction_id
      where pred.room_id = p_room_id
        and pred.status = 'revealed'
        and pred.resolved_at is not null
        and to_char(pred.resolved_at at time zone 'UTC', 'IYYY"-W"IW') = private.current_week_key()
      group by b.player_id
    ) s on s.player_id = rm.player_id
    where rm.room_id = p_room_id
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;


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
      rm.current_streak,
      rm.highest_streak,
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

create or replace view public.player_rooms_by_activity as
select distinct on (rm.player_id, r.id)
  rm.player_id,
  r.id as room_id,
  r.name,
  r.room_code,
  r.status,              -- 🌟 Added
  r.predictions_limit,    -- 🌟 Added
  r.created_at,
  -- 1. Compute the latest activity timestamp
  p.created_at as latest_prediction_at,
  -- 2. Dynamically count total room members
  (
    select count(*)::int 
    from public.room_members sub_rm 
    where sub_rm.room_id = r.id
  ) as member_count,
  -- 3. Dynamically count active predictions
  (
    select count(*)::int 
    from public.predictions sub_p 
    where sub_p.room_id = r.id 
      and sub_p.status in ('draft', 'locked')
  ) as active_prediction_count
from public.room_members rm
join public.rooms r on r.id = rm.room_id
left join public.predictions p on p.room_id = r.id
order by rm.player_id, r.id, p.created_at desc;


alter table public.player_room_stats enable row level security;
alter table public.room_stats enable row level security;