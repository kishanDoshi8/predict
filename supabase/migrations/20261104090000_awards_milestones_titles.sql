-- ============================================================
-- Migration: awards_milestones_titles
-- Description: Four new series awards (Sharpshooter, Underdog, Comeback,
--   Hot Finish), personal career milestones kept apart from awards, and a
--   play-style RPC behind the titles under a player's name. Milestones are
--   backfilled quietly (no activity posts); new awards apply to series that
--   complete from now on.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New award types
-- ------------------------------------------------------------
alter type public.series_award_type add value if not exists 'SHARPSHOOTER';
alter type public.series_award_type add value if not exists 'UNDERDOG';
alter type public.series_award_type add value if not exists 'COMEBACK';
alter type public.series_award_type add value if not exists 'HOT_FINISH';

-- ------------------------------------------------------------
-- 2. Tier helpers (adds the finish window and the new award tiers)
-- ------------------------------------------------------------
-- How much a finished series' trophies are worth, from its size.
-- Players counts only those who qualified (see private.series_required_bets).
create or replace function private.series_tier(
  p_games integer,
  p_players integer
)
returns text
language sql
immutable
set search_path = public, private
as $$
  select case
    when coalesce(p_games, 0) <= 7 or coalesce(p_players, 0) <= 2 then 'minor'
    when p_games >= 20 and p_players >= 5 then 'major'
    else 'standard'
  end;
$$;

-- How many of a series' last settled predictions count as its finish.
create or replace function private.series_finish_window(
  p_games integer
)
returns integer
language sql
immutable
set search_path = public, private
as $$
  select greatest(3, ceil(coalesce(p_games, 0) * 0.25))::int;
$$;

-- How impressive an award was for its series: gold, silver or bronze.
-- Compares the type as text so new award types can be added and used in one migration.
create or replace function private.series_award_tier(
  p_award_type public.series_award_type,
  p_value numeric,
  p_games integer,
  p_starting_stack integer
)
returns text
language sql
immutable
set search_path = public, private
as $$
  select case p_award_type::text
    when 'LONGEST_STREAK' then case
      when p_value >= 4 and p_value >= 0.25 * greatest(p_games, 1) then 'gold'
      when p_value >= 3 and p_value >= 0.15 * greatest(p_games, 1) then 'silver'
      else 'bronze'
    end
    when 'BIGGEST_PROFIT' then case
      when p_value >= 1.0 * greatest(p_starting_stack, 1) then 'gold'
      when p_value >= 0.5 * greatest(p_starting_stack, 1) then 'silver'
      else 'bronze'
    end
    when 'MOST_POINTS_RISKED' then case
      when p_value >= 5 * greatest(p_starting_stack, 1) then 'gold'
      when p_value >= 2 * greatest(p_starting_stack, 1) then 'silver'
      else 'bronze'
    end
    when 'EVER_PRESENT' then case
      when p_value >= 20 then 'gold'
      when p_value >= 10 then 'silver'
      else 'bronze'
    end
    when 'MOST_DUEL_WINS' then case
      when p_value >= 0.25 * greatest(p_games, 1) then 'gold'
      when p_value >= 0.10 * greatest(p_games, 1) then 'silver'
      else 'bronze'
    end
    -- Win rate, as a percentage of settled bets.
    when 'SHARPSHOOTER' then case
      when p_value >= 75 then 'gold'
      when p_value >= 60 then 'silver'
      else 'bronze'
    end
    -- Payout multiplier of the winning bet.
    when 'UNDERDOG' then case
      when p_value >= 5 then 'gold'
      when p_value >= 3 then 'silver'
      else 'bronze'
    end
    -- Places climbed from the lowest weekly rank.
    when 'COMEBACK' then case
      when p_value >= 5 then 'gold'
      when p_value >= 3 then 'silver'
      else 'bronze'
    end
    -- Wins over the final stretch (see private.series_finish_window).
    when 'HOT_FINISH' then case
      when p_value >= private.series_finish_window(p_games) then 'gold'
      when p_value >= 0.75 * private.series_finish_window(p_games) then 'silver'
      else 'bronze'
    end
    else 'bronze'
  end;
