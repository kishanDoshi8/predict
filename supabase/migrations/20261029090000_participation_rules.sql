-- ============================================================
-- Migration: participation_rules
-- Description: Doing nothing no longer pays. Players must bet on a minimum
--   number of a series' settled predictions (set per series, default 3) to
--   be ranked, place or win awards; the rest show as "not ranked yet".
--   Weekly top-ups go only to players who bet that week, or who are broke.
--   Applies to running series straight away.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Series setting: the old awards minimum now also decides ranking
-- ------------------------------------------------------------
alter table public.series rename column minimum_predictions_for_awards to min_bets_to_rank;
update public.series set min_bets_to_rank = least(greatest(min_bets_to_rank, 0), 50);
alter table public.series
  add constraint series_min_bets_to_rank_check check (min_bets_to_rank between 0 and 50);

-- ------------------------------------------------------------
-- 2. Functions
-- ------------------------------------------------------------
-- Signatures gain the ranking bar; drop the old ones so calls aren't ambiguous.
drop function if exists public.create_series(uuid, text, text, integer, integer, integer);
drop function if exists public.update_series(uuid, text, text, integer, integer, integer);

-- How many settled predictions a player must have bet on to be ranked in a series.
-- Early on, the bar is capped at the number settled so far, so nobody is shut out.
create or replace function private.series_required_bets(
  p_series_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  select least(
    s.min_bets_to_rank,
    (
      select count(*)::int
      from public.predictions p
      where p.series_id = s.id
        and p.status in ('revealed', 'no_result')
    )
  )
  from public.series s
  where s.id = p_series_id;
$$;

create or replace function public.get_series_leaderboard(
  p_room_id uuid,
  p_series_id uuid,
  p_sort_by text default 'points'
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_series public.series%rowtype;
  v_required integer;
  v_result json;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  select * into v_series
  from public.series s
  where s.id = p_series_id
    and s.room_id = p_room_id;

  if not found then
    raise exception 'Series not found for this room' using errcode = 'P0002';
  end if;

  if p_sort_by not in ('points', 'rating', 'accuracy', 'streak') then
    raise exception 'Invalid sort mode: %', p_sort_by using errcode = 'P0001';
  end if;

  v_required := private.series_required_bets(p_series_id);

  with stats as (
    select *
    from private.get_leaderboard_player_stats(
      p_room_id,
      p_series_id,
      false
    )
  ),
  base_current as (
    select
      rm.player_id,
      p.username,
      coalesce(s.net_profit, 0) as total_won_in_room,
      -- Series that closed before wallets existed fall back to stack + profit.
      coalesce(w.balance, v_series.starting_stack + coalesce(s.net_profit, 0)::int) as balance,
      coalesce(w.balance - w.escrow, v_series.starting_stack + coalesce(s.net_profit, 0)::int) as available,
      coalesce(w.granted, v_series.starting_stack) as granted,
      rm.joined_at,
      rm.is_organizer,
      rm.current_streak,
      rm.highest_streak,
      rm.prediction_rating,
      rm.peak_prediction_rating,
      rm.rated_predictions_count,
      coalesce(s.total_bets, 0) as total_bets,
      coalesce(s.total_revealed_bets, 0) as total_revealed_bets,
      coalesce(s.winning_bets, 0) as winning_bets,
      coalesce(s.total_wagered, 0) as total_wagered,
      coalesce(s.total_payout, 0) as total_payout,
      coalesce(s.total_profit, 0) as total_profit,
      coalesce(s.total_loss, 0) as total_loss,
      coalesce(s.net_profit, 0) as net_points,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          round((coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets) * 100, 1)
        else 0
      end as win_percentage,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets
      end as accuracy_ratio,
      -- Only players who bet on enough settled predictions are ranked.
      coalesce(s.total_bets, 0) >= v_required as is_ranked,
      greatest(v_required - coalesce(s.total_bets, 0), 0)::int as bets_needed
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join stats s on s.player_id = rm.player_id
    left join public.series_wallets w on w.series_id = p_series_id and w.player_id = rm.player_id
    where rm.room_id = p_room_id
  ),
  ranked as (
    select
      bc.*,
      case when bc.is_ranked then rank() over (
        partition by bc.is_ranked
        order by
          case when p_sort_by = 'points' then bc.balance end desc nulls last,
          case when p_sort_by = 'points' then bc.winning_bets end desc nulls last,
          case when p_sort_by = 'rating' then bc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then bc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.total_revealed_bets end desc nulls last,
          case when p_sort_by = 'streak' then bc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then bc.highest_streak end desc nulls last,
          bc.joined_at asc nulls last
      ) end as rank
    from base_current bc
  )
  -- Ranked players first, then everyone still short of the bar, closest first.
  select json_agg(lb order by lb.rank nulls last, lb.bets_needed, lb.username, lb.player_id)
  into v_result
  from (
    select
      r.player_id,
      r.username,
      r.total_won_in_room,
      r.balance,
      r.available,
      r.granted,
      r.joined_at,
      r.is_organizer,
      r.current_streak,
      r.highest_streak,
      r.prediction_rating,
      r.peak_prediction_rating,
      r.rated_predictions_count,
      r.total_bets,
      r.total_revealed_bets,
      r.winning_bets,
      r.total_wagered,
      r.total_payout,
      r.net_points,
      r.net_points as net_profit,
      r.win_percentage,
      r.rank,
      r.is_ranked,
      r.bets_needed,
      v_required as required_bets,
      null::int as previous_rank,
      null::int as rank_change,
      null::numeric as previous_prediction_rating,
      null::numeric as rating_change,
      null::numeric as previous_total_won_in_room,
      null::numeric as points_change
    from ranked r
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;

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
   and rm.is_organizer = true
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

  insert into public.series_awards (series_id, player_id, award_type, value, description)
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
    'Achieved the longest winning streak in this Series.'
  from player_streaks ps
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and ps.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
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
    'Recorded the biggest single prediction profit.'
  from player_biggest_profit pbp
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and pbp.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
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
    'Won the most duels during this Series.'
  from duel_wins dw
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and dw.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
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
    'Risked the most points during this Series.'
  from points_risked pr
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and pr.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
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
    'Participated in every completed prediction.'
  from eligible_players ep
  left join player_completed_participation pcp on pcp.player_id = ep.player_id
  where v_completed_predictions > 0
    and coalesce(pcp.completed_prediction_count, 0) = v_completed_predictions;

  update public.series
  set
    status = 'completed',
    completed_at = now()
  where id = p_series_id
  returning * into v_series;

  return row_to_json(v_series);
end;
$$;

-- Run by the series-weekly-topup cron job every Monday.
-- Pays each active series' weekly top-up, at most once per ISO week, to the
-- players who bet in the series during the week that just ended. Players with
-- nothing left to bet with are topped up too, so going broke never locks
-- anyone out of a series.
create or replace function private.pay_series_topups()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_key   text := private.current_week_key();
  v_this_week  timestamptz := date_trunc('week', now() at time zone 'UTC') at time zone 'UTC';
  v_last_week  timestamptz := v_this_week - interval '7 days';
  v_series     record;
  v_paid       integer;
  v_count      integer := 0;
begin
  for v_series in
    select s.id, s.room_id, s.title, s.weekly_topup, r.room_code
    from public.series s
    join public.rooms r on r.id = s.room_id
    where s.status = 'active'
      and s.weekly_topup > 0
      and s.last_topup_week is distinct from v_week_key
    for update of s
  loop
    update public.series_wallets w
    set balance = w.balance + v_series.weekly_topup,
        granted = w.granted + v_series.weekly_topup,
        updated_at = now()
    where w.series_id = v_series.id
      and (
        w.balance - w.escrow <= 0
        or exists (
          select 1
          from public.bets b
          join public.predictions p on p.id = b.prediction_id
          where p.series_id = v_series.id
            and b.player_id = w.player_id
            and greatest(b.placed_at, b.updated_at) >= v_last_week
            and greatest(b.placed_at, b.updated_at) < v_this_week
        )
      );
    get diagnostics v_paid = row_count;

    -- Counts every week a top-up round ran, so late joiners start level with active players.
    update public.series
    set topups_paid = topups_paid + 1,
        last_topup_week = v_week_key
    where id = v_series.id;

    if v_paid > 0 then
      perform private.fire_push_notification(
        'weekly_points_claim',
        null,
        v_series.room_id,
        '+' || v_series.weekly_topup || ' points',
        'Weekly top-ups for ' || v_series.title || ' are in for everyone who played last week.',
        '/rooms/' || v_series.room_code
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.create_series(
  p_room_id uuid,
  p_title text,
  p_description text default null,
  p_expected_games integer default 0,
  p_starting_stack integer default 1000,
  p_weekly_topup integer default 100,
  p_min_bets_to_rank integer default 3
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_member public.room_members%rowtype;
  v_series public.series%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can manage series' using errcode = 'P0012';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Series title cannot be empty' using errcode = 'P0001';
  end if;

  if p_expected_games < 0 then
    raise exception 'Expected games cannot be negative' using errcode = 'P0001';
  end if;

  if p_starting_stack < 100 then
    raise exception 'Starting points must be at least 100' using errcode = 'P0001';
  end if;

  if p_weekly_topup < 0 then
    raise exception 'Weekly top-up cannot be negative' using errcode = 'P0001';
  end if;

  if p_min_bets_to_rank is null or p_min_bets_to_rank not between 0 and 50 then
    raise exception 'Minimum bets to be ranked must be between 0 and 50' using errcode = 'P0001';
  end if;

  insert into public.series (
    room_id,
    title,
    status,
    description,
    expected_games,
    created_by,
    started_at,
    starting_stack,
    weekly_topup,
    min_bets_to_rank,
    last_topup_week
  )
  values (
    p_room_id,
    trim(p_title),
    'active',
    nullif(trim(coalesce(p_description, '')), ''),
    p_expected_games,
    v_player_id,
    now(),
    p_starting_stack,
    p_weekly_topup,
    p_min_bets_to_rank,
    -- The first top-up is paid the Monday after the series starts.
    private.current_week_key()
  )
  returning * into v_series;

  perform private.ensure_series_wallet(v_series.id, rm.player_id)
  from public.room_members rm
  where rm.room_id = p_room_id;

  return row_to_json(v_series);
end;
$$;

create or replace function public.update_series(
  p_series_id uuid,
  p_title text,
  p_description text default null,
  p_expected_games integer default 0,
  p_starting_stack integer default null,
  p_weekly_topup integer default null,
  p_min_bets_to_rank integer default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_series public.series%rowtype;
  v_points_changed boolean;
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
   and rm.is_organizer = true
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  if v_series.status = 'archived' then
    raise exception 'Archived series are read-only' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Series title cannot be empty' using errcode = 'P0001';
  end if;

  if p_expected_games < 0 then
    raise exception 'Expected games cannot be negative' using errcode = 'P0001';
  end if;

  -- Unlike points, the ranking bar can change while a series runs: it moves no one's balance.
  if p_min_bets_to_rank is not null and p_min_bets_to_rank not between 0 and 50 then
    raise exception 'Minimum bets to be ranked must be between 0 and 50' using errcode = 'P0001';
  end if;

  if p_min_bets_to_rank is not null
    and p_min_bets_to_rank <> v_series.min_bets_to_rank
    and v_series.status not in ('draft', 'active') then
    raise exception 'Minimum bets to be ranked can only change before a series is closed' using errcode = 'P0001';
  end if;

  v_points_changed :=
    (p_starting_stack is not null and p_starting_stack <> v_series.starting_stack)
    or (p_weekly_topup is not null and p_weekly_topup <> v_series.weekly_topup);

  if v_points_changed then
    if v_series.status not in ('draft', 'active') then
      raise exception 'Points settings can only change before a series is closed' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.bets b
      join public.predictions p on p.id = b.prediction_id
      where p.series_id = p_series_id
    ) then
      raise exception 'Points settings can''t change once the series has bets' using errcode = 'P0001';
    end if;

    if coalesce(p_starting_stack, v_series.starting_stack) < 100 then
      raise exception 'Starting points must be at least 100' using errcode = 'P0001';
    end if;

    if coalesce(p_weekly_topup, v_series.weekly_topup) < 0 then
      raise exception 'Weekly top-up cannot be negative' using errcode = 'P0001';
    end if;
  end if;

  update public.series
  set
    title = trim(p_title),
    description = nullif(trim(coalesce(p_description, '')), ''),
    expected_games = p_expected_games,
    starting_stack = coalesce(p_starting_stack, starting_stack),
    weekly_topup = coalesce(p_weekly_topup, weekly_topup),
    min_bets_to_rank = coalesce(p_min_bets_to_rank, min_bets_to_rank)
  where id = p_series_id
  returning * into v_series;

  -- No bets yet, so every wallet is still untouched: reissue it with the new settings.
  if v_points_changed then
    update public.series_wallets
    set balance = v_series.starting_stack + v_series.weekly_topup * v_series.topups_paid,
        granted = v_series.starting_stack + v_series.weekly_topup * v_series.topups_paid,
        updated_at = now()
    where series_id = p_series_id;
  end if;

  return row_to_json(v_series);
end;
$$;

-- The series list shows the ranking bar.
create or replace view public.series_with_stats
with (security_invoker = true) as
with series_prediction_stats as (
  select
    p.series_id,
    count(*)::int as total_predictions,
    count(*) filter (where p.status in ('draft', 'locked'))::int as active_predictions,
    count(*) filter (where p.status in ('revealed', 'no_result'))::int as completed_predictions,
    count(*) filter (where p.status = 'cancelled')::int as cancelled_predictions
  from public.predictions p
  where p.series_id is not null
  group by p.series_id
)
select
  s.id,
  s.room_id,
  s.title,
  s.description,
  s.status,
  s.expected_games,
  coalesce(sps.total_predictions, 0) as prediction_count,
  coalesce(sps.completed_predictions, 0) as completed_games,
  coalesce(sps.total_predictions, 0) as total_predictions,
  coalesce(sps.active_predictions, 0) as active_predictions,
  coalesce(sps.completed_predictions, 0) as completed_predictions,
  coalesce(sps.cancelled_predictions, 0) as cancelled_predictions,
  greatest(s.expected_games - coalesce(sps.completed_predictions, 0), 0) as remaining_games,
  case
    when s.expected_games > 0 then least(round((coalesce(sps.completed_predictions, 0)::numeric / s.expected_games::numeric) * 100, 2), 100)
    else 0::numeric
  end as progress_percentage,
  s.created_by,
  s.created_at,
  s.started_at,
  s.completed_at,
  s.archived_at,
  s.starting_stack,
  s.weekly_topup,
  s.topups_paid,
  exists (
    select 1
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = s.id
  ) as has_bets,
  s.min_bets_to_rank
from public.series s
left join series_prediction_stats sps on sps.series_id = s.id;

-- ------------------------------------------------------------
-- 3. Grants
-- ------------------------------------------------------------
revoke execute on function private.series_required_bets(uuid) from public, anon, authenticated;
revoke execute on function public.create_series(uuid, text, text, integer, integer, integer, integer) from public, anon;
revoke execute on function public.update_series(uuid, text, text, integer, integer, integer, integer) from public, anon;
grant execute on function public.create_series(uuid, text, text, integer, integer, integer, integer) to authenticated;
grant execute on function public.update_series(uuid, text, text, integer, integer, integer, integer) to authenticated;
