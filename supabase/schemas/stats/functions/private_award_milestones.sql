-- Grants any career milestones a room's players have cleared and not yet been
-- given. Safe to run any number of times. p_player_ids narrows it to some
-- players; p_announce posts each new milestone to the room's activity feed.
create or replace function private.award_milestones(
  p_room_id uuid,
  p_player_ids uuid[] default null,
  p_announce boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    with titles as (
      select
        sp.player_id,
        s.id as series_id,
        s.completed_at,
        row_number() over (partition by sp.player_id order by s.completed_at, s.id) as title_number
      from public.series_placements sp
      join public.series s on s.id = sp.series_id
      where s.room_id = p_room_id
        and s.completed_at is not null
        and sp.placement = 1
        and (p_player_ids is null or sp.player_id = any(p_player_ids))
    ),
    finished as (
      select
        s.id,
        lag(s.id) over (order by s.completed_at, s.id) as previous_id
      from public.series s
      where s.room_id = p_room_id
        and s.completed_at is not null
    ),
    room_bets as (
      select
        b.player_id,
        b.amount,
        b.payout,
        b.placed_at,
        b.option_id,
        p.status,
        p.winning_option_id,
        p.series_id,
        coalesce(p.resolved_at, b.updated_at) as settled_at,
        -- The odds the room gave this side: the whole pool over its stake.
        sum(b.amount) over (partition by p.id)::numeric
          / nullif(sum(b.amount) over (partition by p.id, b.option_id), 0) as odds
      from public.bets b
      join public.predictions p on p.id = b.prediction_id
      where p.room_id = p_room_id
        and p.status <> 'cancelled'
    ),
    -- Filtered after the odds are worked out, so they cover every bettor.
    player_bets as (
      select rb.*
      from room_bets rb
      where p_player_ids is null or rb.player_id = any(p_player_ids)
    ),
    candidates as (
      select t.player_id, 'FIRST_TITLE' as milestone_type, t.completed_at as achieved_at, t.series_id
      from titles t
      where t.title_number = 1

      union all
      select t.player_id, 'HAT_TRICK', t.completed_at, t.series_id
      from titles t
      where t.title_number = 3

      union all
      (
        select distinct on (t.player_id) t.player_id, 'BACK_TO_BACK', t.completed_at, t.series_id
        from titles t
        join finished f on f.id = t.series_id
        join titles prev on prev.player_id = t.player_id and prev.series_id = f.previous_id
        order by t.player_id, t.completed_at
      )

      union all
      select rb.player_id, 'CENTURY', rb.placed_at, rb.series_id
      from (
        select
          pb.*,
          row_number() over (partition by pb.player_id order by pb.placed_at) as bet_number
        from player_bets pb
      ) rb
      where rb.bet_number = 100

      union all
      (
        select distinct on (rb.player_id) rb.player_id, 'MOONSHOT', rb.settled_at, rb.series_id
        from player_bets rb
        where rb.status = 'revealed'
          and rb.option_id = rb.winning_option_id
          and rb.odds >= 10
        order by rb.player_id, rb.settled_at
      )

      union all
      (
        select distinct on (sa.player_id) sa.player_id, 'IRON_SEASON', s.completed_at, s.id
        from public.series_awards sa
        join public.series s on s.id = sa.series_id
        where s.room_id = p_room_id
          and sa.award_type = 'EVER_PRESENT'
          and coalesce(s.final_games, 0) >= 10
          and (p_player_ids is null or sa.player_id = any(p_player_ids))
        order by sa.player_id, s.completed_at
      )
    ),
    inserted as (
      insert into public.room_member_milestones (room_id, player_id, milestone_type, achieved_at, series_id)
      select p_room_id, c.player_id, c.milestone_type, c.achieved_at, c.series_id
      from candidates c
      -- Only current members collect milestones.
      join public.room_members rm on rm.room_id = p_room_id and rm.player_id = c.player_id
      on conflict (room_id, player_id, milestone_type) do nothing
      returning player_id, milestone_type, series_id
    )
    select i.player_id, i.milestone_type, i.series_id, pl.username
    from inserted i
    join public.players pl on pl.id = i.player_id
  loop
    v_count := v_count + 1;

    if p_announce then
      perform private.create_room_activity(
        p_room_id := p_room_id,
        p_activity_type := 'achievement_milestone',
        p_activity_tier := 2,
        p_metadata := jsonb_build_object(
          'member', jsonb_build_object('id', v_row.player_id, 'username', v_row.username),
          'milestoneType', v_row.milestone_type,
          'seriesId', v_row.series_id
        ),
        p_created_by_player_id := v_row.player_id,
        p_dedupe_key := 'milestone:' || v_row.player_id::text || ':' || v_row.milestone_type
      );
    end if;
  end loop;

  return v_count;
end;
$$;

-- A revealed prediction can unlock Century and Moonshot for its bettors.
create or replace function private.on_prediction_revealed_milestones()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.award_milestones(
    new.room_id,
    array(select b.player_id from public.bets b where b.prediction_id = new.id)
  );
  return new;
end;
$$;
