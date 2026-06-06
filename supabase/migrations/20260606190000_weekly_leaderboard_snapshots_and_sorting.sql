alter table public.room_members
  add column if not exists peak_prediction_rating integer not null default 1500;

update public.room_members
set peak_prediction_rating = greatest(peak_prediction_rating, prediction_rating);

create index if not exists idx_room_members_room_prediction_rating
on public.room_members (room_id, prediction_rating desc);

grant select (peak_prediction_rating) on public.room_members to anon;
grant select (peak_prediction_rating) on public.room_members to authenticated;

create table if not exists public.room_member_weekly_snapshots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null
    references public.rooms(id)
    on delete cascade,
  player_id uuid not null
    references public.players(id)
    on delete cascade,
  week_start date not null,
  total_won_in_room integer not null,
  prediction_rating integer not null,
  peak_prediction_rating integer not null,
  rated_predictions_count integer not null,
  current_streak integer not null,
  highest_streak integer not null,
  created_at timestamptz not null default now(),
  unique (room_id, player_id, week_start)
);

create index if not exists idx_room_member_weekly_snapshots_room_week
on public.room_member_weekly_snapshots(room_id, week_start);

create index if not exists idx_room_member_weekly_snapshots_player_week
on public.room_member_weekly_snapshots(player_id, week_start);

alter table public.room_member_weekly_snapshots enable row level security;

revoke all on public.room_member_weekly_snapshots from anon;
revoke all on public.room_member_weekly_snapshots from authenticated;

drop policy if exists "room_member_weekly_snapshots_select_room_members" on public.room_member_weekly_snapshots;
create policy "room_member_weekly_snapshots_select_room_members"
  on public.room_member_weekly_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = room_member_weekly_snapshots.room_id
        and rm.player_id = private.get_player_id_from_auth()
    )
  );

drop policy if exists "room_member_weekly_snapshots_no_direct_insert" on public.room_member_weekly_snapshots;
create policy "room_member_weekly_snapshots_no_direct_insert"
  on public.room_member_weekly_snapshots
  for insert
  to authenticated
  with check (false);

drop policy if exists "room_member_weekly_snapshots_no_direct_update" on public.room_member_weekly_snapshots;
create policy "room_member_weekly_snapshots_no_direct_update"
  on public.room_member_weekly_snapshots
  for update
  to authenticated
  using (false);

drop policy if exists "room_member_weekly_snapshots_no_direct_delete" on public.room_member_weekly_snapshots;
create policy "room_member_weekly_snapshots_no_direct_delete"
  on public.room_member_weekly_snapshots
  for delete
  to authenticated
  using (false);

grant select on public.room_member_weekly_snapshots to authenticated;

create or replace function public.create_weekly_room_member_snapshots()
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_start date;
  v_inserted_count integer := 0;
begin
  -- date_trunc('week', ...) uses Monday as the ISO week boundary.
  -- We truncate in UTC to keep snapshot boundaries timezone-stable.
  v_week_start := (date_trunc('week', now() at time zone 'UTC'))::date;

  insert into public.room_member_weekly_snapshots (
    room_id,
    player_id,
    week_start,
    total_won_in_room,
    prediction_rating,
    peak_prediction_rating,
    rated_predictions_count,
    current_streak,
    highest_streak
  )
  select
    rm.room_id,
    rm.player_id,
    v_week_start,
    rm.total_won_in_room,
    rm.prediction_rating,
    rm.peak_prediction_rating,
    rm.rated_predictions_count,
    rm.current_streak,
    rm.highest_streak
  from public.room_members rm
  on conflict (room_id, player_id, week_start) do nothing;

  get diagnostics v_inserted_count = row_count;

  return json_build_object('snapshots_created', v_inserted_count);
end;
$$;

create or replace function private.run_weekly_processing()
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_snapshot_result json;
begin
  -- 1) Snapshot room-member state for weekly movement calculations.
  v_snapshot_result := public.create_weekly_room_member_snapshots();

  -- 2) Run the existing weekly claims processing hook when it exists.
  begin
    execute 'select public.process_weekly_claims()';
  exception
    when undefined_function then
      null;
  end;

  -- 3) Send weekly claim reminder notifications.
  perform private.fire_push_notification(
    'weekly_points_claim',
    null,
    null,
    '💰 Weekly Points Available!',
    'Claim your 100 free points now.',
    '/'
  );

  return json_build_object(
    'snapshots_created',
    coalesce((v_snapshot_result->>'snapshots_created')::integer, 0)
  );
end;
$$;

