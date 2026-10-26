-- ============================================================
-- Migration: weekly_standings
-- Description: Weekly rank movement for series. Every Monday, just before
--   top-ups, each active series' standings are snapshotted. The series
--   leaderboard reports movement since that snapshot, and a weekly recap
--   (last week's top 5, biggest climber and faller) feeds the share card.
--   Removes the rating-era room snapshot system it replaces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Remove the rating-era weekly snapshots
-- ------------------------------------------------------------
-- Older setups scheduled this job by hand (see README history).
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'run-weekly-processing';
end $$;

do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in (
            'get_room_weekly_leaderboard',
            'get_room_leaderboard',
            'create_weekly_room_member_snapshots',
            'get_latest_room_member_snapshot'))
       or (n.nspname = 'private' and p.proname = 'run_weekly_processing')
  loop
    execute 'drop function ' || v_fn;
  end loop;
end $$;

drop table if exists public.room_member_weekly_snapshots;

-- ------------------------------------------------------------
-- 2. Series standing snapshots
-- ------------------------------------------------------------
-- One row per member per week: where they stood when week_key began, i.e.
-- the final standings of the week before.
create table if not exists public.series_standing_snapshots (
  series_id  uuid not null references public.series(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  week_key   text not null,
  rank       integer,
  is_ranked  boolean not null,
  balance    integer not null,
  created_at timestamptz not null default now(),
  primary key (series_id, player_id, week_key)
);

-- Read only through get_series_leaderboard and get_series_weekly_recap.
alter table public.series_standing_snapshots enable row level security;
revoke all on public.series_standing_snapshots from anon, authenticated;

-- A series' points standings: ranked players by balance, then winning bets,
-- then who joined first. Same rule as get_series_leaderboard's points sort
-- (tests keep the two in step). Unranked players get a null rank.
create or replace function private.series_standings(
  p_series_id uuid
)
returns table (
  player_id uuid,
  rank integer,
  is_ranked boolean,
  balance integer
)
language sql
stable
security definer
set search_path = public, private
as $$
  with series as (
    select s.id, s.room_id, s.starting_stack, private.series_required_bets(s.id) as required
    from public.series s
    where s.id = p_series_id
  ),
  stats as (
    select st.*
    from series se
    cross join lateral private.get_leaderboard_player_stats(se.room_id, se.id, false) st
  ),
  members as (
    select
      rm.player_id,
      rm.joined_at,
      coalesce(w.balance, se.starting_stack + coalesce(st.net_profit, 0)::int) as balance,
      coalesce(st.winning_bets, 0) as winning_bets,
      coalesce(st.total_bets, 0) >= se.required as is_ranked
    from series se
    join public.room_members rm on rm.room_id = se.room_id
    left join stats st on st.player_id = rm.player_id
    left join public.series_wallets w on w.series_id = se.id and w.player_id = rm.player_id
  )
  select
    m.player_id,
    case when m.is_ranked then (rank() over (
      partition by m.is_ranked
      order by m.balance desc, m.winning_bets desc, m.joined_at asc
    ))::int end as rank,
    m.is_ranked,
    m.balance
  from members m;
$$;

-- Monday cron, just before top-ups: record every active series' standings
-- as they stood when the week ended. Safe to run twice in a week.
create or replace function private.snapshot_series_standings()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_key text := private.current_week_key();
  v_series   record;
  v_count    integer := 0;
begin
  for v_series in
    select s.id from public.series s where s.status = 'active'
  loop
    insert into public.series_standing_snapshots (series_id, player_id, week_key, rank, is_ranked, balance)
    select v_series.id, st.player_id, v_week_key, st.rank, st.is_ranked, st.balance
    from private.series_standings(v_series.id) st
    on conflict (series_id, player_id, week_key) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- The last completed week of a series for the weekly share card: the top 5
-- and the biggest climber and faller, comparing the latest Monday snapshot
-- with the one before. Null until the first snapshot.
create or replace function public.get_series_weekly_recap(
  p_room_id   uuid,
  p_series_id uuid
)
returns json
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_caller_id   uuid;
  v_latest      text;
  v_previous    text;
  v_week_number integer;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  if not exists (
    select 1 from public.series where id = p_series_id and room_id = p_room_id
  ) then
    raise exception 'Series not found for this room' using errcode = 'P0002';
  end if;

  -- Week keys look like 2026-W44, so text order is time order.
  select max(week_key), count(distinct week_key)::int
  into v_latest, v_week_number
  from public.series_standing_snapshots
  where series_id = p_series_id;

  if v_latest is null then
    return null;
  end if;

  select max(week_key) into v_previous
  from public.series_standing_snapshots
  where series_id = p_series_id and week_key < v_latest;

  return (
    with latest as (
      select s.player_id, s.rank, s.balance
      from public.series_standing_snapshots s
      where s.series_id = p_series_id and s.week_key = v_latest and s.rank is not null
    ),
    previous as (
      select s.player_id, s.rank
      from public.series_standing_snapshots s
      where s.series_id = p_series_id and s.week_key = v_previous and s.rank is not null
    ),
    moves as (
      select
        l.player_id,
        p.username,
        l.rank,
        l.balance,
        pv.rank - l.rank as rank_change,
        v_previous is not null and pv.rank is null as is_new
      from latest l
      join public.players p on p.id = l.player_id
      left join previous pv on pv.player_id = l.player_id
    )
    select json_build_object(
      'week_key', v_latest,
      'week_number', v_week_number,
      'has_previous', v_previous is not null,
      'standings', coalesce((
        select json_agg(json_build_object(
          'rank', m.rank,
          'username', m.username,
          'balance', m.balance,
          'rank_change', m.rank_change,
          'is_new', m.is_new
        ) order by m.rank, m.username)
        from (select * from moves order by rank, username limit 5) m
      ), '[]'::json),
      'climber', (
        select json_build_object('username', m.username, 'rank', m.rank, 'rank_change', m.rank_change)
        from moves m
        where m.rank_change > 0
        order by m.rank_change desc, m.rank
        limit 1
      ),
      'faller', (
        select json_build_object('username', m.username, 'rank', m.rank, 'rank_change', m.rank_change)
        from moves m
        where m.rank_change < 0
        order by m.rank_change asc, m.rank
        limit 1
      )
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- 3. Leaderboard movement since Monday
-- ------------------------------------------------------------
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
  v_week_key text := private.current_week_key();
  v_has_snapshot boolean;
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

  -- Movement is measured against this week's Monday snapshot.
  select exists (
    select 1 from public.series_standing_snapshots
    where series_id = p_series_id and week_key = v_week_key
  ) into v_has_snapshot;

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
      -- Movement since Monday, for the points standings only.
      case when p_sort_by = 'points' then snap.rank end as previous_rank,
      case
        when p_sort_by = 'points' and r.rank is not null and snap.rank is not null
          then snap.rank - r.rank
      end as rank_change,
      -- Ranked now but not on Monday (joined late or just reached the bar).
      (p_sort_by = 'points' and v_has_snapshot and r.rank is not null
        and not coalesce(snap.is_ranked, false)) as rank_is_new,
      null::numeric as previous_prediction_rating,
      null::numeric as rating_change,
      null::numeric as previous_total_won_in_room,
      null::numeric as points_change
    from ranked r
    left join public.series_standing_snapshots snap
      on snap.series_id = p_series_id
     and snap.player_id = r.player_id
     and snap.week_key = v_week_key
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ------------------------------------------------------------
-- 4. Grants
-- ------------------------------------------------------------
revoke execute on function private.series_standings(uuid) from public, anon, authenticated;
revoke execute on function private.snapshot_series_standings() from public, anon, authenticated;
revoke execute on function public.get_series_weekly_recap(uuid, uuid) from public, anon;
grant execute on function public.get_series_weekly_recap(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. Monday job: snapshot standings, then pay top-ups
-- ------------------------------------------------------------
-- Same job and time as before; the snapshot runs first so it captures the
-- week as it ended, before top-ups move balances.
select cron.schedule(
  'series-weekly-topup',
  '5 0 * * 1',
  $$select private.snapshot_series_standings(); select private.pay_series_topups()$$
);
