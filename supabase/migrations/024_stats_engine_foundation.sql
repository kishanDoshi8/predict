-- ============================================================
-- Migration: 024_stats_engine_foundation
-- Description:
--   Foundational room/player stats infrastructure with
--   centralized stat update services and backend-driven
--   dashboard stat cards.
-- ============================================================

alter table public.room_members
  add column if not exists current_streak integer not null default 0 check (current_streak >= 0),
  add column if not exists highest_streak integer not null default 0 check (highest_streak >= 0);

comment on column public.room_members.current_streak is
  'Current consecutive wins for this player in this room. Updated by centralized stats services on resolution.';
comment on column public.room_members.highest_streak is
  'Highest consecutive wins ever reached by this player in this room.';

create table if not exists public.room_stats (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  stat_key        text not null,
  stat_value_json jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (room_id, stat_key)
);

create table if not exists public.player_room_stats (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  user_id         uuid not null references public.players(id) on delete cascade,
  stat_key        text not null,
  stat_value_json jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (room_id, user_id, stat_key)
);

create index if not exists idx_room_stats_room_key
  on public.room_stats (room_id, stat_key);

create index if not exists idx_player_room_stats_room_user_key
  on public.player_room_stats (room_id, user_id, stat_key);

create index if not exists idx_player_room_stats_room_key
  on public.player_room_stats (room_id, stat_key);

do $$
begin
  alter publication supabase_realtime add table public.room_stats;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.player_room_stats;
exception when duplicate_object then null;
end $$;

create or replace function private.upsert_room_stat(
  p_room_id uuid,
  p_stat_key text,
  p_stat_value jsonb
)
returns void
language plpgsql
set search_path = public, private
as $$
begin
  insert into public.room_stats (room_id, stat_key, stat_value_json)
  values (p_room_id, p_stat_key, p_stat_value)
  on conflict (room_id, stat_key)
  do update
  set stat_value_json = excluded.stat_value_json,
      updated_at = now();
end;
$$;

create or replace function private.upsert_player_room_stat(
  p_room_id uuid,
  p_user_id uuid,
  p_stat_key text,
  p_stat_value jsonb
)
returns void
language plpgsql
set search_path = public, private
as $$
begin
  insert into public.player_room_stats (room_id, user_id, stat_key, stat_value_json)
  values (p_room_id, p_user_id, p_stat_key, p_stat_value)
  on conflict (room_id, user_id, stat_key)
  do update
  set stat_value_json = excluded.stat_value_json,
      updated_at = now();
end;
$$;

create or replace function private.refresh_room_featured_streaks(
  p_room_id uuid
)
returns void
language plpgsql
set search_path = public, private
as $$
declare
  v_current record;
  v_highest record;
