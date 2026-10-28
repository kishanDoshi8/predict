-- How a player plays in a room: the play-style titles they hold right now.
-- Sharpshooter, High Roller and Giant Killer go to the room's top player (ties
-- share); Ever-Present goes to anyone who bets on nearly every prediction.
create or replace function public.get_room_member_style(
  p_room_id uuid,
  p_player_id uuid
)
returns json
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_result json;
begin
  v_caller_id := private.get_player_id_from_auth();

  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.player_id = v_caller_id
  ) then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  with members as (
    select rm.player_id, rm.joined_at
    from public.room_members rm
    where rm.room_id = p_room_id
  ),
  settled as (
    select p.id, p.created_at, p.status, p.winning_option_id
    from public.predictions p
    where p.room_id = p_room_id
      and p.status in ('revealed', 'no_result')
  ),
  room_bets as (
    select
      b.id, b.player_id, b.option_id, b.amount, s.status, s.winning_option_id,
      -- The odds the room gave this side: the whole pool over its stake.
      sum(b.amount) over (partition by b.prediction_id)::numeric
        / nullif(sum(b.amount) over (partition by b.prediction_id, b.option_id), 0) as odds
    from public.bets b
    join settled s on s.id = b.prediction_id
  ),
  measures as (
    select
      m.player_id,
      count(rb.id) filter (where rb.status = 'revealed' and rb.winning_option_id is not null) as revealed_bets,
      count(rb.id) filter (where rb.option_id = rb.winning_option_id) as wins,
      count(rb.id) filter (where rb.option_id = rb.winning_option_id and rb.odds >= 4) as long_wins,
      coalesce(sum(rb.amount), 0) as risked,
      count(rb.id) as settled_bets,
      (select count(*) from settled s where s.created_at >= m.joined_at) as settled_since_joined
    from members m
    left join room_bets rb on rb.player_id = m.player_id
    group by m.player_id, m.joined_at
  ),
  rated as (
    select
      ms.*,
      case when ms.revealed_bets >= 20 then ms.wins::numeric / ms.revealed_bets end as win_rate
    from measures ms
  ),
  holders as (
    select 'SHARPSHOOTER' as title, r.player_id
    from rated r
    where r.win_rate is not null
      and r.win_rate = (select max(win_rate) from rated)

    union all
    select 'HIGH_ROLLER', r.player_id
    from rated r
    where r.settled_bets >= 10
      and r.risked = (select max(risked) from rated where settled_bets >= 10)

    union all
    select 'EVER_PRESENT', r.player_id
    from rated r
    where r.settled_since_joined >= 20
      and r.settled_bets >= 0.9 * r.settled_since_joined

    union all
    select 'GIANT_KILLER', r.player_id
    from rated r
    where r.long_wins >= 3
      and r.long_wins = (select max(long_wins) from rated)
  )
  select json_build_object(
    'titles', coalesce(
      (select json_agg(h.title order by h.title) from holders h where h.player_id = p_player_id),
      '[]'::json
    )
  )
  into v_result;

  return v_result;
end;
$$;
