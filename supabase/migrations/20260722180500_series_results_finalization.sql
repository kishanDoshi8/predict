alter table public.series
  add column if not exists minimum_predictions_for_awards integer not null default 3 check (minimum_predictions_for_awards >= 0);

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'series_award_type'
      and n.nspname = 'public'
  ) then
    create type public.series_award_type as enum (
      'LONGEST_STREAK',
      'BIGGEST_PROFIT',
      'MOST_DUEL_WINS',
      'MOST_POINTS_RISKED',
      'EVER_PRESENT'
    );
  end if;
end $$;

create table if not exists public.series_placements (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  placement integer not null check (placement in (1, 2, 3)),
  points numeric not null,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (series_id, player_id)
);

create index if not exists idx_series_placements_series_placement
  on public.series_placements(series_id, placement, created_at asc);

create table if not exists public.series_awards (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  award_type public.series_award_type not null,
  value numeric not null,
  description text not null,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (series_id, award_type, player_id)
);

create index if not exists idx_series_awards_series_type
  on public.series_awards(series_id, award_type, created_at asc);

create or replace function private.prevent_series_result_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'Series results are immutable once generated' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_series_placements_immutable on public.series_placements;
create trigger trg_series_placements_immutable
before update or delete on public.series_placements
for each row execute function private.prevent_series_result_mutation();

drop trigger if exists trg_series_awards_immutable on public.series_awards;
create trigger trg_series_awards_immutable
before update or delete on public.series_awards
for each row execute function private.prevent_series_result_mutation();

alter table public.series_placements enable row level security;
revoke all on public.series_placements from anon;
drop policy if exists "series_placements_select" on public.series_placements;
create policy "series_placements_select" on public.series_placements for select using (true);
drop policy if exists "series_placements_no_direct_write" on public.series_placements;
create policy "series_placements_no_direct_write" on public.series_placements for insert with check (false);
drop policy if exists "series_placements_no_direct_update" on public.series_placements;
create policy "series_placements_no_direct_update" on public.series_placements for update using (false);
drop policy if exists "series_placements_no_direct_delete" on public.series_placements;
create policy "series_placements_no_direct_delete" on public.series_placements for delete using (false);
grant select (id, series_id, player_id, placement, points, collected_at, created_at) on public.series_placements to anon;
grant select (id, series_id, player_id, placement, points, collected_at, created_at) on public.series_placements to authenticated;

alter table public.series_awards enable row level security;
revoke all on public.series_awards from anon;
drop policy if exists "series_awards_select" on public.series_awards;
create policy "series_awards_select" on public.series_awards for select using (true);
drop policy if exists "series_awards_no_direct_write" on public.series_awards;
create policy "series_awards_no_direct_write" on public.series_awards for insert with check (false);
drop policy if exists "series_awards_no_direct_update" on public.series_awards;
create policy "series_awards_no_direct_update" on public.series_awards for update using (false);
drop policy if exists "series_awards_no_direct_delete" on public.series_awards;
create policy "series_awards_no_direct_delete" on public.series_awards for delete using (false);
grant select (id, series_id, player_id, award_type, value, description, collected_at, created_at) on public.series_awards to anon;
grant select (id, series_id, player_id, award_type, value, description, collected_at, created_at) on public.series_awards to authenticated;

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
  v_minimum_predictions integer;
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

  v_minimum_predictions := coalesce(v_series.minimum_predictions_for_awards, 3);

  select count(*)::int
  into v_completed_predictions
  from public.predictions p
  where p.series_id = p_series_id
    and p.status in ('revealed', 'no_result');

  insert into public.series_placements (series_id, player_id, placement, points)
  with leaderboard as (
    select
      rm.player_id,
      coalesce(stats.net_profit, 0)::numeric as net_profit
    from public.room_members rm
    left join private.get_leaderboard_player_stats(
      v_series.room_id,
      p_series_id,
      false
    ) stats on stats.player_id = rm.player_id
    where rm.room_id = v_series.room_id
  ),
  ranked as (
    select
      l.player_id,
      l.net_profit,
      rank() over (order by l.net_profit desc) as placement
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
    join series_predictions sp on sp.id = b.prediction_id
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
    select p.id
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp on sp.id = b.prediction_id
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
    select p.id
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp on sp.id = b.prediction_id
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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

create or replace function public.get_series_placements(
  p_room_id uuid,
  p_series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_result json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Room member not found' using errcode = 'P0011';
  end if;

  if not exists (
    select 1
    from public.series s
    where s.id = p_series_id
      and s.room_id = p_room_id
      and s.status in ('completed', 'archived')
  ) then
    raise exception 'Series results are not available yet' using errcode = 'P0002';
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'id', sp.id,
        'series_id', sp.series_id,
        'player_id', sp.player_id,
        'username', p.username,
        'placement', sp.placement,
        'points', sp.points,
        'collected_at', sp.collected_at,
        'created_at', sp.created_at
      )
      order by sp.placement asc, sp.points desc, p.username asc
    ),
    '[]'::json
  )
  into v_result
  from public.series_placements sp
  join public.players p on p.id = sp.player_id
  where sp.series_id = p_series_id;

  return v_result;
end;
$$;

create or replace function public.get_series_awards(
  p_room_id uuid,
  p_series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_result json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Room member not found' using errcode = 'P0011';
  end if;

  if not exists (
    select 1
    from public.series s
    where s.id = p_series_id
      and s.room_id = p_room_id
      and s.status in ('completed', 'archived')
  ) then
    raise exception 'Series results are not available yet' using errcode = 'P0002';
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'id', sa.id,
        'series_id', sa.series_id,
        'player_id', sa.player_id,
        'username', p.username,
        'award_type', sa.award_type,
        'value', sa.value,
        'description', sa.description,
        'collected_at', sa.collected_at,
        'created_at', sa.created_at
      )
      order by sa.award_type asc, sa.value desc, p.username asc
    ),
    '[]'::json
  )
  into v_result
  from public.series_awards sa
  join public.players p on p.id = sa.player_id
  where sa.series_id = p_series_id;

  return v_result;
end;
$$;

grant execute on function public.complete_series(uuid) to authenticated;
grant execute on function public.get_series_placements(uuid, uuid) to authenticated;
grant execute on function public.get_series_awards(uuid, uuid) to authenticated;