begin
  select
    prs.user_id,
    p.username,
    coalesce((prs.stat_value_json ->> 'streak')::integer, 0) as streak
  into v_current
  from public.player_room_stats prs
  join public.players p on p.id = prs.user_id
  where prs.room_id = p_room_id
    and prs.stat_key = 'current_streak'
  order by
    coalesce((prs.stat_value_json ->> 'streak')::integer, 0) desc,
    p.username asc
  limit 1;

  if found and v_current.streak > 0 then
    perform private.upsert_room_stat(
      p_room_id,
      'current_streak',
      jsonb_build_object(
        'streak', v_current.streak,
        'user_id', v_current.user_id,
        'username', v_current.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'current_streak';
  end if;

  select
    prs.user_id,
    p.username,
    coalesce((prs.stat_value_json ->> 'streak')::integer, 0) as streak
  into v_highest
  from public.player_room_stats prs
  join public.players p on p.id = prs.user_id
  where prs.room_id = p_room_id
    and prs.stat_key = 'highest_streak'
  order by
    coalesce((prs.stat_value_json ->> 'streak')::integer, 0) desc,
    p.username asc
  limit 1;

  if found and v_highest.streak > 0 then
    perform private.upsert_room_stat(
      p_room_id,
      'highest_streak',
      jsonb_build_object(
        'streak', v_highest.streak,
        'user_id', v_highest.user_id,
        'username', v_highest.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'highest_streak';
  end if;
end;
$$;

create or replace function public.update_streaks_after_resolution(
  p_room_id uuid,
  p_prediction_id uuid,
  p_winning_option_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_outcome <> 'win' or p_winning_option_id is null then
    return;
  end if;

  update public.room_members rm
  set current_streak = rm.current_streak + 1,
      highest_streak = greatest(rm.highest_streak, rm.current_streak + 1)
  where rm.room_id = p_room_id
    and exists (
      select 1
      from public.bets b
      where b.prediction_id = p_prediction_id
        and b.player_id = rm.player_id
        and b.option_id = p_winning_option_id
    );

  update public.room_members rm
  set current_streak = 0
  where rm.room_id = p_room_id
    and exists (
      select 1
      from public.bets b
      where b.prediction_id = p_prediction_id
        and b.player_id = rm.player_id
        and b.option_id <> p_winning_option_id
    );
end;
$$;

create or replace function public.update_player_stats_after_resolution(
  p_room_id uuid,
  p_prediction_id uuid,
  p_winning_option_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform public.update_streaks_after_resolution(
    p_room_id,
    p_prediction_id,
    p_winning_option_id,
    p_outcome
  );

  insert into public.player_room_stats (room_id, user_id, stat_key, stat_value_json)
  select
    rm.room_id,
    rm.player_id,
    'current_streak',
    jsonb_build_object(
      'streak', rm.current_streak,
      'user_id', rm.player_id,
      'username', p.username
    )
  from public.room_members rm
  join public.players p on p.id = rm.player_id
  where rm.room_id = p_room_id
  on conflict (room_id, user_id, stat_key)
  do update
  set stat_value_json = excluded.stat_value_json,
      updated_at = now();

  insert into public.player_room_stats (room_id, user_id, stat_key, stat_value_json)
  select
    rm.room_id,
    rm.player_id,
    'highest_streak',
    jsonb_build_object(
      'streak', rm.highest_streak,
      'user_id', rm.player_id,
      'username', p.username
    )
  from public.room_members rm
  join public.players p on p.id = rm.player_id
  where rm.room_id = p_room_id
  on conflict (room_id, user_id, stat_key)
  do update
  set stat_value_json = excluded.stat_value_json,
      updated_at = now();

  perform private.refresh_room_featured_streaks(p_room_id);
end;
$$;

create or replace function public.update_room_stats_after_resolution(
  p_room_id uuid,
  p_prediction_id uuid,
  p_winning_option_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_biggest_bet record;
  v_biggest_win record;
  v_most_profit record;
begin
  select
    b.amount,
    pred.id as prediction_id,
    b.player_id as user_id,
    p.username
  into v_biggest_bet
  from public.bets b
  join public.predictions pred on pred.id = b.prediction_id
  join public.players p on p.id = b.player_id
  where pred.room_id = p_room_id
    and pred.status in ('revealed', 'cancelled', 'no_result')
  order by b.amount desc, b.placed_at asc, b.id asc
  limit 1;

  if found then
    perform private.upsert_room_stat(
      p_room_id,
      'biggest_bet',
      jsonb_build_object(
        'amount', v_biggest_bet.amount,
        'prediction_id', v_biggest_bet.prediction_id,
        'user_id', v_biggest_bet.user_id,
        'username', v_biggest_bet.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'biggest_bet';
  end if;

  select
    greatest(coalesce(b.payout, 0) - b.amount, 0) as amount,
    pred.id as prediction_id,
    b.player_id as user_id,
    p.username
  into v_biggest_win
  from public.bets b
  join public.predictions pred on pred.id = b.prediction_id
  join public.players p on p.id = b.player_id
  where pred.room_id = p_room_id
    and pred.status = 'revealed'
  order by amount desc, pred.resolved_at asc nulls last, b.id asc
  limit 1;

  if found and v_biggest_win.amount > 0 then
    perform private.upsert_room_stat(
      p_room_id,
      'biggest_win',
      jsonb_build_object(
        'amount', v_biggest_win.amount,
        'prediction_id', v_biggest_win.prediction_id,
        'user_id', v_biggest_win.user_id,
        'username', v_biggest_win.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'biggest_win';
  end if;

  select
    b.player_id as user_id,
    p.username,
    sum(greatest(coalesce(b.payout, 0) - b.amount, 0))::bigint as amount
  into v_most_profit
  from public.bets b
  join public.predictions pred on pred.id = b.prediction_id
  join public.players p on p.id = b.player_id
  where pred.room_id = p_room_id
    and pred.status = 'revealed'
  group by b.player_id, p.username
  order by amount desc, p.username asc
  limit 1;

  if found and v_most_profit.amount > 0 then
    perform private.upsert_room_stat(
      p_room_id,
      'most_profit',
      jsonb_build_object(
        'amount', v_most_profit.amount,
        'user_id', v_most_profit.user_id,
        'username', v_most_profit.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'most_profit';
  end if;
end;
$$;

create or replace function public.get_room_stat_cards(
  p_room_id uuid,
  p_limit int default 5
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_cards json;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  p_limit := greatest(1, least(p_limit, 10));

  select json_agg(c.card order by (c.card ->> 'priority')::int asc)
  into v_cards
  from (
    select
      json_build_object(
        'key', rs.stat_key,
        'title',
          case rs.stat_key
            when 'current_streak' then 'Win Streak'
            when 'highest_streak' then 'Best Streak'
            when 'biggest_win' then 'Biggest Win'
            when 'biggest_bet' then 'Biggest Bet'
            when 'most_profit' then 'Most Profit'
            else initcap(replace(rs.stat_key, '_', ' '))
          end,
        'value',
          case rs.stat_key
            when 'current_streak' then format('%s Win Streak', coalesce((rs.stat_value_json ->> 'streak')::int, 0))
            when 'highest_streak' then format('%s Highest', coalesce((rs.stat_value_json ->> 'streak')::int, 0))
            else format('%s pts', to_char(coalesce((rs.stat_value_json ->> 'amount')::numeric, 0), 'FM999G999G999G999'))
          end,
        'subtitle',
          case
            when rs.stat_key in ('current_streak', 'highest_streak')
              then coalesce(rs.stat_value_json ->> 'username', '')
            when rs.stat_key in ('biggest_win', 'biggest_bet', 'most_profit')
              then coalesce(rs.stat_value_json ->> 'username', '')
            else null
          end,
        'icon',
          case rs.stat_key
            when 'current_streak' then '🔥'
            when 'highest_streak' then '🏅'
            when 'biggest_win' then '💰'
            when 'biggest_bet' then '🎯'
            when 'most_profit' then '📈'
            else '⭐'
          end,
        'priority',
          case rs.stat_key
            when 'current_streak' then 10
            when 'highest_streak' then 20
            when 'biggest_win' then 30
            when 'biggest_bet' then 40
            when 'most_profit' then 50
            else 100
          end
      ) as card
    from public.room_stats rs
    where rs.room_id = p_room_id
      and rs.stat_key in ('current_streak', 'highest_streak', 'biggest_win', 'biggest_bet', 'most_profit')
    order by
      case rs.stat_key
        when 'current_streak' then 10
        when 'highest_streak' then 20
        when 'biggest_win' then 30
        when 'biggest_bet' then 40
        when 'most_profit' then 50
        else 100
      end,
      rs.stat_key
    limit p_limit
  ) c;

  return coalesce(v_cards, '[]'::json);
end;
$$;

grant execute on function public.update_streaks_after_resolution(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.update_player_stats_after_resolution(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.update_room_stats_after_resolution(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.get_room_stat_cards(uuid, int) to authenticated;

create or replace function public.resolve_prediction_v2(
  p_prediction_id     uuid,
  p_room_id           uuid,
  p_outcome           text,
  p_winning_option_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id         uuid;
  v_prediction        public.predictions%rowtype;
  v_winning_option    public.prediction_options%rowtype;

  v_total_winner_cap  numeric;
  v_loser             record;
  v_winner            record;
  v_winner_gain       integer;
  v_loser_refund      integer;
  v_final_payout      integer;
  v_winners_count     integer := 0;
  v_losers_count      integer := 0;
  v_multiple_sides    boolean;
  v_effective_outcome text;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and player_id = v_player_id
      and is_organizer = true
  ) then
    raise exception 'Only the room organizer can resolve predictions' using errcode = 'P0012';
  end if;

  select * into v_prediction
  from public.predictions
  where id      = p_prediction_id
    and room_id = p_room_id
    and status  = 'locked';

  if not found then
    raise exception 'Prediction not found or not in locked phase' using errcode = 'P0006';
  end if;

  if p_outcome in ('no_result', 'cancel') then
    perform private.refund_all_bets_v2(p_prediction_id);

    v_effective_outcome := case
      when p_outcome = 'cancel' then 'cancelled'
      else p_outcome
    end;

    update public.predictions
    set status      = v_effective_outcome,
        resolved_at = now()
    where id = p_prediction_id;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      v_effective_outcome
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      v_effective_outcome
    );

    return json_build_object(
      'resolved', true,
      'outcome',  v_effective_outcome,
      'refunded', true
    );
  end if;

  if p_outcome <> 'win' then
    raise exception 'Invalid outcome. Must be win, no_result, or cancel.' using errcode = 'P0001';
  end if;

  if p_winning_option_id is null then
    raise exception 'p_winning_option_id is required for a win outcome' using errcode = 'P0001';
  end if;

  select * into v_winning_option
  from public.prediction_options
  where id            = p_winning_option_id
    and prediction_id = p_prediction_id;

  if not found then
    raise exception 'Winning option does not belong to this prediction' using errcode = 'P0008';
  end if;

  select count(distinct option_id) > 1 into v_multiple_sides
  from public.bets
  where prediction_id = p_prediction_id;

  if not v_multiple_sides then
    perform private.refund_all_bets_v2(p_prediction_id);

    update public.predictions
    set status = 'no_result',
        resolved_at = now()
    where id = p_prediction_id;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    return json_build_object(
      'resolved', true,
      'outcome', 'no_result',
      'reason', 'Only one option had bets — all refunded',
      'refunded', true
    );
  end if;

  if v_winning_option.total_bet = 0 then
    perform private.refund_all_bets_v2(p_prediction_id);

    update public.predictions
    set status = 'no_result',
        resolved_at = now()
    where id = p_prediction_id;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    return json_build_object(
      'resolved', true,
      'outcome', 'no_result',
      'reason', 'Nobody bet on the winning option — all refunded',
      'refunded', true
    );
  end if;

  select sum(amount)::numeric into v_total_winner_cap
  from public.bets
  where prediction_id = p_prediction_id
    and option_id     = p_winning_option_id;

  create temp table _winner_gains (
    player_id  uuid    primary key,
    bet_amount integer not null,
    total_gain integer not null default 0
  ) on commit drop;

  insert into _winner_gains (player_id, bet_amount)
  select player_id, amount
  from public.bets
  where prediction_id = p_prediction_id
    and option_id     = p_winning_option_id;

  for v_loser in
    select b.id as bet_id, b.player_id, b.amount
    from public.bets b
    where b.prediction_id = p_prediction_id
      and b.option_id    <> p_winning_option_id
  loop
    if v_loser.amount::numeric >= v_total_winner_cap then
      v_loser_refund := v_loser.amount - v_total_winner_cap::integer;
      for v_winner in select player_id, bet_amount from _winner_gains loop
        update _winner_gains
        set total_gain = total_gain + v_winner.bet_amount
        where player_id = v_winner.player_id;
      end loop;
    else
      v_loser_refund := 0;
      for v_winner in select player_id, bet_amount from _winner_gains loop
        v_winner_gain := floor(
          (v_winner.bet_amount::numeric / v_total_winner_cap) * v_loser.amount::numeric
        );

        update _winner_gains
        set total_gain = total_gain + v_winner_gain
        where player_id = v_winner.player_id;
      end loop;
    end if;

    update public.players
    set points_in_escrow = points_in_escrow - v_loser.amount,
        points_balance   = points_balance   - v_loser.amount + v_loser_refund
    where id = v_loser.player_id;

    update public.bets
    set payout = v_loser_refund
    where id = v_loser.bet_id;

    v_losers_count := v_losers_count + 1;
  end loop;

  for v_winner in select player_id, bet_amount, total_gain from _winner_gains loop
    v_final_payout := v_winner.bet_amount + v_winner.total_gain;

    update public.players
    set points_in_escrow = points_in_escrow - v_winner.bet_amount,
        points_balance   = points_balance   + v_final_payout,
        total_won        = total_won        + v_winner.total_gain
    where id = v_winner.player_id;

    update public.room_members
    set total_won_in_room = total_won_in_room + v_winner.total_gain
    where room_id   = v_prediction.room_id
      and player_id = v_winner.player_id;

    update public.bets
    set payout = v_final_payout
    where prediction_id = p_prediction_id
      and player_id     = v_winner.player_id;

    v_winners_count := v_winners_count + 1;
  end loop;

  update public.predictions
  set status            = 'revealed',
      winning_option_id = p_winning_option_id,
      resolved_at       = now()
  where id = p_prediction_id;

  perform public.update_player_stats_after_resolution(
    p_room_id,
    p_prediction_id,
    p_winning_option_id,
    'win'
  );

  perform public.update_room_stats_after_resolution(
    p_room_id,
    p_prediction_id,
    p_winning_option_id,
    'win'
  );

  return json_build_object(
    'resolved',          true,
    'outcome',           'revealed',
    'winning_option_id', p_winning_option_id,
    'winning_label',     v_winning_option.label,
    'winners',           v_winners_count,
    'losers',            v_losers_count
  );
end;
$$;

grant execute on function public.resolve_prediction_v2(uuid, uuid, text, uuid) to authenticated;