$$;

revoke execute on function private.series_finish_window(integer) from public, anon, authenticated;
revoke execute on function private.series_award_tier(public.series_award_type, numeric, integer, integer) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Career milestones
-- ------------------------------------------------------------
-- Career milestones: personal bars a player clears once per room, apart from
-- the competitive series awards. Granted by private.award_milestones.
create table if not exists public.room_member_milestones (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  milestone_type text not null check (milestone_type in (
    'FIRST_TITLE', 'HAT_TRICK', 'BACK_TO_BACK', 'CENTURY', 'MOONSHOT', 'IRON_SEASON'
  )),
  -- When the bar was first cleared, and the series it was cleared in, if any.
  achieved_at timestamptz not null,
  series_id uuid references public.series(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (room_id, player_id, milestone_type)
);

create index if not exists idx_room_member_milestones_room_player
  on public.room_member_milestones (room_id, player_id, achieved_at desc);

alter table public.room_member_milestones enable row level security;
revoke all on public.room_member_milestones from anon;
revoke insert, update, delete, truncate, references, trigger on public.room_member_milestones from authenticated;
drop policy if exists "room_member_milestones_select" on public.room_member_milestones;
create policy "room_member_milestones_select" on public.room_member_milestones
  for select to authenticated using (private.is_room_member(room_id));
grant select (id, room_id, player_id, milestone_type, achieved_at, series_id, created_at)
  on public.room_member_milestones to authenticated;

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

drop trigger if exists trg_predictions_award_milestones on public.predictions;
create trigger trg_predictions_award_milestones
after update of status on public.predictions
for each row
when (new.status = 'revealed' and old.status is distinct from 'revealed')
execute function private.on_prediction_revealed_milestones();

revoke execute on function private.award_milestones(uuid, uuid[], boolean) from public, anon, authenticated;
revoke execute on function private.on_prediction_revealed_milestones() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Completing a series hands out the new awards and milestones
-- ------------------------------------------------------------
create or replace function public.complete_series(
  p_series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_series public.series%rowtype;
  v_unfinished_predictions integer;
  v_required_bets integer;
  v_completed_predictions integer;
  v_eligible_players integer;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select s.* into v_series
  from public.series s
  join public.room_members rm
    on rm.room_id = s.room_id
   and rm.player_id = v_player_id
   and rm.role in ('owner', 'organizer')
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  if v_series.status <> 'active' then
    raise exception 'Only active series can be completed' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.series_placements sp where sp.series_id = p_series_id
  ) or exists (
    select 1 from public.series_awards sa where sa.series_id = p_series_id
  ) then
    raise exception 'Series final results already exist' using errcode = 'P0001';
  end if;

  select count(*)::int
  into v_unfinished_predictions
  from public.predictions p
  where p.series_id = p_series_id
    and p.status in ('draft', 'locked');

  if v_unfinished_predictions > 0 then
    raise exception 'Series has unfinished predictions and cannot be completed' using errcode = 'P0001';
  end if;

  -- The same bar decides who can place and who can win awards.
  v_required_bets := private.series_required_bets(p_series_id);

  select count(*)::int
  into v_completed_predictions
  from public.predictions p
  where p.series_id = p_series_id
    and p.status in ('revealed', 'no_result');

  -- Players who qualified, which (with games) sets how much the series' trophies are worth.
  select count(*)::int
  into v_eligible_players
  from (
    select b.player_id
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
    having count(distinct b.prediction_id) >= v_required_bets
  ) eligible;

  insert into public.series_placements (series_id, player_id, placement, points)
  with leaderboard as (
    select
      rm.player_id,
      coalesce(w.balance, v_series.starting_stack + coalesce(stats.net_profit, 0))::numeric as balance,
      coalesce(w.balance - w.granted, coalesce(stats.net_profit, 0))::numeric as net_profit
    from public.room_members rm
    left join public.series_wallets w
      on w.series_id = p_series_id
     and w.player_id = rm.player_id
    left join private.get_leaderboard_player_stats(
      v_series.room_id,
      p_series_id,
      false
    ) stats on stats.player_id = rm.player_id
    where rm.room_id = v_series.room_id
      -- Only players who bet on enough settled predictions can place.
      and coalesce(stats.total_bets, 0) >= v_required_bets
  ),
  -- The final balance decides the title; placements record net profit for the Hall of Fame.
  ranked as (
    select
      l.player_id,
      l.net_profit,
      rank() over (order by l.balance desc) as placement
    from leaderboard l
  )
  select
    p_series_id,
    r.player_id,
    r.placement,
    r.net_profit
  from ranked r
  where r.placement <= 3;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with series_predictions as (
    select
      p.id,
      p.status,
      p.series_prediction_number,
      p.created_at,
      p.winning_option_id
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp
      on sp.id = b.prediction_id
     and sp.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  revealed_player_results as (
    select
      b.player_id,
      coalesce(sp.series_prediction_number, 2147483647) as sort_number,
      sp.created_at,
      sp.id as prediction_id,
      (b.option_id = sp.winning_option_id) as is_win
    from public.bets b
    join series_predictions sp
      on sp.id = b.prediction_id
     and sp.status = 'revealed'
     and sp.winning_option_id is not null
    join eligible_players ep on ep.player_id = b.player_id
  ),
  win_groups as (
    select
      rpr.player_id,
      rpr.sort_number,
      rpr.created_at,
      rpr.prediction_id,
      rpr.is_win,
      sum(case when rpr.is_win then 0 else 1 end) over (
        partition by rpr.player_id
        order by rpr.sort_number asc, rpr.created_at asc, rpr.prediction_id asc
      ) as loss_group
    from revealed_player_results rpr
  ),
  streak_runs as (
    select
      wg.player_id,
      wg.is_win,
      row_number() over (
        partition by wg.player_id, wg.loss_group
        order by wg.sort_number asc, wg.created_at asc, wg.prediction_id asc
      ) as win_run
    from win_groups wg
  ),
  player_streaks as (
    select
      sr.player_id,
      coalesce(
        max(
          case
            when sr.is_win then sr.win_run
            else 0
          end
        ),
        0
      )::numeric as award_value
    from streak_runs sr
    group by sr.player_id
  ),
  top_value as (
    select max(ps.award_value) as value
    from player_streaks ps
  )
  select
    p_series_id,
    ps.player_id,
    'LONGEST_STREAK'::public.series_award_type,
    ps.award_value,
    'Achieved the longest winning streak in this Series.',
    private.series_award_tier('LONGEST_STREAK', ps.award_value, v_completed_predictions, v_series.starting_stack)
  from player_streaks ps
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and ps.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with series_predictions as (
    select p.id, p.status
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp
      on sp.id = b.prediction_id
     and sp.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  player_biggest_profit as (
    select
      b.player_id,
      max(greatest(coalesce(b.payout, 0) - b.amount, 0))::numeric as award_value
    from public.bets b
    join series_predictions sp on sp.id = b.prediction_id
    join eligible_players ep on ep.player_id = b.player_id
    group by b.player_id
  ),
  top_value as (
    select max(pbp.award_value) as value
    from player_biggest_profit pbp
  )
  select
    p_series_id,
    pbp.player_id,
    'BIGGEST_PROFIT'::public.series_award_type,
    pbp.award_value,
    'Recorded the biggest single prediction profit.',
    private.series_award_tier('BIGGEST_PROFIT', pbp.award_value, v_completed_predictions, v_series.starting_stack)
  from player_biggest_profit pbp
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and pbp.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with series_predictions as (
    select p.id, p.winning_option_id
    from public.predictions p
    where p.series_id = p_series_id
      and p.status = 'revealed'
      and p.winning_option_id is not null
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  duel_wins as (
    select
      winner.player_id,
      count(*)::numeric as award_value
    from public.duels d
    join series_predictions sp on sp.id = d.prediction_id
    join public.bets challenger_bet on challenger_bet.id = d.challenger_bet_id
    join public.bets opponent_bet on opponent_bet.id = d.matched_opponent_bet_id
    join lateral (
      select case
        when challenger_bet.option_id = sp.winning_option_id then d.challenger_player_id
        else d.matched_opponent_player_id
      end as player_id
    ) winner on true
    join eligible_players ep on ep.player_id = winner.player_id
    where d.status = 'resolved'
    group by winner.player_id
  ),
  top_value as (
    select max(dw.award_value) as value
    from duel_wins dw
  )
  select
    p_series_id,
    dw.player_id,
    'MOST_DUEL_WINS'::public.series_award_type,
    dw.award_value,
    'Won the most duels during this Series.',
    private.series_award_tier('MOST_DUEL_WINS', dw.award_value, v_completed_predictions, v_series.starting_stack)
  from duel_wins dw
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and dw.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with series_predictions as (
    select p.id, p.status
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp
      on sp.id = b.prediction_id
     and sp.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  points_risked as (
    select
      b.player_id,
      sum(b.amount)::numeric as award_value
    from public.bets b
    join series_predictions sp on sp.id = b.prediction_id
    join eligible_players ep on ep.player_id = b.player_id
    group by b.player_id
  ),
  top_value as (
    select max(pr.award_value) as value
    from points_risked pr
  )
  select
    p_series_id,
    pr.player_id,
    'MOST_POINTS_RISKED'::public.series_award_type,
    pr.award_value,
    'Risked the most points during this Series.',
    private.series_award_tier('MOST_POINTS_RISKED', pr.award_value, v_completed_predictions, v_series.starting_stack)
  from points_risked pr
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and pr.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with completed_predictions as (
    select p.id
    from public.predictions p
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct p.id)::int as prediction_count
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  player_completed_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as completed_prediction_count
    from public.bets b
    join completed_predictions cp on cp.id = b.prediction_id
    group by b.player_id
  )
  select
    p_series_id,
    ep.player_id,
    'EVER_PRESENT'::public.series_award_type,
    v_completed_predictions::numeric,
    'Participated in every completed prediction.',
    private.series_award_tier('EVER_PRESENT', v_completed_predictions::numeric, v_completed_predictions, v_series.starting_stack)
  from eligible_players ep
  left join player_completed_participation pcp on pcp.player_id = ep.player_id
  where v_completed_predictions > 0
    and coalesce(pcp.completed_prediction_count, 0) = v_completed_predictions;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with
  eligible_players as (
    select b.player_id
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
    having count(distinct b.prediction_id) >= v_required_bets
  ),
  -- Share of their settled bets that won, as a percentage.
  candidates as (
    select
      b.player_id,
      round(100.0 * count(*) filter (where b.option_id = p.winning_option_id) / count(*), 1) as award_value
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    join eligible_players ep on ep.player_id = b.player_id
    where p.series_id = p_series_id
      and p.status = 'revealed'
      and p.winning_option_id is not null
    group by b.player_id
    having count(*) >= greatest(v_required_bets, 3)
  ),
  top_value as (
    select max(c.award_value) as value
    from candidates c
  )
  select
    p_series_id,
    c.player_id,
    'SHARPSHOOTER'::public.series_award_type,
    c.award_value,
    'Called the highest share of results in this Series.',
    private.series_award_tier('SHARPSHOOTER', c.award_value, v_completed_predictions, v_series.starting_stack)
  from candidates c
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and c.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with
  eligible_players as (
    select b.player_id
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
    having count(distinct b.prediction_id) >= v_required_bets
  ),
  -- The longest odds they won at: the whole pool over the stake on the winning side.
  odds as (
    select
      p.id,
      p.winning_option_id,
      sum(b.amount)::numeric / nullif(sum(b.amount) filter (where b.option_id = p.winning_option_id), 0) as value
    from public.predictions p
    join public.bets b on b.prediction_id = p.id
    where p.series_id = p_series_id
      and p.status = 'revealed'
    group by p.id, p.winning_option_id
  ),
  candidates as (
    select
      b.player_id,
      max(round(o.value, 2)) as award_value
    from public.bets b
    join odds o on o.id = b.prediction_id and b.option_id = o.winning_option_id
    join eligible_players ep on ep.player_id = b.player_id
    group by b.player_id
  ),
  top_value as (
    select max(c.award_value) as value
    from candidates c
  )
  select
    p_series_id,
    c.player_id,
    'UNDERDOG'::public.series_award_type,
    c.award_value,
    'Won against the longest odds in this Series.',
    private.series_award_tier('UNDERDOG', c.award_value, v_completed_predictions, v_series.starting_stack)
  from candidates c
  cross join top_value tv
  where tv.value is not null
    and tv.value >= 2
    and c.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with
  eligible_players as (
    select b.player_id
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
    having count(distinct b.prediction_id) >= v_required_bets
  ),
  -- Places climbed from their lowest weekly rank to where they finished.
  final_ranks as (
    select st.player_id, st.rank
    from private.series_standings(p_series_id) st
    where st.is_ranked
  ),
  lowest_ranks as (
    select ss.player_id, max(ss.rank) as rank
    from public.series_standing_snapshots ss
    where ss.series_id = p_series_id
      and ss.is_ranked
      and ss.rank is not null
    group by ss.player_id
  ),
  candidates as (
    select fr.player_id, (lr.rank - fr.rank)::numeric as award_value
    from final_ranks fr
    join lowest_ranks lr on lr.player_id = fr.player_id
    join eligible_players ep on ep.player_id = fr.player_id
  ),
  top_value as (
    select max(c.award_value) as value
    from candidates c
  )
  select
    p_series_id,
    c.player_id,
    'COMEBACK'::public.series_award_type,
    c.award_value,
    'Climbed the most places from their lowest point in this Series.',
    private.series_award_tier('COMEBACK', c.award_value, v_completed_predictions, v_series.starting_stack)
  from candidates c
  cross join top_value tv
  where tv.value is not null
    and tv.value >= 2
    and c.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description, tier)
  with
  eligible_players as (
    select b.player_id
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
    having count(distinct b.prediction_id) >= v_required_bets
  ),
  -- Wins over the series' last few settled predictions.
  finish as (
    select p.id, p.winning_option_id
    from public.predictions p
    where p.series_id = p_series_id
      and p.status = 'revealed'
      and p.winning_option_id is not null
    order by coalesce(p.series_prediction_number, 2147483647) desc, p.created_at desc, p.id desc
    limit private.series_finish_window(v_completed_predictions)
  ),
  candidates as (
    select b.player_id, count(*)::numeric as award_value
    from public.bets b
    join finish f on f.id = b.prediction_id
    join eligible_players ep on ep.player_id = b.player_id
    where b.option_id = f.winning_option_id
    group by b.player_id
  ),
  top_value as (
    select max(c.award_value) as value
    from candidates c
  )
  select
    p_series_id,
    c.player_id,
    'HOT_FINISH'::public.series_award_type,
    c.award_value,
    'Won the most predictions in the final stretch of this Series.',
    private.series_award_tier('HOT_FINISH', c.award_value, v_completed_predictions, v_series.starting_stack)
  from candidates c
  cross join top_value tv
  where tv.value is not null
    and v_completed_predictions >= 6 and tv.value >= 2
    and c.award_value = tv.value;

  update public.series
  set
    status = 'completed',
    completed_at = now(),
    final_games = v_completed_predictions,
    final_players = v_eligible_players,
    tier = private.series_tier(v_completed_predictions, v_eligible_players)
  where id = p_series_id
  returning * into v_series;

  -- Titles, back-to-backs and Ever-Present seasons can unlock career milestones.
  perform private.award_milestones(v_series.room_id);

  return row_to_json(v_series);
end;
$$;

-- ------------------------------------------------------------
-- 5. Play-style titles
-- ------------------------------------------------------------
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

revoke execute on function public.get_room_member_style(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_room_member_style(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Backfill milestones, without posting them to the feed
-- ------------------------------------------------------------
select private.award_milestones(r.id, null, false)
from public.rooms r;