create or replace function public.update_prediction_ratings(
  p_room_id uuid,
  p_prediction_id uuid,
  p_winning_option_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_prediction public.predictions%rowtype;
  v_config record;
  v_participant record;
  v_member public.room_members%rowtype;

  v_total_predictors integer;
  v_winning_predictors integer;
  v_prediction_popularity numeric;
  v_surprise numeric;
  v_sample_weight numeric;
  v_difficulty numeric;

  v_experience numeric;
  v_effective_k numeric;
  v_change numeric;
  v_rounded_change integer;
  v_new_rating integer;
begin
  select *
  into v_prediction
  from public.predictions
  where id = p_prediction_id
    and room_id = p_room_id;

  if not found then
    raise exception 'Prediction not found for rating update' using errcode = 'P0006';
  end if;

  if not v_prediction.affects_rating then
    return;
  end if;

  if v_prediction.status <> 'revealed' then
    return;
  end if;

  if v_prediction.winning_option_id is distinct from p_winning_option_id then
    raise exception 'Winning option mismatch for rating update' using errcode = 'P0008';
  end if;

  select version, base_k, min_participants
  into v_config
  from public.rating_system_config
  where is_active = true
  order by version desc
  limit 1;

  if not found then
    raise exception 'No active rating system configuration found' using errcode = 'P0001';
  end if;

  select
    count(distinct b.player_id),
    count(distinct case when b.option_id = p_winning_option_id then b.player_id end)
  into v_total_predictors, v_winning_predictors
  from public.bets b
  where b.prediction_id = p_prediction_id;

  if v_total_predictors < v_config.min_participants then
    return;
  end if;

  -- Popular winners imply low surprise; unpopular winners imply upset outcomes.
  v_prediction_popularity := v_winning_predictors::numeric / v_total_predictors::numeric;
  v_surprise := 1 - v_prediction_popularity;

  -- Scale difficulty by participation size so larger samples carry stronger signal.
  v_sample_weight := ln(v_total_predictors::numeric + 1);
  v_difficulty := 1 + (v_surprise * v_sample_weight * 0.5);

  for v_participant in
    select distinct b.player_id, b.option_id
    from public.bets b
    where b.prediction_id = p_prediction_id
  loop
    select *
    into v_member
    from public.room_members
    where room_id = p_room_id
      and player_id = v_participant.player_id
    for update;

    if not found then
      continue;
    end if;

    v_experience := least(
      1.0::numeric,
      v_member.rated_predictions_count::numeric / 100.0
    );

    v_effective_k := v_config.base_k * (0.25 + (0.75 * v_experience));

    if v_participant.option_id = p_winning_option_id then
      v_change := v_effective_k * v_difficulty;
    else
      v_change := -(v_effective_k / v_difficulty);
    end if;

    v_rounded_change := round(v_change)::integer;
    v_new_rating := greatest(0, v_member.prediction_rating + v_rounded_change);

    update public.room_members
    set prediction_rating = v_new_rating,
        peak_prediction_rating = greatest(peak_prediction_rating, v_new_rating),
        rated_predictions_count = rated_predictions_count + 1,
        rating_system_version = v_config.version
    where id = v_member.id;
  end loop;
end;
$$;

drop function if exists public.get_room_leaderboard(uuid);
create or replace function public.get_room_leaderboard(
  p_room_id uuid,
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
  v_result    json;
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

  if p_sort_by not in ('points', 'rating', 'accuracy', 'streak') then
    raise exception 'Invalid sort mode: %', p_sort_by using errcode = 'P0001';
  end if;

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
      rm.prediction_rating,
      rm.peak_prediction_rating,
      rm.rated_predictions_count,
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
          case when p_sort_by = 'points' then rm.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' and coalesce(s.total_revealed_bets, 0) > 0
            then (coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets)
          end desc nulls last,
          case when p_sort_by = 'rating' then rm.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then rm.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' and coalesce(s.total_revealed_bets, 0) > 0
            then (coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets)
          end desc nulls last,
          case when p_sort_by = 'accuracy' then coalesce(s.total_revealed_bets, 0) end desc nulls last,
          case when p_sort_by = 'streak' then rm.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then rm.highest_streak end desc nulls last,
          rm.joined_at asc
      ) as rank
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join (
      select
        b.player_id,
        count(*) as total_bets,
        count(*) filter (where pred.status = 'revealed') as total_revealed_bets,
        count(*) filter (
          where pred.status = 'revealed'
            and b.option_id = pred.winning_option_id
        ) as winning_bets,
        sum(b.amount) as total_wagered,
        sum(coalesce(b.payout, 0)) as total_payout
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

drop function if exists public.get_room_weekly_leaderboard(uuid);
create or replace function public.get_room_weekly_leaderboard(
  p_room_id uuid,
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

  if p_sort_by not in ('points', 'rating', 'accuracy', 'streak') then
    raise exception 'Invalid sort mode: %', p_sort_by using errcode = 'P0001';
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
      rm.prediction_rating,
      rm.peak_prediction_rating,
      rm.rated_predictions_count,
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
          case when p_sort_by = 'points' then coalesce(s.weekly_total_won, 0) end desc nulls last,
          case when p_sort_by = 'points' and coalesce(s.total_revealed_bets, 0) > 0
            then (coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets)
          end desc nulls last,
          case when p_sort_by = 'rating' then rm.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then rm.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' and coalesce(s.total_revealed_bets, 0) > 0
            then (coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets)
          end desc nulls last,
          case when p_sort_by = 'accuracy' then coalesce(s.total_revealed_bets, 0) end desc nulls last,
          case when p_sort_by = 'streak' then rm.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then rm.highest_streak end desc nulls last,
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

grant execute on function public.get_room_leaderboard(uuid, text) to authenticated;
grant execute on function public.get_room_weekly_leaderboard(uuid, text) to authenticated;

-- Weekly cron integration (run once manually after enabling pg_cron):
-- select cron.schedule(
--   'run-weekly-processing',
--   '0 8 * * 1',
--   $cron$
--     select private.run_weekly_processing();
--   $cron$
-- );
